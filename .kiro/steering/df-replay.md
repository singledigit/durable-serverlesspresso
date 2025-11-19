---
inclusion: manual
---

# AWS Durable Execution Replay System

## Overview

The AWS Durable Execution SDK enables long-running, stateful Lambda functions through a **checkpoint-based replay system**. When a Lambda function times out or waits for external events, it saves its state (checkpoints) and terminates gracefully. On subsequent invocations, the function **replays** from the beginning but skips completed operations by returning cached results from checkpoints.

## Core Principle: Deterministic Replay

> **Your handler function re-executes from the beginning on every invocation, but completed operations are skipped by returning cached results from checkpoints.**

This means:
- Code runs **deterministically** - same sequence of operations in the same order
- Completed operations return cached results instantly (no re-execution)
- New operations execute normally and create new checkpoints
- Function continues from where it left off

## Execution Modes

The SDK operates in three distinct modes:

### ExecutionMode (First Run)
- **When**: First invocation or when all previous operations are complete
- **Behavior**: All operations execute normally and create checkpoints
- **Logging**: All logs are emitted

### ReplayMode (Replaying History)
- **When**: Subsequent invocations with existing checkpoints
- **Behavior**: Operations return cached results without re-execution
- **Logging**: Logs are suppressed (mode-aware logging)
- **Transition**: Automatically switches to ExecutionMode when reaching new operations

### ReplaySucceededContext (Special Case)
- **When**: Replaying a child context that previously succeeded
- **Behavior**: Returns non-resolving promises to prevent execution
- **Use Case**: Prevents re-execution of completed child contexts

## The Replay Lifecycle

### Step 1: Initialization

When a Lambda invocation starts, the execution context loads history:

```typescript
// Load operations from checkpoint storage
const operationsArray = [...(event.InitialExecutionState.Operations || [])];

// Fetch paginated operations if needed
while (nextMarker) {
  const response = await state.getStepData(checkpointToken, durableExecutionArn, nextMarker);
  operationsArray.push(...(response.Operations || []));
  nextMarker = response.NextMarker || "";
}

// Determine mode based on history
const durableExecutionMode = operationsArray.length > 1
  ? DurableExecutionMode.ReplayMode
  : DurableExecutionMode.ExecutionMode;

// Build stepData lookup map
const stepData: Record<string, Operation> = operationsArray.reduce((acc, operation) => {
  if (operation.Id) {
    acc[operation.Id] = operation;
  }
  return acc;
}, {});
```

**Key Points:**
- Operations loaded from checkpoint storage
- Mode determined by operation count (>1 = replay)
- All operations indexed by ID for fast lookup

### Step 2: Handler Execution

The handler function always runs from the beginning:

```typescript
const handlerPromise = runWithContext("root", undefined, () =>
  handler(customerHandlerEvent, durableContext)
);

const terminationPromise = executionContext.terminationManager.getTerminationPromise();

// Race between completion and termination
const [resultType, result] = await Promise.race([
  handlerPromise,
  terminationPromise
]);
```

**Key Points:**
- Handler always starts from the beginning
- Races between normal completion and graceful termination
- Termination occurs when waiting for external events

### Step 3: Operation Execution

Each operation follows this pattern:

```typescript
while (true) {
  const stepData = context.getStepData(stepId);
  
  // 1. Validate replay consistency
  validateReplayConsistency(stepId, currentOperation, stepData, context);
  
  // 2. Check if already completed (REPLAY)
  if (stepData?.Status === OperationStatus.SUCCEEDED) {
    return await handleCompletedStep(context, stepId, name, serdes);
  }
  
  // 3. Check if failed
  if (stepData?.Status === OperationStatus.FAILED) {
    throw DurableOperationError.fromErrorObject(stepData.StepDetails.Error);
  }
  
  // 4. Check if waiting for retry
  if (stepData?.Status === OperationStatus.PENDING) {
    await waitForContinuation(...);
    continue; // Re-evaluate after waiting
  }
  
  // 5. Execute the operation (NEW EXECUTION)
  const result = await executeStep(...);
  return result;
}
```

