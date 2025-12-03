# Coffee Ordering Durable Function - SAM Application

Serverless coffee ordering system with AWS Lambda Durable Functions, EventBridge, and AppSync Events API.

## Architecture

- **Durable Function**: Coffee order orchestration with barista callbacks
- **EventBridge**: Event-driven architecture for order lifecycle
- **DynamoDB**: Config and orders storage with GSIs
- **AppSync Events API**: Real-time WebSocket updates

## Project Structure

```
sev2/
├── template.yaml                    # SAM template
└── src/
    ├── coffee-orders/               # Durable orchestrator function
    ├── callback-handler/            # Processes barista callbacks
    ├── event-publisher/             # Publishes to AppSync
    └── get-execution-history/       # API to get execution history
```

## Dependencies

**Orchestrator function** (`coffee-orders`):
- `@aws/durable-execution-sdk-js` - Bundled with the function

**Client functions** (`callback-handler`, `get-execution-history`):
- `@aws-sdk/client-lambda` - Marked as external, uses Lambda runtime's built-in AWS SDK

## Deployment

```bash
# Build
sam build

# Deploy
sam deploy --guided

# Or direct deploy
sam deploy --stack-name coffee-ordering --region us-east-1 --capabilities CAPABILITY_IAM --resolve-s3
```

## Functions

### coffee-orders (Durable)
- **Type**: Durable orchestrator
- **Dependencies**: `@aws/durable-execution-sdk-js`
- **Timeout**: 60s (execution timeout: 300s)
- **Workflow**: Order placement → Barista acceptance → Completion

### callback-handler
- **Type**: Standard Lambda
- **Dependencies**: `@aws-sdk/client-lambda`
- **Trigger**: EventBridge (BARISTA_* events)
- **Purpose**: Sends callbacks to durable execution

### event-publisher
- **Type**: Standard Lambda
- **Trigger**: EventBridge (ORDER_* events)
- **Purpose**: Updates DynamoDB and publishes to AppSync

### get-execution-history
- **Type**: Standard Lambda
- **Dependencies**: `@aws-sdk/client-lambda`
- **Trigger**: API Gateway
- **Purpose**: Returns durable execution history

## Event Flow

1. Order placed → `coffee-orders` durable function starts
2. Function publishes `ORDER_PLACED` to EventBridge
3. `event-publisher` updates DynamoDB and AppSync
4. Function waits for barista callback
5. Barista accepts → `BARISTA_ACCEPT_ORDER` event
6. `callback-handler` sends success callback
7. Function continues → waits for completion
8. Barista completes → `BARISTA_COMPLETE_ORDER` event
9. `callback-handler` sends success callback
10. Function completes → `ORDER_COMPLETED` event

## Testing

The durable function includes Jest tests using the `@aws/durable-execution-sdk-js-testing` library for local testing.

```bash
cd src/coffee-orders
npm install
npm test
```

The testing library provides:
- `LocalDurableTestRunner` - Run durable functions locally without AWS
- Mock callback responses
- Skip time for faster tests
- Verify execution history and results

## Clean Up

```bash
sam delete --stack-name coffee-ordering
```
