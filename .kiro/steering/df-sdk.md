# AWS Durable Execution SDKs Reference

## Overview

Two SDKs work together to enable durable, long-running Lambda functions:

1. **aws-durable-execution-sdk-js** - For orchestrator functions (functions with `DurableConfig`)
2. **@aws-sdk/client-lambda** (with durable commands) - For client functions that interact with durable executions

## SDK 1: aws-durable-execution-sdk-js (Orchestrator SDK)

### Purpose
Build stateful, long-running Lambda functions with automatic state persistence, retry logic, and workflow orchestration.

### Core Concept: DurableContext

The `DurableContext` is the main interface for building durable workflows. It provides methods for:
- Executing atomic steps with retry
- Waiting for time periods or conditions
- Invoking other functions
- Coordinating parallel operations
- Waiting for external callbacks

### Basic Usage

```typescript
import { withDurableExecution, DurableContext } from 'aws-durable-execution-sdk-js';

export const handler = withDurableExecution(
  async (event: any, context: DurableContext) => {
    const result = await context.step(async () => {
      return "step completed";
    });
    return result;
  }
);
```

### Step Operations

Execute atomic operations with automatic retry and state persistence:

```typescript
// Anonymous step (most common)
const result = await context.step(async () => {
  return await fetchFromAPI();
});

// Named step for tracking
const data = await context.step('fetch-data', async () => {
  return await processData();
});

// Step with retry strategy
const result = await context.step(
  async () => {
    if (Math.random() < 0.5) throw new Error("Random failure");
    return "step succeeded";
  },
  {
    retryStrategy: (error: Error, attemptCount: number) => {
      if (attemptCount >= 3) return { shouldRetry: false };
      return { shouldRetry: true, delay: { seconds: attemptCount } };
    },
    semantics: StepSemantics.AtMostOncePerRetry,
  }
);
```

**Key Rule**: `step()` is for **single atomic operations only**. To group multiple durable operations, use `runInChildContext()`.

### Child Contexts

Group multiple durable operations with isolated state tracking:

```typescript
const orderResult = await context.runInChildContext(
  'process-order',
  async (childContext) => {
    // Child context has its own step counter and state
    const validated = await childContext.step('validate', async () => 
      validateOrder(order)
    );
    
    await childContext.wait({ seconds: 1 });
    
    const charged = await childContext.step('charge', async () => 
      chargePayment(validated)
    );
    
    return charged;
  }
);
```

### Wait Operations

```typescript
// Wait for duration (seconds)
await context.wait({ seconds: 30 });

// Named wait for tracking
await context.wait('rate-limit-delay', { seconds: 5 });
```

### Conditional Waiting

Wait until a condition is met by periodically checking state:

```typescript
const finalState = await context.waitForCondition(
  'wait-for-job',
  async (currentState, ctx) => {
    const status = await checkJobStatus(currentState.jobId);
    return { ...currentState, status };
  },
  {
    initialState: { jobId: 'job-123', status: 'pending' },
    waitStrategy: (state, attempt) => {
      if (state.status === 'completed') {
        return { shouldContinue: false };
      }
      return {
        shouldContinue: true,
        delay: { seconds: Math.min(attempt * 2, 60) },
      };
    },
  }
);
```

### External Callbacks

Wait for external systems to complete operations:

```typescript
const result = await context.waitForCallback(
  'wait-for-webhook',
  async (callbackId, ctx) => {
    // This function receives the callbackId
    await submitToExternalAPI(callbackId);
  },
  { timeout: { seconds: 300 } }
);
```

**Callback Pattern**: Store the `callbackId` in DynamoDB or send it to an external system. When the external event occurs, another Lambda function retrieves the `callbackId` and uses the client SDK to send the callback result.

**Alternative: createCallback**

For more control, use `createCallback` to get the callback ID without immediately waiting:

```typescript
const [callbackPromise, callbackId] = await context.createCallback<string>();

// Send callbackId to external system
await storeCallbackId(orderId, callbackId);

// Wait for external system to respond
const result = await callbackPromise;
```

### Invoking Other Functions

Call other durable functions:

```typescript
const result = await context.invoke(
  'process-payment',
  'arn:aws:lambda:us-east-1:123456789012:function:payment-processor',
  { amount: 100, currency: 'USD' }
);
```

### Batch Operations

#### Map - Process arrays with concurrency control

