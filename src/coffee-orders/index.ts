import { DurableContext, withDurableExecution, createRetryStrategy } from "aws-durable-execution-sdk-js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { OrderRecord, EventConfig, CancelledBy } from "./types";
import { parseCallbackResult, getTimestamp, publishToAppSync } from "./utils";

// ========== AWS CLIENTS ==========
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-south-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ========== ENVIRONMENT VARIABLES ==========
const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME!;
const CONFIG_TABLE_NAME = process.env.CONFIG_TABLE_NAME!;
const APPSYNC_HTTP_ENDPOINT = process.env.APPSYNC_HTTP_ENDPOINT!;

// ========== CONSTANTS ==========
const TIMEOUTS = {
  ACCEPTANCE: 120, // 2 minutes
  COMPLETION: 120, // 2 minutes
} as const;

const CANCELLATION_REASONS = {
  ACCEPTANCE_TIMEOUT: "Acceptance timeout - no barista accepted within 2 minutes",
  COMPLETION_TIMEOUT: "Completion timeout - order not completed within 2 minutes",
  VALIDATION_FAILED: "Validation failed",
  USER_CANCELLED: "Order cancelled",
} as const;

// ========== RETRY STRATEGY ==========
const retryStrategy = createRetryStrategy({
  maxAttempts: 3,
  initialDelay: { seconds: 1 },
  backoffRate: 2.0,
});

// ========== WORKFLOW-SPECIFIC TYPE DEFINITIONS ==========
interface OrderPlacementEvent {
  orderId: string;
  attendeeId: string;
  eventId: string;
  orderDetails: {
    drinkType: string;
    size: string;
    customizations?: string[];
  };
  timestamp: string;
}

interface CallbackResult {
  action?: "ACCEPT" | "CANCEL" | "COMPLETE";
  reason?: string;
  cancelledBy?: string;
  baristaId?: string;
}

interface CancellationResult {
  orderId: string;
  status: "CANCELLED";
  reason: string;
  cancelledBy: CancelledBy;
}

interface CompletionResult {
  orderId: string;
  status: "COMPLETED";
  attendeeId: string;
  eventId: string;
  orderDetails: OrderRecord["orderDetails"];
  baristaId?: string;
  timestamps: {
    placed: string;
    completed: string;
  };
}

// ========== WORKFLOW-SPECIFIC HELPER FUNCTIONS ==========

/**
 * Update DynamoDB status and publish to AppSync
 */
async function updateStatusAndPublish(
  orderId: string,
  status: string,
  eventType: string,
  detail: Record<string, any>,
  timestamp: string,
  updateExpression?: string,
  expressionValues?: Record<string, any>
): Promise<void> {
  // Update DynamoDB
  const baseUpdate = `SET #status = :status, updatedAt = :timestamp`;
  const finalUpdate = updateExpression ? `${baseUpdate}, ${updateExpression}` : baseUpdate;
  
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE_NAME,
      Key: { orderId },
      UpdateExpression: finalUpdate,
      ExpressionAttributeNames: {
        "#status": "status",
        ...(updateExpression?.includes("#timestamps") ? { "#timestamps": "timestamps" } : {}),
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":timestamp": timestamp,
        ...expressionValues,
      },
    })
  );

  // Publish to AppSync for real-time updates
  const eventData = { type: eventType, orderId, timestamp, data: detail };
  const channels = [
    `coffee-ordering/orders/${orderId}`,
    ...(detail.attendeeId ? [`coffee-ordering/attendee/${detail.attendeeId}`] : []),
    ...(status === "QUEUED" ? ["coffee-ordering/barista/queue"] : []),
  ];

  await Promise.all(
    channels.map((channel) => publishToAppSync(channel, eventData, APPSYNC_HTTP_ENDPOINT))
  );
}

/**
 * Handle order cancellation - unified cancellation logic
 */
