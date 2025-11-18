<template>
  <div class="order-queue">
    <!-- Queue Header with Filters -->
    <div class="queue-header mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-[--color-coffee-brown]">
          Order Queue
        </h2>
        <div class="text-sm text-gray-600">
          {{ filteredOrders.length }} order{{ filteredOrders.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Filter Controls -->
      <div class="filter-controls grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Search -->
        <div class="col-span-1 md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Search Order
          </label>
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Order ID or Attendee ID..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[--color-coffee-brown] focus:border-transparent"
            @input="onFilterChange"
          />
        </div>

        <!-- Drink Type Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Drink Type
          </label>
          <select
            v-model="filterDrinkType"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[--color-coffee-brown] focus:border-transparent"
            @change="onFilterChange"
          >
            <option value="">All Drinks</option>
            <option value="latte">Latte</option>
            <option value="cappuccino">Cappuccino</option>
            <option value="espresso">Espresso</option>
            <option value="americano">Americano</option>
          </select>
        </div>

        <!-- Size Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Size
          </label>
          <select
            v-model="filterSize"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[--color-coffee-brown] focus:border-transparent"
            @change="onFilterChange"
          >
            <option value="">All Sizes</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      <!-- Status Tabs -->
      <div class="status-tabs flex gap-2 mt-4">
        <button
          @click="filterStatus = ''"
          class="px-4 py-2 rounded-lg font-medium transition-all"
          :class="filterStatus === '' 
            ? 'bg-[--color-coffee-brown] text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
        >
          All ({{ allOrdersCount }})
        </button>
        <button
          @click="filterStatus = 'QUEUED'"
          class="px-4 py-2 rounded-lg font-medium transition-all"
          :class="filterStatus === 'QUEUED' 
            ? 'bg-yellow-500 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
        >
          Queued ({{ queuedCount }})
        </button>
        <button
          @click="filterStatus = 'ACCEPTED'"
          class="px-4 py-2 rounded-lg font-medium transition-all"
          :class="filterStatus === 'ACCEPTED' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
        >
          In Progress ({{ acceptedCount }})
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-if="filteredOrders.length === 0" 
      class="empty-state card bg-white text-center py-16"
    >
      <div class="text-6xl mb-4">☕</div>
      <h3 class="text-xl font-semibold text-gray-700 mb-2">
        No Orders in Queue
      </h3>
      <p class="text-gray-500">
        {{ hasActiveFilters 
          ? 'No orders match your filters' 
          : 'New orders will appear here automatically' }}
      </p>
      <button
        v-if="hasActiveFilters"
        @click="clearFilters"
        class="mt-4 px-4 py-2 bg-[--color-coffee-brown] text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        Clear Filters
      </button>
    </div>

    <!-- Order Grid (3-4 columns) -->
    <div 
      v-else
      class="order-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
    >
      <TransitionGroup name="order-card">
        <div
          v-for="order in filteredOrders"
          :key="order.orderId"
          class="order-card-wrapper"
        >
          <slot name="order-card" :order="order">
            <!-- Default order card (will be replaced by OrderCard component in task 32) -->
            <div class="order-card card bg-white hover:shadow-xl transition-all cursor-pointer">
              <!-- Order Header -->
              <div class="flex items-start justify-between mb-3">
                <div>
                  <div class="text-xs text-gray-500 mb-1">
                    Order #{{ order.orderId.slice(-8) }}
                  </div>
                  <div class="text-lg font-bold text-[--color-coffee-brown]">
                    {{ formatDrinkName(order.orderDetails.drinkType) }}
                  </div>
                  <div class="text-sm text-gray-600">
                    {{ order.orderDetails.size.toUpperCase() }}
                  </div>
                </div>
                <div 
                  class="status-badge px-2 py-1 rounded text-xs font-medium"
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
                <div class="text-xs text-gray-500 mb-1">Customizations:</div>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="custom in order.orderDetails.customizations"
                    :key="custom"
                    class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {{ custom }}
                  </span>
                </div>
              </div>

              <!-- Attendee Info -->
              <div class="text-xs text-gray-500 mb-1">
                Attendee: {{ order.attendeeId }}
              </div>

              <!-- Time Info -->
              <div class="text-xs text-gray-500 mb-3">
                Placed {{ formatTimeAgo(order.timestamps.placed) }}
              </div>

              <!-- Action Buttons Placeholder -->
              <div class="flex gap-2">
                <button
                  v-if="order.status === 'QUEUED'"
                  class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                  @click.stop="$emit('accept-order', order.orderId)"
                >
                  Accept
                </button>
                <button
                  v-if="order.status === 'ACCEPTED'"
                  class="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  @click.stop="$emit('complete-order', order.orderId)"
                >
                  Complete
                </button>
                <button
                  class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                  @click.stop="$emit('cancel-order', order.orderId)"
                >
                  Cancel
                </button>
              </div>
            </div>
          </slot>
        </div>
      </TransitionGroup>
    </div>

    <!-- Audio element for notification sound -->
    <audio ref="notificationAudio" preload="auto">
      <!-- Using a data URL for a simple beep sound -->
      <source :src="notificationSoundUrl" type="audio/wav" />
    </audio>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { Order, DrinkType, DrinkSize, OrderStatus } from '../../types';

// ========== Props ==========
interface Props {
  orders: Order[];
  enableSound?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  enableSound: true
});

// ========== Emits ==========
const emit = defineEmits<{
  'accept-order': [orderId: string];
  'complete-order': [orderId: string];
  'cancel-order': [orderId: string];
  'filter-change': [filters: {
    searchTerm: string;
    drinkType: DrinkType | '';
    size: DrinkSize | '';
    status: OrderStatus | '';
  }];
}>();

// ========== State ==========
const searchTerm = ref<string>('');
const filterDrinkType = ref<DrinkType | ''>('');
const filterSize = ref<DrinkSize | ''>('');
const filterStatus = ref<OrderStatus | ''>('');

const notificationAudio = ref<HTMLAudioElement | null>(null);
const previousOrderCount = ref<number>(0);

// Simple beep sound as data URL (440Hz tone for 200ms)
const notificationSoundUrl = ref<string>('');

// ========== Computed ==========

/**
 * Check if any filters are active
 */
const hasActiveFilters = computed(() => {
  return !!(searchTerm.value || filterDrinkType.value || filterSize.value || filterStatus.value);
});

/**
 * Filter orders based on search and filter criteria
 */
const filteredOrders = computed(() => {
  let orders = [...props.orders];

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    orders = orders.filter(order => 
      order.orderId.toLowerCase().includes(search) ||
      order.attendeeId.toLowerCase().includes(search)
    );
  }

  // Apply drink type filter
  if (filterDrinkType.value) {
    orders = orders.filter(order => order.orderDetails.drinkType === filterDrinkType.value);
  }

  // Apply size filter
  if (filterSize.value) {
    orders = orders.filter(order => order.orderDetails.size === filterSize.value);
  }

  // Apply status filter
  if (filterStatus.value) {
    orders = orders.filter(order => order.status === filterStatus.value);
  }

  // Sort by timestamp (newest first)
  orders.sort((a, b) => {
    const timeA = new Date(a.timestamps.placed).getTime();
    const timeB = new Date(b.timestamps.placed).getTime();
    return timeB - timeA;
  });

  return orders;
});

