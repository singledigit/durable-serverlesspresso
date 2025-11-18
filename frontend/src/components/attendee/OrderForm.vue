<template>
  <div class="order-form">
    <!-- Form Header -->
    <div class="mb-3">
      <h2 class="text-lg font-bold text-[--color-coffee-brown] mb-1">
        ☕ Order Your Coffee
      </h2>
      <p class="text-xs text-gray-600">
        Select your drink, size, and customizations
      </p>
    </div>

    <!-- Daily Limit Warning -->
    <div 
      v-if="orderStore.todaysOrderCount >= 2" 
      class="mb-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded"
    >
      <p class="text-xs text-yellow-800">
        <span class="font-semibold">⚠️</span> 
        You've ordered {{ orderStore.todaysOrderCount }} of 3 coffees today
      </p>
    </div>

    <!-- Error Display -->
    <div 
      v-if="localError" 
      class="mb-3 p-2 bg-red-50 border-l-4 border-red-500 rounded"
    >
      <div class="flex items-start gap-2">
        <span class="text-base">❌</span>
        <div class="flex-1">
          <p class="font-semibold text-red-800 text-xs">Error</p>
          <p class="text-xs text-red-700">{{ localError }}</p>
        </div>
        <button 
          @click="clearLocalError"
          class="text-red-500 hover:text-red-700 text-sm"
          aria-label="Close error"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Drink Selection -->
    <div class="mb-3">
      <label class="block text-xs font-semibold text-gray-700 mb-2">
        Choose Your Drink
      </label>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="drink in drinkOptions"
          :key="drink.value"
          @click="selectDrink(drink.value)"
          :class="[
            'drink-card',
            selectedDrink === drink.value ? 'drink-card-selected' : 'drink-card-default'
          ]"
          type="button"
        >
          <div class="text-4xl mb-2">{{ drink.icon }}</div>
          <div class="font-semibold text-base">{{ drink.label }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ drink.description }}</div>
        </button>
      </div>
      <p v-if="validationErrors.drink" class="text-sm text-red-600 mt-2">
        {{ validationErrors.drink }}
      </p>
    </div>

    <!-- Size Selection -->
    <div class="mb-3">
      <label class="block text-xs font-semibold text-gray-700 mb-2">
        Select Size
      </label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="size in sizeOptions"
          :key="size.value"
          @click="selectSize(size.value)"
          :class="[
            'size-button',
            selectedSize === size.value ? 'size-button-selected' : 'size-button-default'
          ]"
          type="button"
        >
          <span class="font-semibold text-sm">{{ size.volume }}</span>
        </button>
      </div>
      <p v-if="validationErrors.size" class="text-sm text-red-600 mt-2">
        {{ validationErrors.size }}
      </p>
    </div>

    <!-- Customizations -->
    <div class="mb-3">
      <label class="block text-xs font-semibold text-gray-700 mb-2">
        Customizations (Optional)
      </label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="custom in customizationOptions"
          :key="custom.value"
          @click="toggleCustomization(custom.value)"
          :class="[
            'customization-chip',
            selectedCustomizations.includes(custom.value) 
              ? 'customization-chip-selected' 
              : 'customization-chip-default'
          ]"
          type="button"
        >
          <span class="mr-1">{{ custom.icon }}</span>
          <span class="text-xs">{{ custom.label }}</span>
        </button>
      </div>
    </div>

    <!-- Order Summary -->
    <div 
      v-if="selectedDrink && selectedSize" 
      class="mb-3 p-2 bg-[--color-coffee-cream] rounded-lg"
    >
      <h3 class="font-semibold text-[--color-coffee-brown] mb-1 text-xs">Order Summary</h3>
      <div class="space-y-0 text-xs">
        <p>
          <span class="font-medium">Drink:</span> 
          {{ getDrinkLabel(selectedDrink) }}
        </p>
        <p>
          <span class="font-medium">Size:</span> 
          {{ getSizeLabel(selectedSize) }}
        </p>
        <p v-if="selectedCustomizations.length > 0">
          <span class="font-medium">Customizations:</span> 
          {{ selectedCustomizations.map(c => getCustomizationLabel(c)).join(', ') }}
        </p>
      </div>
    </div>

    <!-- Submit Button with Coffee Cup Animation -->
    <button
      @click="handleSubmit"
      :disabled="isSubmitting || !isFormValid || !eventStore.storeOpen"
      :class="[
        'submit-button',
        isSubmitting || !isFormValid || !eventStore.storeOpen 
          ? 'submit-button-disabled' 
          : 'submit-button-active'
      ]"
      type="button"
    >
      <span v-if="isSubmitting" class="flex items-center justify-center gap-2">
        <!-- Coffee Cup Fill Animation -->
        <div class="coffee-cup-loader">
          <div class="cup-body">
            <div class="coffee-fill-loader"></div>
          </div>
          <div class="cup-handle"></div>
        </div>
        <span>Placing Order...</span>
      </span>
      <span v-else-if="!eventStore.storeOpen">
        Store Closed
      </span>
      <span v-else-if="!isFormValid">
        Select Drink & Size
      </span>
      <span v-else>
        Place Order ☕
      </span>
    </button>

    <!-- Help Text -->
    <p class="text-xs text-center text-gray-500 mt-2">
      Your order will be sent to the barista queue
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useOrderStore } from '../../stores/orderStore';
import { useEventStore } from '../../stores/eventStore';
import type { DrinkType, DrinkSize } from '../../types';