async function handleCancellation(
  context: DurableContext,
  orderData: OrderRecord,
  reason: string,
  cancelledBy: CancelledBy,
  timestamp: string
): Promise<CancellationResult> {
  await context.step(
    "handle-cancellation",
    async () => {
      await updateStatusAndPublish(
        orderData.orderId,
        "CANCELLED",
        "ORDER_CANCELLED",
        {
          attendeeId: orderData.attendeeId,
          reason,
          cancelledBy,
        },
        timestamp,
        "currentPhase = :phase, activeCallbackId = :null, cancellationReason = :reason, cancelledBy = :cancelledBy, #timestamps.cancelled = :timestamp",
        {
          ":phase": "CANCELLED",
          ":null": null,
          ":reason": reason,
          ":cancelledBy": cancelledBy,
        }
      );

      context.logger.info("Order cancelled", {
        orderId: orderData.orderId,
        reason,
        cancelledBy,
      });
    },
    { retryStrategy }
  );

  return {
    orderId: orderData.orderId,
    status: "CANCELLED",
    reason,
    cancelledBy,
  };
}

/**
 * Update phase and callback tracking in DynamoDB
 */
async function updatePhaseAndCallback(
  orderId: string,
  phase: "WAITING_ACCEPTANCE" | "WAITING_COMPLETION",
  callbackId: string
): Promise<void> {
  const timestamp = getTimestamp();
  
  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE_NAME,
      Key: { orderId },
      UpdateExpression: "SET currentPhase = :phase, activeCallbackId = :callbackId, updatedAt = :timestamp",
      ExpressionAttributeValues: {
        ":phase": phase,
        ":callbackId": callbackId,
        ":timestamp": timestamp,
      },
    })
  );
}

