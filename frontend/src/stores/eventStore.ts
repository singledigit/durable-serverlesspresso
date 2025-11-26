import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EventConfig } from '../types';

/**
 * Event Store
 * Manages event configuration and store status
 * Handles event-level settings like store hours and open/closed status
 */
export const useEventStore = defineStore('event', () => {
  // ========== State ==========
  
  /**
   * Current event configuration
   * Contains event details, store hours, and settings
   */
  const currentEvent = ref<EventConfig | null>(null);

  /**
   * Store open/closed status
   * Derived from currentEvent but can be toggled independently
   */
  const storeOpen = ref<boolean>(false);

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
   * Get event ID
   */
  const eventId = computed(() => {
    return currentEvent.value?.eventId || null;
  });

  /**
   * Get event name
   */
  const eventName = computed(() => {
    return currentEvent.value?.eventName || 'Coffee Ordering System';
  });

  /**
   * Get maximum orders per attendee
   */
  const maxOrdersPerAttendee = computed(() => {
    return currentEvent.value?.maxOrdersPerAttendee || 3;
  });

  /**
   * Get store status message
   */
  const storeStatusMessage = computed(() => {
    if (!currentEvent.value) {
      return 'Event configuration not loaded';
    }

    return storeOpen.value ? 'Store is open' : 'Store is closed';
  });

  /**
   * Check if orders can be placed
   * Store must be open
   */
  const canPlaceOrders = computed(() => {
    return storeOpen.value;
  });

  // ========== Actions ==========

  /**
   * Load event configuration
   * Fetches event data from backend API
   * 
   * @param eventId - The event ID to load configuration for
   */
  async function loadEventConfig(eventIdParam?: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Use provided eventId or fall back to environment variable
      const targetEventId = eventIdParam || import.meta.env.VITE_EVENT_ID || '';

      if (!targetEventId) {
        throw new Error('Event ID not provided and VITE_EVENT_ID not set');
      }

      // Import API service dynamically to avoid circular dependencies
      const { apiService } = await import('../services/api');
      
      // Fetch event configuration from API
      const config = await apiService.getEventConfig(targetEventId);
      
      if (config.error) {
        throw new Error(config.error);
      }

      currentEvent.value = config;
      storeOpen.value = config.storeOpen;

      console.log('Event configuration loaded:', config);
    } catch (err: any) {
      error.value = err.message || 'Failed to load event configuration';
      console.error('Error loading event configuration:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Toggle store open/closed status
   * Used by baristas to manually open or close the store
   * 
   * @param open - New open status (true = open, false = closed)
   */
  async function toggleStoreStatus(open: boolean): Promise<void> {
    if (!currentEvent.value?.eventId) {
      throw new Error('No event loaded');
    }

    isLoading.value = true;
    error.value = null;

    try {
      // Import API service dynamically to avoid circular dependencies
      const { apiService } = await import('../services/api');
      
      // Call backend API to update store status
      // This will publish an event via AppSync Events that all clients will receive
      await apiService.updateStoreStatus(currentEvent.value.eventId, open);

      // Update local state
      storeOpen.value = open;

      if (currentEvent.value) {
        currentEvent.value.storeOpen = open;
        currentEvent.value.updatedAt = new Date().toISOString();
      }

      console.log(`Store status updated: ${open ? 'OPEN' : 'CLOSED'}`);
    } catch (err: any) {
      error.value = err.message || 'Failed to update store status';
      console.error('Error updating store status:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update event configuration
   * Used to update event settings like hours or max orders
   * 
   * @param updates - Partial event configuration to update
   */
  async function updateEventConfig(updates: Partial<EventConfig>): Promise<void> {
    if (!currentEvent.value) {
      throw new Error('No event configuration loaded');
    }

    isLoading.value = true;
    error.value = null;

    try {
      // TODO: Replace with actual API call when backend endpoint is available
      // await apiService.updateEventConfig(currentEvent.value.eventId, updates);

      // Update local state
      currentEvent.value = {
        ...currentEvent.value,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Update storeOpen if it was changed
      if (updates.storeOpen !== undefined) {
        storeOpen.value = updates.storeOpen;
      }

      console.log('Event configuration updated:', updates);
    } catch (err: any) {
      error.value = err.message || 'Failed to update event configuration';
      console.error('Error updating event configuration:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
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
    currentEvent.value = null;
    storeOpen.value = false;
    isLoading.value = false;
    error.value = null;
  }

  // ========== Return Store Interface ==========
  return {
    // State
    currentEvent,
    storeOpen,
    isLoading,
    error,

    // Getters
    eventId,
    eventName,
    maxOrdersPerAttendee,
    storeStatusMessage,
    canPlaceOrders,

    // Actions
    loadEventConfig,
    toggleStoreStatus,
    updateEventConfig,
    clearError,
    $reset
  };
});
