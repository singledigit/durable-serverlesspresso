import { DurableContext, withDurableExecution } from 'aws-durable-execution-sdk-js';

interface HelloWorldEvent {
  name: string;
}

async function handler(event: HelloWorldEvent, context: DurableContext) {
  context.logger.info('Starting hello world durable function', { event });

  // Step 1: Greet
  const greeting = await context.step('greet', async () => {
    const message = `Hello, ${event.name}!`;
    context.logger.info('Generated greeting', { message });
    return message;
  });

  // Step 2: Add timestamp
  const result = await context.step('add-timestamp', async () => {
    const timestamp = new Date().toISOString();
    context.logger.info('Adding timestamp', { timestamp });
    return {
      greeting,
      timestamp,
      executionArn: context.executionArn
    };
  });

  context.logger.info('Completed hello world durable function', { result });
  return result;
}

export const lambdaHandler = withDurableExecution(handler);
