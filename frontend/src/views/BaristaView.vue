<template>
  <div class="barista-view min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
    <!-- Header matching AttendeeView style -->
    <header class="sticky top-0 z-20 text-white shadow-lg header-solid">
      <div class="container mx-auto px-4 py-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="text-2xl">☕</div>
            <div>
              <h1 class="text-base font-bold">Barista Dashboard</h1>
              <p class="text-xs opacity-80">{{ eventStore.currentEvent?.eventName || 'Loading...' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <div 
                class="w-2 h-2 rounded-full"
                :class="eventStore.storeOpen ? 'bg-green-400' : 'bg-red-400'"
              ></div>
              <span class="text-xs">{{ eventStore.storeOpen ? 'Open' : 'Closed' }}</span>
            </div>
            <button
              @click="toggleStoreStatus"
              class="px-3 py-1 text-xs rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
              :class="eventStore.storeOpen 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'"
              :disabled="isTogglingStore"
            >
              <span v-if="!isTogglingStore">
                {{ eventStore.storeOpen ? 'Close' : 'Open' }}
              </span>
              <span v-else>...</span>
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <!-- Queue Statistics Bar -->
    <div class="bg-white border-b border-gray-200 shadow-sm">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-center justify-center gap-8">
          <div class="text-center">
            <div class="text-xl font-bold text-gray-800">{{ queuedOrdersCount }}</div>
            <div class="text-xs text-gray-600">In Queue</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-gray-800">{{ acceptedOrdersCount }}</div>
            <div class="text-xs text-gray-600">In Progress</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-gray-800">{{ completedTodayCount }}</div>
            <div class="text-xs text-gray-600">Completed Today</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-gray-800">{{ averageCompletionTime }}</div>
            <div class="text-xs text-gray-600">Avg. Time</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main content area with sidebar layout -->
    <div class="container mx-auto px-6 py-6 flex-1">
      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Sidebar: Filters (second on mobile, first on desktop) -->
        <aside class="w-full lg:w-80 flex-shrink-0 order-2 lg:order-1">
          <!-- Filters Card -->
          <div class="card bg-white">
            <h2 class="text-lg font-bold text-[--color-coffee-brown] mb-4 flex items-center gap-2">
              <span>🔍</span>
              <span>Filters</span>
            </h2>
            
            <div class="space-y-4">
              <!-- Search -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Search Order
                </label>
                <input
                  v-model="searchTerm"
                  type="text"
                  placeholder="Order ID or Attendee ID..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[--color-coffee-brown] focus:border-transparent"
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
                >
                  <option value="">All Sizes</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <!-- Status Filter -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  v-model="filterStatus"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[--color-coffee-brown] focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="QUEUED">Queued</option>
                  <option value="ACCEPTED">In Progress</option>
                </select>
              </div>

              <!-- Clear Filters Button -->
              <button
                @click="clearFilters"
                class="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </aside>

        <!-- Main: Order Queue Grid (first on mobile, second on desktop) -->
        <main class="flex-1 order-1 lg:order-2">
          <!-- Real-time updates disabled message (development only) -->
          <div 
            v-if="!isAppSyncConfigured" 
            class="card mb-6 bg-blue-50 border-2 border-blue-400"
          >
            <div class="flex items-center gap-3">
              <div class="text-2xl">ℹ️</div>
              <div>
                <h3 class="font-semibold text-blue-800">Development Mode</h3>
                <p class="text-sm text-blue-700">
                  Real-time updates are disabled. Configure AppSync Events in .env to enable.
                </p>
              </div>
            </div>
          </div>

          <!-- Store closed message -->
          <div 
            v-if="!eventStore.storeOpen" 
            class="card mb-6 bg-yellow-50 border-2 border-yellow-400"
          >
            <div class="flex items-center gap-3">
              <div class="text-2xl">⚠️</div>
              <div>
                <h3 class="font-semibold text-yellow-800">Store Currently Closed</h3>
                <p class="text-sm text-yellow-700">
                  New orders cannot be placed. Toggle the store status to open.
                </p>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="mb-4 flex gap-2 border-b border-gray-200">
            <button
              @click="activeTab = 'active'"
              class="px-4 py-2 font-medium transition-colors"
              :class="activeTab === 'active' 
                ? 'text-[--color-coffee-brown] border-b-2 border-[--color-coffee-brown]' 
                : 'text-gray-500 hover:text-gray-700'"
            >
              Active Orders ({{ pendingOrders.length }})
            </button>
            <button
              @click="activeTab = 'history'"
              class="px-4 py-2 font-medium transition-colors"
              :class="activeTab === 'history' 
                ? 'text-[--color-coffee-brown] border-b-2 border-[--color-coffee-brown]' 
                : 'text-gray-500 hover:text-gray-700'"
            >
              History ({{ orderStore.orderHistory.length }})
            </button>
          </div>

          <!-- Order Queue Header -->
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-[--color-coffee-brown]">
              {{ activeTab === 'active' ? 'Order Queue' : 'Order History' }}
            </h2>
            <div class="text-sm text-gray-600">
              {{ filteredOrders.length }} order{{ filteredOrders.length !== 1 ? 's' : '' }}
            </div>
          </div>

          <!-- Empty State -->
          <div 
            v-if="!isInitialLoading && filteredOrders.length === 0" 
            class="card bg-white text-center py-16"
          >
            <div class="text-6xl mb-4">☕</div>
            <h3 class="text-xl font-semibold text-gray-700 mb-2">
              {{ activeTab === 'active' ? 'No Active Orders' : 'No Order History' }}
            </h3>
            <p class="text-gray-500">
              {{ searchTerm || filterDrinkType || filterSize || filterStatus 
                ? 'No orders match your filters' 
                : activeTab === 'active' 
                  ? 'New orders will appear here automatically' 
                  : 'Completed and cancelled orders will appear here' }}
            </p>
          </div>

          <!-- Loading Skeleton -->
          <div 
            v-else-if="isInitialLoading"
            class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
          >
            <SkeletonLoader v-for="i in 6" :key="i" type="order" />
          </div>

          <!-- Order Grid (3-4 columns) -->
          <div 
            v-else
            class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
          >
            <!-- Order cards will be rendered here by OrderCard component -->
            <!-- This is a placeholder for task 32 -->
            <div
              v-for="order in filteredOrders"
              :key="order.orderId"
              class="card bg-white hover:shadow-xl transition-shadow cursor-pointer flex flex-col"
            >
              <!-- Card content - grows to fill space -->
              <div class="flex-1">
                <!-- Order header -->
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <div class="text-xs text-gray-500 mb-1">Order #{{ order.orderId.slice(-8) }}</div>
                    <div class="text-lg font-bold text-[--color-coffee-brown]">
                      {{ order.orderDetails.drinkType.charAt(0).toUpperCase() + order.orderDetails.drinkType.slice(1) }}
                    </div>
                    <div class="text-sm text-gray-600">{{ order.orderDetails.size.toUpperCase() }}</div>
                  </div>
                  <div 
                    class="px-2 py-1 rounded text-xs font-medium"
                    :class="{
                      'bg-yellow-100 text-yellow-800': order.status === 'QUEUED',
                      'bg-blue-100 text-blue-800': order.status === 'ACCEPTED'
                    }"
                  >
                    {{ order.status }}
                  </div>
                </div>

                <!-- Customizations -->
                <div v-if="order.orderDetails.customizations && order.orderDetails.customizations.length > 0" class="mb-3">
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

                <!-- Time info -->
                <div class="text-xs text-gray-500 mb-3">
                  Placed {{ formatTimeAgo(order.timestamps.placed) }}
                </div>
              </div>

              <!-- Action buttons - stays at bottom -->
              <div class="flex gap-2 mt-auto">
                <!-- View Execution History button for completed/cancelled orders -->
                <button
                  v-if="order.status === 'COMPLETED' || order.status === 'CANCELLED'"
                  @click="viewExecutionHistory(order)"
                  class="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  View History
                </button>
                
                <button
                  v-if="order.status === 'QUEUED' && activeTab === 'active'"
                  @click="handleAcceptOrder(order.orderId)"
                  :disabled="isProcessingOrder(order.orderId)"
                  class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="!isProcessingOrder(order.orderId)">Accept</span>
                  <LoadingSpinner v-else size="16px" containerClass="py-0" />
                </button>
                <button
                  v-if="order.status === 'ACCEPTED' && activeTab === 'active'"
                  @click="handleCompleteOrder(order.orderId)"
                  :disabled="isProcessingOrder(order.orderId)"
                  class="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="!isProcessingOrder(order.orderId)">Complete</span>
                  <LoadingSpinner v-else size="16px" containerClass="py-0" />
                </button>
                <button
                  v-if="activeTab === 'active'"
                  @click="handleCancelOrder(order.orderId)"
                  :disabled="isProcessingOrder(order.orderId)"
                  class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="!isProcessingOrder(order.orderId)">Cancel</span>
                  <LoadingSpinner v-else size="16px" containerClass="py-0" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
    
    <!-- Execution History Modal -->
    <div
      v-if="showExecutionHistory && selectedOrder"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="closeExecutionHistory"
    >
      <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-bold text-[--color-coffee-brown]">
              Execution History - Order {{ selectedOrder.orderId.substring(0, 8) }}
            </h3>
            <button
              @click="closeExecutionHistory"
              class="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <!-- View toggle -->
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700">Timeline View</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                v-model="showRawJson" 
                class="sr-only peer"
              >
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[--color-coffee-brown]"></div>
            </label>
            <span class="text-sm font-medium text-gray-700">Show Raw JSON</span>
          </div>
        </div>
        
        <div class="p-4 overflow-auto flex-1">
          <!-- Timeline View -->
          <div v-if="!showRawJson && selectedOrder.executionHistory?.Events">
            <div class="space-y-3">
              <div
                v-for="(event, index) in selectedOrder.executionHistory.Events"
                :key="index"
                class="flex gap-4"
              >
                <!-- Timeline line -->
                <div class="flex flex-col items-center">
                  <div 
                    class="w-3 h-3 rounded-full"
                    :class="{
                      'bg-green-500': event.EventType?.includes('Succeeded') || event.EventType?.includes('Completed'),
                      'bg-blue-500': event.EventType?.includes('Started') || event.EventType?.includes('Scheduled'),
                      'bg-yellow-500': event.EventType?.includes('Waiting') || event.EventType?.includes('Callback'),
                      'bg-red-500': event.EventType?.includes('Failed') || event.EventType?.includes('TimedOut'),
                      'bg-gray-400': !event.EventType
                    }"
                  ></div>
                  <div v-if="index < selectedOrder.executionHistory.Events.length - 1" class="w-0.5 h-full bg-gray-300 mt-1"></div>
                </div>
                
                <!-- Event details -->
                <div class="flex-1 pb-4">
                  <div class="bg-gray-50 rounded-lg p-3">
                    <div class="flex items-start justify-between mb-2">
                      <div>
                        <span class="font-semibold text-gray-800">{{ event.EventType || 'Event' }}</span>
                        <!-- Show step/context name prominently -->
                        <span v-if="event.Name && event.SubType === 'Step'" class="ml-2 font-medium"
                          :class="{
                            'text-blue-600': event.EventType === 'StepStarted',
                            'text-green-600': event.EventType === 'StepSucceeded',
                            'text-red-600': event.EventType === 'StepFailed'
                          }"
                        >
                          → {{ event.Name }}
                        </span>
                      </div>
                      <span class="text-xs text-gray-500">{{ event.EventTimestamp ? new Date(event.EventTimestamp).toLocaleString() : 'N/A' }}</span>
                    </div>
                    <div v-if="event.EventId" class="text-xs text-gray-600 mb-1">Event ID: {{ event.EventId }}</div>
                    
                    <!-- Show relevant details based on event type -->
                    <div v-if="event.ExecutionStartedDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1">Input:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ formatJson(event.ExecutionStartedDetails.Input?.Payload) }}</pre>
                    </div>
                    <div v-else-if="event.ExecutionSucceededDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1">Output:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ formatJson(event.ExecutionSucceededDetails.Result?.Payload) }}</pre>
                    </div>
                    <div v-else-if="event.StepSucceededDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1">Result:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ formatJson(event.StepSucceededDetails.Result?.Payload) }}</pre>
                    </div>
                    <div v-else-if="event.StepFailedDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1 text-red-600">Error:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ event.StepFailedDetails.Error || 'N/A' }}</pre>
                    </div>
                    <div v-else-if="event.CallbackStartedDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1">Callback ID:</div>
                      <code class="bg-white px-2 py-1 rounded text-xs break-all">{{ event.CallbackStartedDetails.CallbackId }}</code>
                      <div class="text-xs text-gray-600 mt-1">Timeout: {{ event.CallbackStartedDetails.Timeout }}s</div>
                    </div>
                    <div v-else-if="event.CallbackSucceededDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1">Callback Result:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ formatJson(event.CallbackSucceededDetails.Result?.Payload) }}</pre>
                    </div>
                    <div v-else-if="event.CallbackFailedDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1 text-red-600">Callback Error:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ event.CallbackFailedDetails.Error || 'N/A' }}</pre>
                    </div>
                    <div v-else-if="event.ContextStartedDetails" class="text-sm text-gray-700 mt-2">
                      <div class="text-xs text-gray-600">Context Type: {{ event.SubType }}</div>
                    </div>
                    <div v-else-if="event.ContextSucceededDetails" class="text-sm text-gray-700 mt-2">
                      <div class="font-medium mb-1">Context Result:</div>
                      <pre class="bg-white p-2 rounded text-xs max-h-32 overflow-auto whitespace-pre-wrap break-words">{{ formatJson(event.ContextSucceededDetails.Result?.Payload) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Raw JSON View -->
          <div v-else-if="showRawJson && selectedOrder.executionHistory">
            <pre class="bg-gray-50 p-4 rounded-lg text-xs whitespace-pre-wrap break-words">{{ JSON.stringify(selectedOrder.executionHistory, null, 2) }}</pre>
          </div>
          
          <!-- Loading/Empty state -->
          <div v-else class="text-center text-gray-500 py-8">
            <div v-if="!selectedOrder.executionHistory">Loading execution history...</div>
            <div v-else>No execution history available</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-gray-200 py-3 px-4 mt-8 bg-white">
      <div class="container mx-auto text-center text-sm text-gray-600">
        <p>Powered by Serverlesspresso</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useOrderStore } from '../stores/orderStore';
import { useEventStore } from '../stores/eventStore';
import { appSyncEventsService, ConnectionState } from '../services/appSyncEvents';
import { apiService } from '../services/api';
import type { OrderEvent, DrinkType, DrinkSize, OrderStatus, Order } from '../types';
import SkeletonLoader from '../components/shared/SkeletonLoader.vue';
import LoadingSpinner from '../components/shared/LoadingSpinner.vue';

const orderStore = useOrderStore();
const eventStore = useEventStore();

// ========== State ==========
const baristaId = ref<string>('');
const connectionState = ref<ConnectionState>(ConnectionState.DISCONNECTED);
const unsubscribeCallbacks = ref<Array<() => void>>([]);
const isTogglingStore = ref<boolean>(false);
const processingOrders = ref<Set<string>>(new Set());
const isInitialLoading = ref<boolean>(true);

// Tab and modal state
const activeTab = ref<'active' | 'history'>('active');
const selectedOrder = ref<Order | null>(null);
const showExecutionHistory = ref<boolean>(false);
const showRawJson = ref<boolean>(false);

// Filter state
const searchTerm = ref<string>('');
const filterDrinkType = ref<DrinkType | ''>('');
const filterSize = ref<DrinkSize | ''>('');
const filterStatus = ref<OrderStatus | ''>('');

// ========== Computed ==========
const isAppSyncConfigured = computed(() => {
  return !!(import.meta.env.VITE_APPSYNC_EVENTS_URL && import.meta.env.VITE_APPSYNC_EVENTS_API_KEY);
});

/**
 * Get all pending orders (QUEUED or ACCEPTED)
 */
const pendingOrders = computed(() => {
  return orderStore.pendingOrders || [];
});

/**
 * Filter orders based on search and filter criteria
 */
const filteredOrders = computed(() => {
  let orders = activeTab.value === 'active' ? pendingOrders.value : orderStore.orderHistory;

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

  return orders;
});

/**
 * Count of queued orders
 */
const queuedOrdersCount = computed(() => {
  return pendingOrders.value.filter(order => order.status === 'QUEUED').length;
});

/**
 * Count of accepted (in progress) orders
 */
const acceptedOrdersCount = computed(() => {
  return pendingOrders.value.filter(order => order.status === 'ACCEPTED').length;
});

/**
 * Count of active orders (queued + accepted)
 * Note: Currently unused but kept for potential future use
 */
// const activeOrdersCount = computed(() => {
//   return pendingOrders.value.length;
// });

/**
 * Count of completed orders today
 */
const completedTodayCount = computed(() => {
  // This would typically come from the order store
  // For now, return a placeholder
  return orderStore.orderHistory?.filter(order => {
    if (order.status !== 'COMPLETED' || !order.timestamps.completed) return false;
    const completedDate = new Date(order.timestamps.completed);
    const today = new Date();
    return completedDate.toDateString() === today.toDateString();
  }).length || 0;
});

/**
 * Average completion time in minutes
 */
const averageCompletionTime = computed(() => {
  const completedToday = orderStore.orderHistory?.filter(order => {
    if (order.status !== 'COMPLETED' || !order.timestamps.completed) return false;
    const completedDate = new Date(order.timestamps.completed);
    const today = new Date();
    return completedDate.toDateString() === today.toDateString();
  }) || [];

  if (completedToday.length === 0) return '0m';

  const totalMinutes = completedToday.reduce((sum, order) => {
    const placed = new Date(order.timestamps.placed).getTime();
    const completed = new Date(order.timestamps.completed!).getTime();
    return sum + (completed - placed) / 1000 / 60;
  }, 0);

  const avgMinutes = Math.round(totalMinutes / completedToday.length);
  return `${avgMinutes}m`;
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
}

/**
 * Check if an order is currently being processed
 */
function isProcessingOrder(orderId: string): boolean {
  return processingOrders.value.has(orderId);
}

/**
 * Handle accepting an order
 */
async function handleAcceptOrder(orderId: string): Promise<void> {
  if (isProcessingOrder(orderId)) return;
  
  processingOrders.value.add(orderId);
  
  // Optimistic update
  const order = orderStore.pendingOrders.find(o => o.orderId === orderId);
  if (order) {
    order.status = 'ACCEPTED';
    order.baristaId = baristaId.value;
    order.timestamps.accepted = new Date().toISOString();
  }
  
  try {
    console.log(`[BaristaView] Accepting order ${orderId}...`);
    
    await apiService.acceptOrder(orderId, {
      baristaId: baristaId.value
    });
    
    console.log(`[BaristaView] Order ${orderId} accepted successfully`);
  } catch (error: any) {
    console.error(`[BaristaView] Failed to accept order ${orderId}:`, error);
    
    // Revert optimistic update
    if (order) {
      order.status = 'QUEUED';
      delete order.baristaId;
      delete order.timestamps.accepted;
    }
    
    alert(`Failed to accept order: ${error.message || 'Unknown error'}`);
  } finally {
    processingOrders.value.delete(orderId);
  }
}

/**
 * Handle completing an order
 */
async function handleCompleteOrder(orderId: string): Promise<void> {
  if (isProcessingOrder(orderId)) return;
  
  processingOrders.value.add(orderId);
  
  // Optimistic update
  const order = orderStore.pendingOrders.find(o => o.orderId === orderId);
  const originalStatus = order?.status;
  if (order) {
    order.status = 'COMPLETED';
    order.timestamps.completed = new Date().toISOString();
  }
  
  try {
    console.log(`[BaristaView] Completing order ${orderId}...`);
    
    await apiService.completeOrder(orderId, {
      baristaId: baristaId.value
    });
    
    console.log(`[BaristaView] Order ${orderId} completed successfully`);
    
    // Move to history
    if (order) {
      orderStore.pendingOrders = orderStore.pendingOrders.filter(o => o.orderId !== orderId);
      orderStore.orderHistory.unshift(order);
    }
  } catch (error: any) {
    console.error(`[BaristaView] Failed to complete order ${orderId}:`, error);
    
    // Revert optimistic update
    if (order && originalStatus) {
      order.status = originalStatus;
      delete order.timestamps.completed;
    }
    
    alert(`Failed to complete order: ${error.message || 'Unknown error'}`);
  } finally {
    processingOrders.value.delete(orderId);
  }
}

/**
 * Handle cancelling an order
 */
async function handleCancelOrder(orderId: string): Promise<void> {
  if (isProcessingOrder(orderId)) return;
  
  // Confirm cancellation
  const reason = prompt('Please provide a reason for cancellation:');
  if (!reason) {
    console.log(`[BaristaView] Order ${orderId} cancellation aborted by user`);
    return;
  }
  
  processingOrders.value.add(orderId);
  
  // Optimistic update
  const order = orderStore.pendingOrders.find(o => o.orderId === orderId);
  const originalStatus = order?.status;
  if (order) {
    order.status = 'CANCELLED';
    order.timestamps.cancelled = new Date().toISOString();
  }
  
  try {
    console.log(`[BaristaView] Cancelling order ${orderId}...`);
    
    await apiService.cancelOrder(orderId, {
      reason,
      cancelledBy: 'barista'
    });
    
    console.log(`[BaristaView] Order ${orderId} cancelled successfully`);
    
    // Move to history
    if (order) {
      orderStore.pendingOrders = orderStore.pendingOrders.filter(o => o.orderId !== orderId);
      orderStore.orderHistory.unshift(order);
    }
  } catch (error: any) {
    console.error(`[BaristaView] Failed to cancel order ${orderId}:`, error);
    
    // Revert optimistic update
    if (order && originalStatus) {
      order.status = originalStatus;
      delete order.timestamps.cancelled;
    }
    
    alert(`Failed to cancel order: ${error.message || 'Unknown error'}`);
  } finally {
    processingOrders.value.delete(orderId);
  }
}

/**
 * View execution history for an order
 */
async function viewExecutionHistory(order: Order): Promise<void> {
  selectedOrder.value = order;
  showExecutionHistory.value = true;
  
  // If execution history is not already loaded, fetch it
  if (!order.executionHistory) {
    try {
      console.log('[BaristaView] Fetching execution history for orderId:', order.orderId);
      
      // Use orderId to look up the execution
      // Use a dummy path parameter and pass orderId as query param
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://lpgiuqktxd.execute-api.us-east-1.amazonaws.com/prod';
      const url = `${apiUrl}/execution/history?orderId=${encodeURIComponent(order.orderId)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch execution history: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update the order with the fetched history
      if (selectedOrder.value) {
        selectedOrder.value.executionHistory = data.history;
      }
      
      console.log('[BaristaView] Execution history fetched successfully');
    } catch (error) {
      console.error('[BaristaView] Error fetching execution history:', error);
      alert('Failed to fetch execution history. Please try again.');
    }
  }
}

/**
 * Close execution history modal
 */
function closeExecutionHistory(): void {
  showExecutionHistory.value = false;
  selectedOrder.value = null;
  showRawJson.value = false;
}

/**
 * Format JSON payload for display
 */
function formatJson(payload: string | undefined): string {
  if (!payload) return 'N/A';
  try {
    const parsed = JSON.parse(payload);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payload;
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
 * Toggle store open/closed status
 */
async function toggleStoreStatus(): Promise<void> {
  isTogglingStore.value = true;
  
  try {
    console.log('[BaristaView] Toggling store status...');
    
    // Call the event store to toggle status
    // This will call the backend API which publishes an event
    const newStatus = !eventStore.storeOpen;
    await eventStore.toggleStoreStatus(newStatus);
    
    console.log('[BaristaView] Store status toggled:', eventStore.storeOpen ? 'OPEN' : 'CLOSED');
  } catch (error) {
    console.error('[BaristaView] Failed to toggle store status:', error);
    alert('Failed to update store status. Please try again.');
  } finally {
    isTogglingStore.value = false;
  }
}

// ========== AppSync Events Integration ==========

/**
 * Initialize AppSync Events connection
 */
async function initializeAppSyncEvents(): Promise<void> {
  try {
    console.log('[BaristaView] Initializing AppSync Events connection...');
    
    // Check if AppSync Events is configured
    const appSyncUrl = import.meta.env.VITE_APPSYNC_EVENTS_URL;
    const appSyncApiKey = import.meta.env.VITE_APPSYNC_EVENTS_API_KEY;
    
    if (!appSyncUrl || !appSyncApiKey) {
      console.warn('[BaristaView] AppSync Events not configured - real-time updates disabled');
      console.warn('[BaristaView] Set VITE_APPSYNC_EVENTS_URL and VITE_APPSYNC_EVENTS_API_KEY in .env file');
      return;
    }
    
    // Connect to AppSync Events
    await appSyncEventsService.connect();
    
    // Monitor connection state
    const unsubscribeState = appSyncEventsService.onConnectionStateChange((state) => {
      connectionState.value = state;
      console.log('[BaristaView] Connection state changed:', state);
    });
    
    unsubscribeCallbacks.value.push(unsubscribeState);
    
    // Subscribe to barista queue channel for new orders
    subscribeToBaristaQueue();
    
    // Subscribe to store status channel
    subscribeToStoreStatus();
    
    // Subscribe to existing pending orders for status updates
    subscribeToExistingOrders();
    
    console.log('[BaristaView] AppSync Events initialized successfully');
  } catch (error) {
    console.error('[BaristaView] Failed to initialize AppSync Events:', error);
    console.warn('[BaristaView] Real-time updates will not be available');
  }
}

/**
 * Subscribe to store status channel for open/closed updates
 * Channel: /coffee-ordering/store/{eventId}
 */
function subscribeToStoreStatus(): void {
  const eventId = eventStore.eventId;
  if (!eventId) {
    console.warn('[BaristaView] Cannot subscribe to store status - no event ID');
    return;
  }
  
  const channel = `/coffee-ordering/store/${eventId}`;
  
  console.log(`[BaristaView] Subscribing to store status channel: ${channel}`);
  
  const unsubscribe = appSyncEventsService.subscribe(channel, (event: any) => {
    console.log(`[BaristaView] Received store status event:`, event);
    
    if (event.type === 'STORE_STATUS_CHANGED' && event.data?.storeOpen !== undefined) {
      eventStore.storeOpen = event.data.storeOpen;
      console.log(`[BaristaView] Store status updated to: ${event.data.storeOpen ? 'OPEN' : 'CLOSED'}`);
    }
  });
  
  unsubscribeCallbacks.value.push(unsubscribe);
}

/**
 * Subscribe to barista queue channel for new orders
 * Channel: /coffee-ordering/barista/queue
 */
function subscribeToBaristaQueue(): void {
  const channel = '/coffee-ordering/barista/queue';
  
  console.log(`[BaristaView] Subscribing to barista queue channel: ${channel}`);
  
  const unsubscribe = appSyncEventsService.subscribe(channel, (event: OrderEvent) => {
    console.log(`[BaristaView] Received event on barista queue:`, event);
    handleOrderEvent(event);
    
    // Play sound notification for new orders
    if (event.type === 'ORDER_QUEUED') {
      playNotificationSound();
      
      // Subscribe to individual order channel for status updates
      subscribeToOrderChannel(event.orderId);
    }
  });
  
  unsubscribeCallbacks.value.push(unsubscribe);
}

/**
 * Subscribe to individual order channel for status updates
 * Channel: /coffee-ordering/orders/{orderId}
 * 
 * This allows the barista to receive real-time updates when:
 * - Order is accepted by another barista
 * - Order is completed
 * - Order is cancelled
 */
function subscribeToOrderChannel(orderId: string): void {
  const channel = `/coffee-ordering/orders/${orderId}`;
  
  console.log(`[BaristaView] Subscribing to order channel: ${channel}`);
  
  const unsubscribe = appSyncEventsService.subscribe(channel, (event: OrderEvent) => {
    console.log(`[BaristaView] Received event on order channel ${channel}:`, event);
    handleOrderEvent(event);
    
    // If order is completed or cancelled, unsubscribe from this channel
    if (event.type === 'ORDER_COMPLETED' || event.type === 'ORDER_CANCELLED') {
      console.log(`[BaristaView] Order ${orderId} finished, unsubscribing from channel`);
      unsubscribe();
      
      // Remove from unsubscribe callbacks list
      const index = unsubscribeCallbacks.value.indexOf(unsubscribe);
      if (index !== -1) {
        unsubscribeCallbacks.value.splice(index, 1);
      }
    }
  });
  
  unsubscribeCallbacks.value.push(unsubscribe);
}

/**
 * Subscribe to all existing pending orders
 * Called on initialization to subscribe to orders that are already in the queue
 */
function subscribeToExistingOrders(): void {
  console.log(`[BaristaView] Subscribing to ${pendingOrders.value.length} existing orders`);
  
  pendingOrders.value.forEach(order => {
    subscribeToOrderChannel(order.orderId);
  });
}

/**
 * Handle incoming order events from AppSync Events
 */
function handleOrderEvent(event: OrderEvent): void {
  console.log('[BaristaView] Processing order event:', event);
  console.log('[BaristaView] Current pending orders count:', orderStore.pendingOrders.length);
  
  // Update order status in store
  orderStore.updateOrderStatus(event);
  
  console.log('[BaristaView] After update, pending orders count:', orderStore.pendingOrders.length);
  
  // Handle order removal from queue with animation
  if (event.type === 'ORDER_COMPLETED') {
    console.log(`[BaristaView] Order ${event.orderId} completed - will be removed from queue`);
    // The order store already handles moving the order to history
    // The UI will automatically update via reactive computed properties
  } else if (event.type === 'ORDER_CANCELLED') {
    console.log(`[BaristaView] Order ${event.orderId} cancelled - will be removed from queue`);
    // The order store already handles moving the order to history
    // The UI will automatically update via reactive computed properties
  }
}

/**
 * Play notification sound for new orders
 */
function playNotificationSound(): void {
  // In a real implementation, this would play an audio notification
  // For now, we'll just log it
  console.log('[BaristaView] 🔔 New order notification');
  
  // Optional: Use Web Audio API or HTML5 Audio to play a sound
  // const audio = new Audio('/notification.mp3');
  // audio.play().catch(err => console.error('Failed to play sound:', err));
}

/**
 * Cleanup AppSync Events subscriptions
 */
function cleanupAppSyncEvents(): void {
  console.log('[BaristaView] Cleaning up AppSync Events subscriptions...');
  
  // Unsubscribe from all channels
  unsubscribeCallbacks.value.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('[BaristaView] Error unsubscribing:', error);
    }
  });
  
  unsubscribeCallbacks.value = [];
  
  // Disconnect from AppSync Events
  appSyncEventsService.disconnect();
  
  console.log('[BaristaView] AppSync Events cleanup complete');
}

// ========== Lifecycle Hooks ==========

/**
 * Initialize on component mount
 */
onMounted(async () => {
  console.log('[BaristaView] Component mounted');
  
  try {
    // Generate or retrieve barista ID
    const storedBaristaId = localStorage.getItem('baristaId');
    if (storedBaristaId) {
      baristaId.value = storedBaristaId;
    } else {
      baristaId.value = `barista-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('baristaId', baristaId.value);
    }
    
    console.log('[BaristaView] Barista ID:', baristaId.value);
    
    // Load event configuration
    const eventId = import.meta.env.VITE_EVENT_ID || 'coffee-shop';
    await eventStore.loadEventConfig(eventId);
    
    // Load recent orders (will split into pending and history)
    try {
      console.log('[BaristaView] Loading recent orders...');
      await orderStore.loadRecentOrders(eventId, 30);
      console.log(`[BaristaView] Loaded orders: ${orderStore.pendingOrders.length} pending, ${orderStore.orderHistory.length} history`);
    } catch (error) {
      console.error('[BaristaView] Failed to load recent orders:', error);
      // Continue anyway - orders will be populated via AppSync Events
    }
    
    // Initialize AppSync Events connection for real-time updates
    await initializeAppSyncEvents();
    
    console.log('[BaristaView] Barista dashboard ready');
  } finally {
    isInitialLoading.value = false;
  }
});

/**
 * Cleanup on component unmount
 */
onUnmounted(() => {
  console.log('[BaristaView] Component unmounting, cleaning up...');
  cleanupAppSyncEvents();
});
</script>

<style scoped>
/* Ensure header has solid background and stays on top */
.header-solid {
  background-color: var(--color-coffee-brown);
  opacity: 1;
}

/* Desktop-optimized layout */
.barista-view {
  min-height: 100vh;
}

/* Sidebar fixed width for consistent layout */
aside {
  min-width: 320px;
}

/* Card styling */
.card {
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease-out;
}

.card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Header animation */
header {
  animation: slide-down 0.4s ease-out;
}

@keyframes slide-down {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Store status indicator pulse */
header .w-3.h-3 {
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

/* Button hover effects */
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

/* Grid responsive adjustments */
@media (max-width: 1280px) {
  aside {
    width: 280px;
    min-width: 280px;
  }
}

@media (max-width: 1024px) {
  .barista-view {
    /* Stack sidebar on smaller screens */
  }
  
  aside {
    width: 100%;
    max-width: none;
  }
  
  .flex.gap-6 {
    flex-direction: column;
  }
}

/* Smooth transitions for all interactive elements */
* {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Input focus styles */
input:focus,
select:focus {
  outline: none;
}

/* Scrollbar styling for webkit browsers */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Loading spinner animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
