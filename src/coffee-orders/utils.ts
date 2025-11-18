/**
 * Generic utility functions that could be reused across multiple Lambda functions
 */

import { DurableContext } from "aws-durable-execution-sdk-js";

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