```typescript
const results = await context.map(
  'process-users',
  users,
  async (context, user, index) => {
    return await context.step(`process-${user.id}`, async () => 
      processUser(user)
    );
  },
  {
    maxConcurrency: 5,
    completionConfig: {
      minSuccessful: 8,
      toleratedFailureCount: 2,
    },
    itemNamer: (user, index) => `User-${user.id}`,
  }
);

// Check results
console.log(`Succeeded: ${results.successCount}, Failed: ${results.failureCount}`);
results.throwIfError(); // Throws if any failures
```
```

#### Parallel - Execute multiple functions concurrently

```typescript
const results = await context.parallel(
  'parallel-tasks',
  [
    async (childContext) => {
      return await childContext.step(async () => fetchData1());
    },
    async (childContext) => {
      return await childContext.step(async () => fetchData2());
    },
    async (childContext) => {
      await childContext.wait({ seconds: 1 });
      return fetchData3();
    },
  ],
  {
    maxConcurrency: 2,
    completionConfig: { minSuccessful: 2 },
  }
);

return results.getResults();
```

### Promise Combinators

For fast, in-memory operations (NOT durable):

```typescript
// Wait for all promises
const [user, posts, comments] = await context.promise.all([
  fetchUser(userId),
  fetchPosts(userId),
  fetchComments(userId),
]);

// Race promises
const fastest = await context.promise.race([
  fetchFromPrimary(),
  fetchFromSecondary(),
]);

// Wait for first success
const result = await context.promise.any([
  fetchFromSource1(),
  fetchFromSource2(),
]);

// Wait for all to settle
const results = await context.promise.allSettled([
  operation1(),
  operation2()
]);
```

**Important**: Promise combinators accept already-executing promises and cannot provide concurrency control or durability. Use `map()` or `parallel()` for durable, controlled execution.

### Retry Strategies

```typescript
import { retryPresets, createRetryStrategy } from 'aws-durable-execution-sdk-js';

// Built-in preset
await context.step('api-call', async () => callExternalAPI(), {
  retryStrategy: retryPresets.exponentialBackoff(),
});

// Custom retry strategy
await context.step('custom-retry', async () => riskyOperation(), {
  retryStrategy: (error, attempt) => ({
    shouldRetry: attempt < 5 && error.message.includes('timeout'),
    delaySeconds: attempt * 2,
  }),
});

// Advanced retry configuration
const retryStrategy = createRetryStrategy({
  maxAttempts: 5,
  initialDelaySeconds: 1,
  maxDelaySeconds: 60,
  exponentialDelayFactor: 2,
  jitterStrategy: JitterStrategy.FULL,
});
```

### Logging

```typescript
const handler = async (event: any, ctx: DurableContext) => {
  ctx.logger.info('Processing started', { userId: event.userId });
  
  try {
    const result = await ctx.step('process', async (stepCtx) => {
      stepCtx.logger.debug('Step executing');
      return processData();
    });
    
    ctx.logger.info('Processing completed', { result });
    return result;
  } catch (error) {
    ctx.logger.error('Processing failed', error);
    throw error;
  }
};
```

### Comprehensive Example

Combining multiple operations in a real workflow:

```typescript
import { withDurableExecution, DurableContext } from 'aws-durable-execution-sdk-js';

export const handler = withDurableExecution(
  async (event: any, context: DurableContext) => {
    context.logger.info('Starting workflow', { orderId: event.orderId });
    
    // Step 1: Validate order
    const validated = await context.step('validate', async () => {
      return validateOrder(event);
    });
    
    // Step 2: Wait for rate limiting
    await context.wait({ seconds: 1 });
    
    // Step 3: Process items in parallel with concurrency control
    const items = [1, 2, 3, 4, 5];
    const mapResults = await context.map(
      'process-items',
      items,
      async (context, item, index) => {
        return await context.step(`item-${index}`, async () => {
          return item * 2;
        });
      },
      { maxConcurrency: 2 }
    );
    
    // Step 4: Run parallel operations
    const parallelResults = await context.parallel(
      'parallel-tasks',
      [
        async (childContext) => {
          return await childContext.step('fetch-inventory', async () => 
            fetchInventory()
          );
        },
        async (childContext) => {
          return await childContext.step('fetch-pricing', async () => 
            fetchPricing()
          );
        },
      ]
    );
    
    // Step 5: Wait for external approval
    const [approvalPromise, callbackId] = await context.createCallback<string>();
    
    await context.step('store-callback', async () => 
      storeCallbackId(event.orderId, callbackId)
    );
    
    const approval = await approvalPromise;
    
    // Step 6: Final processing
    const result = await context.step('finalize', async () => {
      return finalizeOrder(validated, mapResults, parallelResults, approval);
    });
    
    context.logger.info('Workflow completed', { result });
    return result;
  }
);
```

### Step Semantics

Control execution guarantees:

```typescript
import { StepSemantics } from 'aws-durable-execution-sdk-js';

