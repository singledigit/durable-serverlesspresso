<template>
  <div 
    class="order-card card bg-white hover:shadow-xl transition-all cursor-pointer"
    :class="getCardStateClass()"
    @click="$emit('view-details', order.orderId)"
  >
    <!-- Order Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1">
        <div class="text-xs text-gray-500 mb-1">
          Order #{{ order.orderId.slice(-8).toUpperCase() }}
        </div>
        <div class="text-lg font-bold text-[--color-coffee-brown]">
          {{ formatDrinkName(order.orderDetails.drinkType) }}
        </div>
        <div class="text-sm text-gray-600 font-medium">
          {{ formatSize(order.orderDetails.size) }}
        </div>
      </div>
      <div 
        class="status-badge px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
        :class="getStatusBadgeClass(order.status)"
      >
        {{ order.status }}
      </div>
    </div>

    <!-- Customizations -->
    <div 
      v-if="order.orderDetails.customizations && order.orderDetails.customizations.length > 0" 
      class="mb-3"
    >
      <div class="text-xs text-gray-500 mb-1 font-medium">Customizations:</div>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="custom in order.orderDetails.customizations"
          :key="custom"
          class="px-2 py-1 bg-[--color-latte] text-[--color-coffee-brown] rounded text-xs font-medium"
        >
          {{ custom }}
        </span>
      </div>
    </div>

    <!-- Attendee Info -->
    <div class="mb-3 pb-3 border-b border-gray-200">
      <div class="flex items-center gap-2 text-xs text-gray-600">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span class="font-medium">{{ order.attendeeId }}</span>
      </div>
    </div>

    <!-- Time Info -->
    <div class="mb-3">
      <div class="flex items-center gap-2 text-xs">
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span :class="getTimeClass()">
          {{ formatTimeAgo(order.timestamps.placed) }}
        </span>
      </div>
      <div v-if="order.status === 'ACCEPTED' && order.timestamps.accepted" class="flex items-center gap-2 text-xs mt-1">
        <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-blue-600 font-medium">
          In progress for {{ formatDuration(order.timestamps.accepted) }}
        </span>
      </div>
    </div>

    <!-- Barista Info (if accepted) -->
    <div v-if="order.baristaId && order.status === 'ACCEPTED'" class="mb-3 text-xs text-blue-600 font-medium">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Barista: {{ order.baristaId }}</span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-2" @click.stop>
      <!-- Accept Button (QUEUED orders only) -->
      <button
        v-if="order.status === 'QUEUED'"
        class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
        :disabled="isProcessing"
        @click="handleAccept"
      >
        <svg v-if="!isProcessing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ isProcessing ? 'Accepting...' : 'Accept' }}</span>
      </button>

      <!-- Complete Button (ACCEPTED orders only) -->
      <button
        v-if="order.status === 'ACCEPTED'"
        class="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
        :disabled="isProcessing"
        @click="handleComplete"
      >
        <svg v-if="!isProcessing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ isProcessing ? 'Completing...' : 'Complete' }}</span>
      </button>

      <!-- Cancel Button (always visible for QUEUED and ACCEPTED) -->
      <button
        v-if="order.status === 'QUEUED' || order.status === 'ACCEPTED'"
        class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1"
        :disabled="isProcessing"
        @click="handleCancelClick"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>Cancel</span>
      </button>
    </div>

    <!-- Cancel Reason Modal -->
    <Teleport to="body">
      <div
        v-if="showCancelModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click.self="closeCancelModal"
      >
        <div 
          class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-modal-in"
          @click.stop
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">Cancel Order</h3>
            <button
              @click="closeCancelModal"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <p class="text-sm text-gray-600 mb-3">
              Order #{{ order.orderId.slice(-8).toUpperCase() }} - {{ formatDrinkName(order.orderDetails.drinkType) }}
            </p>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Cancellation Reason <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="cancelReason"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows="3"
              placeholder="Enter reason for cancellation..."
              :disabled="isProcessing"
            ></textarea>
            <p v-if="cancelReasonError" class="text-xs text-red-500 mt-1">
              {{ cancelReasonError }}
            </p>
          </div>

          <div class="flex gap-3">
            <button
              @click="closeCancelModal"
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              :disabled="isProcessing"
            >
              Keep Order
            </button>
            <button
              @click="handleCancelConfirm"
              class="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              :disabled="isProcessing || !cancelReason.trim()"
            >
              <svg v-if="!isProcessing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isProcessing ? 'Cancelling...' : 'Cancel Order' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Order, OrderStatus, DrinkType, DrinkSize } from '../../types';

// ========== Props ==========
interface Props {
  order: Order;
  baristaId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  baristaId: 'barista-default'
});

// ========== Emits ==========
const emit = defineEmits<{
  'accept-order': [orderId: string, baristaId: string];
  'complete-order': [orderId: string, baristaId: string];
  'cancel-order': [orderId: string, reason: string];
  'view-details': [orderId: string];
}>();

// ========== State ==========
const isProcessing = ref(false);
const showCancelModal = ref(false);
const cancelReason = ref('');
const cancelReasonError = ref('');

