# Random Coffee Order Scripts

Scripts to place 20 random coffee orders for testing the durable function workflow.

## Usage

### Option 1: Node.js (No dependencies)

```bash
API_BASE_URL=https://your-api-url.execute-api.region.amazonaws.com/prod \
EVENT_ID=reinvent-2024 \
ATTENDEE_ID=test-user-123 \
node scripts/order-random-coffees.js
```

### Option 2: TypeScript (requires ts-node)

```bash
API_BASE_URL=https://your-api-url.execute-api.region.amazonaws.com/prod \
EVENT_ID=reinvent-2024 \
ATTENDEE_ID=test-user-123 \
npx ts-node scripts/order-random-coffees.ts
```

## Environment Variables

- `API_BASE_URL` - Your API Gateway endpoint (required)
- `EVENT_ID` - Event identifier (default: `reinvent-2024`)
- `ATTENDEE_ID` - Attendee identifier (default: `test-attendee-{timestamp}`)

## What it does

- Places 20 random coffee orders
- Random drink types: latte, cappuccino, espresso, americano
- Random sizes: small, medium, large
- Random customizations: extra shot, oat milk, almond milk, etc.
- 100ms delay between orders to avoid overwhelming the API

## Getting your API URL

From your SAM stack outputs:
```bash
asp private && aws cloudformation describe-stacks \
  --stack-name sev2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```
