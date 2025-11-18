<template>
  <div class="order-status-container">
    <!-- Status Card with data attribute for status-based styling -->
    <div class="status-card" :data-status="order.status">
      <!-- Header with Order ID -->
      <div class="status-header">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-[--color-coffee-brown]">Your Order</h3>
            <p class="text-xs text-gray-500 mt-1">Order #{{ shortOrderId }}</p>
          </div>
          <div 
            class="status-badge"
            :class="statusBadgeClass"
          >
            {{ statusLabel }}
          </div>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div class="progress-section">
        <div class="progress-stages">
          <!-- Stage 1: Placed -->
          <div 
            class="progress-stage"
            :class="{ 'stage-active': isStageActive('PENDING'), 'stage-complete': isStageComplete('PENDING') }"
          >
            <div class="stage-icon">
              <span v-if="isStageComplete('PENDING')">✓</span>
              <span v-else>📝</span>
            </div>
            <div class="stage-label">Placed</div>
            <div v-if="order.timestamps.placed" class="stage-time">
              {{ formatTime(order.timestamps.placed) }}
            </div>
          </div>

          <!-- Connector Line -->
          <div 
            class="progress-connector"
            :class="{ 'connector-active': isStageComplete('PENDING') }"
          ></div>

          <!-- Stage 2: Queued -->
          <div 
            class="progress-stage"
            :class="{ 'stage-active': isStageActive('QUEUED'), 'stage-complete': isStageComplete('QUEUED') }"
          >
            <div class="stage-icon">
              <span v-if="isStageComplete('QUEUED')">✓</span>
              <span v-else>⏳</span>
            </div>
            <div class="stage-label">Queued</div>
            <div v-if="order.timestamps.queued" class="stage-time">
              {{ formatTime(order.timestamps.queued) }}
            </div>
          </div>

          <!-- Connector Line -->
          <div 
            class="progress-connector"
            :class="{ 'connector-active': isStageComplete('QUEUED') }"
          ></div>

          <!-- Stage 3: Preparing -->
          <div 
            class="progress-stage"
            :class="{ 'stage-active': isStageActive('ACCEPTED'), 'stage-complete': isStageComplete('ACCEPTED') }"
          >
            <div class="stage-icon">
              <span v-if="isStageComplete('ACCEPTED')">✓</span>
              <span v-else>☕</span>
            </div>
            <div class="stage-label">Preparing</div>
            <div v-if="order.timestamps.accepted" class="stage-time">
              {{ formatTime(order.timestamps.accepted) }}
            </div>
          </div>

          <!-- Connector Line -->
          <div 
            class="progress-connector"
            :class="{ 'connector-active': isStageComplete('ACCEPTED') }"
          ></div>

          <!-- Stage 4: Ready -->
          <div 
            class="progress-stage"
            :class="{ 'stage-active': isStageActive('COMPLETED'), 'stage-complete': isStageComplete('COMPLETED') }"
          >
            <div class="stage-icon">
              <span v-if="order.status === 'COMPLETED'">✓</span>
              <span v-else>🎉</span>
            </div>
            <div class="stage-label">Ready</div>
            <div v-if="order.timestamps.completed" class="stage-time">
              {{ formatTime(order.timestamps.completed) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Order Details -->
      <div class="order-details">
        <h4 class="text-sm font-semibold text-gray-700 mb-2">Order Details</h4>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Drink:</span>
            <span class="detail-value">{{ formatDrinkType(order.orderDetails.drinkType) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Size:</span>
            <span class="detail-value">{{ formatSize(order.orderDetails.size) }}</span>
          </div>
          <div v-if="order.orderDetails.customizations && order.orderDetails.customizations.length > 0" class="detail-item col-span-2">
            <span class="detail-label">Customizations:</span>
            <span class="detail-value">{{ order.orderDetails.customizations.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- Time Elapsed / Estimated Time -->
      <div class="time-info">
        <div v-if="order.status === 'COMPLETED'" class="time-display success">
          <span class="time-icon">✓</span>
          <span class="time-text">Completed in {{ totalTime }}</span>
        </div>
        <div v-else-if="order.status === 'CANCELLED'" class="time-display error">
          <span class="time-icon">✕</span>
          <span class="time-text">Cancelled after {{ totalTime }}</span>
          <p v-if="order.cancellationReason" class="text-xs text-gray-600 mt-1">
            Reason: {{ order.cancellationReason }}
          </p>
        </div>
        <div v-else class="time-display">
          <span class="time-icon">⏱️</span>
          <span class="time-text">{{ elapsedTime }} elapsed</span>
          <span v-if="estimatedTimeRemaining" class="text-xs text-gray-500 ml-2">
            (Est. {{ estimatedTimeRemaining }} remaining)
          </span>
        </div>
      </div>

      <!-- Cancel Button (visible when PENDING or QUEUED) -->
      <div v-if="canCancel" class="action-section">
        <button
          @click="handleCancel"
          :disabled="isCancelling"
          class="cancel-button"
        >
          <span v-if="isCancelling" class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Cancelling...</span>
          </span>
          <span v-else>Cancel Order</span>
        </button>
        <p class="text-xs text-center text-gray-500 mt-2">
          You can cancel your order before it's being prepared
        </p>
      </div>

      <!-- Completion Message with Confetti -->
      <div v-if="order.status === 'COMPLETED'" class="completion-message">
        <!-- Confetti Container -->
        <div class="confetti-container">
          <div v-for="i in 50" :key="i" class="confetti" :style="getConfettiStyle(i)"></div>
        </div>
        <div class="text-4xl mb-2 celebration-icon">🎉</div>
        <h4 class="text-lg font-bold text-green-700 mb-1">Your coffee is ready!</h4>
        <p class="text-sm text-gray-600">Please pick it up at the counter</p>
      </div>

      <!-- Cancellation Message with Shake Animation -->
      <div v-if="order.status === 'CANCELLED'" class="cancellation-message">
        <div class="text-4xl mb-2 sad-icon">😔</div>
        <h4 class="text-lg font-bold text-red-700 mb-1">Order Cancelled</h4>
        <p class="text-sm text-gray-600">
          {{ getCancellationMessage() }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useOrderStore } from '../../stores/orderStore';
import type { Order } from '../../types';

// ========== Props ==========
const props = defineProps<{
  order: Order;
}>();

// ========== Emits ==========
const emit = defineEmits<{
  cancelled: [];
}>();

// ========== Store ==========
const orderStore = useOrderStore();

// ========== State ==========
const isCancelling = ref(false);
const currentTime = ref(Date.now());
let timeInterval: number | null = null;

// ========== Computed ==========

/**
 * Short order ID for display (last 8 characters)
 */
const shortOrderId = computed(() => {
  return props.order.orderId.slice(-8).toUpperCase();
});

/**
 * Status label for display
 */
const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    QUEUED: 'In Queue',
    ACCEPTED: 'Preparing',
    COMPLETED: 'Ready',
    CANCELLED: 'Cancelled'
  };
  return labels[props.order.status] || props.order.status;
});

/**
 * Status badge CSS class
 */
const statusBadgeClass = computed(() => {
  const classes: Record<string, string> = {
    PENDING: 'badge-pending',
    QUEUED: 'badge-queued',
    ACCEPTED: 'badge-accepted',
    COMPLETED: 'badge-completed',
    CANCELLED: 'badge-cancelled'
  };
  return classes[props.order.status] || 'badge-pending';
});

/**
 * Check if order can be cancelled
 */
const canCancel = computed(() => {
  return props.order.status === 'PENDING' || props.order.status === 'QUEUED';
});

/**
 * Calculate elapsed time since order was placed
 */
const elapsedTime = computed(() => {
  if (!props.order.timestamps.placed) {
    return '0m';
  }
  
  const placed = new Date(props.order.timestamps.placed).getTime();
  const elapsed = Math.floor((currentTime.value - placed) / 1000 / 60); // minutes
  
  if (elapsed < 1) {
    return 'Just now';
  } else if (elapsed === 1) {
    return '1 minute';
  } else {
    return `${elapsed} minutes`;
  }
});

/**
 * Calculate total time from placement to completion/cancellation
 */
const totalTime = computed(() => {
  if (!props.order.timestamps.placed) {
    return '0m';
  }
  
  let endTime: number;
  if (props.order.status === 'COMPLETED' && props.order.timestamps.completed) {
    endTime = new Date(props.order.timestamps.completed).getTime();
  } else if (props.order.status === 'CANCELLED' && props.order.timestamps.cancelled) {
    endTime = new Date(props.order.timestamps.cancelled).getTime();
  } else {
    endTime = currentTime.value;
  }
  
  const placed = new Date(props.order.timestamps.placed).getTime();
  const total = Math.floor((endTime - placed) / 1000 / 60); // minutes
  
  if (total < 1) {
    return 'less than a minute';
  } else if (total === 1) {
    return '1 minute';
  } else {
    return `${total} minutes`;
  }
});

/**
 * Estimate remaining time based on current status
 */
const estimatedTimeRemaining = computed(() => {
  if (props.order.status === 'COMPLETED' || props.order.status === 'CANCELLED') {
    return null;
  }
  
  // Rough estimates
  if (props.order.status === 'PENDING') {
    return '2-3 min';
  } else if (props.order.status === 'QUEUED') {
    return '1-2 min';
  } else if (props.order.status === 'ACCEPTED') {
    return '3-5 min';
  }
  
  return null;
});

// ========== Methods ==========

/**
 * Check if a stage is currently active
 */
function isStageActive(status: string): boolean {
  return props.order.status === status;
}

/**
 * Check if a stage is complete
 */
function isStageComplete(status: string): boolean {
  const statusOrder = ['PENDING', 'QUEUED', 'ACCEPTED', 'COMPLETED'];
  const currentIndex = statusOrder.indexOf(props.order.status);
  const stageIndex = statusOrder.indexOf(status);
  
  return currentIndex > stageIndex;
}

/**
 * Format timestamp for display
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
    small: 'Small (8 oz)',
    medium: 'Medium (12 oz)',
    large: 'Large (16 oz)'
  };
  return sizeMap[size] || size;
}

/**
 * Get cancellation message based on who cancelled
 */
function getCancellationMessage(): string {
  if (!props.order.cancelledBy) {
    return 'Your order was cancelled';
  }
  
  const messages: Record<string, string> = {
    attendee: 'You cancelled this order',
    barista: 'The barista cancelled this order',
    system: 'This order was automatically cancelled'
  };
  
  return messages[props.order.cancelledBy] || 'Your order was cancelled';
}

/**
 * Handle cancel button click
 */
async function handleCancel(): Promise<void> {
  if (isCancelling.value || !canCancel.value) {
    return;
  }
  
  // Confirm cancellation
  const confirmed = confirm('Are you sure you want to cancel this order?');
  if (!confirmed) {
    return;
  }
  
  isCancelling.value = true;
  
  try {
    await orderStore.cancelOrder(
      props.order.orderId,
      'Cancelled by attendee',
      'attendee'
    );
    
    // Emit cancelled event
    emit('cancelled');
    
    // Provide haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    alert(error.message || 'Failed to cancel order. Please try again.');
  } finally {
    isCancelling.value = false;
  }
}

/**
 * Update current time every second
 */
function startTimeUpdates(): void {
  timeInterval = window.setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
}

/**
 * Stop animations
 */
function stopAnimations(): void {
  if (timeInterval !== null) {
    clearInterval(timeInterval);
    timeInterval = null;
  }
}

/**
 * Generate random confetti styles
 */
function getConfettiStyle(index: number): { left: string; backgroundColor: string; animationDelay: string; animationDuration: string } {
  const colors = ['#6F4E37', '#D4A574', '#E8C4A0', '#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3'];
  const randomColor = colors[index % colors.length] || '#6F4E37';
  const randomLeft = Math.random() * 100;
  const randomDelay = Math.random() * 0.5;
  const randomDuration = 2 + Math.random() * 1;
  
  return {
    left: `${randomLeft}%`,
    backgroundColor: randomColor,
    animationDelay: `${randomDelay}s`,
    animationDuration: `${randomDuration}s`
  };
}

// ========== Lifecycle ==========

onMounted(() => {
  startTimeUpdates();
});

onUnmounted(() => {
  stopAnimations();
});
</script>

<style scoped>
/* Container */
.order-status-container {
  width: 100%;
  animation: slide-in 0.3s ease-out;
}

/* Fade Transition for Status Changes */
.status-card {
  transition: all 0.3s ease-in-out;
}

/* Status-specific background transitions */
.status-card[data-status="PENDING"] {
  background: linear-gradient(135deg, rgba(243, 244, 246, 0.5), rgba(255, 255, 255, 1));
}

.status-card[data-status="QUEUED"] {
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.3), rgba(255, 255, 255, 1));
}

.status-card[data-status="ACCEPTED"] {
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.3), rgba(255, 255, 255, 1));
}