// ========== Props ==========
const props = defineProps<{
  attendeeId: string;
}>();

// ========== Stores ==========
const orderStore = useOrderStore();
const eventStore = useEventStore();

// ========== Emits ==========
const emit = defineEmits<{
  orderPlaced: [orderId: string];
}>();

// ========== State ==========
const selectedDrink = ref<DrinkType | null>(null);
const selectedSize = ref<DrinkSize | null>(null);
const selectedCustomizations = ref<string[]>([]);
const isSubmitting = ref(false);
const localError = ref<string | null>(null);
const validationErrors = ref<{
  drink?: string;
  size?: string;
}>({});

// ========== Drink Options ==========
const drinkOptions = [
  {
    value: 'latte' as DrinkType,
    label: 'Latte',
    icon: '☕',
    description: 'Espresso with steamed milk'
  },
  {
    value: 'cappuccino' as DrinkType,
    label: 'Cappuccino',
    icon: '🥛',
    description: 'Espresso with foam'
  },
  {
    value: 'espresso' as DrinkType,
    label: 'Espresso',
    icon: '⚡',
    description: 'Strong & bold'
  },
  {
    value: 'americano' as DrinkType,
    label: 'Americano',
    icon: '☕',
    description: 'Espresso with hot water'
  }
];

// ========== Size Options ==========
const sizeOptions = [
  {
    value: 'small' as DrinkSize,
    label: 'S',
    icon: '🥤',
    volume: '8 oz'
  },
  {
    value: 'medium' as DrinkSize,
    label: 'M',
    icon: '🥤',
    volume: '12 oz'
  },
  {
    value: 'large' as DrinkSize,
    label: 'L',
    icon: '🥤',
    volume: '16 oz'
  }
];

// ========== Customization Options ==========
const customizationOptions = [
  { value: 'extra shot', label: 'Extra Shot', icon: '➕' },
  { value: 'oat milk', label: 'Oat Milk', icon: '🌾' },
  { value: 'almond milk', label: 'Almond Milk', icon: '🌰' },
  { value: 'soy milk', label: 'Soy Milk', icon: '🫘' },
  { value: 'sugar free', label: 'Sugar Free', icon: '🚫' },
  { value: 'extra foam', label: 'Extra Foam', icon: '☁️' },
  { value: 'whipped cream', label: 'Whipped Cream', icon: '🍦' },
  { value: 'caramel drizzle', label: 'Caramel', icon: '🍯' }
];

