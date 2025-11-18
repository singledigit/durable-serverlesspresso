# Quick Start

## Prerequisites

- AWS SAM CLI with durable function support
- Node.js 22.x
- AWS credentials configured

## Deploy

```bash
# Build all functions and layers
sam build

# Deploy
sam deploy --guided
```

## Seed Config Data

```bash
aws dynamodb put-item \
  --table-name CoffeeOrderingConfig \
  --item '{
    "eventId": {"S": "reinvent-2025"},
    "eventName": {"S": "re:Invent 2025"},
    "storeOpen": {"BOOL": true},
    "openingTime": {"S": "08:00"},
    "closingTime": {"S": "18:00"},
    "maxOrdersPerAttendee": {"N": "3"},
    "createdAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
    "updatedAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}
  }'
```

## Test Order Flow

### 1. Place Order (via EventBridge)
```bash
aws events put-events \
  --entries '[{
    "Source": "coffee.ordering.test",
    "DetailType": "PLACE_ORDER",
    "Detail": "{\"orderId\":\"test-001\",\"attendeeId\":\"attendee-123\",\"eventId\":\"reinvent-2025\",\"orderDetails\":{\"drinkType\":\"latte\",\"size\":\"medium\"}}"
  }]' \
  --event-bus-name CoffeeOrderingEventBus
```

### 2. Barista Accepts
```bash
aws events put-events \
  --entries '[{
    "Source": "coffee.ordering",
    "DetailType": "BARISTA_ACCEPT_ORDER",
    "Detail": "{\"orderId\":\"test-001\",\"action\":\"ACCEPT\",\"baristaId\":\"barista-1\",\"timestamp\":\"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'\"}"
  }]' \
  --event-bus-name CoffeeOrderingEventBus
```

### 3. Barista Completes
```bash
aws events put-events \
  --entries '[{
    "Source": "coffee.ordering",
    "DetailType": "BARISTA_COMPLETE_ORDER",
    "Detail": "{\"orderId\":\"test-001\",\"action\":\"COMPLETE\",\"baristaId\":\"barista-1\",\"timestamp\":\"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'\"}"
  }]' \
  --event-bus-name CoffeeOrderingEventBus
```

## Monitor

```bash
# View logs
sam logs --name CoffeeOrdersFunction --tail

# Get execution history
aws lambda get-durable-execution-history \
  --durable-execution-arn <ARN>
```

## Clean Up

```bash
sam delete --stack-name coffee-ordering
```
