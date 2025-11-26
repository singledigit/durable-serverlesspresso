import { EventBridgeEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME!;
const CONFIG_TABLE_NAME = process.env.CONFIG_TABLE_NAME!;
const APPSYNC_EVENTS_API_URL = process.env.APPSYNC_EVENTS_API_URL!;
const APPSYNC_EVENTS_API_KEY = process.env.APPSYNC_EVENTS_API_KEY!;

interface OrderEventDetail {
  type: string;
  orderId?: string;
  attendeeId?: string;
  eventId?: string;
  orderDetails?: any;
  baristaId?: string;
  reason?: string;
  cancelledBy?: string;
  timestamp?: string;
  storeOpen?: boolean;
}

interface EventConfig {
  eventId: string;
  eventName: string;
  storeOpen: boolean;
  openingTime: string;
  closingTime: string;
  maxOrdersPerAttendee: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Event Publisher Lambda Function
 * 
 * This function is the single source of truth for customer-facing order status.
 * It handles two responsibilities:
 * 1. Update DynamoDB with display state (status, timestamps, cancellation details)
 * 2. Publish real-time events to AppSync Events for frontend updates
 * 
 * Hybrid State Management Approach:
 * - Durable Function writes: callback IDs, currentPhase, activeCallbackId (orchestration state)
 * - Event Publisher writes: status, timestamps, cancellation details (display state)
 */
export const handler = async (event: EventBridgeEvent<string, OrderEventDetail>) => {
  console.log("Event Publisher received event:", JSON.stringify(event, null, 2));

  // EventBridge event type is in 'detail-type', not 'detail.type'
  const eventType = event['detail-type'];
  const { orderId, attendeeId, orderDetails, baristaId, reason, cancelledBy, eventId, storeOpen } = event.detail;
  const timestamp = new Date().toISOString();

  try {
    // Handle store status events
    if (eventType === "STORE_STATUS_CHANGED") {
      if (!eventId || storeOpen === undefined) {
        throw new Error("eventId and storeOpen are required for STORE_STATUS_CHANGED events");
      }
      
      // Update config table with new store status (source of truth)
      await updateStoreStatus(eventId, storeOpen, timestamp);
      
      // Publish to AppSync Events for real-time frontend updates
      await publishToAppSyncEvents(eventType, orderId, attendeeId, { 
        timestamp,
        eventId,
        storeOpen
      });
      
      console.log(`Successfully processed ${eventType} event for event ${eventId}`);
      return;
    }

    // Handle order events
    if (!orderId) {
      throw new Error("orderId is required for order events");
    }
    
    // Update DynamoDB with display state based on event type
    await updateOrderDisplayState(eventType, orderId, timestamp, { baristaId, reason, cancelledBy });

    // Publish to AppSync Events for real-time frontend updates
    await publishToAppSyncEvents(eventType, orderId, attendeeId, { 
      orderDetails, 
      baristaId, 
      reason, 
      cancelledBy, 
      timestamp
    });

    console.log(`Successfully processed ${eventType} event for order ${orderId}`);
  } catch (error) {
    console.error(`Error processing event:`, error);
    throw error;
  }
};

/**
 * Update store status in config table (source of truth)
 */
async function updateStoreStatus(
  eventId: string,
  storeOpen: boolean,
  timestamp: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: CONFIG_TABLE_NAME,
      Key: { eventId },
      UpdateExpression: "SET storeOpen = :storeOpen, updatedAt = :timestamp",
      ExpressionAttributeValues: {
        ":storeOpen": storeOpen,
        ":timestamp": timestamp,
      },
    })
  );
  console.log(`Updated store status for event ${eventId} to ${storeOpen ? 'OPEN' : 'CLOSED'}`);
}

/**
 * Update DynamoDB with display state based on event type
 */
