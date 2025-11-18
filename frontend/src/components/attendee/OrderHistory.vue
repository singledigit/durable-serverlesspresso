<template>
  <div class="order-history">
    <!-- Header with Daily Count Indicator -->
    <div class="history-header">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-[--color-coffee-brown]">
          Order History
        </h3>
        <button 
          class="daily-count-badge"
          :class="dailyCountBadgeClass"
          @click.stop="clearHistory"
          title="Click to clear history"
        >
          <span class="count-text">{{ todaysOrderCount }}/3</span>
          <span class="count-label">Today</span>
        </button>
      </div>
      
      <!-- Daily Limit Warning -->
      <div 
        v-if="isApproachingLimit" 
        class="limit-warning"
      >
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">
          {{ limitWarningText }}
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="orderHistory.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-text">No order history yet</p>
      <p class="empty-subtext">Your past orders will appear here</p>
    </div>

    <!-- Order Cards -->
    <div v-else class="order-cards-container">
      <div
        v-for="order in sortedOrders"
        :key="order.orderId"
        class="order-card-wrapper"
      >
        <!-- Swipeable Order Card -->
        <div
          class="order-card"
          :class="{ 'card-expanded': expandedOrderId === order.orderId }"
          @click="toggleExpand(order.orderId)"
          @touchstart="handleTouchStart($event, order.orderId)"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          :style="getCardStyle(order.orderId)"
        >
          <!-- Card Header (Always Visible) -->
          <div class="card-header">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="order-icon">
                  {{ getOrderIcon(order.status) }}
                </div>
                <div>
                  <div class="order-id">Order #{{ getShortOrderId(order.orderId) }}</div>
                  <div class="order-date">{{ formatDate(order.timestamps.placed) }}</div>
                </div>
              </div>
              <div 
                class="status-badge"
                :class="getStatusBadgeClass(order.status)"
              >
                {{ getStatusLabel(order.status) }}
              </div>
            </div>
          </div>

          <!-- Card Summary (Always Visible) -->
          <div class="card-summary">
            <div class="summary-item">
              <span class="summary-icon">☕</span>
              <span class="summary-text">
                {{ formatDrinkType(order.orderDetails.drinkType) }} 
                ({{ formatSize(order.orderDetails.size) }})
              </span>
            </div>
            <div v-if="order.orderDetails.customizations && order.orderDetails.customizations.length > 0" class="summary-item">
              <span class="summary-icon">➕</span>
              <span class="summary-text">
                {{ order.orderDetails.customizations.length }} customization{{ order.orderDetails.customizations.length > 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <!-- Expand Indicator -->
          <div class="expand-indicator">
            <span class="expand-text">{{ expandedOrderId === order.orderId ? 'Tap to collapse' : 'Tap for details' }}</span>
            <span class="expand-icon" :class="{ 'icon-rotated': expandedOrderId === order.orderId }">
              ▼
            </span>
          </div>

          <!-- Expanded Details (Conditionally Visible) -->
          <transition name="expand">
            <div v-if="expandedOrderId === order.orderId" class="card-details">
              <!-- Customizations -->
              <div v-if="order.orderDetails.customizations && order.orderDetails.customizations.length > 0" class="detail-section">
                <h5 class="detail-title">Customizations</h5>
                <div class="customization-chips">
                  <span
                    v-for="custom in order.orderDetails.customizations"
                    :key="custom"
                    class="customization-chip"
                  >
                    {{ custom }}
                  </span>
                </div>
              </div>

              <!-- Timeline -->
              <div class="detail-section">
                <h5 class="detail-title">Timeline</h5>
                <div class="timeline">
                  <div v-if="order.timestamps.placed" class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <span class="timeline-label">Placed</span>
                      <span class="timeline-time">{{ formatTime(order.timestamps.placed) }}</span>
                    </div>
                  </div>
                  <div v-if="order.timestamps.queued" class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <span class="timeline-label">Queued</span>
                      <span class="timeline-time">{{ formatTime(order.timestamps.queued) }}</span>
                    </div>
                  </div>
                  <div v-if="order.timestamps.accepted" class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <span class="timeline-label">Accepted</span>
                      <span class="timeline-time">{{ formatTime(order.timestamps.accepted) }}</span>
                    </div>
                  </div>
                  <div v-if="order.timestamps.completed" class="timeline-item">
                    <div class="timeline-dot timeline-dot-success"></div>
                    <div class="timeline-content">
                      <span class="timeline-label">Completed</span>
                      <span class="timeline-time">{{ formatTime(order.timestamps.completed) }}</span>
                    </div>
                  </div>
                  <div v-if="order.timestamps.cancelled" class="timeline-item">
                    <div class="timeline-dot timeline-dot-error"></div>
                    <div class="timeline-content">
                      <span class="timeline-label">Cancelled</span>
                      <span class="timeline-time">{{ formatTime(order.timestamps.cancelled) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cancellation Reason -->
              <div v-if="order.status === 'CANCELLED' && order.cancellationReason" class="detail-section">
                <h5 class="detail-title">Cancellation Reason</h5>
                <p class="cancellation-reason">{{ order.cancellationReason }}</p>
                <p v-if="order.cancelledBy" class="cancelled-by">
                  Cancelled by: {{ formatCancelledBy(order.cancelledBy) }}
                </p>
              </div>

              <!-- Total Time -->
              <div class="detail-section">
                <h5 class="detail-title">Total Time</h5>
                <p class="total-time">{{ calculateTotalTime(order) }}</p>
              </div>
            </div>
          </transition>
        </div>

        <!-- Swipe Delete Indicator -->
        <div 
          v-if="swipeState.orderId === order.orderId && swipeState.distance < -50"
          class="swipe-delete-indicator"
        >
          <span class="delete-icon">🗑️</span>
          <span class="delete-text">Release to remove</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOrderStore } from '../../stores/orderStore';
import type { Order, OrderStatus, CancelledBy } from '../../types';

// ========== Store ==========
const orderStore = useOrderStore();

// ========== State ==========
const expandedOrderId = ref<string | null>(null);
const swipeState = ref<{
  orderId: string | null;
  startX: number;
  currentX: number;
  distance: number;
  isSwiping: boolean;
}>({
  orderId: null,
  startX: 0,
  currentX: 0,
  distance: 0,
  isSwiping: false
});

// ========== Computed ==========

/**
 * Get order history from store
 */
const orderHistory = computed(() => {
  return orderStore.orderHistory;
});

/**
 * Sort orders by most recent first
 */
const sortedOrders = computed(() => {
  return [...orderHistory.value].sort((a, b) => {
    const aTime = new Date(a.timestamps.placed).getTime();
    const bTime = new Date(b.timestamps.placed).getTime();
    return bTime - aTime; // Most recent first
  });
});

/**
 * Count of orders placed today
 */
const todaysOrderCount = computed(() => {
  return orderStore.todaysOrderCount;
});

/**
 * Check if approaching daily limit (2 or more orders)
 */
const isApproachingLimit = computed(() => {
  return todaysOrderCount.value >= 2;
});

/**
 * CSS class for daily count badge
 */
const dailyCountBadgeClass = computed(() => {
  if (todaysOrderCount.value >= 3) {
    return 'badge-limit-reached';
  } else if (todaysOrderCount.value >= 2) {
    return 'badge-limit-warning';
  } else {
    return 'badge-limit-normal';
  }
});

/**
 * Warning text for daily limit
 */
const limitWarningText = computed(() => {
  if (todaysOrderCount.value >= 3) {
    return 'Daily limit reached (3/3 orders)';
  } else if (todaysOrderCount.value === 2) {
    return 'Approaching daily limit (2/3 orders)';
  }
  return '';
});

// ========== Methods ==========

/**
 * Toggle expand/collapse for order details
 */
function toggleExpand(orderId: string): void {
  if (swipeState.value.isSwiping) {
    return; // Don't toggle if swiping
  }
  
  if (expandedOrderId.value === orderId) {
    expandedOrderId.value = null;
  } else {
    expandedOrderId.value = orderId;
  }
  
  // Provide haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

/**
 * Handle touch start for swipe gesture
 */
function handleTouchStart(event: TouchEvent, orderId: string): void {
  const touch = event.touches[0];
  if (!touch) return;
  
  swipeState.value = {
    orderId,
    startX: touch.clientX,
    currentX: touch.clientX,
    distance: 0,
    isSwiping: false
  };
}

/**
 * Handle touch move for swipe gesture
 */
function handleTouchMove(event: TouchEvent): void {
  if (!swipeState.value.orderId) {
    return;
  }
  
  const touch = event.touches[0];
  if (!touch) return;
  
  swipeState.value.currentX = touch.clientX;
  swipeState.value.distance = swipeState.value.currentX - swipeState.value.startX;
  
  // Mark as swiping if moved more than 10px
  if (Math.abs(swipeState.value.distance) > 10) {
    swipeState.value.isSwiping = true;
  }
  
  // Only allow left swipe (negative distance)
  if (swipeState.value.distance > 0) {
    swipeState.value.distance = 0;
  }
}

/**
 * Handle touch end for swipe gesture
 */
function handleTouchEnd(): void {
  if (!swipeState.value.orderId) {
    return;
  }
  
  // If swiped far enough left, remove from history
  if (swipeState.value.distance < -100) {
    removeFromHistory(swipeState.value.orderId);
    
    // Provide haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
  }
  
  // Reset swipe state
  setTimeout(() => {
    swipeState.value = {
      orderId: null,
      startX: 0,
      currentX: 0,
      distance: 0,
      isSwiping: false
    };
  }, 300);
}

/**
 * Get card style for swipe animation
 */
function getCardStyle(orderId: string): Record<string, string> {
  if (swipeState.value.orderId === orderId && swipeState.value.isSwiping) {
    return {
      transform: `translateX(${swipeState.value.distance}px)`,
      transition: 'none'
    };
  }
  return {
    transform: 'translateX(0)',
    transition: 'transform 0.3s ease-out'
  };
}

/**
 * Remove order from history (local only, not from backend)
 */
function removeFromHistory(orderId: string): void {
  const index = orderStore.orderHistory.findIndex(o => o.orderId === orderId);
  if (index > -1) {
    orderStore.orderHistory.splice(index, 1);
  }
}

/**
 * Get short order ID for display
 */
function getShortOrderId(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

/**
 * Get icon for order status
 */
function getOrderIcon(status: OrderStatus): string {
  const icons: Record<OrderStatus, string> = {
    PENDING: '⏳',
    QUEUED: '📋',
    ACCEPTED: '☕',
    COMPLETED: '✅',
    CANCELLED: '❌'
  };
  return icons[status] || '📋';
}

/**
 * Get status label for display
 */
function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING: 'Pending',
    QUEUED: 'Queued',
    ACCEPTED: 'Preparing',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  };
  return labels[status] || status;
}

/**
 * Get CSS class for status badge
 */
function getStatusBadgeClass(status: OrderStatus): string {
  const classes: Record<OrderStatus, string> = {
    PENDING: 'badge-pending',
    QUEUED: 'badge-queued',
    ACCEPTED: 'badge-accepted',
    COMPLETED: 'badge-completed',
    CANCELLED: 'badge-cancelled'
  };
  return classes[status] || 'badge-pending';
}

/**
 * Format drink type for display
 */
function formatDrinkType(drinkType: string): string {
  return drinkType.charAt(0).toUpperCase() + drinkType.slice(1);
}

/**
 * Format size for display
 */
function formatSize(size: string): string {
  const sizeMap: Record<string, string> = {
    small: 'S',
    medium: 'M',
    large: 'L'
  };
  return sizeMap[size] || size;
}

/**
 * Format date for display
 */
function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateStr = date.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (dateStr === todayStr) {
    return 'Today, ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else if (dateStr === yesterdayStr) {
    return 'Yesterday, ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

/**
 * Format time for display
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

/**
 * Format cancelled by for display
 */
function formatCancelledBy(cancelledBy: CancelledBy): string {
  const labels: Record<CancelledBy, string> = {
    attendee: 'You',
    barista: 'Barista',
    system: 'System'
  };
  return labels[cancelledBy] || cancelledBy;
}

/**
 * Calculate total time from placement to completion/cancellation
 */
function calculateTotalTime(order: Order): string {
  if (!order.timestamps.placed) {
    return 'Unknown';
  }
  
  let endTime: number;
  if (order.status === 'COMPLETED' && order.timestamps.completed) {
    endTime = new Date(order.timestamps.completed).getTime();
  } else if (order.status === 'CANCELLED' && order.timestamps.cancelled) {
    endTime = new Date(order.timestamps.cancelled).getTime();
  } else {
    return 'In progress';
  }
  
  const placed = new Date(order.timestamps.placed).getTime();
  const totalMinutes = Math.floor((endTime - placed) / 1000 / 60);
  
  if (totalMinutes < 1) {
    return 'Less than a minute';
  } else if (totalMinutes === 1) {
    return '1 minute';
  } else {
    return `${totalMinutes} minutes`;
  }
}

/**
 * Clear order history (secret button)
 */
function clearHistory(): void {
  if (confirm('Clear all order history? This cannot be undone.')) {
    // Clear the order store
    orderStore.orderHistory = [];
    
    // Clear localStorage
    const attendeeId = localStorage.getItem('attendeeId');
    if (attendeeId) {
      localStorage.removeItem(`orderHistory_${attendeeId}`);
    }
    
    // Collapse any expanded cards
    expandedOrderId.value = null;
    
    // Provide haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
    
    console.log('[OrderHistory] History cleared');
  }
}
</script>

<style scoped>
/* Container */
.order-history {
  width: 100%;
  animation: fade-in 0.3s ease-out;
}

/* Header */
.history-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--color-coffee-cream);
}

/* Daily Count Badge */
.daily-count-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  min-width: 70px;
  box-shadow: 0 2px 4px rgb(0 0 0 / 0.1);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.daily-count-badge:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgb(0 0 0 / 0.15);
}

.daily-count-badge:active {
  transform: scale(0.95);
  transition: transform 0.05s ease-out;
}

.badge-limit-normal {
  background: linear-gradient(135deg, rgb(220 252 231), rgb(187 247 208));
  border: 2px solid rgb(134 239 172);
}

.badge-limit-warning {
  background: linear-gradient(135deg, rgb(254 243 199), rgb(253 224 71));
  border: 2px solid rgb(250 204 21);
  animation: pulse-warning 2s ease-in-out infinite;
}

.badge-limit-reached {
  background: linear-gradient(135deg, rgb(254 226 226), rgb(252 165 165));
  border: 2px solid rgb(248 113 113);
  animation: pulse-error 2s ease-in-out infinite;
}

.count-text {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
}

.count-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
  opacity: 0.8;
}

