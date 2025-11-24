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
    
    await LocalDurableTestRunner.setupTestEnvironment();
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
      skipTime: true,
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
      skipTime: true,
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
      skipTime: true,
    });

    const execution = await runner.run({ payload: createTestEvent() });
    const result = execution.getResult();
    
    expect(result?.status).toBe("CANCELLED");
    expect(result?.reason).toContain("limit");
  });
});


