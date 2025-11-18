import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import * as LambdaSDK from "@aws-sdk/client-lambda";
import { EventBridgeEvent } from "aws-lambda";

// Extract classes from the SDK (handles both ESM and CommonJS)
const { LambdaClient, SendDurableExecutionCallbackSuccessCommand } = LambdaSDK;

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({});

// Environment variables
const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME!;

/**
 * Event detail structure from EventBridge
 */
interface CallbackEventDetail {
  orderId: string;
  action: "ACCEPT" | "COMPLETE" | "CANCEL";
  baristaId?: string;
  reason?: string;
  cancelledBy?: string;
  timestamp: string;
}

/**
 * Order record structure from DynamoDB
 */
interface OrderRecord {
  orderId: string;
  currentPhase?: "WAITING_ACCEPTANCE" | "WAITING_COMPLETION" | "COMPLETED" | "CANCELLED";
  activeCallbackId?: string;
  callbackIds?: {
    acceptance?: string;
    completion?: string;
  };
  status: string;
}

/**
 * Callback Handler Lambda Function
 * 
 * Processes EventBridge events for barista actions (ACCEPT, COMPLETE, CANCEL)
 * and invokes the appropriate durable execution callback.
 * 
 * Event Types:
 * - BARISTA_ACCEPT_ORDER: Barista accepts an order from the queue
 * - BARISTA_COMPLETE_ORDER: Barista marks an order as complete
 * - ORDER_CANCEL_REQUEST: Attendee, barista, or system cancels an order
 */
export const handler = async (event: EventBridgeEvent<string, CallbackEventDetail>) => {
  console.log("Received callback event:", JSON.stringify(event, null, 2));

  // Derive action from detail-type
  let action: "ACCEPT" | "COMPLETE" | "CANCEL";
  if (event['detail-type'] === 'BARISTA_ACCEPT_ORDER') {
    action = 'ACCEPT';
  } else if (event['detail-type'] === 'BARISTA_COMPLETE_ORDER') {
    action = 'COMPLETE';
  } else if (event['detail-type'] === 'ORDER_CANCEL_REQUEST') {
    action = 'CANCEL';
  } else {
    console.error(`Unknown event type: ${event['detail-type']}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Unknown event type" })
    };
  }

  const { orderId, baristaId, reason, cancelledBy } = event.detail;

  try {
    // Retrieve order record to get callback IDs and current phase
    const orderResult = await docClient.send(new GetCommand({
      TableName: ORDERS_TABLE_NAME,
      Key: { orderId }
    }));

    if (!orderResult.Item) {
      console.error(`Order not found: ${orderId}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Order not found" })
      };
    }

    const order = orderResult.Item as OrderRecord;
    console.log("Order record:", JSON.stringify(order, null, 2));

    // Determine which callback ID to use based on action type and current phase
    let callbackId: string | undefined;

    if (action === "CANCEL") {
      // For cancellation, use the active callback ID (current waiting phase)
      callbackId = order.activeCallbackId;
      
      if (!callbackId) {
        console.warn(`No active callback for order ${orderId} in phase ${order.currentPhase}. Order may not be in a waiting state.`);
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: "Order is not in a waiting state and cannot be cancelled via callback",
            currentPhase: order.currentPhase,
            status: order.status
          })
        };
      }
    } else if (action === "ACCEPT") {
      // For acceptance, use the acceptance callback ID
      callbackId = order.callbackIds?.acceptance;
      
      if (!callbackId) {
        console.error(`No acceptance callback ID found for order ${orderId}`);
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: "Order is not waiting for acceptance",
            currentPhase: order.currentPhase
          })
        };
      }
    } else if (action === "COMPLETE") {
      // For completion, use the completion callback ID
      callbackId = order.callbackIds?.completion;
      
      if (!callbackId) {
        console.error(`No completion callback ID found for order ${orderId}`);
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: "Order is not waiting for completion",
            currentPhase: order.currentPhase
          })
        };
      }
    }

    if (!callbackId) {
      console.error(`Could not determine callback ID for action ${action} on order ${orderId}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid action or order state" })
      };
    }

    // Prepare callback result data
    const callbackResult: any = { action };
    
    if (action === "ACCEPT" && baristaId) {
      callbackResult.baristaId = baristaId;
    } else if (action === "COMPLETE" && baristaId) {
      callbackResult.baristaId = baristaId;
    } else if (action === "CANCEL") {
      callbackResult.reason = reason || "Unknown";
      callbackResult.cancelledBy = cancelledBy || "unknown";
    }

    // Invoke durable execution callback
    console.log(`Invoking callback ${callbackId} with result:`, callbackResult);
    
    await lambdaClient.send(new SendDurableExecutionCallbackSuccessCommand({
      CallbackId: callbackId,
      Result: JSON.stringify(callbackResult)
    }));

    console.log(`Successfully invoked callback for order ${orderId}, action: ${action}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Callback invoked successfully",
        orderId,
        action,
        callbackId
      })
    };

  } catch (error) {
    console.error("Error processing callback event:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};
