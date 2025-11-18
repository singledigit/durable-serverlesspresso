import {
  LocalDurableTestRunner,
  OperationStatus,
} from "aws-durable-functions-sdk-js-testing";
import { handler } from "../src/index";

// Mock the S3Client
var mockS3Client: {
  send: jest.Mock;
};
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => {
    mockS3Client = {
      send: jest.fn(),
    };
    return mockS3Client;
  }),
  ListBucketsCommand: jest.fn(),
}));

beforeAll(() => LocalDurableTestRunner.setupTestEnvironment());
afterAll(() => LocalDurableTestRunner.teardownTestEnvironment());

describe("example-s3", () => {
  const durableTestRunner = new LocalDurableTestRunner({
    handlerFunction: handler,
    skipTime: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute S3 list buckets operation successfully", async () => {
    // Mock successful S3 response
    const mockBuckets = [
      { Name: "test-bucket-1", CreationDate: new Date("2023-01-01") },
      { Name: "test-bucket-2", CreationDate: new Date("2023-02-01") },
    ];

    mockS3Client.send.mockResolvedValue({
      Buckets: mockBuckets,
    });

    // Run execution
    const execution = await durableTestRunner.run();

    // Verify execution result
    expect(execution.getResult()).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        message: "Success",
        buckets: mockBuckets,
      }),
    });

    // Verify the number of completed operations
    const operations = execution.getOperations();
    expect(operations.length).toEqual(1);

    // Verify the step operation result
    const stepOperation = durableTestRunner.getOperation("Get Buckets");
    expect(stepOperation.getStatus()).toEqual(OperationStatus.SUCCEEDED);
    expect(stepOperation.getStepDetails()?.result).toEqual({
      Buckets: JSON.parse(JSON.stringify(mockBuckets)),
    });
  });

  it("should handle S3 service errors gracefully", async () => {
    // Mock S3 service error
    const mockError = new Error("Access denied to S3 service");
    mockS3Client.send.mockRejectedValue(mockError);

    // Run execution
    const execution = await durableTestRunner.run();

    // Verify execution result
    expect(execution.getResult()).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: "Error",
        error: "Access denied to S3 service",
      }),
    });

    // Verify the number of completed operations
    const operations = execution.getOperations();
    expect(operations.length).toEqual(1);

    // Verify that the step retries 3 times
    expect(mockS3Client.send).toHaveBeenCalledTimes(3);

    // Verify the step operation error
    const stepOperation = durableTestRunner.getOperation("Get Buckets");
    expect(stepOperation.getStatus()).toEqual(OperationStatus.FAILED);
    expect(stepOperation.getStepDetails()?.error?.errorMessage).toEqual(
      "Access denied to S3 service"
    );
  });
});