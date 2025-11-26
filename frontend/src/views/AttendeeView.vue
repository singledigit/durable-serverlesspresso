<template>
  <div class="attendee-view min-h-screen bg-gradient-to-br from-[--color-coffee-cream] to-[--color-coffee-latte] flex flex-col">
    <!-- Mobile-optimized header -->
    <header class="sticky top-0 z-20 text-white shadow-lg safe-area-header header-solid">
      <div class="container mx-auto px-4 py-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="text-2xl">☕</div>
            <div>
              <h1 class="text-base font-bold">Coffee Order</h1>
              <p class="text-xs opacity-80">{{ eventStore.currentEvent?.eventName || 'Loading...' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div 
              class="w-2 h-2 rounded-full"
              :class="eventStore.storeOpen ? 'bg-green-400' : 'bg-red-400'"
            ></div>
            <span class="text-xs">{{ eventStore.storeOpen ? 'Open' : 'Closed' }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content container with mobile-first responsive design -->
    <main class="container mx-auto px-4 pt-8 pb-6 max-w-2xl relative z-0 flex-1">
      <!-- Loading State -->
      <LoadingSpinner v-if="isInitialLoading" text="Loading..." />

      <template v-else>
        <!-- Real-time updates disabled message (development only) -->
        <div 
          v-if="!isAppSyncConfigured" 
          class="card mb-4 bg-blue-50 border-2 border-blue-400"
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

      <!-- Store closed animation -->
      <div v-if="!eventStore.storeOpen" class="mb-6">
        <div class="card bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 text-center py-12">
          <!-- Animated coffee cup -->
          <div class="mb-6 relative inline-block">
            <div class="text-8xl animate-bounce">☕</div>
            <div class="absolute -top-2 -right-2 text-4xl animate-pulse">💤</div>
          </div>
          
          <!-- Message -->
          <h2 class="text-3xl font-bold text-gray-800 mb-3">We're Closed</h2>
          <p class="text-lg text-gray-600 mb-2">Come back during our hours:</p>
          <p class="text-xl font-semibold text-[--color-coffee-brown]">
            {{ eventStore.currentEvent?.openingTime }} - {{ eventStore.currentEvent?.closingTime }}
          </p>
          
          <!-- Decorative elements -->
          <div class="mt-8 flex justify-center gap-4 text-3xl opacity-50">
            <span class="animate-pulse" style="animation-delay: 0s">🌙</span>
            <span class="animate-pulse" style="animation-delay: 0.2s">⭐</span>
            <span class="animate-pulse" style="animation-delay: 0.4s">✨</span>
          </div>
        </div>
      </div>

      <!-- Current order status (if exists) with fade transition -->
      <transition name="fade" mode="out-in" v-else>
        <div v-if="orderStore.currentOrder" key="order-status" class="mb-6">
          <OrderStatus 
            :order="orderStore.currentOrder" 
            @cancelled="handleOrderCancelled"
          />
        </div>

        <!-- Order form (if no current order) -->
        <div v-else key="order-form" class="mb-6">
          <OrderForm 
            :attendee-id="attendeeId" 
            @order-placed="handleOrderPlaced" 
          />
        </div>
      </transition>

      <!-- Order history -->
      <div class="mb-6">
        <OrderHistory />
      </div>
      </template>
    </main>

    <!-- Mobile-friendly footer -->
    <footer class="fixed bottom-0 left-0 right-0 border-t border-gray-200 py-3 px-4 md:relative md:mt-8 footer-solid z-10">
      <div class="container mx-auto max-w-2xl text-center text-sm text-gray-600">
        <p>Powered by Serverlesspresso</p>
      </div>
    </footer>

    <!-- Notification Toast -->
    <transition name="slide-up">
      <div
        v-if="notification?.show"
        class="notification-toast"
        :class="`notification-${notification.type}`"
        @click="dismissNotification"
      >
        <div class="notification-content">
          <div class="notification-icon">
            {{ notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️' }}
          </div>
          <div class="notification-text">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
          </div>
          <button class="notification-close" @click.stop="dismissNotification">
            ✕
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useOrderStore } from '../stores/orderStore';
import { useEventStore } from '../stores/eventStore';
import { appSyncEventsService, ConnectionState } from '../services/appSyncEvents';
import type { OrderEvent, StoreEvent } from '../types';
import OrderForm from '../components/attendee/OrderForm.vue';
import OrderStatus from '../components/attendee/OrderStatus.vue';
import OrderHistory from '../components/attendee/OrderHistory.vue';
import LoadingSpinner from '../components/shared/LoadingSpinner.vue';

const orderStore = useOrderStore();
const eventStore = useEventStore();

// ========== State ==========
const attendeeId = ref<string>('');
const connectionState = ref<ConnectionState>(ConnectionState.DISCONNECTED);
const unsubscribeCallbacks = ref<Array<() => void>>([]);
const isInitialLoading = ref<boolean>(true);

// Notification state
const notification = ref<{
  show: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
} | null>(null);

// ========== Computed ==========
const isAppSyncConfigured = computed(() => {
  return !!(import.meta.env.VITE_APPSYNC_EVENTS_URL && import.meta.env.VITE_APPSYNC_EVENTS_API_KEY);
});

// ========== AppSync Events Integration ==========

/**
 * Initialize AppSync Events connection
 */
async function initializeAppSyncEvents(): Promise<void> {
  try {
    console.log('[AttendeeView] Initializing AppSync Events connection...');
    
    // Check if AppSync Events is configured
    const appSyncUrl = import.meta.env.VITE_APPSYNC_EVENTS_URL;
    const appSyncApiKey = import.meta.env.VITE_APPSYNC_EVENTS_API_KEY;
    
    if (!appSyncUrl || !appSyncApiKey) {
      console.warn('[AttendeeView] AppSync Events not configured - real-time updates disabled');
      console.warn('[AttendeeView] Set VITE_APPSYNC_EVENTS_URL and VITE_APPSYNC_EVENTS_API_KEY in .env file');
      return;
    }
    
    // Connect to AppSync Events
    await appSyncEventsService.connect();
    
    // Monitor connection state
    const unsubscribeState = appSyncEventsService.onConnectionStateChange((state) => {
      connectionState.value = state;
      console.log('[AttendeeView] Connection state changed:', state);
    });
    
    unsubscribeCallbacks.value.push(unsubscribeState);
    
    // Don't subscribe to attendee channel on load - it may not exist yet
    // We'll only subscribe to order-specific channels when orders are placed
    // subscribeToAttendeeChannel();
    
    console.log('[AttendeeView] AppSync Events initialized successfully');
  } catch (error) {
    console.error('[AttendeeView] Failed to initialize AppSync Events:', error);
    console.warn('[AttendeeView] Real-time updates will not be available');
  }
}

/**
 * Subscribe to store status channel for real-time updates
 * Channel: /coffee-ordering/store/{eventId}
 */
function subscribeToStoreChannel(eventId: string): void {
  const channel = `/coffee-ordering/store/${eventId}`;
  
  console.log(`[AttendeeView] Subscribing to store channel: ${channel}`);
  
  const unsubscribe = appSyncEventsService.subscribe(channel, (event: OrderEvent | StoreEvent) => {
    console.log(`[AttendeeView] Received event on store channel:`, event);
    handleStoreEvent(event as StoreEvent);
  });
  
  unsubscribeCallbacks.value.push(unsubscribe);
}

/**
 * Subscribe to order-specific channel for real-time updates
 * Channel: /coffee-ordering/orders/{orderId}
 */
function subscribeToOrderChannel(orderId: string): void {
  const channel = `/coffee-ordering/orders/${orderId}`;
  
  console.log(`[AttendeeView] Subscribing to order channel: ${channel}`);
  
  const unsubscribe = appSyncEventsService.subscribe(channel, (event: OrderEvent) => {
    console.log(`[AttendeeView] Received event on order channel:`, event);
    handleOrderEvent(event);
  });
  
  unsubscribeCallbacks.value.push(unsubscribe);
}

/**
 * Handle incoming store events from AppSync Events
 * Updates store status in real-time
 */
function handleStoreEvent(event: StoreEvent): void {
  console.log('[AttendeeView] Processing store event:', event);
  
  // Only process STORE_STATUS_CHANGED events
  if (event.type !== 'STORE_STATUS_CHANGED') {
    console.log('[AttendeeView] Ignoring non-store event on store channel:', event.type);
    return;
  }
  
  // Update store status
  eventStore.storeOpen = event.data.storeOpen;
  
  // Show notification
  if (event.data.storeOpen) {
    showNotification('Store Opened', 'You can now place orders!', 'success');
  } else {
    showNotification('Store Closed', 'The coffee bar is now closed', 'info');
  }
  
  // Provide haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(100);
  }
}

/**
 * Handle incoming order events from AppSync Events
 * Updates order store with real-time status changes
 */
function handleOrderEvent(event: OrderEvent): void {
  console.log('[AttendeeView] Processing order event:', event);
  
  // Update order status in store
  orderStore.updateOrderStatus(event);
  
  // Show notifications for important events
  if (event.type === 'ORDER_CANCELLED') {
    const reason = event.data?.reason || 'Your order was cancelled';
    showNotification('Order Cancelled', reason, 'error');
  } else if (event.type === 'ORDER_COMPLETED') {
    showNotification('Order Ready!', 'Your coffee is ready for pickup', 'success');
  } else if (event.type === 'ORDER_ACCEPTED') {
    showNotification('Order Accepted', 'Your coffee is being prepared', 'info');
  }
  
  // Provide haptic feedback for mobile devices
  if ('vibrate' in navigator) {
    // Different vibration patterns for different events
    switch (event.type) {
      case 'ORDER_QUEUED':
        navigator.vibrate(100); // Single short vibration
        break;
      case 'ORDER_ACCEPTED':
        navigator.vibrate([100, 50, 100]); // Double vibration
        break;
      case 'ORDER_COMPLETED':
        navigator.vibrate([100, 50, 100, 50, 100]); // Triple vibration
        break;
      case 'ORDER_CANCELLED':
        navigator.vibrate([200, 100, 200]); // Longer vibrations
        break;
    }
  }
}

/**
 * Cleanup AppSync Events subscriptions
 */
function cleanupAppSyncEvents(): void {
  console.log('[AttendeeView] Cleaning up AppSync Events subscriptions...');
  
  // Unsubscribe from all channels
  unsubscribeCallbacks.value.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('[AttendeeView] Error unsubscribing:', error);
    }
  });
  
  unsubscribeCallbacks.value = [];
  
  // Disconnect from AppSync Events
  appSyncEventsService.disconnect();
  
  console.log('[AttendeeView] AppSync Events cleanup complete');
}

