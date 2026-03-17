import { DurableContext } from "@aws/durable-execution-sdk-js";
import { PublishRequest } from "ob-appsync-events-request";

/**
 * Parse callback result - handles both string and object responses
 * Generic utility that works with any callback result type
 */
export function parseCallbackResult<T>(result: T | string, context: DurableContext, orderId: string): T {
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as T;
    } catch (error) {
      context.logger.error("Failed to parse callback result", error as Error, { orderId });
      throw new Error("Invalid callback result format");
    }
  }
  return result;
}

/**
 * Generate ISO timestamp
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(vars: string[]): void {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

/**
 * Publish event to AppSync Events using IAM-signed request
 */
export async function publishToAppSync(
  channel: string,
  eventData: any,
  httpEndpoint: string
): Promise<void> {
  console.log(`[AppSync] Publishing to channel: ${channel}, endpoint: ${httpEndpoint}`);
  
  if (!httpEndpoint) {
    console.log(`[LOCAL] Skipping AppSync publish to ${channel}`);
    return;
  }

  try {
    const url = `https://${httpEndpoint}/event`;
    console.log(`[AppSync] Creating signed request to: ${url}`);
    
    const request = await PublishRequest.signed(
      url,
      channel,
      eventData
    );

    console.log(`[AppSync] Sending request...`);
    const response = await fetch(request);
    
    console.log(`[AppSync] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AppSync publish failed: ${response.status} - ${errorText}`);
    } else {
      console.log(`[AppSync] Successfully published to ${channel}`);
    }
  } catch (error) {
    console.error(`AppSync publish error:`, error);
  }
}
