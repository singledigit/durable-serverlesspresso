import { withDurableExecution, DurableContext } from 'aws-durable-execution-sdk-js';

interface PlaygroundEvent {
  name?: string;
}

async function playgroundHandler(event: PlaygroundEvent, ctx: DurableContext) {
  const name = event.name || 'World';

  const greeting = await ctx.step('create-greeting', async () => {
    return `Hello, ${name}!`;
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: greeting,
      timestamp: new Date().toISOString(),
    }),
  };
}

export const handler = withDurableExecution(playgroundHandler);