// ========== Notification System ==========

/**
 * Show a notification to the user
 */
function showNotification(title: string, message: string, type: 'success' | 'error' | 'info'): void {
  notification.value = {
    show: true,
    title,
    message,
    type
  };
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (notification.value) {
      notification.value.show = false;
      // Clear after animation
      setTimeout(() => {
        notification.value = null;
      }, 300);
    }
  }, 5000);
}

/**
 * Manually dismiss notification
 */
function dismissNotification(): void {
  if (notification.value) {
    notification.value.show = false;
    setTimeout(() => {
      notification.value = null;
    }, 300);
  }
}

// ========== Event Handlers ==========

/**
 * Handle order placed event
 * Subscribe to order-specific channel for real-time updates
 */
function handleOrderPlaced(orderId: string): void {
  console.log('[AttendeeView] Order placed successfully:', orderId);
  
  // Subscribe to order-specific channel
  subscribeToOrderChannel(orderId);
  
  // Provide haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(100);
  }
  
  // Additional logic can be added here (e.g., show success toast)
}

/**
 * Handle order cancelled event
 */
function handleOrderCancelled(): void {
  console.log('[AttendeeView] Order cancelled');
  
  // The order store will update via AppSync Events
  // Additional logic can be added here (e.g., show cancellation toast)
}