/* Limit Warning */
.limit-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: rgb(254 243 199);
  border-left: 4px solid rgb(250 204 21);
  border-radius: 0.5rem;
}

.warning-icon {
  font-size: 1.25rem;
}

.warning-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(146 64 14);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(107 114 128);
  margin-bottom: 0.5rem;
}

.empty-subtext {
  font-size: 0.875rem;
  color: rgb(156 163 175);
}

/* Order Cards Container */
.order-cards-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Order Card Wrapper (for swipe delete indicator) */
.order-card-wrapper {
  position: relative;
}

/* Order Card */
.order-card {
  background: white;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  border: 2px solid var(--color-coffee-cream);
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s ease-out; /* Fast response - under 100ms */
}

/* Instant feedback on touch */
.order-card:active {
  transform: scale(0.98);
  transition: transform 0.05s ease-out; /* 50ms - instant feedback */
}

.card-expanded {
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  border-color: var(--color-coffee-brown);
  animation: card-expand 0.3s ease-out;
}

@keyframes card-expand {
  0% {
    transform: scale(0.98);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}

/* Card Header */
.card-header {
  margin-bottom: 0.75rem;
}

.order-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-coffee-cream);
  border-radius: 0.5rem;
}

.order-id {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-coffee-brown);
}

.order-date {
  font-size: 0.75rem;
  color: rgb(107 114 128);
  margin-top: 0.125rem;
}

