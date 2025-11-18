# AWS SAM Durable Functions Best Practices

## Overview

Durable Functions in AWS SAM enable long-running, stateful workflows that can survive Lambda function timeouts and failures. This guide covers best practices for implementing durable functions using the AWS Durable Execution SDK.

## Environment Configuration

**AWS Profile and Region**:
- Always use AWS profile: `private`
- Default region: `us-east-1`
- Disable pagination in AWS CLI commands with `--no-paginate`

**SAM CLI**:
- Use `samdev` instead of `sam` for all commands
- Example: `samdev deploy` instead of `sam deploy`


## Enabling Durable Functions

To create a Durable Function, add the `DurableConfig` property to your SAM template:

```yaml
HelloWorld:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: HelloWorld-TypeScript
    CodeUri: ./dist
    Handler: hello-world.handler
    Runtime: nodejs22.x
    Architectures:
      - arm64
    MemorySize: 128
    Timeout: 60
    DurableConfig:
      ExecutionTimeout: 3600        # Maximum execution time in seconds
      RetentionPeriodInDays: 7      # How long to retain execution history
```

## Required Dependencies

**REQUIRED**: Use Lambda layers for the durable execution SDKs. There are two layers to use depending on your function type:

### Layer Types

**1. DurableSdkLayer** - For orchestrator functions (functions with `DurableConfig`)
- Contains the `aws-durable-execution-sdk-js` package
- Used by functions that implement durable workflows with `withDurableExecution`
- Required for functions using `ctx.step()`, `ctx.waitForCallback()`, etc.

**2. DurableClientLayer** - For client functions (functions that interact with durable executions)
- Contains the AWS SDK Lambda Client with durable execution commands
- Used by functions that need to send callbacks or query execution state
- Required for functions using `SendDurableExecutionCallbackSuccess`, `GetDurableExecutionHistory`, etc.

### Layer Definitions

Define both layers in your SAM template:

```yaml
Resources:
  # Layer for orchestrator functions
  DurableSdkLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: durable-sdk
      Description: AWS Durable Execution SDK for orchestrator functions
      ContentUri: src/durable-sdk/
      CompatibleRuntimes:
        - nodejs22.x
        - nodejs20.x
      RetentionPolicy: Delete
    Metadata:
      BuildMethod: makefile

  # Layer for client functions
  DurableClientLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: durable-client-sdk
      Description: AWS SDK Lambda Client with Durable Execution commands
      ContentUri: src/durable-client/
      CompatibleRuntimes:
        - nodejs22.x
        - nodejs20.x
      RetentionPolicy: Delete
    Metadata:
      BuildMethod: makefile
```

### Using Layers in Functions

**Orchestrator Function** (with DurableConfig):
```yaml
CoffeeOrdersFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: coffee-orders
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

**Client Function** (interacts with durable executions):
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

**Important**: When using layers, mark the SDK packages as external in your esbuild configuration to prevent bundling them with your function code.

## IAM Permissions

Durable functions require specific IAM permissions. Create a role with the necessary durable execution actions:

```yaml
Resources:
  DurableFunctionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: DurableExecutionPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - lambda:CheckpointDurableExecution
                  - lambda:GetDurableExecutionState
                Resource: '*'

  MyDurableFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... other properties ...
      Role: !GetAtt DurableFunctionRole.Arn
      DurableConfig:
        ExecutionTimeout: 3600
        RetentionPeriodInDays: 7
```

## SAM CLI Commands

### Deployment

Deploy durable functions like any other SAM function:

```bash
samdev deploy --stack-name <YourStackName> --guided --profile private --region us-east-1
```

### Local Invocation

Invoke durable functions locally with optional execution naming:

```bash
samdev local invoke <FunctionName> --event <Event> --durable-execution-name <YourName>
```

The `--durable-execution-name` parameter is optional and helps identify executions during testing.

### Execution Management

#### Local Development

```bash
# Get execution details
samdev local execution get $EXECUTION_ARN

# View execution history (table format by default)
samdev local execution history $EXECUTION_ARN

# View execution history as JSON
samdev local execution history $EXECUTION_ARN --format json

# Stop a running execution
samdev local execution stop $EXECUTION_ARN
```

#### Remote Testing

```bash
# Get execution details from deployed function
samdev remote execution get $EXECUTION_ARN --profile private --region us-east-1

# View execution history
samdev remote execution history $EXECUTION_ARN --profile private --region us-east-1

# Stop a running execution
samdev remote execution stop $EXECUTION_ARN --profile private --region us-east-1
```

### Callback Management

For functions using `waitForCallback`, manage callbacks locally:

```bash
# Send success callback
samdev local callback succeed $CALLBACK_ID --result '{"data": "value"}'

# Send heartbeat to keep execution alive
samdev local callback heartbeat $CALLBACK_ID

# Send failure callback
samdev local callback fail $CALLBACK_ID --error '{"message": "Failed"}'
```

Use `samdev local callback <action> --help` to see all available parameters.

**Note**: Remote callback commands are not yet available but will be added in future releases.

## Configuration Best Practices

### Execution Timeout

- Set `ExecutionTimeout` based on your workflow's maximum expected duration
- Default Lambda timeout (60s) applies to individual steps, not the entire execution
- Durable executions can run much longer than standard Lambda limits

### Retention Period

- Set `RetentionPeriodInDays` based on your debugging and audit needs
- Longer retention periods consume more storage
- Typical values: 7-30 days for development, 90+ days for production

### Memory and Timeout

- Individual Lambda invocations still respect `MemorySize` and `Timeout` settings
- Each checkpoint/resume counts as a new invocation
- Size appropriately for the work done in each step, not the entire workflow

## Code Structure

When implementing durable functions:

1. **Use the SDK wrapper**: Wrap your handler with `withDurableExecution`
2. **Checkpoint strategically**: Use `ctx.step()` for non-deterministic operations
3. **Handle errors**: Implement proper error handling and retry logic
4. **Test locally first**: Use `samdev local invoke` before deploying

Example structure:
```typescript
import { withDurableExecution, DurableContext } from 'aws-durable-execution-sdk-js';

async function handler(event: any, ctx: DurableContext) {
  // Your durable workflow logic
  const result1 = await ctx.step('step1', async () => {
    // Non-deterministic operation
    return await externalApiCall();
  });
  
  const result2 = await ctx.step('step2', async () => {
    // Another operation
    return await processData(result1);
  });
  
  return result2;
}

export const lambdaHandler = withDurableExecution(handler);
```

**Note**: When using layers, the SDK is available at runtime without needing to include it in your function's `package.json` dependencies.

## Testing Strategy

1. **Local testing**: Use `samdev local invoke` with test events
2. **Execution tracking**: Use `samdev local execution history` to debug
3. **Callback testing**: Test callback scenarios with `samdev local callback` commands
4. **Remote validation**: Deploy to dev environment and test with `samdev remote execution` commands

## Common Patterns

### Long-running workflows
- Break work into discrete steps using `ctx.step()`
- Each step is checkpointed automatically
- Execution resumes from last checkpoint on timeout/failure

### External callbacks
- Use `ctx.waitForCallback()` for human approval or external system responses
- Manage callbacks with SAM CLI callback commands
- Set appropriate timeouts for callback operations

### Parallel execution
- Use `ctx.parallel()` for concurrent operations
- Results are collected and checkpointed together
- Improves performance for independent operations

## References

- [AWS Durable Execution SDK (JavaScript)](https://github.com/aws/aws-durable-execution-sdk-js)
- [SDK Examples](https://github.com/aws/aws-durable-execution-sdk-js/tree/development/packages/aws-durable-execution-sdk-js-examples)
