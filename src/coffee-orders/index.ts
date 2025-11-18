import { DurableContext, withDurableExecution, createRetryStrategy } from "aws-durable-execution-sdk-js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { randomUUID } from "crypto";
import { OrderRecord, EventConfig, CancelledBy } from "./types";
import { parseCallbackResult, getTimestamp } from "./utils";

// ========== AWS CLIENTS ==========
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-south-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION || "eu-south-1" });

// ========== ENVIRONMENT VARIABLES ==========
const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME!;
const CONFIG_TABLE_NAME = process.env.CONFIG_TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

// ========== CONSTANTS ==========
const TIMEOUTS = {
  ACCEPTANCE: 120, // 2 minutes
  COMPLETION: 120, // 2 minutes
} as const;

const EVENT_SOURCE = "coffee.ordering" as const;

const CANCELLATION_REASONS = {
  ACCEPTANCE_TIMEOUT: "Acceptance timeout - no barista accepted within 2 minutes",
  COMPLETION_TIMEOUT: "Completion timeout - order not completed within 2 minutes",
  VALIDATION_FAILED: "Validation failed",
  USER_CANCELLED: "Order cancelled",
} as const;

// ========== RETRY STRATEGY ==========
const retryStrategy = createRetryStrategy({
  maxAttempts: 3,
  initialDelaySeconds: 1,
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
 * Publish event to EventBridge
 */
async function publishEvent(
  detailType: string,
  detail: Record<string, any>
): Promise<void> {
  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    })
  );
}

/**
 * Update order status in DynamoDB
 */