/* Status Badge */
.status-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-pending {
  background-color: rgb(243 244 246);
  color: rgb(75 85 99);
}

.badge-queued {
  background-color: rgb(254 243 199);
  color: rgb(146 64 14);
}

.badge-accepted {
  background-color: rgb(219 234 254);
  color: rgb(30 64 175);
}

.badge-completed {
  background-color: rgb(220 252 231);
  color: rgb(22 101 52);
}

.badge-cancelled {
  background-color: rgb(254 226 226);
  color: rgb(153 27 27);
}

/* Card Summary */
.card-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgb(55 65 81);
}

.summary-icon {
  font-size: 1rem;
}

.summary-text {
  font-weight: 500;
}

/* Expand Indicator */
.expand-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-coffee-cream);
}

.expand-text {
  font-size: 0.75rem;
  color: rgb(107 114 128);
  font-weight: 500;
}

.expand-icon {
  font-size: 0.75rem;
  color: rgb(107 114 128);
  transition: transform 0.3s ease;
}

.icon-rotated {
  transform: rotate(180deg);
}

/* Card Details (Expanded) */
.card-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid var(--color-coffee-cream);
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(107 114 128);
  margin-bottom: 0.5rem;
}

/* Customization Chips */
.customization-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.customization-chip {
  padding: 0.375rem 0.75rem;
  background-color: var(--color-coffee-latte);
  color: white;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--color-coffee-brown);
  flex-shrink: 0;
}