**Key Points:**
- Operations check checkpoint status first
- Completed operations return cached results immediately
- New operations execute and create checkpoints
- Failed operations throw reconstructed errors

### Step 4: Mode Transition

The SDK automatically transitions from ReplayMode to ExecutionMode:

```typescript
private checkAndUpdateReplayMode(): void {
  if (this.durableExecutionMode === DurableExecutionMode.ReplayMode) {
    const nextStepId = this.getNextStepId();
    const nextStepData = this.executionContext.getStepData(nextStepId);
    
    // If next operation doesn't exist in history, switch to execution mode
    if (!nextStepData) {
      this.durableExecutionMode = DurableExecutionMode.ExecutionMode;
    }
  }
}
```

**Key Points:**
- Checked before each operation
- Transitions when reaching operations not in history
- Ensures new operations execute normally

## Replay Consistency Validation

To ensure deterministic execution, the SDK validates operations occur in the same order:

```typescript
export const validateReplayConsistency = (
  stepId: string,
  currentOperation: { type, name, subType },
  checkpointData: Operation | undefined,
  context: ExecutionContext,
): void => {
  if (!checkpointData || !checkpointData.Type) return;
  
  // Validate operation type
  if (checkpointData.Type !== currentOperation.type) {
    throw new NonDeterministicExecutionError(
      `Operation type mismatch for step "${stepId}". ` +
      `Expected "${checkpointData.Type}", got "${currentOperation.type}"`
    );
  }
  
  // Validate operation name
  if (checkpointData.Name !== currentOperation.name) {
    throw new NonDeterministicExecutionError(
      `Operation name mismatch for step "${stepId}". ` +
      `Expected "${checkpointData.Name}", got "${currentOperation.name}"`
    );
  }
  
  // Validate operation subtype
  if (checkpointData.SubType !== currentOperation.subType) {
    throw new NonDeterministicExecutionError(
      `Operation subtype mismatch for step "${stepId}"`
    );
  }
};
```

**What Gets Validated:**
- Operation type (STEP, WAIT, INVOKE, etc.)
- Operation name (user-provided identifier)
- Operation subtype (specific variant)

**Why This Matters:**

Non-deterministic code will be caught immediately:

```typescript
// ❌ BAD: Non-deterministic control flow
const shouldProcess = Math.random() > 0.5;
if (shouldProcess) {
  await context.step("process", async () => processData());
}

// First run: random = 0.7, step executes, checkpoint created
// Second run: random = 0.3, step skipped, validation fails!
// Error: Expected operation "process" at position 2, but got different operation
```

## Step ID Generation

Operations are identified by sequential IDs:

```typescript
private createStepId(): string {
  this._stepCounter++;
  return this._stepPrefix
    ? `${this._stepPrefix}-${this._stepCounter}`
    : `${this._stepCounter}`;
}
```

**Examples:**
- Root context: `1`, `2`, `3`, ...
- Child context: `parent-1`, `parent-2`, `parent-3`, ...
- Nested child: `parent-1-1`, `parent-1-2`, ...

**Key Points:**
- IDs are deterministic (based on execution order)
- Counter increments for each operation
- Prefix identifies context hierarchy

## Checkpoint Storage

Operations are persisted to external storage:

```typescript
const checkpoint = async (stepId: string, operation: CheckpointOperation) => {
  await state.checkpoint(
    checkpointToken,
    durableExecutionArn,
    operation
  );
  
  // Update local cache
  context._stepData[stepId] = operation;
};
```

**Checkpoint Actions:**
- `START`: Operation began execution
- `SUCCEED`: Operation completed successfully
- `FAIL`: Operation failed permanently
- `RETRY`: Operation failed but will retry

