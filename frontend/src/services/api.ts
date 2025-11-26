import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  PlaceOrderRequest,
  PlaceOrderResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  AcceptOrderRequest,
  AcceptOrderResponse,
  CompleteOrderRequest,
  CompleteOrderResponse,
  GetOrdersRequest,
  GetOrdersResponse,
  ErrorResponse
} from '../types';

/**
 * API Service for Coffee Ordering System
 * Handles all HTTP requests to the backend API Gateway
 */
class ApiService {
  private client: AxiosInstance;

  constructor() {
    // Get base URL from environment
    const baseURL = import.meta.env.VITE_API_BASE_URL;
    
    // Validate that base URL is configured
    if (!baseURL) {
      console.error('VITE_API_BASE_URL is not configured. Please check your .env file.');
      throw new Error('API base URL is not configured. Please set VITE_API_BASE_URL in your .env file.');
    }
    
    // Initialize Axios client with base configuration
    this.client = axios.create({
      baseURL,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Handle and transform API errors
   */
  private handleError(error: AxiosError<ErrorResponse>): Error {
    if (error.response?.data?.error) {
      // Backend returned a structured error
      const { code, message, details } = error.response.data.error;
      const enhancedError = new Error(message);
      (enhancedError as any).code = code;
      (enhancedError as any).details = details;
      (enhancedError as any).statusCode = error.response.status;
      return enhancedError;
    } else if (error.request) {
      // Request was made but no response received
      const networkError = new Error('Network error: Unable to reach the server');
      (networkError as any).code = 'NETWORK_ERROR';
      return networkError;
    } else {
      // Something else happened
      const unknownError = new Error(error.message || 'An unexpected error occurred');
      (unknownError as any).code = 'UNKNOWN_ERROR';
      return unknownError;
    }
  }

  /**
   * Get orders with optional filtering
   * GET /orders
   * 
   * @param request - Optional filters for status, eventId, and limit
   * @returns Promise with array of orders
   */
  async getOrders(request?: GetOrdersRequest): Promise<GetOrdersResponse> {
    try {
      const params = new URLSearchParams();
      
      if (request?.status && request.status.length > 0) {
        params.append('status', request.status.join(','));
      }
      
      if (request?.eventId) {
        params.append('eventId', request.eventId);
      }
      
      if (request?.limit) {
        params.append('limit', request.limit.toString());
      }
      
      const queryString = params.toString();
      const url = queryString ? `/orders?${queryString}` : '/orders';
      
      const response = await this.client.get<GetOrdersResponse>(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get orders:', error);
      throw error;
    }
  }

  /**
   * Place a new coffee order
   * POST /orders
   * 
   * @param request - Order placement request with attendee ID, event ID, and order details
   * @returns Promise with order ID and status
   */
  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponse> {
    try {
      const response = await this.client.post<PlaceOrderResponse>('/orders', request);
      return response.data;
    } catch (error) {
      console.error('Failed to place order:', error);
      throw error;
    }
  }

  /**
   * Cancel an existing order
   * POST /orders/{orderId}/cancel
   * 
   * @param orderId - The ID of the order to cancel
   * @param request - Cancellation request with reason and cancelled by
   * @returns Promise with success status and message
   */
  async cancelOrder(orderId: string, request: CancelOrderRequest): Promise<CancelOrderResponse> {
    try {
      const response = await this.client.post<CancelOrderResponse>(
        `/orders/${orderId}/cancel`,
        request
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Barista accepts an order from the queue
   * POST /barista/accept/{orderId}
   * 
   * @param orderId - The ID of the order to accept
   * @param request - Accept request with barista ID
   * @returns Promise with success status and message
   */
  async acceptOrder(orderId: string, request: AcceptOrderRequest): Promise<AcceptOrderResponse> {
    try {
      const response = await this.client.post<AcceptOrderResponse>(
        `/barista/accept/${orderId}`,
        request
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to accept order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Barista marks an order as complete
   * POST /barista/complete/{orderId}
   * 
   * @param orderId - The ID of the order to complete
   * @param request - Complete request with barista ID
   * @returns Promise with success status and message
   */
  async completeOrder(orderId: string, request: CompleteOrderRequest): Promise<CompleteOrderResponse> {
    try {
      const response = await this.client.post<CompleteOrderResponse>(
        `/barista/complete/${orderId}`,
        request
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to complete order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order count for attendee today
   * GET /orders/count
   * 
   * @param attendeeId - The attendee ID
   * @param eventId - The event ID
   * @returns Promise with order count
   */
  async getOrderCount(attendeeId: string, eventId: string): Promise<{ count: number }> {
    try {
      const response = await this.client.get(`/orders/count?attendeeId=${attendeeId}&eventId=${eventId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get order count:', error);
      throw error;
    }
  }

  /**
   * Get event configuration
   * GET /config/{eventId}
   * 
   * @param eventId - The event ID
   * @returns Promise with event configuration
   */
  async getEventConfig(eventId: string): Promise<any> {
    try {
      const response = await this.client.get(`/config/${eventId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get event config:', error);
      throw error;
    }
  }

  /**
   * Update store open/closed status
   * POST /store/status
   * 
   * @param eventId - The event ID
   * @param storeOpen - New store status (true = open, false = closed)
   * @returns Promise with success status
   */
  async updateStoreStatus(eventId: string, storeOpen: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post<{ success: boolean; message: string }>(
        '/store/status',
        { eventId, storeOpen }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to update store status:', error);
      throw error;
    }
  }

  /**
   * Get the base URL for the API
   * Useful for debugging and configuration verification
   */
  getBaseURL(): string {
    return this.client.defaults.baseURL || '';
  }

  /**
   * Update the base URL dynamically
   * Useful for testing or environment switching
   */
  setBaseURL(url: string): void {
    this.client.defaults.baseURL = url;
  }

  /**
   * Update the request timeout
   */
  setTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export class for testing purposes
export { ApiService };

// Export convenience functions for direct usage
export const getOrders = (request?: GetOrdersRequest) => apiService.getOrders(request);
export const placeOrder = (request: PlaceOrderRequest) => apiService.placeOrder(request);
export const cancelOrder = (orderId: string, request: CancelOrderRequest) => 
  apiService.cancelOrder(orderId, request);
export const acceptOrder = (orderId: string, request: AcceptOrderRequest) => 
  apiService.acceptOrder(orderId, request);
export const completeOrder = (orderId: string, request: CompleteOrderRequest) => 
  apiService.completeOrder(orderId, request);
export const updateStoreStatus = (eventId: string, storeOpen: boolean) =>
  apiService.updateStoreStatus(eventId, storeOpen);