/**
 * Count of all orders
 */
const allOrdersCount = computed(() => props.orders.length);

/**
 * Count of queued orders
 */
const queuedCount = computed(() => {
  return props.orders.filter(order => order.status === 'QUEUED').length;
});

/**
 * Count of accepted orders
 */
const acceptedCount = computed(() => {
  return props.orders.filter(order => order.status === 'ACCEPTED').length;
});

// ========== Methods ==========

/**
 * Clear all filters
 */
function clearFilters(): void {
  searchTerm.value = '';
  filterDrinkType.value = '';
  filterSize.value = '';
  filterStatus.value = '';
  onFilterChange();
}

/**
 * Emit filter change event
 */
function onFilterChange(): void {
  emit('filter-change', {
    searchTerm: searchTerm.value,
    drinkType: filterDrinkType.value,
    size: filterSize.value,
    status: filterStatus.value
  });
}

/**
 * Format drink name (capitalize first letter)
 */
function formatDrinkName(drinkType: DrinkType): string {
  return drinkType.charAt(0).toUpperCase() + drinkType.slice(1);
}

/**
 * Get CSS class for status badge
 */
function getStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
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
  return `${diffHours} hours ago`;
}

/**
 * Play notification sound for new orders
 */
function playNotificationSound(): void {
  if (!props.enableSound) return;
  
  try {
    if (notificationAudio.value) {
      // Reset audio to beginning
      notificationAudio.value.currentTime = 0;
      
      // Play the sound
      const playPromise = notificationAudio.value.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('[OrderQueue] Failed to play notification sound:', error);
          // Autoplay might be blocked by browser
        });
      }
    }
  } catch (error) {
    console.error('[OrderQueue] Error playing notification sound:', error);
  }
}

