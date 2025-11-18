<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click.self="handleClose"
      >
        <div 
          class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-modal-in"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[--color-coffee-brown] to-[#8B6F47] text-white">
            <div class="flex-1">
              <h2 class="text-2xl font-bold mb-1">Order Details</h2>
              <p class="text-sm opacity-90">
                Order #{{ order.orderId.slice(-8).toUpperCase() }}
              </p>
            </div>
            <button
              @click="handleClose"
              class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
              aria-label="Close"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content (Scrollable) -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Status Badge -->
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm text-gray-500 mb-1">Current Status</div>
                <div 
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                  :class="getStatusBadgeClass(order.status)"
                >
                  <div class="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                  {{ order.status }}
                </div>
              </div>
              <div v-if="order.baristaId" class="text-right">
                <div class="text-sm text-gray-500 mb-1">Assigned Barista</div>
                <div class="text-lg font-semibold text-[--color-coffee-brown]">
                  {{ order.baristaId }}
                </div>
              </div>
            </div>

            <!-- Order Information -->
            <div class="card bg-gray-50">
              <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-[--color-coffee-brown]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Order Information
              </h3>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-xs text-gray-500 mb-1 font-medium">Drink Type</div>
                  <div class="text-2xl font-bold text-[--color-coffee-brown]">
                    {{ formatDrinkName(order.orderDetails.drinkType) }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1 font-medium">Size</div>
                  <div class="text-2xl font-bold text-gray-700">
                    {{ formatSize(order.orderDetails.size) }}
                  </div>
                </div>
              </div>

              <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="text-xs text-gray-500 mb-1 font-medium">Attendee ID</div>
                <div class="flex items-center gap-2 text-gray-700">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span class="font-mono font-medium">{{ order.attendeeId }}</span>
                </div>
              </div>
            </div>

            <!-- Customizations -->
            <div class="card bg-[--color-latte] bg-opacity-20 border border-[--color-latte]">
              <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-[--color-coffee-brown]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Customizations
              </h3>
              
              <div v-if="order.orderDetails.customizations && order.orderDetails.customizations.length > 0">
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="(custom, index) in order.orderDetails.customizations"
                    :key="index"
                    class="px-3 py-2 bg-white border-2 border-[--color-coffee-brown] text-[--color-coffee-brown] rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ custom }}
                  </div>
                </div>
              </div>
              <div v-else class="text-gray-500 italic text-sm">
                No customizations requested
              </div>
            </div>

            <!-- Action History Timeline -->
            <div class="card bg-white border border-gray-200">
              <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-[--color-coffee-brown]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Action History
              </h3>
              
              <div class="space-y-4">
                <!-- Timeline Item: Placed -->
                <div v-if="order.timestamps.placed" class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div v-if="order.timestamps.queued || order.timestamps.accepted || order.timestamps.completed || order.timestamps.cancelled" class="w-0.5 h-full bg-gray-300 mt-1"></div>
                  </div>
                  <div class="flex-1 pb-4">
                    <div class="font-semibold text-gray-900">Order Placed</div>
                    <div class="text-sm text-gray-500">{{ formatTimestamp(order.timestamps.placed) }}</div>
                    <div class="text-xs text-gray-400 mt-1">{{ formatTimeAgo(order.timestamps.placed) }}</div>
                  </div>
                </div>

                <!-- Timeline Item: Queued -->
                <div v-if="order.timestamps.queued" class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div v-if="order.timestamps.accepted || order.timestamps.completed || order.timestamps.cancelled" class="w-0.5 h-full bg-gray-300 mt-1"></div>
                  </div>
                  <div class="flex-1 pb-4">
                    <div class="font-semibold text-gray-900">Added to Queue</div>
                    <div class="text-sm text-gray-500">{{ formatTimestamp(order.timestamps.queued) }}</div>
                    <div class="text-xs text-gray-400 mt-1">{{ formatTimeAgo(order.timestamps.queued) }}</div>
                  </div>
                </div>

                <!-- Timeline Item: Accepted -->
                <div v-if="order.timestamps.accepted" class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div v-if="order.timestamps.completed || order.timestamps.cancelled" class="w-0.5 h-full bg-gray-300 mt-1"></div>
                  </div>
                  <div class="flex-1 pb-4">
                    <div class="font-semibold text-gray-900">Accepted by Barista</div>
                    <div class="text-sm text-gray-500">{{ formatTimestamp(order.timestamps.accepted) }}</div>
                    <div class="text-xs text-gray-400 mt-1">{{ formatTimeAgo(order.timestamps.accepted) }}</div>
                    <div v-if="order.baristaId" class="text-xs text-blue-600 mt-1 font-medium">
                      Barista: {{ order.baristaId }}
                    </div>
                  </div>
                </div>

                <!-- Timeline Item: Completed -->
                <div v-if="order.timestamps.completed" class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-green-700">Order Completed</div>
                    <div class="text-sm text-gray-500">{{ formatTimestamp(order.timestamps.completed) }}</div>
                    <div class="text-xs text-gray-400 mt-1">{{ formatTimeAgo(order.timestamps.completed) }}</div>
                    <div v-if="order.timestamps.placed && order.timestamps.completed" class="text-xs text-green-600 mt-1 font-medium">
                      Total time: {{ calculateDuration(order.timestamps.placed, order.timestamps.completed) }}
                    </div>
                  </div>
                </div>

                <!-- Timeline Item: Cancelled -->
                <div v-if="order.timestamps.cancelled" class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-red-700">Order Cancelled</div>
                    <div class="text-sm text-gray-500">{{ formatTimestamp(order.timestamps.cancelled) }}</div>
                    <div class="text-xs text-gray-400 mt-1">{{ formatTimeAgo(order.timestamps.cancelled) }}</div>
                    <div v-if="order.cancellationReason" class="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
                      <span class="font-medium">Reason:</span> {{ order.cancellationReason }}
                    </div>
                    <div v-if="order.cancelledBy" class="text-xs text-gray-500 mt-1">
                      Cancelled by: {{ order.cancelledBy }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Barista Notes -->
            <div class="card bg-white border border-gray-200">
              <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-[--color-coffee-brown]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Barista Notes
              </h3>
              
              <textarea
                v-model="notes"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[--color-coffee-brown] focus:border-transparent resize-none"
                rows="4"
                placeholder="Add notes about this order (e.g., special requests, issues, etc.)..."
                :disabled="order.status === 'COMPLETED' || order.status === 'CANCELLED'"
              ></textarea>
              
              <div class="flex items-center justify-between mt-2">
                <div class="text-xs text-gray-500">
                  {{ notes.length }} / 500 characters
                </div>
                <button
                  v-if="notes !== initialNotes && order.status !== 'COMPLETED' && order.status !== 'CANCELLED'"
                  @click="saveNotes"
                  class="px-3 py-1 bg-[--color-coffee-brown] text-white rounded text-xs font-medium hover:opacity-90 transition-opacity"
                  :disabled="isSavingNotes"
                >
                  {{ isSavingNotes ? 'Saving...' : 'Save Notes' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              @click="handleClose"
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Close
            </button>
            <button
              v-if="order.status === 'QUEUED'"
              @click="$emit('accept-order', order.orderId)"
              class="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Accept Order
            </button>
            <button
              v-if="order.status === 'ACCEPTED'"
              @click="$emit('complete-order', order.orderId)"
              class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete Order
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Order, DrinkType, DrinkSize, OrderStatus } from '../../types';

// ========== Props ==========
interface Props {
  order: Order;
  isOpen: boolean;
}

const props = defineProps<Props>();

// ========== Emits ==========
const emit = defineEmits<{
  'close': [];
  'accept-order': [orderId: string];
  'complete-order': [orderId: string];
  'update-notes': [orderId: string, notes: string];
}>();

// ========== State ==========
const notes = ref<string>('');
const initialNotes = ref<string>('');
const isSavingNotes = ref(false);

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
      return 'bg-gray-100 text-gray-800 border border-gray-300';
    case 'QUEUED':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case 'ACCEPTED':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 border border-green-300';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 border border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
}

/**
 * Format timestamp to readable date/time
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format time ago (e.g., "2 minutes ago")
 */
function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 1000 / 60);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(startTimestamp: string, endTimestamp: string): string {
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 1000 / 60);

  if (diffMins < 1) return 'less than 1 minute';
  if (diffMins === 1) return '1 minute';
  if (diffMins < 60) return `${diffMins} minutes`;
  
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  
  if (diffHours === 1) {
    return remainingMins > 0 ? `1 hour ${remainingMins} min` : '1 hour';
  }
  
  return remainingMins > 0 ? `${diffHours} hours ${remainingMins} min` : `${diffHours} hours`;
}