// ========== Watchers ==========

/**
 * Watch for current order changes to manage subscriptions
 * When a new order is created, subscribe to its channel
 */
watch(
  () => orderStore.currentOrder,
  (newOrder, oldOrder) => {
    // If we have a new order and it's different from the old one
    if (newOrder && newOrder.orderId !== oldOrder?.orderId) {
      console.log('[AttendeeView] Current order changed, subscribing to order channel');
      subscribeToOrderChannel(newOrder.orderId);
      
      // Scroll to top when order status appears
      // Use nextTick to ensure DOM has updated, then scroll to show full card
      nextTick(() => {
        // Scroll to top to show the order status card
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }
);

/**
 * Watch for order history changes to persist to localStorage
 */
watch(
  () => orderStore.orderHistory,
  () => {
    if (attendeeId.value) {
      saveOrderHistoryToStorage();
    }
  },
  { deep: true }
);

// ========== Lifecycle Hooks ==========

/**
 * Load order history from localStorage
 */
function loadOrderHistoryFromStorage(): void {
  try {
    const storedHistory = localStorage.getItem(`orderHistory_${attendeeId.value}`);
    if (storedHistory) {
      const orders = JSON.parse(storedHistory);
      orderStore.orderHistory = orders;
      console.log(`[AttendeeView] Loaded ${orders.length} orders from localStorage`);
    }
  } catch (error) {
    console.error('[AttendeeView] Failed to load order history from localStorage:', error);
  }
}

/**
 * Save order history to localStorage
 */
function saveOrderHistoryToStorage(): void {
  try {
    localStorage.setItem(
      `orderHistory_${attendeeId.value}`,
      JSON.stringify(orderStore.orderHistory)
    );
  } catch (error) {
    console.error('[AttendeeView] Failed to save order history to localStorage:', error);
  }
}

/**
 * Initialize on component mount
 */
onMounted(async () => {
  console.log('[AttendeeView] Component mounted');
  
  try {
    // Generate or retrieve attendee ID
    // In a real application, this would come from authentication
    // For demo purposes, we'll generate a unique ID or use a stored one
    const storedAttendeeId = localStorage.getItem('attendeeId');
    if (storedAttendeeId) {
      attendeeId.value = storedAttendeeId;
    } else {
      // Generate a simple attendee ID
      attendeeId.value = `attendee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('attendeeId', attendeeId.value);
    }
    
    console.log('[AttendeeView] Attendee ID:', attendeeId.value);
    
    // Load event configuration
    const eventId = import.meta.env.VITE_EVENT_ID || 'reinvent-2025';
    await eventStore.loadEventConfig(eventId);
    
    // Load order history from API (falls back to localStorage on error)
    try {
      await orderStore.loadRecentOrders(eventId, 30);
    } catch (error) {
      console.error('[AttendeeView] Failed to load orders from API, using localStorage');
      loadOrderHistoryFromStorage();
    }
    
    // Load order count from server
    await orderStore.loadOrderCount(attendeeId.value, eventId);
    
    // Initialize AppSync Events connection
    await initializeAppSyncEvents();
    
    // Subscribe to store status channel
    subscribeToStoreChannel(eventId);
    
    // If there's already a current order, subscribe to its channel
    if (orderStore.currentOrder) {
      console.log('[AttendeeView] Found existing current order, subscribing to channel');
      subscribeToOrderChannel(orderStore.currentOrder.orderId);
    }
  } finally {
    isInitialLoading.value = false;
  }
});

/**
 * Cleanup on component unmount
 */
onUnmounted(() => {
  console.log('[AttendeeView] Component unmounting, cleaning up...');
  cleanupAppSyncEvents();
});
</script>

<style scoped>
/* Mobile-first responsive design */
.attendee-view {
  /* Ensure full viewport height on mobile */
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile browsers */
}

/* Safe area handling for notched devices */
.safe-area-header {
  padding-top: env(safe-area-inset-top);
}

/* Ensure header has solid background and stays on top */
.header-solid {
  background-color: var(--color-coffee-brown);
  opacity: 1;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Ensure header stays on top */
header {
  position: sticky;
  top: 0;
  z-index: 20;
}

/* Ensure main content stays below header */
main {
  position: relative;
  z-index: 1;
}

/* Ensure footer has solid background */
.footer-solid {
  background-color: white;
  opacity: 1;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Touch-friendly tap targets (minimum 44x44px) */
.card {
  touch-action: manipulation;
}

/* Smooth scrolling for mobile */
@media (max-width: 768px) {
  .attendee-view {
    -webkit-overflow-scrolling: touch;
  }
  
  /* Adjust padding for mobile */
  main {
    padding-bottom: 80px; /* Account for fixed footer */
  }
}

/* Desktop optimizations */
@media (min-width: 769px) {
  footer {
    position: relative;
    margin-top: 2rem;
  }
  
  main {
    padding-bottom: 1.5rem;
  }
}

/* Prevent text selection on interactive elements */
header, footer {
  user-select: none;
  -webkit-user-select: none;
}

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Header Animation */
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

/* Store Status Indicator Animation */
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

/* Card Hover Effects */
.card {
  transition: all 0.2s ease-out;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.15);
}

/* Smooth transitions for all interactive elements */
* {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Instant feedback for touch interactions */
button:active,
a:active {
  transform: scale(0.97);
  transition: transform 0.05s ease-out; /* 50ms - instant feedback */
}

/* Notification Toast */
.notification-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 90%;
  width: 400px;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  animation: bounce-in 0.3s ease-out;
}

@media (min-width: 769px) {
  .notification-toast {
    bottom: 20px;
  }
}

.notification-success {
  background: linear-gradient(135deg, rgb(34 197 94), rgb(22 163 74));
  color: white;
}

.notification-error {
  background: linear-gradient(135deg, rgb(239 68 68), rgb(220 38 38));
  color: white;
}

.notification-info {
  background: linear-gradient(135deg, rgb(59 130 246), rgb(37 99 235));
  color: white;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.notification-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notification-text {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 14px;
  opacity: 0.95;
  line-height: 1.4;
}

.notification-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  transition: background 0.2s ease;
}

.notification-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.notification-close:active {
  transform: scale(0.9);
}

/* Slide up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(20px) scale(0.9);
  }
  50% {
    transform: translateX(-50%) translateY(-5px) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
</style>