.status-card[data-status="COMPLETED"] {
  background: linear-gradient(135deg, rgba(220, 252, 231, 0.3), rgba(255, 255, 255, 1));
}

.status-card[data-status="CANCELLED"] {
  background: linear-gradient(135deg, rgba(254, 226, 226, 0.3), rgba(255, 255, 255, 1));
}

/* Status Card */
.status-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1);
  border: 2px solid var(--color-coffee-cream);
}

/* Status Header */
.status-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--color-coffee-cream);
}

/* Status Badge */
.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
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

/* Progress Section */
.progress-section {
  margin-bottom: 1.5rem;
}

.progress-stages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.progress-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  position: relative;
  z-index: 1;
}

.stage-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background-color: rgb(243 244 246);
  border: 3px solid rgb(209 213 219);
  transition: all 0.3s ease;
}

.stage-active .stage-icon {
  background-color: var(--color-coffee-latte);
  border-color: var(--color-coffee-brown);
  box-shadow: 0 0 0 4px rgba(111, 78, 55, 0.1);
  animation: pulse-ring 2s ease-in-out infinite;
}

.stage-complete .stage-icon {
  background-color: var(--color-coffee-brown);
  border-color: var(--color-coffee-brown);
  color: white;
}

.stage-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(107 114 128);
  text-align: center;
}

