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

### 1. Initialization
- Operations loaded from checkpoint storage
- Mode determined by operation count (>1 = ReplayMode)
- All operations indexed by ID for fast lookup

### 2. Handler Execution
- Handler always starts from the beginning
- Races between normal completion and graceful termination
- Termination occurs when waiting for external events

### 3. Operation Execution Pattern

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
    continue;
  }
  
  // 5. Execute the operation (NEW EXECUTION)
  const result = await executeStep(...);
  return result;
}
```

### 4. Mode Transition
- Checked before each operation
- Transitions from ReplayMode to ExecutionMode when reaching operations not in history
- Ensures new operations execute normally

## Replay Consistency Validation

The SDK validates operations occur in the same order:

**What Gets Validated:**
- Operation type (STEP, WAIT, INVOKE, etc.)
- Operation name (user-provided identifier)
- Operation subtype (specific variant)

**Why This Matters:**

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

**Examples:**
- Root context: `1`, `2`, `3`, ...
- Child context: `parent-1`, `parent-2`, `parent-3`, ...
- Nested child: `parent-1-1`, `parent-1-2`, ...

**Key Points:**
- IDs are deterministic (based on execution order)
- Counter increments for each operation
- Prefix identifies context hierarchy

## Checkpoint Storage

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

```typescript
const handler = async (event: any, context: DurableContext) => {
  context.logger.info("Starting workflow"); // Logged on every invocation!
  
  const user = await context.step("fetch-user", async () => {
    context.logger.info("Fetching user"); // Logged on every invocation!
    return fetchUser(event.userId);
  });
  
  await context.wait({ seconds: 5 });
  
  const result = await context.step("process-user", async () => {
    context.logger.info("Processing user"); // Logged on every invocation!
    return processUser(user);
  });
  
  return result;
};

// Invocation 1: All logs emitted
// Invocation 2: All logs emitted again (duplicates!)
```

### The Solution

The SDK provides a mode-aware logger that automatically suppresses logs during replay:

**Logging Behavior:**

**Invocation 1 (ExecutionMode):**
```
✅ "Starting workflow"
✅ "Fetching user"
(terminates at wait)
```

**Invocation 2 (ReplayMode → ExecutionMode):**
```
❌ "Starting workflow" - suppressed (ReplayMode)
❌ "Fetching user" - suppressed (ReplayMode)
✅ "Processing user" - logged (ExecutionMode)
```

### Disabling Mode-Aware Logging

For local development or debugging:

```typescript
const handler = async (event: any, context: DurableContext) => {
  // Disable mode-aware logging - see all logs during replay
  context.configureLogger({ modeAware: false });
  
  context.logger.info("This will log on every invocation");
};
```

**Use Cases:**
- Local development and debugging
- Understanding replay behavior
- Troubleshooting issues

### Why Logs Are Not Checkpointed

Unlike operation results, **logs are never checkpointed**:

1. **Performance**: Checkpointing every log would significantly increase storage costs
2. **Observability**: Logs are for real-time observability, not state persistence
3. **Determinism**: Log content doesn't affect execution flow
4. **Volume**: Applications can generate thousands of logs per execution

## Common Pitfalls

**Non-Deterministic Control Flow:**
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

**Modifying Closure Variables:**
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

**External State Access:**
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

**Conditional Operations Based on Time:**
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
8. **Design for idempotency**: Operations should be safe to retry