async function updateOrderDisplayState(
  eventType: string,
  orderId: string,
  timestamp: string,
  data: { baristaId?: string; reason?: string; cancelledBy?: string }
): Promise<void> {
  switch (eventType) {
    case "ORDER_QUEUED":
      await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE_NAME,
          Key: { orderId },
          UpdateExpression: "SET #status = :status, #timestamps.queued = :timestamp, updatedAt = :timestamp",
          ExpressionAttributeNames: {
            "#status": "status",
            "#timestamps": "timestamps",
          },
          ExpressionAttributeValues: {
            ":status": "QUEUED",
            ":timestamp": timestamp,
          },
        })
      );
      console.log(`Updated order ${orderId} status to QUEUED`);
      break;

    case "ORDER_ACCEPTED":
      await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE_NAME,
          Key: { orderId },
          UpdateExpression: "SET #status = :status, #timestamps.accepted = :timestamp, baristaId = :baristaId, updatedAt = :timestamp",
          ExpressionAttributeNames: {
            "#status": "status",
            "#timestamps": "timestamps",
          },
          ExpressionAttributeValues: {
            ":status": "ACCEPTED",
            ":timestamp": timestamp,
            ":baristaId": data.baristaId || "unknown",
          },
        })
      );
      console.log(`Updated order ${orderId} status to ACCEPTED`);
      break;

    case "ORDER_COMPLETED":
      await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE_NAME,
          Key: { orderId },
          UpdateExpression:
            "SET #status = :status, currentPhase = :phase, activeCallbackId = :null, #timestamps.completed = :timestamp, updatedAt = :timestamp",
          ExpressionAttributeNames: {
            "#status": "status",
            "#timestamps": "timestamps",
          },
          ExpressionAttributeValues: {
            ":status": "COMPLETED",
            ":phase": "COMPLETED",
            ":null": null,
            ":timestamp": timestamp,
          },
        })
      );
      console.log(`Updated order ${orderId} status to COMPLETED`);
      break;

    case "ORDER_CANCELLED":
      await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE_NAME,
          Key: { orderId },
          UpdateExpression:
            "SET #status = :status, currentPhase = :phase, activeCallbackId = :null, cancellationReason = :reason, cancelledBy = :cancelledBy, #timestamps.cancelled = :timestamp, updatedAt = :timestamp",
          ExpressionAttributeNames: {
            "#status": "status",
            "#timestamps": "timestamps",
          },
          ExpressionAttributeValues: {
            ":status": "CANCELLED",
            ":phase": "CANCELLED",
            ":null": null,
            ":reason": data.reason || "Unknown",
            ":cancelledBy": data.cancelledBy || "unknown",
            ":timestamp": timestamp,
          },
        })
      );
      console.log(`Updated order ${orderId} status to CANCELLED`);
      break;

    default:
      console.log(`No DynamoDB update needed for event type: ${eventType}`);
  }
}

/**
 * Publish events to AppSync Events for real-time frontend updates
 */
async function publishToAppSyncEvents(
  eventType: string,
  orderId: string | undefined,
  attendeeId: string | undefined,
  data: { orderDetails?: any; baristaId?: string; reason?: string; cancelledBy?: string; timestamp: string; eventId?: string; storeOpen?: boolean }
): Promise<void> {
  const channels: string[] = [];
  
  // Handle store status events
  if (eventType === "STORE_STATUS_CHANGED") {
    const storeEventData = {
      type: eventType,
      eventId: data.eventId,
      timestamp: data.timestamp,
      data: {
        storeOpen: data.storeOpen
      }
    };
    
    // Publish to store channel
    const storeChannel = `coffee-ordering/store/${data.eventId}`;
    try {
      await publishToChannel(storeChannel, storeEventData);
      console.log(`Published ${eventType} to channel: ${storeChannel}`);
    } catch (error) {
      console.error(`Failed to publish to channel ${storeChannel}:`, error);
    }
    return;
  }

  // Handle order events
  const eventData = {
    type: eventType,
    orderId,
    timestamp: data.timestamp,
    data: {
      baristaId: data.baristaId,
      reason: data.reason,
      cancelledBy: data.cancelledBy,
      orderDetails: data.orderDetails,
    },
  };

  // Always publish to order-specific channel
  // For publishing: format is namespace/channel-path (NO leading slash)
  // For subscribing: format is /namespace/channel-path (WITH leading slash)
  // Our namespace is "coffee-ordering"
  channels.push(`coffee-ordering/orders/${orderId}`);

  // Publish to barista queue for new orders
  if (eventType === "ORDER_QUEUED") {
    channels.push("coffee-ordering/barista/queue");
  }

  // Publish to attendee channel if attendeeId is available
  if (attendeeId) {
    channels.push(`coffee-ordering/attendee/${attendeeId}`);
  }

  // Publish to each channel
  for (const channel of channels) {
    try {
      await publishToChannel(channel, eventData);
      console.log(`Published ${eventType} to channel: ${channel}`);
    } catch (error) {
      console.error(`Failed to publish to channel ${channel}:`, error);
      // Continue with other channels even if one fails
    }
  }
}

/**
 * Publish a single event to an AppSync Events channel using IAM authentication
 */
async function publishToChannel(channel: string, eventData: any): Promise<void> {
  const url = new URL(APPSYNC_EVENTS_API_URL);
  const body = JSON.stringify({
    channel,
    events: [JSON.stringify(eventData)],
  });

  const request = new HttpRequest({
    method: "POST",
    protocol: url.protocol.slice(0, -1),
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      "Content-Type": "application/json",
      host: url.hostname,
    },
    body,
  });

  const signer = new SignatureV4({
    service: "appsync",
    region: process.env.AWS_REGION || "us-east-1",
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  const response = await fetch(url.toString(), {
    method: signedRequest.method,
    headers: signedRequest.headers as Record<string, string>,
    body: signedRequest.body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AppSync Events publish failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  console.log(`Successfully published to channel ${channel}`);
}