.stage-active .stage-label {
  color: var(--color-coffee-brown);
  font-weight: 700;
}

.stage-time {
  font-size: 0.625rem;
  color: rgb(156 163 175);
  text-align: center;
}

/* Progress Connector */
.progress-connector {
  position: absolute;
  top: 24px;
  height: 3px;
  background-color: rgb(229 231 235);
  transition: background-color 0.3s ease;
  z-index: 0;
}

.progress-connector:nth-of-type(2) {
  left: calc(12.5% + 24px);
  width: calc(25% - 48px);
}

.progress-connector:nth-of-type(4) {
  left: calc(37.5% + 24px);
  width: calc(25% - 48px);
}

.progress-connector:nth-of-type(6) {
  left: calc(62.5% + 24px);
  width: calc(25% - 48px);
}

.connector-active {
  background-color: var(--color-coffee-brown);
}

/* Order Details */
.order-details {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--color-coffee-cream);
  border-radius: 0.75rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: rgb(107 114 128);
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: rgb(31 41 55);
  font-weight: 600;
}

.col-span-2 {
  grid-column: span 2;
}

/* Time Info */
.time-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: rgb(249 250 251);
  border-radius: 0.75rem;
  border: 1px solid rgb(229 231 235);
}

.time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgb(55 65 81);
}

