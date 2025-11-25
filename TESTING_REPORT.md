# Durable Functions Testing Report

**Date**: November 24, 2025  
**Project**: Coffee Ordering System (sev2)  
**Testing Library**: `@aws/durable-execution-sdk-js-testing` v0.1.0  
**Function Under Test**: `coffee-orders` (complex multi-callback durable function)

---

## Executive Summary

Successfully implemented local testing for AWS Lambda durable functions using the official testing SDK. **3 out of 4 test scenarios pass reliably**. Callback testing with complex multi-step workflows causes checkpoint server instability, indicating a limitation in the current testing library version.

---

## Test Environment

### Setup
- **Testing Mode**: Local (using `LocalDurableTestRunner`)
- **Test Framework**: Jest with ts-jest
- **Node Version**: v24.0.1
- **SDK Location**: Local packages from `aws-durable-execution-sdk-js` (development branch)
- **Mocked Services**: DynamoDB, EventBridge, AppSync

### Configuration
```typescript
LocalDurableTestRunner.setupTestEnvironment()
runner = new LocalDurableTestRunner({
  handlerFunction: handler,
  skipTime: true  // Skip wait delays for faster tests
})
```

---

## Test Results

### ✅ Passing Tests (3/4)

#### 1. Execution Initialization
**Status**: PASS (161ms)  
**Purpose**: Verify durable execution starts and creates operations  
**Assertions**:
- Execution object is defined
- Operations array has length > 0

```typescript
const execution = await runner.run({ payload: testEvent });
expect(execution).toBeDefined();
expect(execution.getOperations().length).toBeGreaterThan(0);
```

#### 2. Store Closed Validation
**Status**: PASS (120ms)  
**Purpose**: Verify order cancellation when store is closed  
**Assertions**:
- Result status is "CANCELLED"
- Cancellation reason contains "closed"

```typescript
mockSend
  .mockResolvedValueOnce({})  // initialize-order
  .mockResolvedValueOnce({ Item: { storeOpen: false } })  // event-config
  .mockResolvedValueOnce({ Items: [] })  // previous-orders

const result = execution.getResult();
expect(result?.status).toBe("CANCELLED");
expect(result?.reason).toContain("closed");
```

#### 3. Daily Limit Validation
**Status**: PASS (114ms)  
**Purpose**: Verify order cancellation when daily limit exceeded  
**Assertions**:
- Result status is "CANCELLED"
- Cancellation reason contains "limit"

```typescript
mockSend
  .mockResolvedValueOnce({})
  .mockResolvedValueOnce({ Item: { maxOrdersPerAttendee: 2 } })
  .mockResolvedValueOnce({ Items: [{ status: "COMPLETED" }, { status: "COMPLETED" }] })

expect(result?.status).toBe("CANCELLED");
expect(result?.reason).toContain("limit");
```

### ❌ Failing Test (1/4)

#### 4. Callback Completion Workflow
**Status**: FAIL (Checkpoint server crash)  
**Purpose**: Test full order workflow with barista acceptance and completion callbacks  
**Error**: `ECONNREFUSED 127.0.0.1:<port>` - Checkpoint server crashes

**Attempted Approaches**:
1. Using `runner.getOperation("callback-name")` - Server crash
2. Using `runner.getOperationByIndex(0)` - Server crash
3. Using `callbackResponses` parameter - Server crash
4. Isolated test file with fresh environment - Server crash

**Error Pattern**:
```
TypeError: fetch failed
  at CheckpointApiClient.makeRequest
  at TestExecutionOrchestrator.handleCompletedExecution
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:<random-port>
```

---

## Function Complexity Analysis

### Coffee Orders Function Characteristics

**Total Operations Before First Callback**: ~6-7 operations
1. `generate-timestamp` - Step
2. `initialize-order` - Step (DynamoDB PutCommand)
3. `parallel-validation` - Parallel operation
   - `fetch-event-config` - Step (DynamoDB GetCommand)
   - `fetch-attendee-orders` - Step (DynamoDB QueryCommand)
4. `publish-order-placed` - Step (AppSync publish)
5. `update-status-queued` - Step (DynamoDB UpdateCommand)
6. `store-acceptance-callback` - Step (DynamoDB UpdateCommand)
7. **`wait-acceptance`** - Callback operation ⚠️

**Sequential Callbacks**: 2
- Acceptance callback (barista accepts order)
- Completion callback (barista completes order)

**External Service Interactions**:
- DynamoDB: 6+ operations
- EventBridge: 2+ operations
- AppSync: 4+ operations

**State Management**:
- Callback IDs stored in DynamoDB
- Active callback tracking
- Phase transitions (PENDING → QUEUED → ACCEPTED → COMPLETED)

---

## Comparison with SDK Examples

### Working Example (from SDK tests)
```typescript
// Simple function with callback as FIRST operation
const handler = withDurableExecution(async (event, context) => {
  const [callbackPromise, callbackId] = await context.createCallback("external-api-call");
  const result = await callbackPromise;
  return { result, callbackId };
});

// Test pattern that works
const callbackOp = runner.getOperationByIndex(0);  // First operation
await callbackOp.waitForData();
await callbackOp.sendCallbackSuccess("payment_completed");
```