**Stored Data:**
- Operation ID, type, name, subtype
- Parent ID (for hierarchy)
- Status (STARTED, SUCCEEDED, FAILED, PENDING)
- Result payload (for successful operations)
- Error details (for failed operations)
- Retry metadata (attempt count, next attempt time)

## Mode-Aware Logging

Since operations re-execute during replay, logs would be duplicated without special handling.

### The Problem

Without mode-aware logging:

```typescript
const handler = async (event: any, context: DurableContext) => {
  context.logger.info("Starting workflow"); // Logged on every invocation!
  
  const user = await context.step("fetch-user", async (ctx) => {
    ctx.logger.info("Fetching user"); // Logged on every invocation!
    return fetchUser(event.userId);
  });
  
  context.logger.info("User fetched", { user }); // Logged on every invocation!
  
  await context.wait({ seconds: 5 });
  
  const result = await context.step("process-user", async (ctx) => {
    ctx.logger.info("Processing user"); // Logged on every invocation!
    return processUser(user);
  });
  
  return result;
};

// Invocation 1: All 4 logs emitted
// Invocation 2: All 4 logs emitted again (duplicates!)
// Invocation 3: All 4 logs emitted again (more duplicates!)
```

### The Solution

The SDK provides a mode-aware logger that automatically suppresses logs during replay:

```typescript
const createModeAwareLogger = (
  durableExecutionMode: DurableExecutionMode,
  createContextLogger: (stepId: string, attempt?: number) => Logger,
  modeAwareEnabled: boolean,
  stepPrefix?: string,
): Logger => {
  const enrichedLogger = createContextLogger(stepPrefix || "", undefined);
  
  // Only log if in ExecutionMode (when mode-aware is enabled)
  const shouldLog = (): boolean =>
    !modeAwareEnabled ||
    durableExecutionMode === DurableExecutionMode.ExecutionMode;
  
  return {
    info: (message?: string, data?: unknown): void => {
      if (shouldLog()) enrichedLogger.info(message, data);
    },
    error: (message?: string, error?: Error, data?: unknown): void => {
      if (shouldLog()) enrichedLogger.error(message, error, data);
    },
    warn: (message?: string, data?: unknown): void => {
      if (shouldLog()) enrichedLogger.warn(message, data);
    },
    debug: (message?: string, data?: unknown): void => {
      if (shouldLog()) enrichedLogger.debug(message, data);
    },
  };
};
```

### Logging Behavior Across Invocations

**Invocation 1 (ExecutionMode):**
```
Mode: ExecutionMode
Logs emitted:
✅ "Starting workflow"
✅ "Fetching user"
✅ "User fetched"
(terminates at wait)
```

**Invocation 2 (ReplayMode → ExecutionMode):**
```
Mode: ReplayMode (for steps 1-2)
❌ "Starting workflow" - suppressed
❌ "Fetching user" - suppressed
❌ "User fetched" - suppressed

Mode: ExecutionMode (for step 3)
✅ "Processing user" - logged (new operation)
```

**Invocation 3 (ReplayMode):**
```
Mode: ReplayMode (all steps completed)
❌ All logs suppressed (pure replay)
```

### Disabling Mode-Aware Logging

For local development or debugging:

```typescript
const handler = async (event: any, context: DurableContext) => {
  // Disable mode-aware logging - see all logs during replay
  context.configureLogger({ modeAware: false });
  
  context.logger.info("This will log on every invocation");
  
  await context.step("my-step", async (ctx) => {
    ctx.logger.info("This will also log on every invocation");
    return doWork();
  });
};
```

**Use Cases for Disabling:**
- Local development and debugging
- Understanding replay behavior
- Troubleshooting issues
- Testing and validation

### Logger Enrichment