// ========== Computed ==========
const isFormValid = computed(() => {
  return selectedDrink.value !== null && selectedSize.value !== null;
});

// ========== Methods ==========
function selectDrink(drink: DrinkType): void {
  selectedDrink.value = drink;
  validationErrors.value.drink = undefined;
  
  // Provide haptic feedback on mobile
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

function selectSize(size: DrinkSize): void {
  selectedSize.value = size;
  validationErrors.value.size = undefined;
  
  // Provide haptic feedback on mobile
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

function toggleCustomization(customization: string): void {
  const index = selectedCustomizations.value.indexOf(customization);
  
  if (index > -1) {
    // Remove customization
    selectedCustomizations.value.splice(index, 1);
  } else {
    // Add customization (max 5)
    if (selectedCustomizations.value.length < 5) {
      selectedCustomizations.value.push(customization);
    } else {
      localError.value = 'Maximum 5 customizations allowed';
      setTimeout(() => {
        localError.value = null;
      }, 3000);
    }
  }
  
  // Provide haptic feedback on mobile
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

function getDrinkLabel(drink: DrinkType): string {
  return drinkOptions.find(d => d.value === drink)?.label || drink;
}

function getSizeLabel(size: DrinkSize): string {
  return sizeOptions.find(s => s.value === size)?.label || size;
}

function getCustomizationLabel(customization: string): string {
  return customizationOptions.find(c => c.value === customization)?.label || customization;
}

function validateForm(): boolean {
  validationErrors.value = {};
  let isValid = true;

  if (!selectedDrink.value) {
    validationErrors.value.drink = 'Please select a drink';
    isValid = false;
  }

  if (!selectedSize.value) {
    validationErrors.value.size = 'Please select a size';
    isValid = false;
  }

  return isValid;
}

function clearLocalError(): void {
  localError.value = null;
}

async function handleSubmit(): Promise<void> {
  // Clear previous errors
  localError.value = null;
  orderStore.clearError();

  // Validate form
  if (!validateForm()) {
    return;
  }

  // Check if store is open
  if (!eventStore.storeOpen) {
    localError.value = 'The coffee bar is currently closed';
    return;
  }

  // Check daily limit
  if (orderStore.hasReachedDailyLimit) {
    localError.value = 'You have reached your daily limit of 3 orders';
    return;
  }

  isSubmitting.value = true;

  try {
    // Use attendee ID from props
    const eventId = import.meta.env.VITE_EVENT_ID || 'reinvent-2025';

    // Place order
    const order = await orderStore.placeOrder(props.attendeeId, eventId, {
      drinkType: selectedDrink.value!,
      size: selectedSize.value!,
      customizations: selectedCustomizations.value.length > 0 
        ? selectedCustomizations.value 
        : undefined
    });

    if (order) {
      // Success! Emit event and reset form
      emit('orderPlaced', order.orderId);
      
      // Reset form
      selectedDrink.value = null;
      selectedSize.value = null;
      selectedCustomizations.value = [];
      
      // Provide success haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 100, 50]);
      }
    }
  } catch (error: any) {
    // Handle error
    localError.value = error.message || 'Failed to place order. Please try again.';
    
    // Provide error haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
/* Drink Card Styles */
.drink-card {
  padding: 0.75rem;
  border-radius: 0.75rem;
  border-width: 2px;
  transition: all 0.2s;
  touch-action: manipulation;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 140px;
  /* Ensure minimum tap target size of 44x44px */
  min-width: 44px;
}

.drink-card-default {
  background-color: white;
  border-color: rgb(229 231 235);
}

.drink-card-default:hover {
  border-color: var(--color-coffee-latte);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.drink-card-default:active {
  transform: scale(0.95);
}

.drink-card-selected {
  background-color: var(--color-coffee-cream);
  border-color: var(--color-coffee-brown);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  outline: 2px solid var(--color-coffee-brown);
  outline-offset: 2px;
}

/* Size Button Styles */
.size-button {
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  border-width: 2px;
  transition: all 0.2s;
  touch-action: manipulation;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 36px;
  /* Ensure minimum tap target size */
  min-width: 44px;
}

.size-button-default {
  background-color: white;
  border-color: rgb(229 231 235);
}

.size-button-default:hover {
  border-color: var(--color-coffee-latte);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.size-button-default:active {
  transform: scale(0.95);
}

.size-button-selected {
  background-color: var(--color-coffee-latte);
  border-color: var(--color-coffee-brown);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  color: white;
  outline: 2px solid var(--color-coffee-brown);
  outline-offset: 2px;
}

/* Customization Chip Styles */
.customization-chip {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border-width: 2px;
  transition: all 0.2s;
  touch-action: manipulation;
  font-size: 0.875rem;
  font-weight: 500;
  /* Ensure minimum tap target size */
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.customization-chip-default {
  background-color: white;
  border-color: rgb(209 213 219);
  color: rgb(55 65 81);
}

.customization-chip-default:hover {
  border-color: var(--color-coffee-latte);
  background-color: rgb(249 250 251);
}

.customization-chip-default:active {
  transform: scale(0.95);
}

.customization-chip-selected {
  background-color: var(--color-coffee-brown);
  border-color: var(--color-coffee-brown);
  color: white;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Submit Button Styles */
.submit-button {
  width: 100%;
  padding: 1rem;
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1.125rem;
  transition: all 0.2s;
  touch-action: manipulation;
  /* Ensure minimum tap target size */
  min-height: 56px;
}

.submit-button-active {
  background-color: var(--color-coffee-brown);
  color: white;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

.submit-button-active:hover {
  opacity: 0.9;
}

.submit-button-active:active {
  transform: scale(0.98);
}

.submit-button-disabled {
  background-color: rgb(209 213 219);
  color: rgb(107 114 128);
  cursor: not-allowed;
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  /* Increase touch target sizes on mobile */
  .drink-card {
    min-height: 160px;
  }
  
  .size-button {
    min-height: 48px;
  }
  
  /* Improve readability on small screens */
  .drink-card .text-xs {
    font-size: 10px;
  }
}

/* Prevent text selection on interactive elements */
.drink-card,
.size-button,
.customization-chip,
.submit-button {
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Coffee Cup Loader Animation */
.coffee-cup-loader {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cup-body {
  position: relative;
  width: 18px;
  height: 20px;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid white;
  border-radius: 0 0 4px 4px;
  overflow: hidden;
}

.coffee-fill-loader {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  animation: fill-cup 1.5s ease-in-out infinite;
}

.cup-handle {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 12px;
  border: 2px solid white;
  border-left: none;
  border-radius: 0 50% 50% 0;
}

@keyframes fill-cup {
  0%, 100% {
    height: 0%;
  }
  50% {
    height: 100%;
  }
}

/* Button Press Feedback - Instant Response */
.drink-card:active,
.size-button:active,
.customization-chip:active {
  transform: scale(0.95);
  transition: transform 0.05s ease-out; /* 50ms - well under 100ms requirement */
}

.submit-button-active:active {
  transform: scale(0.98);
  transition: transform 0.05s ease-out;
}

/* Smooth animations */
@keyframes scale-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.order-form {
  animation: scale-in 0.3s ease-out;
}

/* Selection Feedback Animation */
@keyframes selection-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(111, 78, 55, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(111, 78, 55, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(111, 78, 55, 0);
  }
}

.drink-card-selected,
.size-button-selected,
.customization-chip-selected {
  animation: selection-pulse 0.4s ease-out;
}
</style>