// At-most-once per retry (default) - idempotent operations
await ctx.step('idempotent-operation', async () => updateDatabase(), {
  semantics: StepSemantics.AtMostOncePerRetry,
});

// At-least-once per retry - retriable operations
await ctx.step('retriable-operation', async () => sendNotification(), {
  semantics: StepSemantics.AtLeastOncePerRetry,
});
```

## SDK 2: @aws-sdk/client-lambda (Client SDK)

### Purpose
Interact with durable executions from non-durable Lambda functions or external systems.

### Available Commands

#### SendDurableExecutionCallbackSuccess
Send successful callback result to a waiting durable execution:

```typescript
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({});

await lambdaClient.send(new SendDurableExecutionCallbackSuccessCommand({
  CallbackId: callbackId,
  Result: JSON.stringify({ action: 'ACCEPT', baristaId: 'barista-123' })
}));
```

#### SendDurableExecutionCallbackFailure
Send failure callback result:

```typescript
import { SendDurableExecutionCallbackFailureCommand } from '@aws-sdk/client-lambda';

await lambdaClient.send(new SendDurableExecutionCallbackFailureCommand({
  CallbackId: callbackId,
  Error: JSON.stringify({ message: 'Operation failed', code: 'TIMEOUT' })
}));
```

#### SendDurableExecutionCallbackHeartbeat
Keep a callback alive during long-running operations:

```typescript
import { SendDurableExecutionCallbackHeartbeatCommand } from '@aws-sdk/client-lambda';

await lambdaClient.send(new SendDurableExecutionCallbackHeartbeatCommand({
  CallbackId: callbackId
}));
```

#### GetDurableExecutionHistory
Retrieve execution history:

```typescript
import { GetDurableExecutionHistoryCommand } from '@aws-sdk/client-lambda';

const response = await lambdaClient.send(new GetDurableExecutionHistoryCommand({
  ExecutionArn: executionArn
}));

console.log(response.History);
```

#### GetDurableExecution
Get execution details:

```typescript
import { GetDurableExecutionCommand } from '@aws-sdk/client-lambda';

const response = await lambdaClient.send(new GetDurableExecutionCommand({
  ExecutionArn: executionArn
}));

console.log(response.Status, response.Result);
```

#### StopDurableExecution
Stop a running execution:

```typescript
import { StopDurableExecutionCommand } from '@aws-sdk/client-lambda';

await lambdaClient.send(new StopDurableExecutionCommand({
  ExecutionArn: executionArn,
  Reason: 'User requested cancellation'
}));
```

#### ListDurableExecutionsByFunction
List executions for a function:

```typescript
import { ListDurableExecutionsByFunctionCommand } from '@aws-sdk/client-lambda';

const response = await lambdaClient.send(new ListDurableExecutionsByFunctionCommand({
  FunctionName: 'coffee-orders',
  MaxResults: 50
}));

console.log(response.Executions);
```

### Common Pattern: Callback Handler

A typical callback handler function that uses the client SDK:

```typescript
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from '@aws-sdk/client-lambda';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeEvent } from 'aws-lambda';

