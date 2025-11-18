<template>
  <div 
    class="status-badge"
    :class="badgeClass"
    :style="badgeStyle"
  >
    <span class="status-icon">{{ statusIcon }}</span>
    <span class="status-text">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { OrderStatus } from '../../types';

// ========== Props ==========
const props = defineProps<{
  status: OrderStatus;
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}>();

// ========== Computed ==========

/**
 * Get badge CSS class based on status
 */
const badgeClass = computed(() => {
  const sizeClass = props.size === 'small' ? 'badge-small' : props.size === 'large' ? 'badge-large' : 'badge-medium';
  const animatedClass = props.animated ? 'badge-animated' : '';
  
  return `${sizeClass} ${animatedClass} badge-${props.status.toLowerCase()}`;
});

/**
 * Get badge style for dynamic animations
 */
const badgeStyle = computed(() => {
  if (!props.animated) {
    return {};
  }
  
  // Add subtle pulse animation for active statuses
  if (props.status === 'QUEUED' || props.status === 'ACCEPTED') {
    return {
      animation: 'badge-pulse 2s ease-in-out infinite'
    };
  }
  
  return {};
});

/**
 * Get icon for status
 */
const statusIcon = computed(() => {
  const icons: Record<OrderStatus, string> = {
    PENDING: '⏳',
    QUEUED: '📋',
    ACCEPTED: '☕',
    COMPLETED: '✅',
    CANCELLED: '❌'
  };
  return icons[props.status] || '📋';
});

/**
 * Get text for status
 */
const statusText = computed(() => {
  const labels: Record<OrderStatus, string> = {
    PENDING: 'Pending',
    QUEUED: 'In Queue',
    ACCEPTED: 'Preparing',
    COMPLETED: 'Ready',
    CANCELLED: 'Cancelled'
  };
  return labels[props.status] || props.status;
});
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s ease-out;
  white-space: nowrap;
}

/* Size Variants */
.badge-small {
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
}

.badge-small .status-icon {
  font-size: 0.75rem;
}

.badge-medium {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
}

.badge-medium .status-icon {
  font-size: 0.875rem;
}

.badge-large {
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
}

.badge-large .status-icon {
  font-size: 1rem;
}

/* Status Colors */
.badge-pending {
  background-color: rgb(243 244 246);
  color: rgb(75 85 99);
  border: 2px solid rgb(209 213 219);
}

.badge-queued {
  background-color: rgb(254 243 199);
  color: rgb(146 64 14);
  border: 2px solid rgb(250 204 21);
}

.badge-accepted {
  background-color: rgb(219 234 254);
  color: rgb(30 64 175);
  border: 2px solid rgb(59 130 246);
}

.badge-completed {
  background-color: rgb(220 252 231);
  color: rgb(22 101 52);
  border: 2px solid rgb(34 197 94);
}

.badge-cancelled {
  background-color: rgb(254 226 226);
  color: rgb(153 27 27);
  border: 2px solid rgb(239 68 68);
}

/* Animated Variant */
.badge-animated {
  animation: badge-appear 0.3s ease-out;
}

@keyframes badge-appear {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes badge-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 currentColor;
    opacity: 1;
  }
  50% {
    box-shadow: 0 0 0 4px transparent;
    opacity: 0.9;
  }
}

/* Icon Animation */
.status-icon {
  display: inline-block;
  transition: transform 0.2s ease-out;
}

.badge-animated .status-icon {
  animation: icon-bounce 0.5s ease-out;
}

@keyframes icon-bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

/* Hover Effect */
.status-badge:hover {
  transform: scale(1.05);
}
</style>