/**
 * Handle close button click
 */
function handleClose(): void {
  emit('close');
}

/**
 * Save barista notes
 */
async function saveNotes(): Promise<void> {
  if (isSavingNotes.value) return;

  isSavingNotes.value = true;
  try {
    emit('update-notes', props.order.orderId, notes.value);
    initialNotes.value = notes.value;
    
    // Simulate save delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('Error saving notes:', error);
  } finally {
    isSavingNotes.value = false;
  }
}

// ========== Watchers ==========

/**
 * Watch for order changes to reset notes
 */
watch(() => props.order.orderId, () => {
  // Reset notes when order changes
  // In a real implementation, notes would be loaded from backend
  notes.value = '';
  initialNotes.value = '';
}, { immediate: true });

/**
 * Handle escape key to close modal
 */
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }
});
</script>

<style scoped>
/* Card styling */
.card {
  padding: 1.25rem;
  border-radius: 0.75rem;
}

/* Modal animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .animate-modal-in,
.modal-leave-active .animate-modal-in {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from .animate-modal-in {
  transform: scale(0.95) translateY(-20px);
  opacity: 0;
}

.modal-leave-to .animate-modal-in {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-modal-in {
  animation: modal-in 0.3s ease-out;
}

/* Pulse animation for status badge */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Textarea styling */
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

/* Focus styles for accessibility */
button:focus-visible {
  outline: 2px solid var(--color-coffee-brown);
  outline-offset: 2px;
}

textarea:focus-visible {
  outline: none;
}

/* Smooth transitions */
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

/* Timeline connector line */
.flex-col .w-0\.5 {
  flex-grow: 1;
}

/* Gradient header */
.bg-gradient-to-r {
  background-image: linear-gradient(to right, var(--color-coffee-brown), #8B6F47);
}
</style>
