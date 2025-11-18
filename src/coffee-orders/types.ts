/**
 * Shared type definitions for the coffee ordering system
 * These types are used across multiple functions and services
 */

export interface OrderRecord {
  orderId: string;
  attendeeId: string;
  eventId: string;
  status: "PENDING" | "QUEUED" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
  orderDetails: {
    drinkType: string;
    size: string;
    customizations?: string[];
  };
  executionArn: string;
  currentPhase?: "WAITING_ACCEPTANCE" | "WAITING_COMPLETION" | "COMPLETED" | "CANCELLED";
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
  cancelledBy?: string;
  baristaId?: string;
  executionHistory?: any; // Durable execution history data
  createdAt: string;
  updatedAt: string;
}

export interface EventConfig {
  eventId: string;
  eventName: string;
  storeOpen: boolean;
  openingTime: string;
  closingTime: string;
  maxOrdersPerAttendee: number;
  createdAt: string;
  updatedAt: string;
}

export type CancelledBy = "attendee" | "barista" | "system";

export type OrderStatus = OrderRecord["status"];
export type OrderPhase = NonNullable<OrderRecord["currentPhase"]>;