// ========== MAIN HANDLER ==========
export const handler = withDurableExecution(
  async (rawEvent: OrderPlacementEvent | string, context: DurableContext): Promise<CompletionResult | CancellationResult> => {
    // Parse event if it's a string
    const event: OrderPlacementEvent = typeof rawEvent === 'string' ? JSON.parse(rawEvent) : rawEvent;
    
    context.logger.info("Starting coffee order orchestration", { event });

    // ========== STEP 0: GENERATE WORKFLOW TIMESTAMP ==========
    const workflowTimestamp = await context.step("generate-timestamp", async () => {
      return getTimestamp();
    });

    // ========== STEP 1: INITIALIZE ORDER ==========
    const orderData = await context.step(
      "initialize-order",
      async () => {
        const orderId = event.orderId || randomUUID();

        const orderRecord: OrderRecord = {
          orderId,
          attendeeId: event.attendeeId,
          eventId: event.eventId,
          status: "PENDING",
          orderDetails: event.orderDetails,
          executionArn: "", // Looked up dynamically via orderId when needed
          timestamps: { placed: workflowTimestamp },
          createdAt: workflowTimestamp,
          updatedAt: workflowTimestamp,
        };

        await docClient.send(
          new PutCommand({
            TableName: ORDERS_TABLE_NAME,
            Item: orderRecord,
          })
        );

        context.logger.info("Order initialized", { orderId, status: "PENDING" });
        return orderRecord;
      },
      { retryStrategy }
    );

    // ========== STEP 2: PARALLEL VALIDATION DATA FETCH ==========
    context.logger.info("Starting parallel validation", { 
      orderId: orderData.orderId,
      attendeeId: event.attendeeId,
      eventId: event.eventId
    });

    // Capture values for closure
    const attendeeIdForQuery = event.attendeeId;
    const eventIdForQuery = event.eventId;

    const validationResults = await context.parallel(
      "parallel-validation",
      [
        async (ctx) =>
          ctx.step(
            "fetch-event-config",
            async (stepCtx) => {
              stepCtx.logger.info("Fetching event config", {
                eventId: eventIdForQuery,
                tableName: CONFIG_TABLE_NAME
              });
              
              const result = await docClient.send(
                new GetCommand({
                  TableName: CONFIG_TABLE_NAME,
                  Key: { eventId: eventIdForQuery },
                })
              );
              
              stepCtx.logger.info("Event config fetched", {
                found: !!result.Item,
                config: result.Item
              });
              
              return result.Item as EventConfig | undefined;
            },
            { retryStrategy }
          ),
        async (ctx) =>
          ctx.step(
            "fetch-attendee-orders",
            async (stepCtx) => {
              stepCtx.logger.info("Querying attendee orders", {
                attendeeId: attendeeIdForQuery,
                eventId: eventIdForQuery,
                tableName: ORDERS_TABLE_NAME,
                indexName: "AttendeeEventIndex"
              });
              
              const result = await docClient.send(
                new QueryCommand({
                  TableName: ORDERS_TABLE_NAME,
                  IndexName: "AttendeeEventIndex",
                  KeyConditionExpression:
                    "attendeeId = :attendeeId AND eventId = :eventId",
                  ExpressionAttributeValues: {
                    ":attendeeId": attendeeIdForQuery,
                    ":eventId": eventIdForQuery,
                  },
                })
              );
              
              stepCtx.logger.info("Query completed", {
                itemCount: result.Items?.length || 0,
                items: result.Items
              });
              
              return result.Items || [];
            },
            { retryStrategy }
          ),
      ],
      { maxConcurrency: 2 }
    );

    const results = validationResults.getResults();
    const eventConfig = results[0] as EventConfig | undefined;
    const previousOrders = (results[1] as any[]) || [];

    context.logger.info("Validation data retrieved", {
      eventConfig,
      previousOrdersCount: previousOrders.length,
      previousOrders
    });

    // ========== VALIDATION LOGIC ==========
    const validationErrors: string[] = [];

    if (!eventConfig) {
      validationErrors.push(`Event ${event.eventId} does not exist`);
    } else {
      if (!eventConfig.storeOpen) {
        validationErrors.push("Store is currently closed");
      }

      const maxOrders = eventConfig.maxOrdersPerAttendee || 3;
      const nonCancelledOrders = previousOrders.filter((order: any) => order.status !== "CANCELLED");

      if (nonCancelledOrders.length >= maxOrders) {
        validationErrors.push(`Daily limit of ${maxOrders} orders exceeded (current: ${nonCancelledOrders.length})`);
      } else {
        context.logger.info("Daily limit check passed", {
          attendeeId: event.attendeeId,
          orderCount: nonCancelledOrders.length,
          maxOrders,
        });
      }
    }

    // Handle validation failures
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.join("; ");
      context.logger.error("Validation failed", undefined, {
        orderId: orderData.orderId,
        errors: validationErrors,
      });

      return await handleCancellation(context, orderData, errorMessage, "system", workflowTimestamp);
    }

    context.logger.info("All validations passed", { orderId: orderData.orderId });

    // ========== STEP 3: PUBLISH ORDER_PLACED EVENT ==========
    await context.step(
      "publish-order-placed",
      async () => {
        const eventData = { 
          type: "ORDER_PLACED", 
          orderId: orderData.orderId, 
          timestamp: workflowTimestamp, 
          data: {
            attendeeId: orderData.attendeeId,
            eventId: orderData.eventId,
            orderDetails: orderData.orderDetails,
          }
        };

        await Promise.all([
          publishToAppSync(
            `coffee-ordering/orders/${orderData.orderId}`,
            eventData,
            APPSYNC_HTTP_ENDPOINT
          ),
          publishToAppSync(
            `coffee-ordering/attendee/${orderData.attendeeId}`,
            eventData,
            APPSYNC_HTTP_ENDPOINT
          ),
        ]);
      },
      { retryStrategy }
    );

    // ========== STEP 4: UPDATE STATUS TO QUEUED ==========
    await context.step(
      "update-status-queued",
      async () => {
        await updateStatusAndPublish(
          orderData.orderId,
          "QUEUED",
          "ORDER_QUEUED",
          {
            attendeeId: orderData.attendeeId,
            eventId: orderData.eventId,
            orderDetails: orderData.orderDetails,
          },
          workflowTimestamp,
          "#timestamps.queued = :timestamp",
          {}
        );
      },
      { retryStrategy }
    );

    // ========== STEP 5: WAIT FOR BARISTA ACCEPTANCE ==========
    context.logger.info("Waiting for barista acceptance", { orderId: orderData.orderId });

    let acceptanceResult: CallbackResult;

    try {
      acceptanceResult = await context.waitForCallback<CallbackResult>(
        "wait-acceptance",
        async (callbackId) => {
          // Store callback ID in DynamoDB for external systems to use
          await updatePhaseAndCallback(orderData.orderId, "WAITING_ACCEPTANCE", callbackId);
          
          context.logger.info("Acceptance callback registered", {
            orderId: orderData.orderId,
            callbackId,
            phase: "WAITING_ACCEPTANCE",
          });
        },
        { timeout: { seconds: TIMEOUTS.ACCEPTANCE } }
      );
    } catch (error: any) {
      context.logger.warn("Acceptance timeout occurred", {
        orderId: orderData.orderId,
        error: error.message,
      });

      return await handleCancellation(context, orderData, CANCELLATION_REASONS.ACCEPTANCE_TIMEOUT, "system", workflowTimestamp);
    }

    // Parse and validate acceptance result
    acceptanceResult = parseCallbackResult(acceptanceResult, context, orderData.orderId);
    context.logger.info("Acceptance result received", {
      orderId: orderData.orderId,
      result: acceptanceResult,
    });

    // Check for cancellation during acceptance
    if (acceptanceResult.action === "CANCEL") {
      return await handleCancellation(
        context,
        orderData,
        acceptanceResult.reason || CANCELLATION_REASONS.USER_CANCELLED,
        (acceptanceResult.cancelledBy as CancelledBy) || ("unknown" as CancelledBy),
        workflowTimestamp
      );
    }

    context.logger.info("Order accepted by barista", {
      orderId: orderData.orderId,
      baristaId: acceptanceResult.baristaId,
    });

    // ========== STEP 6: UPDATE STATUS TO ACCEPTED ==========
    await context.step(
      "update-status-accepted",
      async () => {
        await updateStatusAndPublish(
          orderData.orderId,
          "ACCEPTED",
          "ORDER_ACCEPTED",
          {
            attendeeId: orderData.attendeeId,
            baristaId: acceptanceResult.baristaId,
          },
          workflowTimestamp,
          "#timestamps.accepted = :timestamp, baristaId = :baristaId",
          {
            ":baristaId": acceptanceResult.baristaId || "unknown",
          }
        );
      },
      { retryStrategy }
    );

    // ========== STEP 7: WAIT FOR ORDER COMPLETION ==========
    context.logger.info("Waiting for order completion", { orderId: orderData.orderId });

    let completionResult: CallbackResult;

    try {
      completionResult = await context.waitForCallback<CallbackResult>(
        "wait-completion",
        async (callbackId) => {
          // Store callback ID in DynamoDB for external systems to use
          await updatePhaseAndCallback(orderData.orderId, "WAITING_COMPLETION", callbackId);
          
          context.logger.info("Completion callback registered", {
            orderId: orderData.orderId,
            callbackId,
            phase: "WAITING_COMPLETION",
          });
        },
        { timeout: { seconds: TIMEOUTS.COMPLETION } }
      );
    } catch (error: any) {
      context.logger.warn("Completion timeout occurred", {
        orderId: orderData.orderId,
        error: error.message,
      });

      return await handleCancellation(context, orderData, CANCELLATION_REASONS.COMPLETION_TIMEOUT, "system", workflowTimestamp);
    }

    // Parse and validate completion result
    completionResult = parseCallbackResult(completionResult, context, orderData.orderId);
    context.logger.info("Completion result received", {
      orderId: orderData.orderId,
      result: completionResult,
    });

    // Check for cancellation during completion
    if (completionResult.action === "CANCEL") {
      return await handleCancellation(
        context,
        orderData,
        completionResult.reason || CANCELLATION_REASONS.USER_CANCELLED,
        (completionResult.cancelledBy as CancelledBy) || ("unknown" as CancelledBy),
        workflowTimestamp
      );
    }

    context.logger.info("Order completed by barista", {
      orderId: orderData.orderId,
      baristaId: completionResult.baristaId,
    });

    // ========== STEP 8: UPDATE STATUS TO COMPLETED ==========
    await context.step(
      "update-status-completed",
      async () => {
        await updateStatusAndPublish(
          orderData.orderId,
          "COMPLETED",
          "ORDER_COMPLETED",
          {
            attendeeId: orderData.attendeeId,
            baristaId: completionResult.baristaId,
          },
          workflowTimestamp,
          "currentPhase = :phase, activeCallbackId = :null, #timestamps.completed = :timestamp",
          {
            ":phase": "COMPLETED",
            ":null": null,
          }
        );
      },
      { retryStrategy }
    );

    // ========== RETURN SUCCESS ==========
    return {
      orderId: orderData.orderId,
      status: "COMPLETED",
      attendeeId: orderData.attendeeId,
      eventId: orderData.eventId,
      orderDetails: orderData.orderDetails,
      baristaId: completionResult.baristaId,
      timestamps: {
        placed: orderData.timestamps.placed,
        completed: getTimestamp(),
      },
    };
  }
);
