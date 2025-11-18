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
   * Get store hours as formatted string
   */
  const storeHours = computed(() => {
    if (!currentEvent.value) {
      return 'Not available';
    }

    const { openingTime, closingTime } = currentEvent.value;
    
    // Format times (assuming ISO 8601 time format like "07:00:00")
    const formatTime = (time: string) => {
      const parts = time.split(':');
      const hours = parts[0];
      const minutes = parts[1];
      
      if (!hours || !minutes) {
        return time; // Return original if format is unexpected
      }
      
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    return `${formatTime(openingTime)} - ${formatTime(closingTime)}`;
  });

  /**
   * Get maximum orders per attendee
   */
  const maxOrdersPerAttendee = computed(() => {
    return currentEvent.value?.maxOrdersPerAttendee || 3;
  });

  /**
   * Check if store is currently within operating hours
   * Note: This checks the time, not the storeOpen flag
   */
  const isWithinOperatingHours = computed(() => {
    if (!currentEvent.value) {
      return false;
    }

    const now = new Date();
    const timeParts = now.toTimeString().split(' ');
    const currentTime = timeParts[0]; // Get HH:MM:SS

    if (!currentTime) {
      return false;
    }

    const { openingTime, closingTime } = currentEvent.value;

    return currentTime >= openingTime && currentTime <= closingTime;
  });

  /**
   * Get store status message
   */
  const storeStatusMessage = computed(() => {
    if (!currentEvent.value) {
      return 'Event configuration not loaded';
    }

    if (storeOpen.value) {
      return 'Store is open';
    }

    if (isWithinOperatingHours.value) {
      return 'Store is closed (within operating hours)';
    }

    return `Store is closed. Hours: ${storeHours.value}`;
  });

  /**
   * Check if orders can be placed
   * Store must be open (only checks storeOpen flag, not time-based hours)
   */
  const canPlaceOrders = computed(() => {
    return storeOpen.value;
  });

  // ========== Actions ==========

  /**
   * Load event configuration
   * Fetches event data from backend or uses environment variable
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

      // TODO: Replace with actual API call when backend endpoint is available
      // For now, create a mock configuration based on environment
      // In production, this would be: await apiService.getEventConfig(targetEventId);
      
      // Mock event configuration for development
      const mockConfig: EventConfig = {
        eventId: targetEventId,
        eventName: import.meta.env.VITE_EVENT_NAME || 'AWS re:Invent 2025',
        storeOpen: true, // Default to open for development
        openingTime: '07:00:00',
        closingTime: '18:00:00',
        maxOrdersPerAttendee: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      currentEvent.value = mockConfig;
      storeOpen.value = mockConfig.storeOpen;

      console.log('Event configuration loaded:', mockConfig);
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
   * Check if current time is within store hours
   * Useful for displaying warnings to users
   */
  function checkStoreHours(): boolean {
    return isWithinOperatingHours.value;
  }

  /**
   * Get time until store opens (in minutes)
   * Returns null if store is already open or past closing time
   */
  const timeUntilOpen = computed((): number | null => {
    if (!currentEvent.value || storeOpen.value) {
      return null;
    }

    const now = new Date();
    const timeParts = now.toTimeString().split(' ');
    const currentTime = timeParts[0];
    
    if (!currentTime) {
      return null;
    }

    const { openingTime } = currentEvent.value;

    if (currentTime >= openingTime) {
      return null; // Already past opening time
    }

    // Calculate minutes until opening
    const currentTimeParts = currentTime.split(':').map(Number);
    const openTimeParts = openingTime.split(':').map(Number);
    
    const currentHours = currentTimeParts[0] || 0;
    const currentMinutes = currentTimeParts[1] || 0;
    const openHours = openTimeParts[0] || 0;
    const openMinutes = openTimeParts[1] || 0;

    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const openTotalMinutes = openHours * 60 + openMinutes;

    return openTotalMinutes - currentTotalMinutes;
  });

  /**
   * Get time until store closes (in minutes)
   * Returns null if store is closed or past closing time
   */
  const timeUntilClose = computed((): number | null => {
    if (!currentEvent.value || !storeOpen.value) {
      return null;
    }

    const now = new Date();
    const timeParts = now.toTimeString().split(' ');
    const currentTime = timeParts[0];
    
    if (!currentTime) {
      return null;
    }

    const { closingTime } = currentEvent.value;

    if (currentTime >= closingTime) {
      return null; // Already past closing time
    }

    // Calculate minutes until closing
    const currentTimeParts = currentTime.split(':').map(Number);
    const closeTimeParts = closingTime.split(':').map(Number);
    
    const currentHours = currentTimeParts[0] || 0;
    const currentMinutes = currentTimeParts[1] || 0;
    const closeHours = closeTimeParts[0] || 0;
    const closeMinutes = closeTimeParts[1] || 0;

    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const closeTotalMinutes = closeHours * 60 + closeMinutes;

    return closeTotalMinutes - currentTotalMinutes;
  });

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
    storeHours,
    maxOrdersPerAttendee,
    isWithinOperatingHours,
    storeStatusMessage,
    canPlaceOrders,
    timeUntilOpen,
    timeUntilClose,

    // Actions
    loadEventConfig,
    toggleStoreStatus,
    updateEventConfig,
    checkStoreHours,
    clearError,
    $reset
  };
});