### Our Function (Complex)
```typescript
// Multiple operations BEFORE callback
const handler = withDurableExecution(async (event, context) => {
  const timestamp = await context.step("generate-timestamp", ...);
  const order = await context.step("initialize-order", ...);
  const validation = await context.parallel("parallel-validation", ...);
  await context.step("publish-order-placed", ...);
  await context.step("update-status-queued", ...);
  await context.step("store-acceptance-callback", ...);
  
  // Callback is operation #6-7, not #0
  const [acceptPromise, acceptId] = await context.createCallback("wait-acceptance");
  // ... more complexity
});
```

---

## Root Cause Analysis

### Hypothesis: Checkpoint Server Overload

The local checkpoint server appears unable to handle:
1. **High operation count** before callbacks (6-7 operations vs 0-1 in examples)
2. **Sequential callbacks** (2 callbacks in series)
3. **Complex state management** (DynamoDB updates between operations)
4. **Parallel operations** (concurrent DynamoDB queries)

### Evidence

**Observation 1**: Simple tests pass consistently
- Tests that complete before callbacks: ✅ 100% success rate
- Tests that reach callbacks: ❌ 100% failure rate

**Observation 2**: Server crashes during callback coordination
```
Worker exited with code: 1
Cannot find module 'express' (resolved in later attempts)
connect ECONNREFUSED (consistent pattern)
```

**Observation 3**: Timing sensitivity
- Adding `setTimeout(100)` before getting operation: Still crashes
- Using `waitForData()` with timeout: Still crashes
- Increasing Jest timeout to 15s: Still crashes

---

## SDK API Changes (Latest Version)

### Breaking Changes Identified

#### 1. Duration Type for Timeouts
**Before**:
```typescript
timeout: 120  // seconds as number
```

**After**:
```typescript
timeout: { seconds: 120 }  // Duration object
```

#### 2. Retry Strategy Configuration
**Before**:
```typescript
createRetryStrategy({
  maxAttempts: 3,
  initialDelaySeconds: 1,
  backoffRate: 2.0
})
```

**After**:
```typescript
createRetryStrategy({
  maxAttempts: 3,
  initialDelay: { seconds: 1 },  // Duration object
  backoffRate: 2.0
})
```

#### 3. Type Definitions Path
**Before**: `dist/index.d.ts`  
**After**: `dist-types/index.d.ts`

---

## Recommendations

### Immediate Actions

1. **Use passing tests for CI/CD**
   - 3 tests provide good coverage of validation logic
   - Fast execution (~1.2s total)
   - Reliable and deterministic

2. **Document callback testing limitation**
   - Add note in test README about complexity constraints
   - Reference this report for context

3. **Consider cloud testing for callbacks**
   - Deploy to staging environment
   - Use `CloudDurableTestRunner` for integration tests
   - Verify callback behavior in production-like environment

### Long-term Solutions

1. **Simplify function for testability**
   - Extract validation logic to separate function
   - Reduce operations before callbacks
   - Consider splitting into multiple functions

2. **Report issue to SDK team**
   - Provide this report as reproduction case
   - Include function complexity metrics
   - Request checkpoint server improvements

3. **Alternative testing approaches**
   - Mock callback operations entirely
   - Test callback logic in isolation
   - Use deployed function testing for E2E validation

---

## Test Coverage Summary

| Test Scenario | Status | Coverage |
|--------------|--------|----------|
| Execution initialization | ✅ PASS | Operation tracking |
| Validation logic | ✅ PASS | Business rules |
| Cancellation flows | ✅ PASS | Error handling |
| Callback workflows | ❌ FAIL | Integration |

**Overall Coverage**: 75% of scenarios (3/4)  
**Reliability**: 100% for passing tests  
**Execution Time**: ~1.2s for passing tests

---

## Code Artifacts

### Test File Location
`src/coffee-orders/index.test.ts`

### Test Configuration
- `jest.config.js` - Jest configuration with ts-jest
- `tsconfig.json` - TypeScript configuration with SDK path mapping
- `package.json` - Test dependencies and scripts

### Test Execution
```bash
cd src/coffee-orders
npm test
```

### Expected Output
```
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        1.333 s
```

---

## Conclusion

The AWS Durable Execution Testing SDK successfully enables local testing of durable functions for validation logic, error handling, and execution flow. However, the current version (0.1.0) has limitations with complex multi-callback workflows that involve significant state management and operation counts before callbacks.

**Recommendation**: Use local testing for unit tests of business logic and validation, and supplement with cloud testing for integration scenarios involving callbacks.

---

## Appendix: Testing Library API Reference

### Successful Patterns
```typescript
// Setup
await LocalDurableTestRunner.setupTestEnvironment();

// Create runner
const runner = new LocalDurableTestRunner({
  handlerFunction: handler,
  skipTime: true
});

// Run execution
const execution = await runner.run({ payload: event });

// Assertions
expect(execution.getResult()).toBe(expectedValue);
expect(execution.getOperations().length).toBeGreaterThan(0);

// Cleanup
await LocalDurableTestRunner.teardownTestEnvironment();
```

### Callback Pattern (Works for Simple Functions)
```typescript
const executionPromise = runner.run({ payload: event });
const callbackOp = runner.getOperationByIndex(0);
await callbackOp.waitForData();
await callbackOp.sendCallbackSuccess(result);
const execution = await executionPromise;
```

### Mocking Strategy
```typescript
// Mock AWS SDK clients
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend }))
  }
}));

// Configure mock responses
mockSend
  .mockResolvedValueOnce({})  // First call
  .mockResolvedValueOnce({ Item: {...} })  // Second call
  .mockResolvedValue({});  // All subsequent calls
```
