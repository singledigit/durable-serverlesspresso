# Coffee Ordering Durable Function - SAM Application

Serverless coffee ordering system with AWS Lambda Durable Functions, EventBridge, and AppSync Events API. This demo showcases human-in-the-loop workflows using durable executions with external callbacks.

## Architecture

- **Durable Function**: Coffee order orchestration with barista callbacks
- **EventBridge**: Event-driven architecture for order lifecycle
- **DynamoDB**: Config and orders storage with GSIs
- **AppSync Events API**: Real-time WebSocket updates to frontend
- **Vue.js Frontend**: Attendee and barista interfaces

## Project Structure

```
se-durable-functions/
├── template.yaml                    # SAM template
├── frontend/                        # Vue.js application
│   ├── src/
│   │   ├── views/                   # AttendeeView & BaristaView
│   │   ├── components/              # UI components
│   │   ├── stores/                  # Pinia state management
│   │   └── services/                # API & AppSync integration
│   └── dist/                        # Built frontend assets
└── src/
    ├── coffee-orders/               # Durable orchestrator function
    ├── callback-handler/            # Processes barista callbacks
    ├── event-publisher/             # Publishes to AppSync & DynamoDB
    └── get-execution-history/       # API to get execution history
```

## Dependencies

**Orchestrator function** (`coffee-orders`):
- `aws-durable-execution-sdk-js` - Via Lambda layer (DurableSdkLayer)

**Client functions** (`callback-handler`, `get-execution-history`):
- `@aws-sdk/client-lambda` - Via Lambda layer (DurableClientLayer)

**Frontend**:
- Vue 3 + TypeScript
- Vite build tool
- Pinia state management
- TailwindCSS styling

## Prerequisites

- AWS SAM CLI installed
- Node.js 22.x or later
- AWS credentials configured (`asp private` for internal AWS accounts)

## Deployment

### Backend

```bash
# Build
asp private && sam build

# Deploy (first time)
asp private && sam deploy --guided

# Subsequent deploys
asp private && sam deploy
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API Gateway and AppSync URLs from SAM outputs

# Build
npm run build

# Deploy to S3 (manual - or use your preferred hosting)
# The dist/ folder contains the built static assets
```

## Functions

### coffee-orders (Durable)
- **Type**: Durable orchestrator
- **Layer**: DurableSdkLayer
- **Timeout**: 60s per invocation (execution timeout: 300s)
- **Workflow**: Order placement → Barista acceptance → Barista completion
- **Key Features**: 
  - Uses `waitForCallback()` for human-in-the-loop pattern
  - Publishes events to EventBridge at each stage
  - Stores callback IDs in DynamoDB for external systems

### callback-handler
- **Type**: Standard Lambda
- **Layer**: DurableClientLayer
- **Trigger**: EventBridge (BARISTA_ACCEPT_ORDER, BARISTA_COMPLETE_ORDER events)
- **Purpose**: Retrieves callback ID from DynamoDB and sends success/failure to durable execution

### event-publisher
- **Type**: Standard Lambda
- **Trigger**: EventBridge (ORDER_* events)
- **Purpose**: Updates DynamoDB orders table and publishes real-time updates to AppSync Events API

### get-execution-history
- **Type**: Standard Lambda
- **Layer**: DurableClientLayer
- **Trigger**: API Gateway GET /execution/{executionArn}
- **Purpose**: Returns durable execution history for debugging and monitoring

## Event Flow

1. **Order Placed**: Attendee submits order via frontend → API Gateway → `coffee-orders` function starts
2. **Order Created**: Function publishes `ORDER_PLACED` to EventBridge
3. **State Update**: `event-publisher` updates DynamoDB and publishes to AppSync (frontend receives update)
4. **Wait for Accept**: Function calls `waitForCallback()` and stores callback ID in DynamoDB
5. **Barista Accepts**: Barista clicks "Accept" → EventBridge `BARISTA_ACCEPT_ORDER` event
6. **Resume Execution**: `callback-handler` retrieves callback ID and sends success → function resumes
7. **Wait for Complete**: Function calls `waitForCallback()` again for completion
8. **Barista Completes**: Barista clicks "Complete" → EventBridge `BARISTA_COMPLETE_ORDER` event
9. **Final Resume**: `callback-handler` sends success → function completes
10. **Order Done**: Function publishes `ORDER_COMPLETED` → frontend shows final status

## Local Testing

### Backend Testing

The durable function includes Jest tests using the `aws-durable-execution-sdk-js-testing` library:

```bash
cd src/coffee-orders
npm install
npm test
```

Test features:
- `LocalDurableTestRunner` - Run durable functions locally without AWS
- Mock callback responses
- Skip time for faster tests
- Verify execution history and results

### Local Invocation

```bash
# Invoke the durable function locally
asp private && sam local invoke CoffeeOrdersFunction \
  --event events/order.json \
  --durable-execution-name test-order-001

# Get execution history
asp private && sam local execution history $EXECUTION_ARN

# Send callback (simulate barista action)
asp private && sam local callback succeed $CALLBACK_ID \
  --result '{"action": "ACCEPT", "baristaId": "barista-123"}'
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` with hot reload.

## Environment Variables

### Backend (SAM)
Set in `template.yaml` or via parameter overrides:
- `EVENT_BUS_NAME`: EventBridge bus name (default: default)
- `CONFIG_TABLE_NAME`: DynamoDB config table
- `ORDERS_TABLE_NAME`: DynamoDB orders table
- `APPSYNC_EVENTS_ENDPOINT`: AppSync Events API URL
- `APPSYNC_EVENTS_API_KEY`: AppSync API key

### Frontend
Configure in `frontend/.env`:
- `VITE_API_BASE_URL`: API Gateway base URL
- `VITE_APPSYNC_EVENTS_URL`: AppSync Events WebSocket URL
- `VITE_APPSYNC_EVENTS_API_KEY`: AppSync API key
- `VITE_EVENT_ID`: Event identifier (e.g., "reinvent-2025")

## Key Concepts Demonstrated

1. **Human-in-the-Loop Workflows**: Using `waitForCallback()` to pause execution until external action
2. **Durable Execution Layers**: Proper separation of orchestrator SDK and client SDK via Lambda layers
3. **Event-Driven Architecture**: EventBridge for decoupled communication between services
4. **Real-Time Updates**: AppSync Events API for WebSocket-based frontend updates
5. **Callback Pattern**: Storing callback IDs in DynamoDB for external system integration

## Clean Up

```bash
asp private && sam delete --stack-name coffee-ordering
```
