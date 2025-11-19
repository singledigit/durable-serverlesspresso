<template>
  <div class="animate-pulse">
    <div v-if="type === 'card'" class="card">
      <div class="h-4 bg-gray-300 rounded w-3/4 mb-3"></div>
      <div class="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div class="h-3 bg-gray-200 rounded w-2/3"></div>
    </div>
    
    <div v-else-if="type === 'order'" class="card">
      <div class="flex justify-between items-start mb-3">
        <div class="flex-1">
          <div class="h-5 bg-gray-300 rounded w-32 mb-2"></div>
          <div class="h-3 bg-gray-200 rounded w-24"></div>
        </div>
        <div class="h-6 bg-gray-300 rounded-full w-20"></div>
      </div>
      <div class="h-3 bg-gray-200 rounded w-full mb-2"></div>
      <div class="h-3 bg-gray-200 rounded w-3/4"></div>
    </div>
    
    <div v-else-if="type === 'text'" :class="textClass">
      <div class="h-4 bg-gray-300 rounded" :style="{ width }"></div>
    </div>
    
    <div v-else-if="type === 'circle'" :class="circleClass">
      <div class="bg-gray-300 rounded-full" :style="{ width: size, height: size }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type?: 'card' | 'order' | 'text' | 'circle';
  width?: string;
  size?: string;
  textClass?: string;
  circleClass?: string;
}>();
</script>