// ========== Methods ==========

/**
 * Format drink name (capitalize first letter)
 */
function formatDrinkName(drinkType: DrinkType): string {
  return drinkType.charAt(0).toUpperCase() + drinkType.slice(1);
}

/**
 * Format size display
 */
function formatSize(size: DrinkSize): string {
  const sizeMap: Record<DrinkSize, string> = {
    small: 'Small',
    medium: 'Medium',
    large: 'Large'
  };
  return sizeMap[size];
}

/**
 * Get CSS class for status badge
 */
function getStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-gray-100 text-gray-800';
    case 'QUEUED':
      return 'bg-yellow-100 text-yellow-800';
    case 'ACCEPTED':
      return 'bg-blue-100 text-blue-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get CSS class for card state
 */
function getCardStateClass(): string {
  switch (props.order.status) {
    case 'QUEUED':
      return 'border-l-4 border-yellow-500';
    case 'ACCEPTED':
      return 'border-l-4 border-blue-500';
    default:
      return '';
  }
}

/**
 * Get CSS class for time display based on urgency
 */
function getTimeClass(): string {
  const minutesAgo = getMinutesAgo(props.order.timestamps.placed);
  
  if (minutesAgo > 5) {
    return 'text-red-600 font-bold'; // Urgent - over 5 minutes
  } else if (minutesAgo > 3) {
    return 'text-orange-600 font-medium'; // Warning - over 3 minutes
  } else {
    return 'text-gray-600'; // Normal
  }
}

/**
 * Calculate minutes ago from timestamp
 */
function getMinutesAgo(timestamp: string): number {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  return Math.floor((now - then) / 1000 / 60);
}

/**
 * Format time ago (e.g., "2 minutes ago")
 */
function formatTimeAgo(timestamp: string): string {
  const diffMins = getMinutesAgo(timestamp);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  return `${diffHours} hours ago`;
}

/**
 * Format duration since timestamp (e.g., "5 mins")
 */
function formatDuration(timestamp: string): string {
  const diffMins = getMinutesAgo(timestamp);

  if (diffMins < 1) return 'less than 1 min';
  if (diffMins === 1) return '1 min';
  if (diffMins < 60) return `${diffMins} mins`;
  
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours === 1) {
    return remainingMins > 0 ? `1 hr ${remainingMins} mins` : '1 hr';
  }
  return remainingMins > 0 ? `${diffHours} hrs ${remainingMins} mins` : `${diffHours} hrs`;
}

/**
 * Handle accept button click
 */
async function handleAccept(): Promise<void> {
  if (isProcessing.value) return;

  isProcessing.value = true;
  try {
    emit('accept-order', props.order.orderId, props.baristaId);
    // Wait a bit to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('Error accepting order:', error);
  } finally {
    isProcessing.value = false;
  }
}

/**
 * Handle complete button click
 */
async function handleComplete(): Promise<void> {
  if (isProcessing.value) return;

  isProcessing.value = true;
  try {
    emit('complete-order', props.order.orderId, props.baristaId);
    // Wait a bit to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('Error completing order:', error);
  } finally {
    isProcessing.value = false;
  }
}

/**
 * Handle cancel button click - show modal
 */
function handleCancelClick(): void {
  showCancelModal.value = true;
  cancelReason.value = '';
  cancelReasonError.value = '';
}

/**
 * Close cancel modal
 */
function closeCancelModal(): void {
  if (isProcessing.value) return;
  showCancelModal.value = false;
  cancelReason.value = '';
  cancelReasonError.value = '';
}

/**
 * Handle cancel confirmation
 */
async function handleCancelConfirm(): Promise<void> {
  if (isProcessing.value) return;

  // Validate reason
  if (!cancelReason.value.trim()) {
    cancelReasonError.value = 'Please provide a cancellation reason';
    return;
  }

  if (cancelReason.value.trim().length < 3) {
    cancelReasonError.value = 'Reason must be at least 3 characters';
    return;
  }

  isProcessing.value = true;
  cancelReasonError.value = '';

  try {
    emit('cancel-order', props.order.orderId, cancelReason.value.trim());
    // Wait a bit to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    closeCancelModal();
  } catch (error) {
    console.error('Error cancelling order:', error);
    cancelReasonError.value = 'Failed to cancel order. Please try again.';
  } finally {
    isProcessing.value = false;
  }
}
</script>

<style scoped>
/* Card styling */
.card {
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.order-card {
  transition: all 0.2s ease-out;
  position: relative;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Button styling */
button {
  transition: all 0.15s ease-out;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal animation */
@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-modal-in {
  animation: modal-in 0.2s ease-out;
}

/* Spinner animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Status badge pulse for urgent orders */
.order-card.border-yellow-500 .status-badge {
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Smooth transitions */
* {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Focus styles for accessibility */
button:focus-visible {
  outline: 2px solid var(--color-coffee-brown);
  outline-offset: 2px;
}

textarea:focus-visible {
  outline: none;
}

/* Scrollbar styling for modal */
textarea::-webkit-scrollbar {
  width: 8px;
}

textarea::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

textarea::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