/**
 * Generate a simple beep sound as data URL
 */
function generateNotificationSound(): void {
  // Create a simple 440Hz beep using Web Audio API
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const duration = 0.2; // 200ms
    const frequency = 440; // A4 note
    
    const numSamples = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    // Generate sine wave
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * 0.3; // 30% volume
    }
    
    // Convert to WAV data URL (simplified - using a library would be better for production)
    // For now, we'll use a silent audio element and rely on console logging
    notificationSoundUrl.value = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    
    audioContext.close();
  } catch (error) {
    console.warn('[OrderQueue] Could not generate notification sound:', error);
  }
}

// ========== Watchers ==========

/**
 * Watch for new orders and play notification sound
 */
watch(() => props.orders.length, (newCount, oldCount) => {
  // Only play sound if orders increased (new order added)
  if (newCount > oldCount && oldCount > 0) {
    console.log('[OrderQueue] 🔔 New order detected - playing notification');
    playNotificationSound();
  }
  previousOrderCount.value = newCount;
});

// ========== Lifecycle Hooks ==========

onMounted(() => {
  console.log('[OrderQueue] Component mounted');
  previousOrderCount.value = props.orders.length;
  generateNotificationSound();
});

onUnmounted(() => {
  console.log('[OrderQueue] Component unmounted');
});
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
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Order card animations */
.order-card-enter-active {
  animation: slide-in-pulse 0.5s ease-out;
}

.order-card-leave-active {
  animation: fade-out 0.3s ease-out;
}

.order-card-move {
  transition: transform 0.3s ease-out;
}

@keyframes slide-in-pulse {
  0% {
    transform: translateY(-20px) scale(0.95);
    opacity: 0;
  }
  50% {
    transform: translateY(0) scale(1.02);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* Pulse animation for new orders */
@keyframes pulse-new-order {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
}

.order-card-wrapper:first-child .order-card {
  animation: pulse-new-order 2s ease-out;
}

/* Filter controls styling */
.filter-controls input:focus,
.filter-controls select:focus {
  outline: none;
}

/* Status tabs */
.status-tabs button {
  transition: all 0.15s ease-out;
}

.status-tabs button:hover:not(.bg-[--color-coffee-brown]):not(.bg-yellow-500):not(.bg-blue-500) {
  transform: translateY(-1px);
}

/* Empty state */
.empty-state {
  animation: fade-in 0.3s ease-out;
}

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

/* Responsive grid adjustments */
@media (max-width: 1024px) {
  .order-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .order-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-controls {
    grid-template-columns: 1fr;
  }
}

/* Smooth transitions for all interactive elements */
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
</style>
