<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <div 
      class="border-4 border-gray-200 border-t-[--color-coffee-brown] rounded-full animate-spin"
      :style="{ width: size, height: size }"
    ></div>
    <span v-if="text" class="ml-3 text-gray-600">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: string;
  text?: string;
  containerClass?: string;
}>(), {
  size: '32px',
  containerClass: 'py-8'
});
</script>
