import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  Order,
  OrderDetails,
  OrderStatus,
  OrderEvent,
  PlaceOrderRequest,
  CancelOrderRequest,
  AcceptOrderRequest,
  CompleteOrderRequest,
  OrderFilters,
  OrderStatistics,
  CancelledBy
} from '../types';
import { apiService } from '../services/api';

/**
 * Order Store
 * Manages order state for both attendees and baristas
 * Handles API calls and real-time event updates
 */
export const useOrderStore = defineStore('order', () => {
  // ========== State ==========
  
  /**
   * Current active order for the attendee
   * Used in attendee view to track their in-progress order
   */
  const currentOrder = ref<Order | null>(null);

  /**
   * Order history for the attendee
   * Stores completed and cancelled orders
   */
  const orderHistory = ref<Order[]>([]);

  /**
   * Pending orders for barista view
   * All orders in QUEUED or ACCEPTED status
   */
  const pendingOrders = ref<Order[]>([]);

  /**
   * Loading state for async operations
   */
  const isLoading = ref(false);

  /**
   * Error state for displaying error messages
   */
  const error = ref<string | null>(null);

  // ========== Getters ==========

  /**
   * Get orders filtered by status
   */
  const getOrdersByStatus = computed(() => {
    return (status: OrderStatus) => {
      return pendingOrders.value.filter(order => order.status === status);
    };
  });

  /**
   * Get queued orders (waiting for barista acceptance)
   */
  const queuedOrders = computed(() => {
    return pendingOrders.value.filter(order => order.status === 'QUEUED');
  });

  /**
   * Get accepted orders (being prepared by barista)
   */
  const acceptedOrders = computed(() => {
    return pendingOrders.value.filter(order => order.status === 'ACCEPTED');
  });

  /**
   * Get completed orders from history
   */
  const completedOrders = computed(() => {
    return orderHistory.value.filter(order => order.status === 'COMPLETED');
  });

  /**
   * Get cancelled orders from history
   */
  const cancelledOrders = computed(() => {
    return orderHistory.value.filter(order => order.status === 'CANCELLED');
  });

  /**
   * Get orders for today (for daily limit checking)
   * Only counts non-cancelled orders
   */
  const todaysOrders = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return orderHistory.value.filter(order => {
      const orderDate = new Date(order.timestamps.placed).toISOString().split('T')[0];
      return orderDate === today && order.status !== 'CANCELLED';
    });
  });

  /**
   * Count of orders placed today (excluding cancelled orders)
   */
  const todaysOrderCount = computed(() => {
    return todaysOrders.value.length + (currentOrder.value ? 1 : 0);
  });

  /**
   * Check if attendee has reached daily limit
   * Allows up to 3 orders per day (cancelled orders don't count)
   */
  const hasReachedDailyLimit = computed(() => {
    return todaysOrderCount.value >= 3; // Max 3 orders per day
  });

  /**
   * Filter orders based on criteria (for barista dashboard)
   */
  const getFilteredOrders = computed(() => {
    return (filters: OrderFilters) => {
      let filtered = [...pendingOrders.value];

      if (filters.status) {
        filtered = filtered.filter(order => order.status === filters.status);
      }

      if (filters.drinkType) {
        filtered = filtered.filter(
          order => order.orderDetails.drinkType === filters.drinkType
        );
      }

      if (filters.size) {
        filtered = filtered.filter(
          order => order.orderDetails.size === filters.size
        );
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(
          order =>
            order.orderId.toLowerCase().includes(searchLower) ||
            order.attendeeId.toLowerCase().includes(searchLower)
        );
      }

      return filtered;
    };
  });

  /**
   * Calculate order statistics for barista dashboard
   */
  const orderStatistics = computed((): OrderStatistics => {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all completed orders from today
    const completedToday = orderHistory.value.filter(order => {
      if (order.status !== 'COMPLETED' || !order.timestamps.completed) {
        return false;
      }
      const completedDate = new Date(order.timestamps.completed).toISOString().split('T')[0];
      return completedDate === today;
    });

    // Calculate average completion time
    let totalCompletionTime = 0;
    completedToday.forEach(order => {
      if (order.timestamps.placed && order.timestamps.completed) {
        const placed = new Date(order.timestamps.placed).getTime();
        const completed = new Date(order.timestamps.completed).getTime();
        totalCompletionTime += (completed - placed) / 1000 / 60; // Convert to minutes
      }
    });

    const averageCompletionTime = completedToday.length > 0
      ? Math.round(totalCompletionTime / completedToday.length)
      : 0;

    return {
      ordersCompletedToday: completedToday.length,
      averageCompletionTime,
      currentQueueLength: queuedOrders.value.length,
      activeOrders: acceptedOrders.value.length
    };
  });

  /**
   * Get order by ID from all sources
   */
  const getOrderById = computed(() => {
    return (orderId: string): Order | null => {
      // Check current order
      if (currentOrder.value?.orderId === orderId) {
        return currentOrder.value;
      }

      // Check pending orders
      const pending = pendingOrders.value.find(order => order.orderId === orderId);
      if (pending) {
        return pending;
      }

      // Check order history
      const historical = orderHistory.value.find(order => order.orderId === orderId);
      if (historical) {
        return historical;
      }

      return null;
    };
  });

  // ========== Actions ==========

  /**
   * Load pending orders from API
   * Called from barista view on initialization
   */
  async function loadPendingOrders(eventId?: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiService.getOrders({
        status: ['QUEUED', 'ACCEPTED'],
        eventId,
        limit: 100
      });

      // Replace pending orders with fetched orders
      pendingOrders.value = response.orders;

      console.log(`[OrderStore] Loaded ${response.orders.length} pending orders`);
    } catch (err: any) {
      error.value = err.message || 'Failed to load pending orders';
      console.error('Error loading pending orders:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load recent orders and split into pending and history
   * Called from barista view
   * Gets the most recent orders regardless of status, then splits them client-side
   */
  async function loadRecentOrders(eventId?: string, limit: number = 30): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Fetch recent orders without status filter (sorted by time)
      const response = await apiService.getOrders({
        eventId,
        limit
      });

      // Split orders into pending and history based on status
      const pending: Order[] = [];
      const history: Order[] = [];
      
      response.orders.forEach(order => {
        if (order.status === 'QUEUED' || order.status === 'ACCEPTED') {
          pending.push(order);
        } else if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
          history.push(order);
        }
      });

      // Update both lists
      pendingOrders.value = pending;
      orderHistory.value = history;

      console.log(`[OrderStore] Loaded ${response.orders.length} recent orders (${pending.length} pending, ${history.length} history)`);
    } catch (err: any) {
      error.value = err.message || 'Failed to load recent orders';
      console.error('Error loading recent orders:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Place a new coffee order
   * Called from attendee view
   */
  async function placeOrder(
    attendeeId: string,
    eventId: string,
    orderDetails: OrderDetails
  ): Promise<Order | null> {
    isLoading.value = true;
    error.value = null;

    try {
      // Check daily limit before placing order
      if (hasReachedDailyLimit.value) {
        throw new Error('You have reached your daily limit of 3 orders');
      }

      // Call API to place order
      const request: PlaceOrderRequest = {
        attendeeId,
        eventId,
        orderDetails
      };

      const response = await apiService.placeOrder(request);

      // Create order object with initial data
      const newOrder: Order = {
        orderId: response.orderId,
        attendeeId,
        eventId,
        status: response.status,
        orderDetails,
        executionArn: '', // Will be populated by backend
        timestamps: {
          placed: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Set as current order for attendee
      currentOrder.value = newOrder;

      return newOrder;
    } catch (err: any) {
      error.value = err.message || 'Failed to place order';
      console.error('Error placing order:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update order status based on real-time events
   * Called when AppSync Events are received
   */
  function updateOrderStatus(event: OrderEvent): void {
    const { orderId, type, data } = event;

    console.log('[OrderStore] updateOrderStatus called:', { orderId, type, data });

    // Find the order in all possible locations
    let order = getOrderById.value(orderId);

    if (!order) {
      // Order not found, might be a new order for barista queue
      if (type === 'ORDER_QUEUED') {
        console.log('[OrderStore] Creating new order from ORDER_QUEUED event');
        
        // Check if orderDetails exists in data
        if (!data?.orderDetails) {
          console.error('[OrderStore] ORDER_QUEUED event missing orderDetails:', event);
          console.warn(`Order ${orderId} not found and no orderDetails in event`);
          return;
        }
        
        // Create new order object for barista queue
        const newOrder: Order = {
          orderId,
          attendeeId: data.attendeeId || '',
          eventId: data.eventId || '', // Will be populated from event data if available
          status: 'QUEUED',
          orderDetails: data.orderDetails,
          executionArn: '',
          timestamps: {
            placed: event.timestamp,
            queued: event.timestamp
          },
          createdAt: event.timestamp,
          updatedAt: event.timestamp
        };
        
        console.log('[OrderStore] Adding new order to pendingOrders:', newOrder);
        pendingOrders.value.push(newOrder);
        return;
      }
      
      console.warn(`Order ${orderId} not found for status update (type: ${type})`);
      return;
    }

    // Update order based on event type
    switch (type) {
      case 'ORDER_PLACED':
        order.status = 'PENDING';
        order.timestamps.placed = event.timestamp;
        break;

      case 'ORDER_QUEUED':
        order.status = 'QUEUED';
        order.timestamps.queued = event.timestamp;
        // Add to pending orders for barista if not already there
        if (!pendingOrders.value.find(o => o.orderId === orderId)) {
          pendingOrders.value.push(order);
        }
        break;

      case 'ORDER_ACCEPTED':
        order.status = 'ACCEPTED';
        order.timestamps.accepted = event.timestamp;
        if (data.baristaId) {
          order.baristaId = data.baristaId;
        }
        break;

      case 'ORDER_COMPLETED':
        order.status = 'COMPLETED';
        order.timestamps.completed = event.timestamp;
        order.currentPhase = 'COMPLETED';
        order.activeCallbackId = undefined;
        
        // Move from pending to history
        pendingOrders.value = pendingOrders.value.filter(o => o.orderId !== orderId);
        if (!orderHistory.value.find(o => o.orderId === orderId)) {
          orderHistory.value.push(order);
        }
        
        // Clear current order after a delay to let user see the completion animation
        if (currentOrder.value?.orderId === orderId) {
          setTimeout(() => {
            if (currentOrder.value?.orderId === orderId) {
              currentOrder.value = null;
            }
          }, 3000); // 3 second delay to show completion celebration
        }
        break;

      case 'ORDER_CANCELLED':
        order.status = 'CANCELLED';
        order.timestamps.cancelled = event.timestamp;
        order.currentPhase = 'CANCELLED';
        order.activeCallbackId = undefined;
        if (data.reason) {
          order.cancellationReason = data.reason;
        }
        if (data.cancelledBy) {
          order.cancelledBy = data.cancelledBy;
        }
        
        // Move from pending to history
        pendingOrders.value = pendingOrders.value.filter(o => o.orderId !== orderId);
        if (!orderHistory.value.find(o => o.orderId === orderId)) {
          orderHistory.value.push(order);
        }
        
        // Clear current order if it's the attendee's order
        if (currentOrder.value?.orderId === orderId) {
          currentOrder.value = null;
        }
        break;
    }

    // Update timestamp
    order.updatedAt = event.timestamp;
  }

  /**
   * Cancel an order
   * Can be called by attendee or barista
   */
  async function cancelOrder(
    orderId: string,
    reason: string,
    cancelledBy: CancelledBy
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const request: CancelOrderRequest = {
        reason,
        cancelledBy
      };

      await apiService.cancelOrder(orderId, request);

      // Note: Actual status update will come via AppSync Events
      // This just triggers the cancellation request
    } catch (err: any) {
      error.value = err.message || 'Failed to cancel order';
      console.error('Error cancelling order:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Barista accepts an order from the queue
   */
  async function acceptOrder(orderId: string, baristaId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const request: AcceptOrderRequest = {
        baristaId
      };

      await apiService.acceptOrder(orderId, request);

      // Note: Actual status update will come via AppSync Events
      // This just triggers the acceptance
    } catch (err: any) {
      error.value = err.message || 'Failed to accept order';
      console.error('Error accepting order:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Barista marks an order as complete
   */
  async function completeOrder(orderId: string, baristaId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const request: CompleteOrderRequest = {
        baristaId
      };

      await apiService.completeOrder(orderId, request);

      // Note: Actual status update will come via AppSync Events
      // This just triggers the completion
    } catch (err: any) {
      error.value = err.message || 'Failed to complete order';
      console.error('Error completing order:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Add an order to pending orders (for barista queue)
   * Used when receiving ORDER_QUEUED events
   */
  function addToPendingOrders(order: Order): void {
    if (!pendingOrders.value.find(o => o.orderId === order.orderId)) {
      pendingOrders.value.push(order);
    }
  }

  /**
   * Remove an order from pending orders
   * Used when order is completed or cancelled
   */
  function removeFromPendingOrders(orderId: string): void {
    pendingOrders.value = pendingOrders.value.filter(o => o.orderId !== orderId);
  }

  /**
   * Add an order to history
   */
  function addToHistory(order: Order): void {
    if (!orderHistory.value.find(o => o.orderId === order.orderId)) {
      orderHistory.value.push(order);
    }
  }

  /**
   * Clear current order (for attendee)
   */
  function clearCurrentOrder(): void {
    currentOrder.value = null;
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Reset store to initial state
   * Useful for testing or logout
   */
  function $reset(): void {
    currentOrder.value = null;
    orderHistory.value = [];
    pendingOrders.value = [];
    isLoading.value = false;
    error.value = null;
  }

  // ========== Return Store Interface ==========
  return {
    // State
    currentOrder,
    orderHistory,
    pendingOrders,
    isLoading,
    error,

    // Getters
    getOrdersByStatus,
    queuedOrders,
    acceptedOrders,
    completedOrders,
    cancelledOrders,
    todaysOrders,
    todaysOrderCount,
    hasReachedDailyLimit,
    getFilteredOrders,
    orderStatistics,
    getOrderById,

    // Actions
    loadPendingOrders,
    loadRecentOrders,
    placeOrder,
    updateOrderStatus,
    cancelOrder,
    acceptOrder,
    completeOrder,
    addToPendingOrders,
    removeFromPendingOrders,
    addToHistory,
    clearCurrentOrder,
    clearError,
    $reset
  };
});