The logger automatically enriches log entries with execution context:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "execution_arn": "arn:aws:lambda:us-east-1:123456789012:function:my-function",
  "level": "info",
  "step_id": "a1b2c3d4",
  "attempt": 2,
  "message": "Processing user",
  "data": { "userId": "user-123" }
}
```

### Why Logs Are Not Checkpointed

Unlike operation results, **logs are never checkpointed**. This is intentional:

1. **Performance**: Checkpointing every log would significantly increase storage costs and latency
2. **Observability**: Logs are for real-time observability, not state persistence
3. **Determinism**: Log content doesn't affect execution flow
4. **Volume**: Applications can generate thousands of logs per execution

Instead, the SDK uses execution modes to intelligently suppress duplicate logs during replay.

## Complete Replay Flow Example

Let's trace a complete example:

```typescript
const handler = async (event: any, context: DurableContext) => {
  const user = await context.step("fetch-user", async () => 
    fetchUser(event.userId)
  );
  
  await context.wait({ seconds: 5 });
  
  const result = await context.step("process-user", async () => 
    processUser(user)
  );
  
  return result;
};
```

### Invocation 1 (ExecutionMode)

```
1. Initialize: operationsArray = [], mode = ExecutionMode

2. Execute step "fetch-user" (ID: 1)
   - No checkpoint exists
   - Execute fetchUser()
   - Checkpoint: { Id: "1", Status: SUCCEEDED, Result: {...} }

3. Execute wait (ID: 2)
   - No checkpoint exists
   - Checkpoint: { Id: "2", Status: STARTED, WaitSeconds: 5 }
   - No other operations running
   - Terminate with reason: WAIT_SCHEDULED
```

### Invocation 2 (ReplayMode → ExecutionMode)

```
1. Initialize: operationsArray = [execution, step-1, wait-2], mode = ReplayMode

2. Execute step "fetch-user" (ID: 1)
   - Checkpoint exists with Status: SUCCEEDED
   - Return cached result immediately (no fetchUser() call)
   - checkAndUpdateReplayMode(): next step (2) exists, stay in ReplayMode

3. Execute wait (ID: 2)
   - Checkpoint exists with Status: STARTED
   - Check if wait time elapsed
   - If elapsed: Checkpoint SUCCEED, continue
   - checkAndUpdateReplayMode(): next step (3) doesn't exist, switch to ExecutionMode

4. Execute step "process-user" (ID: 3)
   - No checkpoint exists (ExecutionMode now)
   - Execute processUser()
   - Checkpoint: { Id: "3", Status: SUCCEEDED, Result: {...} }

5. Handler completes, return result
```

### Invocation 3 (ReplayMode)

```
1. Initialize: operationsArray = [execution, step-1, wait-2, step-3], mode = ReplayMode

2. Execute step "fetch-user" (ID: 1)
   - Return cached result

3. Execute wait (ID: 2)
   - Return immediately (already completed)

4. Execute step "process-user" (ID: 3)
   - Return cached result

5. Handler completes, return result
```

## Handling Failures During Replay

If an operation failed in a previous invocation:

```typescript
// Invocation 1: Step fails
await context.step("risky-operation", async () => {
  throw new Error("API timeout");
});
// Checkpoint: { Id: "1", Status: FAILED, Error: {...} }

// Invocation 2: Replay encounters failed step
const stepData = context.getStepData("1");
if (stepData?.Status === OperationStatus.FAILED) {
  // Reconstruct and throw the original error
  throw DurableOperationError.fromErrorObject(stepData.StepDetails.Error);
}
```

**Key Points:**
- Failed operations throw errors during replay
- Errors are reconstructed from checkpoints (deterministic)
- Execution stops at the failure point
- Retry logic is preserved across invocations

## Common Pitfalls and Solutions

### Pitfall 1: Non-Deterministic Control Flow

```typescript
// ❌ BAD: Random behavior
if (Math.random() > 0.5) {
  await context.step("optional-step", async () => doSomething());
}

// ✅ GOOD: Deterministic control flow
if (event.shouldProcess) {
  await context.step("optional-step", async () => doSomething());
}
```

### Pitfall 2: Modifying Closure Variables

```typescript
// ❌ BAD: Closure mutation
let counter = 0;
await context.step("increment", async () => {
  counter++; // Won't happen during replay!
  return counter;
});

