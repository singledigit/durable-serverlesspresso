# AWS SAM Durable Functions Best Practices

## Overview

Durable Functions in AWS SAM enable long-running, stateful workflows that can survive Lambda function timeouts and failures.

## Environment Configuration

Always prefix SAM and AWS CLI commands with `asp private &&` to ensure proper credentials:
```bash
asp private && sam deploy
asp private && sam local invoke MyFunction
```

## Enabling Durable Functions

Add `DurableConfig` to your SAM template:

```yaml
HelloWorld:
  Type: AWS::Serverless::Function
  Properties:
    Handler: hello-world.handler
    Runtime: nodejs22.x
    DurableConfig:
      ExecutionTimeout: 3600        # Maximum execution time in seconds
      RetentionPeriodInDays: 7      # How long to retain execution history
```

## Required Dependencies

**REQUIRED**: Use Lambda layers for the durable execution SDKs.

### Layer Types

**DurableSdkLayer** - For orchestrator functions (functions with `DurableConfig`)
- Contains `aws-durable-execution-sdk-js`
- Required for functions using `ctx.step()`, `ctx.waitForCallback()`, etc.

**DurableClientLayer** - For client functions (functions that interact with durable executions)
- Contains AWS SDK Lambda Client with durable execution commands
- Required for functions using `SendDurableExecutionCallbackSuccess`, `GetDurableExecutionHistory`, etc.

### Layer Definitions

```yaml
Resources:
  DurableSdkLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: durable-sdk
      ContentUri: src/durable-sdk/
      CompatibleRuntimes:
        - nodejs22.x
        - nodejs20.x
    Metadata:
      BuildMethod: makefile

  DurableClientLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: durable-client-sdk
      ContentUri: src/durable-client/
      CompatibleRuntimes:
        - nodejs22.x
        - nodejs20.x
    Metadata:
      BuildMethod: makefile
```

### Using Layers in Functions

**Orchestrator Function:**
```yaml
CoffeeOrdersFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: src/coffee-orders
    Handler: index.handler
    Layers:
      - !Ref DurableSdkLayer
    DurableConfig:
      ExecutionTimeout: 300
      RetentionPeriodInDays: 7
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        External:
          - '@aws-sdk/*'
          - aws-durable-execution-sdk-js
```

**Client Function:**
```yaml
CallbackHandlerFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: src/callback-handler
    Handler: index.handler
    Layers:
      - !Ref DurableClientLayer
    Policies:
      - Statement:
          - Effect: Allow
            Action:
              - lambda:SendDurableExecutionCallbackSuccess
              - lambda:SendDurableExecutionCallbackFailure
            Resource: !Sub 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:coffee-orders'
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        External:
          - '@aws-sdk/*'
```

**Important**: Mark SDK packages as external in esbuild to prevent bundling.

## IAM Permissions

**Orchestrator Function:**
```yaml
Policies:
  - Statement:
      - Effect: Allow
        Action:
          - lambda:CheckpointDurableExecution
          - lambda:GetDurableExecutionState
        Resource: '*'
```

**Client Function:**
```yaml
Policies:
  - Statement:
      - Effect: Allow
        Action:
          - lambda:SendDurableExecutionCallbackSuccess
          - lambda:SendDurableExecutionCallbackFailure
          - lambda:SendDurableExecutionCallbackHeartbeat
        Resource: !Sub 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:target-function'
```

## SAM CLI Commands

### Deployment
```bash
asp private && sam deploy --stack-name <YourStackName> --guided
```

### Local Invocation
```bash
asp private && sam local invoke <FunctionName> --event <Event> --durable-execution-name <YourName>
```

### Execution Management

**Local:**
```bash
asp private && sam local execution get $EXECUTION_ARN
asp private && sam local execution history $EXECUTION_ARN
asp private && sam local execution stop $EXECUTION_ARN
```

**Remote:**
```bash
asp private && sam remote execution get $EXECUTION_ARN
asp private && sam remote execution history $EXECUTION_ARN
asp private && sam remote execution stop $EXECUTION_ARN
```

### Callback Management (Local Only)
```bash
asp private && sam local callback succeed $CALLBACK_ID --result '{"data": "value"}'
asp private && sam local callback heartbeat $CALLBACK_ID
asp private && sam local callback fail $CALLBACK_ID --error '{"message": "Failed"}'
```

## Configuration Best Practices

**Execution Timeout:**
- Set based on workflow's maximum expected duration
- Durable executions can run much longer than standard Lambda limits

**Retention Period:**
- 7-30 days for development
- 90+ days for production

**Memory and Timeout:**
- Individual Lambda invocations still respect `MemorySize` and `Timeout` settings
- Each checkpoint/resume counts as a new invocation

## Code Structure

```typescript
import { withDurableExecution, DurableContext } from 'aws-durable-execution-sdk-js';

async function handler(event: any, ctx: DurableContext) {
  const result1 = await ctx.step('step1', async () => {
    return await externalApiCall();
  });
  
  const result2 = await ctx.step('step2', async () => {
    return await processData(result1);
  });
  
  return result2;
}

export const lambdaHandler = withDurableExecution(handler);
```

## Testing Strategy

1. **Local testing**: Use `sam local invoke` with test events
2. **Execution tracking**: Use `sam local execution history` to debug
3. **Callback testing**: Test callback scenarios with `sam local callback` commands
4. **Remote validation**: Deploy to dev environment and test with `sam remote execution` commands

## References

- [AWS Durable Execution SDK (JavaScript)](https://github.com/aws/aws-durable-execution-sdk-js)
- [SDK Examples](https://github.com/aws/aws-durable-execution-sdk-js/tree/development/packages/aws-durable-execution-sdk-js-examples)
