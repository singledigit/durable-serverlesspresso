// Order Status Types
export type OrderStatus = "PENDING" | "QUEUED" | "ACCEPTED" | "COMPLETED" | "CANCELLED";

export type OrderPhase = 
  | "WAITING_ACCEPTANCE" 
  | "WAITING_COMPLETION" 
  | "COMPLETED" 
  | "CANCELLED";

export type DrinkType = "latte" | "cappuccino" | "espresso" | "americano";

export type DrinkSize = "small" | "medium" | "large";

export type CancelledBy = "attendee" | "barista" | "system";

// Order Details Interface
export interface OrderDetails {
  drinkType: DrinkType;
  size: DrinkSize;
  customizations?: string[];
}

// Order Interface
export interface Order {
  orderId: string;
  attendeeId: string;
  eventId: string;
  status: OrderStatus;
  orderDetails: OrderDetails;
  executionArn: string;
  currentPhase?: OrderPhase;
  callbackIds?: {
    acceptance?: string;
    completion?: string;
  };
  activeCallbackId?: string;
  timestamps: {
    placed: string;
    queued?: string;
    accepted?: string;
    completed?: string;
    cancelled?: string;
  };
  cancellationReason?: string;
  cancelledBy?: CancelledBy;
  baristaId?: string;
  executionHistory?: any; // Durable execution history data
  createdAt: string;
  updatedAt: string;
}

// Event Configuration Interface
export interface EventConfig {
  eventId: string;
  eventName: string;
  storeOpen: boolean;
  maxOrdersPerAttendee: number;
  createdAt: string;
  updatedAt: string;
}

// AppSync Events Types
export type OrderEventType = 
  | "ORDER_PLACED" 
  | "ORDER_QUEUED" 
  | "ORDER_ACCEPTED" 
  | "ORDER_COMPLETED" 
  | "ORDER_CANCELLED";

export interface OrderEvent {
  type: OrderEventType;
  orderId: string;
  timestamp: string;
  data: {
    status?: OrderStatus;
    reason?: string;
    orderDetails?: OrderDetails;
    estimatedTime?: number;
    baristaId?: string;
    attendeeId?: string;
    eventId?: string;
    cancelledBy?: CancelledBy;
  };
}

export type StoreEventType = "STORE_STATUS_CHANGED";

export interface StoreEvent {
  type: StoreEventType;
  eventId: string;
  timestamp: string;
  data: {
    storeOpen: boolean;
  };
}

// API Request Types
export interface PlaceOrderRequest {
  attendeeId: string;
  eventId: string;
  orderDetails: OrderDetails;
}

export interface CancelOrderRequest {
  reason: string;
  cancelledBy: CancelledBy;
}

export interface AcceptOrderRequest {
  baristaId: string;
}

export interface CompleteOrderRequest {
  baristaId: string;
}

export interface GetOrdersRequest {
  status?: OrderStatus[];
  eventId?: string;
  limit?: number;
}

// API Response Types
export interface PlaceOrderResponse {
  orderId: string;
  status: OrderStatus;
  message: string;
}

export interface CancelOrderResponse {
  success: boolean;
  message: string;
}

export interface AcceptOrderResponse {
  success: boolean;
  message: string;
}

export interface CompleteOrderResponse {
  success: boolean;
  message: string;
}

export interface GetOrdersResponse {
  orders: Order[];
  count: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
  timestamp: string;
}

// AppSync Events Configuration
export interface AppSyncConfig {
  url: string;
  apiKey: string;
}

// WebSocket Event Callback
export type EventCallback = (event: OrderEvent) => void;

// Order Statistics (for Barista Dashboard)
export interface OrderStatistics {
  ordersCompletedToday: number;
  averageCompletionTime: number;
  currentQueueLength: number;
  activeOrders: number;
}

// Filter Options (for Barista Dashboard)
export interface OrderFilters {
  drinkType?: DrinkType;
  size?: DrinkSize;
  status?: OrderStatus;
  searchTerm?: string;
}