// ✅ GOOD: Return values
const counter = await context.step("increment", async () => {
  return 1;
});
```

### Pitfall 3: External State Access

```typescript
// ❌ BAD: Reading external state
const timestamp = Date.now(); // Different on each invocation!
await context.step("process", async () => processWithTimestamp(timestamp));

// ✅ GOOD: Capture state in step
await context.step("process", async () => {
  const timestamp = Date.now(); // Captured in checkpoint
  return processWithTimestamp(timestamp);
});
```

### Pitfall 4: Conditional Operations Based on Time

```typescript
// ❌ BAD: Time-based branching
const isWeekend = new Date().getDay() >= 5;
if (isWeekend) {
  await context.step("weekend-task", async () => doWeekendWork());
}

// ✅ GOOD: Capture time in step
const isWeekend = await context.step("check-day", async () => {
  return new Date().getDay() >= 5;
});
if (isWeekend) {
  await context.step("weekend-task", async () => doWeekendWork());
}
```

## Performance Characteristics

### Replay Performance
- **Completed operations**: ~0.1ms (cache lookup + deserialization)
- **New operations**: Normal execution time + checkpoint write
- **Validation**: Negligible overhead (<0.01ms per operation)

### Memory Usage
- **Checkpoint data**: Stored in `_stepData` map (O(n) where n = operation count)
- **Typical size**: ~1KB per operation
- **Large results**: Automatically checkpointed if >6MB

### Network Calls
- **Initial load**: 1 API call to fetch operations (+ pagination if needed)
- **Per checkpoint**: 1 API call to persist operation state
- **Replay**: 0 additional API calls (uses cached data)

## Summary: Execution Modes and Behavior

| Mode | Logs Emitted? | Operations Executed? | Use Case |
|------|---------------|---------------------|----------|
| **ExecutionMode** | ✅ Yes | ✅ Yes | New operations, first run |
| **ReplayMode** | ❌ No (suppressed) | ❌ No (cached) | Replaying completed operations |
| **ReplaySucceededContext** | ❌ No (suppressed) | ❌ No (non-resolving) | Replaying succeeded child contexts |
| **Mode-Aware Disabled** | ✅ Yes (always) | Depends on mode | Local development, debugging |

## Best Practices for Replay-Safe Code

1. **Keep operations deterministic**: Same inputs → same outputs
2. **Capture non-deterministic values in steps**: Random numbers, timestamps, API calls
3. **Use event data for control flow**: Not runtime-generated values
4. **Return values from steps**: Don't mutate closure variables
5. **Test with multiple invocations**: Verify replay behavior locally
6. **Use mode-aware logging**: Avoid log duplication
7. **Understand mode transitions**: Know when ExecutionMode vs ReplayMode applies
8. **Validate replay consistency**: Let the SDK catch non-deterministic code
9. **Monitor checkpoint sizes**: Large results impact performance
10. **Design for idempotency**: Operations should be safe to retry

## Debugging Replay Issues

### Enable Full Logging

```typescript
context.configureLogger({ modeAware: false });
```

### Check Execution History

```bash
# Local
samdev local execution history $EXECUTION_ARN --format json

# Remote
samdev remote execution history $EXECUTION_ARN --profile private --region us-east-1
```

### Validate Determinism

Run the same event multiple times and compare execution histories:

```bash
samdev local invoke MyFunction --event event.json --durable-execution-name test-1
samdev local invoke MyFunction --event event.json --durable-execution-name test-2
```

Both should produce identical operation sequences.

## References

- [AWS Durable Execution SDK (JavaScript)](https://github.com/aws/aws-durable-execution-sdk-js)
- [SDK Examples](https://github.com/aws/aws-durable-execution-sdk-js/tree/development/packages/aws-durable-execution-sdk-js-examples)