.timeline-dot-success {
  background-color: rgb(34 197 94);
}

.timeline-dot-error {
  background-color: rgb(239 68 68);
}

.timeline-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
}

.timeline-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(55 65 81);
}

.timeline-time {
  font-size: 0.75rem;
  color: rgb(107 114 128);
}

/* Cancellation Reason */
.cancellation-reason {
  font-size: 0.875rem;
  color: rgb(55 65 81);
  margin-bottom: 0.25rem;
}

.cancelled-by {
  font-size: 0.75rem;
  color: rgb(107 114 128);
  font-style: italic;
}

/* Total Time */
.total-time {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-coffee-brown);
}

/* Swipe Delete Indicator */
.swipe-delete-indicator {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1.5rem;
  background: linear-gradient(to left, rgb(239 68 68), rgb(220 38 38));
  border-radius: 1rem;
  z-index: -1;
}

.delete-icon {
  font-size: 1.5rem;
  margin-right: 0.5rem;
}

.delete-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Expand Transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* Animations */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(250, 204, 21, 0);
  }
}

@keyframes pulse-error {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(248, 113, 113, 0);
  }
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .order-card {
    padding: 0.875rem;
  }
  
  .card-header {
    margin-bottom: 0.625rem;
  }
  
  .order-icon {
    width: 36px;
    height: 36px;
    font-size: 1.25rem;
  }
  
  .detail-section {
    margin-bottom: 0.875rem;
  }
}

/* Smooth transitions */
* {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
</style>