.time-display.success {
  color: rgb(22 101 52);
}

.time-display.error {
  color: rgb(153 27 27);
  flex-direction: column;
}

.time-icon {
  font-size: 1.25rem;
}

.time-text {
  font-weight: 600;
}

/* Action Section */
.action-section {
  margin-bottom: 1rem;
}

.cancel-button {
  width: 100%;
  padding: 0.875rem;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 0.875rem;
  background-color: white;
  color: rgb(220 38 38);
  border: 2px solid rgb(220 38 38);
  transition: all 0.2s;
  touch-action: manipulation;
  min-height: 48px;
}

.cancel-button:hover:not(:disabled) {
  background-color: rgb(220 38 38);
  color: white;
}

.cancel-button:active:not(:disabled) {
  transform: scale(0.98);
}

.cancel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Completion Message */
.completion-message {
  position: relative;
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(to bottom, rgb(220 252 231), rgb(187 247 208));
  border-radius: 0.75rem;
  animation: bounce-in 0.5s ease-out;
  overflow: hidden;
}

/* Confetti Container */
.confetti-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

/* Individual Confetti Pieces */
.confetti {
  position: absolute;
  width: 10px;
  height: 10px;
  top: -10px;
  opacity: 0;
  animation: confetti-fall 3s ease-out forwards;
}

@keyframes confetti-fall {
  0% {
    top: -10px;
    opacity: 1;
    transform: translateX(0) rotateZ(0deg);
  }
  100% {
    top: 100%;
    opacity: 0;
    transform: translateX(calc(var(--random-x, 0) * 50px)) rotateZ(720deg);
  }
}

/* Celebration Icon Animation */
.celebration-icon {
  animation: celebration-bounce 0.6s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

@keyframes celebration-bounce {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.2) rotate(-10deg);
  }
  75% {
    transform: scale(1.2) rotate(10deg);
  }
}

/* Cancellation Message */
.cancellation-message {
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(to bottom, rgb(254 226 226), rgb(252 165 165));
  border-radius: 0.75rem;
  animation: shake 0.5s ease-out;
}

/* Sad Icon Animation */
.sad-icon {
  animation: sad-wobble 1s ease-in-out;
}

@keyframes sad-wobble {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-15deg);
  }
  75% {
    transform: rotate(15deg);
  }
}

/* Animations */
@keyframes slide-in {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pulse-ring {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(111, 78, 55, 0.1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(111, 78, 55, 0.2);
  }
}

@keyframes bounce-in {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .status-card {
    padding: 1rem;
  }
  
  .progress-stages {
    gap: 0.25rem;
  }
  
  .stage-icon {
    width: 40px;
    height: 40px;
    font-size: 1.25rem;
  }
  
  .stage-label {
    font-size: 0.625rem;
  }
  
  .progress-connector {
    top: 20px;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
  
  .col-span-2 {
    grid-column: span 1;
  }
}

/* Prevent text selection on interactive elements */
.cancel-button,
.status-badge {
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Smooth transitions */
* {
  transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
</style>
