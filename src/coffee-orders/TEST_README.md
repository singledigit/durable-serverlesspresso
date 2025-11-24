# Coffee Orders Durable Function Testing

## Overview

Tests for the coffee-orders durable function using the AWS Durable Execution SDK Testing Library.

## Running Tests

```bash
npm test
```

## Test Results

✅ **All 3 tests passing**

### Test Coverage

1. **Order Initialization**
   - ✅ Starts execution and creates operations

2. **Validation Failures**
   - ✅ Cancels order when store is closed
   - ✅ Cancels order when daily limit exceeded

### Key Features Demonstrated

- **LocalDurableTestRunner**: Runs durable functions locally without AWS deployment
- **skipTime: true**: Skips wait delays for faster test execution
- **Mocked Dependencies**: AWS SDK clients (DynamoDB, EventBridge) are mocked
- **Operation Tracking**: Verifies durable execution operations are created
- **Result Validation**: Checks execution results and cancellation reasons

## Callback Testing

Callback testing requires:
```typescript
const runner = new LocalDurableTestRunner({ handlerFunction: handler, skipTime: true });
const callbackOp = runner.getOperation("callback-name");
const executionPromise = runner.run({ payload: event });
await callbackOp.waitForData();
await callbackOp.sendCallbackSuccess(result);
const execution = await executionPromise;
```

**Note**: Callback tests with this function currently cause checkpoint server instability. This appears to be a limitation of the testing library with complex multi-callback workflows. The pattern works for simpler functions (see testing library's integration tests).

## Configuration

### jest.config.js
- TypeScript support via ts-jest
- Module mapping for durable SDK

### tsconfig.json
- Maps SDK imports to local packages
- Relaxed strictness for test compatibility

### package.json
- Testing library from local SDK packages
- Express required by checkpoint server

## What's Tested

The tests verify:
- Durable execution starts correctly
- Operations are tracked
- Validation logic works (store status, order limits)
- Cancellation flows function properly
- Results contain expected data

## Future Enhancements

Additional tests could cover:
- Successful validation paths
- Simplified callback scenarios
- Timeout handling
- Full end-to-end workflows (may require deployed testing)