async function updateOrderStatus(
  orderId: string,
  updates: {
    status?: OrderRecord["status"];
    currentPhase?: OrderRecord["currentPhase"];
    activeCallbackId?: string | null;
    cancellationReason?: string;
    cancelledBy?: CancelledBy;
    timestampField?: "queued" | "accepted" | "completed" | "cancelled";
  }
): Promise<void> {
  const timestamp = getTimestamp();
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {
    ":timestamp": timestamp,
  };

  if (updates.status) {
    updateExpressions.push("#status = :status");
    expressionAttributeNames["#status"] = "status";
    expressionAttributeValues[":status"] = updates.status;
  }

  if (updates.currentPhase !== undefined) {
    updateExpressions.push("currentPhase = :phase");
    expressionAttributeValues[":phase"] = updates.currentPhase;
  }

  if (updates.activeCallbackId !== undefined) {
    updateExpressions.push("activeCallbackId = :activeCallbackId");
    expressionAttributeValues[":activeCallbackId"] = updates.activeCallbackId;
  }

  if (updates.cancellationReason) {
    updateExpressions.push("cancellationReason = :reason");
    expressionAttributeValues[":reason"] = updates.cancellationReason;
  }

  if (updates.cancelledBy) {
    updateExpressions.push("cancelledBy = :cancelledBy");
    expressionAttributeValues[":cancelledBy"] = updates.cancelledBy;
  }

  if (updates.timestampField) {
    updateExpressions.push(`#timestamps.${updates.timestampField} = :timestamp`);
    expressionAttributeNames["#timestamps"] = "timestamps";
  }

  updateExpressions.push("updatedAt = :timestamp");

  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE_NAME,
      Key: { orderId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

/**
 * Handle order cancellation - unified cancellation logic
 */
async function handleCancellation(
  context: DurableContext,
  orderData: OrderRecord,
  reason: string,
  cancelledBy: CancelledBy
): Promise<CancellationResult> {
  await context.step(
    "handle-cancellation",
    async () => {
      // Update order status
      await updateOrderStatus(orderData.orderId, {
        status: "CANCELLED",
        currentPhase: "CANCELLED",
        activeCallbackId: null,
        cancellationReason: reason,
        cancelledBy,
        timestampField: "cancelled",
      });

      // Publish cancellation event
      await publishEvent("ORDER_CANCELLED", {
        orderId: orderData.orderId,
        attendeeId: orderData.attendeeId,
        reason,
        cancelledBy,
        timestamp: getTimestamp(),
      });

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
 * Store callback ID in DynamoDB
 */
async function storeCallbackId(
  orderId: string,
  callbackId: string,
  phase: "WAITING_ACCEPTANCE" | "WAITING_COMPLETION",
  callbackType: "acceptance" | "completion"
): Promise<void> {
  const timestamp = getTimestamp();
  const updateExpression =
    callbackType === "acceptance"
      ? "SET callbackIds = :callbackIds, activeCallbackId = :activeCallbackId, currentPhase = :phase, updatedAt = :timestamp"
      : "SET callbackIds.completion = :completionCallbackId, activeCallbackId = :activeCallbackId, currentPhase = :phase, updatedAt = :timestamp";

  const expressionAttributeValues =
    callbackType === "acceptance"
      ? {
          ":callbackIds": { acceptance: callbackId },
          ":activeCallbackId": callbackId,
          ":phase": phase,
          ":timestamp": timestamp,
        }
      : {
          ":completionCallbackId": callbackId,
          ":activeCallbackId": callbackId,
          ":phase": phase,
          ":timestamp": timestamp,
        };

  await docClient.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE_NAME,
      Key: { orderId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

// ========== MAIN HANDLER ==========
export const handler = withDurableExecution(
  async (rawEvent: OrderPlacementEvent | string, context: DurableContext): Promise<CompletionResult | CancellationResult> => {
    // Parse event if it's a string
    const event: OrderPlacementEvent = typeof rawEvent === 'string' ? JSON.parse(rawEvent) : rawEvent;
    
    context.logger.info("Starting coffee order orchestration", { event });

    // ========== STEP 1: INITIALIZE ORDER ==========
    const orderData = await context.step(
      "initialize-order",
      async () => {
        const orderId = event.orderId || randomUUID();
        const timestamp = getTimestamp();

        const orderRecord: OrderRecord = {
          orderId,
          attendeeId: event.attendeeId,
          eventId: event.eventId,
          status: "PENDING",
          orderDetails: event.orderDetails,
          executionArn: "", // Looked up dynamically via orderId when needed
          timestamps: { placed: timestamp },
          createdAt: timestamp,
          updatedAt: timestamp,
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

    // ========== STEP 2: PUBLISH ORDER_PLACED EVENT ==========
    await context.step(
      "publish-order-placed",
      async () => {
        await publishEvent("ORDER_PLACED", {
          orderId: orderData.orderId,
          attendeeId: orderData.attendeeId,
          eventId: orderData.eventId,
          orderDetails: orderData.orderDetails,
          timestamp: getTimestamp(),
        });

        context.logger.info("ORDER_PLACED event published", { orderId: orderData.orderId });
      },
      { retryStrategy }
    );

    // ========== STEP 3: PARALLEL VALIDATION DATA FETCH ==========
    context.logger.info("Starting parallel validation", { 
      orderId: orderData.orderId,
      attendeeId: event.attendeeId,
      eventId: event.eventId
    });

    // Capture values for closure
    const attendeeIdForQuery = event.attendeeId;
    const eventIdForQuery = event.eventId;

    const validationResults = await context.parallel<EventConfig | undefined | any[]>(
      "parallel-validation",
      [
        {
          name: "event-config",
          func: async (ctx) =>
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
        },
        {
          name: "previous-orders",
          func: async (ctx) =>
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
        },
      ],
      { maxConcurrency: 2 }
    );

    const results = validationResults.getResults();
    const eventConfig = results[0] as EventConfig | undefined;
    const previousOrders = results[1] as any[];

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

      return await handleCancellation(context, orderData, errorMessage, "system");
    }

    context.logger.info("All validations passed", { orderId: orderData.orderId });

    // ========== STEP 4: PUBLISH ORDER_QUEUED EVENT ==========
    await context.step(
      "publish-order-queued",
      async () => {
        await updateOrderStatus(orderData.orderId, {
          status: "QUEUED",
          timestampField: "queued",
        });

        await publishEvent("ORDER_QUEUED", {
          orderId: orderData.orderId,
          attendeeId: orderData.attendeeId,
          eventId: orderData.eventId,
          orderDetails: orderData.orderDetails,
          timestamp: getTimestamp(),
        });

        context.logger.info("ORDER_QUEUED event published", { orderId: orderData.orderId });
      },
      { retryStrategy }
    );

    // ========== STEP 5: WAIT FOR BARISTA ACCEPTANCE ==========
    context.logger.info("Waiting for barista acceptance", { orderId: orderData.orderId });

    let acceptanceResult: CallbackResult;

    try {
      acceptanceResult = await context.waitForCallback<CallbackResult>(
        async (callbackId, ctx) => {
          await storeCallbackId(orderData.orderId, callbackId, "WAITING_ACCEPTANCE", "acceptance");
          ctx.logger.info("Acceptance callback ID stored", {
            orderId: orderData.orderId,
            callbackId,
            phase: "WAITING_ACCEPTANCE",
          });
        },
        { timeout: TIMEOUTS.ACCEPTANCE }
      );
    } catch (error: any) {
      context.logger.warn("Acceptance timeout occurred", {
        orderId: orderData.orderId,
        error: error.message,
      });

      return await handleCancellation(context, orderData, CANCELLATION_REASONS.ACCEPTANCE_TIMEOUT, "system");
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
        (acceptanceResult.cancelledBy as CancelledBy) || "unknown"
      );
    }

    context.logger.info("Order accepted by barista", {
      orderId: orderData.orderId,
      baristaId: acceptanceResult.baristaId,
    });

    // ========== STEP 6: PUBLISH ORDER_ACCEPTED EVENT ==========
    await context.step(
      "publish-order-accepted",
      async () => {
        await updateOrderStatus(orderData.orderId, {
          status: "ACCEPTED",
          timestampField: "accepted",
        });

        await publishEvent("ORDER_ACCEPTED", {
          orderId: orderData.orderId,
          attendeeId: orderData.attendeeId,
          baristaId: acceptanceResult.baristaId,
          timestamp: getTimestamp(),
        });

        context.logger.info("ORDER_ACCEPTED event published", { orderId: orderData.orderId });
      },
      { retryStrategy }
    );

    // ========== STEP 7: WAIT FOR ORDER COMPLETION ==========
    context.logger.info("Waiting for order completion", { orderId: orderData.orderId });

    let completionResult: CallbackResult;

    try {
      completionResult = await context.waitForCallback<CallbackResult>(
        async (callbackId, ctx) => {
          await storeCallbackId(orderData.orderId, callbackId, "WAITING_COMPLETION", "completion");
          ctx.logger.info("Completion callback ID stored", {
            orderId: orderData.orderId,
            callbackId,
            phase: "WAITING_COMPLETION",
          });
        },
        { timeout: TIMEOUTS.COMPLETION }
      );
    } catch (error: any) {
      context.logger.warn("Completion timeout occurred", {
        orderId: orderData.orderId,
        error: error.message,
      });

      return await handleCancellation(context, orderData, CANCELLATION_REASONS.COMPLETION_TIMEOUT, "system");
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
        (completionResult.cancelledBy as CancelledBy) || "unknown"
      );
    }

    context.logger.info("Order completed by barista", {
      orderId: orderData.orderId,
      baristaId: completionResult.baristaId,
    });

    // ========== STEP 8: RECORD ORDER COMPLETION ==========
    await context.step(
      "record-order-completion",
      async () => {
        await updateOrderStatus(orderData.orderId, {
          status: "COMPLETED",
          currentPhase: "COMPLETED",
          activeCallbackId: null,
          timestampField: "completed",
        });

        await publishEvent("ORDER_COMPLETED", {
          orderId: orderData.orderId,
          attendeeId: orderData.attendeeId,
          baristaId: completionResult.baristaId,
          timestamp: getTimestamp(),
        });

        context.logger.info("ORDER_COMPLETED event published", { orderId: orderData.orderId });
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
