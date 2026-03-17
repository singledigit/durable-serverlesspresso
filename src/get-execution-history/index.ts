import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { 
  LambdaClient, 
  GetDurableExecutionHistoryCommand,
  ListDurableExecutionsByFunctionCommand 
} from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({});
const COFFEE_ORDERS_FUNCTION = process.env.COFFEE_ORDERS_FUNCTION || "coffee-orders";

/**
 * Lambda function to fetch durable execution history
 * Called via API Gateway when barista wants to view execution details
 * 
 * Accepts either:
 * - executionArn: Full durable execution ARN
 * - orderId: Order ID (will list executions to find the ARN)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log("Get Execution History request:", JSON.stringify(event, null, 2));

  try {
    // Get execution ARN or orderId from path/query parameters
    let executionArn = event.pathParameters?.executionArn;
    const orderId = event.queryStringParameters?.orderId;
    
    console.log("Initial params:", { executionArn, orderId });

    // If executionArn is a placeholder or invalid, treat it as not provided
    if (executionArn && (executionArn === '_' || !executionArn.startsWith('arn:'))) {
      console.log("Ignoring invalid executionArn:", executionArn);
      executionArn = undefined;
    }

    // If orderId provided and no valid executionArn, list executions to find the ARN
    if (orderId && !executionArn) {
      console.log("Looking up execution ARN for orderId:", orderId);
      console.log("Using function name:", COFFEE_ORDERS_FUNCTION);
      
      // List recent executions for the coffee-orders function
      const listCommand = new ListDurableExecutionsByFunctionCommand({
        FunctionName: COFFEE_ORDERS_FUNCTION,
        Statuses: ["SUCCEEDED"], // Try succeeded first
      });

      const listResponse = await lambdaClient.send(listCommand);
      console.log("List response:", JSON.stringify(listResponse, null, 2));
      
      // Find the execution that matches this orderId by checking the input
      if (listResponse.DurableExecutions) {
        console.log(`Found ${listResponse.DurableExecutions.length} executions`);
        for (const execution of listResponse.DurableExecutions) {
          if (execution.DurableExecutionArn) {
            // Fetch the history to check the input
            try {
              const historyCommand = new GetDurableExecutionHistoryCommand({
                DurableExecutionArn: execution.DurableExecutionArn,
                IncludeExecutionData: true,
              });
              const historyResponse = await lambdaClient.send(historyCommand);
              
              // Check if the first event (ExecutionStarted) contains our orderId
              const startEvent = historyResponse.Events?.find(e => e.EventType === "ExecutionStarted");
              if (startEvent?.ExecutionStartedDetails?.Input?.Payload) {
                const input = JSON.parse(startEvent.ExecutionStartedDetails.Input.Payload);
                if (input.orderId === orderId) {
                  executionArn = execution.DurableExecutionArn;
                  console.log("Found execution ARN:", executionArn);
                  break;
                }
              }
            } catch (err) {
              console.warn("Error checking execution:", err);
              continue;
            }
          }
        }
      }

      if (!executionArn) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "Execution not found for orderId",
            orderId,
          }),
        };
      }
    }

    if (!executionArn) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Missing executionArn path parameter or orderId query parameter",
        }),
      };
    }

    console.log("Fetching execution history for:", executionArn);

    // Fetch execution history using the SDK
    const command = new GetDurableExecutionHistoryCommand({
      DurableExecutionArn: executionArn,
      IncludeExecutionData: true,
    });

    const response = await lambdaClient.send(command);

    console.log("Successfully fetched execution history");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        executionArn,
        history: response,
      }),
    };
  } catch (error: any) {
    console.error("Error fetching execution history:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch execution history",
        message: error.message || "Unknown error",
      }),
    };
  }
};
