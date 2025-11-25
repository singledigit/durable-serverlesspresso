// @ts-ignore - Using local testing library
import { LocalDurableTestRunner } from "../durable-sdk/packages/aws-durable-execution-sdk-js-testing/dist-cjs/index.js";

// Mock AWS SDK clients
const mockSend = jest.fn();
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
  PutCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
  GetCommand: jest.fn((params) => params),
  QueryCommand: jest.fn((params) => params),
}));
jest.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: jest.fn(() => ({ send: jest.fn() })),
  PutEventsCommand: jest.fn(),
}));
jest.mock("./utils", () => ({
  parseCallbackResult: jest.fn((result) => result),
  getTimestamp: jest.fn(() => "2025-01-01T00:00:00.000Z"),
  publishToAppSync: jest.fn().mockResolvedValue(undefined),
}));

import { handler } from "./index";

describe("Coffee Orders Durable Function", () => {
  beforeAll(async () => {
    process.env.ORDERS_TABLE_NAME = "test-orders";
    process.env.CONFIG_TABLE_NAME = "test-config";
    process.env.EVENT_BUS_NAME = "test-bus";
    process.env.APPSYNC_HTTP_ENDPOINT = "https://test.appsync.com";
    
    await LocalDurableTestRunner.setupTestEnvironment({ skipTime: true });
  });

  afterAll(async () => {
    await LocalDurableTestRunner.teardownTestEnvironment();
  });

  beforeEach(() => {
    mockSend.mockReset();
  });

  const createTestEvent = (overrides = {}) => ({
    orderId: "test-order-123",
    attendeeId: "attendee-456",
    eventId: "event-789",
    orderDetails: {
      drinkType: "latte",
      size: "medium",
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  it("should start execution and create operations", async () => {
    mockSend.mockResolvedValue({});

    const runner = new LocalDurableTestRunner({
      handlerFunction: handler,
    });

    const execution = await runner.run({ payload: createTestEvent() });

    expect(execution).toBeDefined();
    const operations = execution.getOperations();
    expect(operations.length).toBeGreaterThan(0);
  });

  it("should cancel order when store is closed", async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { eventId: "event-789", storeOpen: false } })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValue({});

    const runner = new LocalDurableTestRunner({
      handlerFunction: handler,
    });

    const execution = await runner.run({ payload: createTestEvent() });
    const result = execution.getResult();
    
    expect(result?.status).toBe("CANCELLED");
    expect(result?.reason).toContain("closed");
  });

  it("should cancel order when daily limit exceeded", async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: { eventId: "event-789", storeOpen: true, maxOrdersPerAttendee: 2 } })
      .mockResolvedValueOnce({ Items: [{ status: "COMPLETED" }, { status: "COMPLETED" }] })
      .mockResolvedValue({});

    const runner = new LocalDurableTestRunner({
      handlerFunction: handler,
    });

    const execution = await runner.run({ payload: createTestEvent() });
    const result = execution.getResult();
    
    expect(result?.status).toBe("CANCELLED");
    expect(result?.reason).toContain("limit");
  });

  it("should wait for barista acceptance and handle callback", async () => {
    mockSend
      .mockResolvedValueOnce({}) // initialize order
      .mockResolvedValueOnce({ Item: { eventId: "event-789", storeOpen: true, maxOrdersPerAttendee: 3 } }) // event config
      .mockResolvedValueOnce({ Items: [] }) // previous orders
      .mockResolvedValue({}); // all other updates

    const runner = new LocalDurableTestRunner({
      handlerFunction: handler,
    });

    // Start execution without awaiting
    const executionPromise = runner.run({ payload: createTestEvent() });

    // Get the acceptance callback operation
    const acceptanceOp = runner.getOperation("wait-acceptance");
    await acceptanceOp.waitForData();

    // Verify callback was created
    const callbackDetails = acceptanceOp.getCallbackDetails();
    expect(callbackDetails).toBeDefined();
    expect(callbackDetails?.callbackId).toBeDefined();

    // Send acceptance callback
    await acceptanceOp.sendCallbackSuccess(
      JSON.stringify({
        action: "ACCEPT",
        baristaId: "barista-123",
      })
    );

    // Get the completion callback operation
    const completionOp = runner.getOperation("wait-completion");
    await completionOp.waitForData();

    // Verify completion callback was created
    const completionCallbackDetails = completionOp.getCallbackDetails();
    expect(completionCallbackDetails).toBeDefined();
    expect(completionCallbackDetails?.callbackId).toBeDefined();

    // Send completion callback
    await completionOp.sendCallbackSuccess(
      JSON.stringify({
        action: "COMPLETE",
        baristaId: "barista-123",
      })
    );

    // Wait for execution to complete
    const execution = await executionPromise;
    const result = execution.getResult();

    // Should complete successfully
    expect(result?.status).toBe("COMPLETED");
    expect(result?.orderId).toBe("test-order-123");
  }, 10000); // Increase timeout to 10 seconds
});