const lambdaClient = new LambdaClient({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: EventBridgeEvent<string, any>) => {
  const { orderId, action } = event.detail;
  
  // Retrieve callback ID from database
  const result = await docClient.send(new GetCommand({
    TableName: process.env.ORDERS_TABLE_NAME,
    Key: { orderId }
  }));
  
  const callbackId = result.Item?.activeCallbackId;
  
  if (!callbackId) {
    throw new Error('No active callback found');
  }
  
  // Send callback result
  await lambdaClient.send(new SendDurableExecutionCallbackSuccessCommand({
    CallbackId: callbackId,
    Result: JSON.stringify({ action, timestamp: new Date().toISOString() })
  }));
  
  return { statusCode: 200 };
};
```

## Common Patterns

### Human-in-the-Loop Workflow

```typescript
async function approvalWorkflow(event: any, ctx: DurableContext) {
  // Create order
  const order = await ctx.step('create-order', async () => 
    createOrder(event)
  );
  
  // Wait for approval (external callback)
  const [approvalPromise, callbackId] = await ctx.createCallback(
    'wait-approval',
    { timeout: 3600 }
  );
  
  // Store callback ID for later use
  await ctx.step('store-callback', async () => 
    saveCallbackId(order.id, callbackId)
  );
  
  // Wait for approval
  const approval = await approvalPromise;
  
  if (approval.approved) {
    // Process approved order
    return await ctx.step('process', async () => 
      processOrder(order)
    );
  } else {
    // Cancel order
    return await ctx.step('cancel', async () => 
      cancelOrder(order)
    );
  }
}
```

### Saga Pattern (Compensating Transactions)

```typescript
async function sagaWorkflow(event: any, ctx: DurableContext) {
  const compensations: Array<() => Promise<void>> = [];
  
  try {
    // Step 1: Reserve inventory
    const reservation = await ctx.step('reserve', async () => 
      reserveInventory(event.items)
    );
    compensations.push(() => releaseInventory(reservation.id));
    
    // Step 2: Charge payment
    const payment = await ctx.step('charge', async () => 
      chargePayment(event.payment)
    );
    compensations.push(() => refundPayment(payment.id));
    
    // Step 3: Ship order
    const shipment = await ctx.step('ship', async () => 
      shipOrder(event.address)
    );
    
    return { success: true, shipment };
    
  } catch (error) {
    // Execute compensations in reverse order
    ctx.logger.error('Workflow failed, executing compensations', error);
    
    for (const compensate of compensations.reverse()) {
      await ctx.step('compensate', async () => compensate());
    }
    
    throw error;
  }
}
```

### Polling External System

```typescript
async function pollJobStatus(event: any, ctx: DurableContext) {
  // Start job
  const job = await ctx.step('start-job', async () => 
    startExternalJob(event)
  );
  
  // Poll until complete
  const finalState = await ctx.waitForCondition(
    'poll-job',
    async (state, ctx) => {
      const status = await checkJobStatus(state.jobId);
      return { ...state, status };
    },
    {
      initialState: { jobId: job.id, status: 'PENDING' },
      waitStrategy: (state, attempt) => {
        if (state.status === 'COMPLETED' || state.status === 'FAILED') {
          return { shouldContinue: false };
        }
        return {
          shouldContinue: true,
          delaySeconds: Math.min(attempt * 5, 60), // Exponential backoff, max 60s
        };
      },
    }
  );
  
  if (finalState.status === 'FAILED') {
    throw new Error('Job failed');
  }
  
  return finalState;
}
```

## Best Practices

1. **Use steps for all non-deterministic operations**: API calls, database queries, random number generation
2. **Keep step functions pure**: Don't access external state directly in step functions
3. **Store callback IDs**: Always persist callback IDs to DynamoDB or similar storage
4. **Use child contexts for grouping**: When you need multiple durable operations together
5. **Set appropriate timeouts**: Balance between workflow needs and Lambda limits
6. **Use retry strategies**: Configure retries based on operation characteristics
7. **Log extensively**: Use ctx.logger for debugging and monitoring
8. **Handle cancellations**: Check for cancellation signals in long-running operations
9. **Test locally first**: Use SAM CLI local invoke before deploying
10. **Monitor execution history**: Use GetDurableExecutionHistory for debugging

## IAM Permissions

### Orchestrator Function
```yaml
Policies:
  - Statement:
      - Effect: Allow
        Action:
          - lambda:CheckpointDurableExecution
          - lambda:GetDurableExecutionState
        Resource: !Sub 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:my-function'
```

### Client Function
```yaml
Policies:
  - Statement:
      - Effect: Allow
        Action:
          - lambda:SendDurableExecutionCallbackSuccess
          - lambda:SendDurableExecutionCallbackFailure
          - lambda:SendDurableExecutionCallbackHeartbeat
          - lambda:GetDurableExecutionHistory
          - lambda:GetDurableExecution
          - lambda:StopDurableExecution
        Resource: !Sub 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:target-function'
```

## Debugging

### Local Testing
```bash
# Invoke locally with execution name
sam local invoke MyFunction --event event.json --durable-execution-name test-001

# Get execution history
sam local execution history $EXECUTION_ARN

# Get execution details
sam local execution get $EXECUTION_ARN

# Stop execution
sam local execution stop $EXECUTION_ARN
```

### Remote Testing
```bash
# Get execution history from deployed function
sam remote execution history $EXECUTION_ARN --profile private --region us-east-1

# Get execution details
sam remote execution get $EXECUTION_ARN --profile private --region us-east-1

# Stop execution
sam remote execution stop $EXECUTION_ARN --profile private --region us-east-1
```

### Callback Testing (Local Only)
```bash
# Send success callback
sam local callback succeed $CALLBACK_ID --result '{"approved": true}'

# Send heartbeat
sam local callback heartbeat $CALLBACK_ID

# Send failure callback
sam local callback fail $CALLBACK_ID --error '{"message": "Rejected"}'
```
