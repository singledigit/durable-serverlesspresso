<template>
  <div class="coffee-animation">
    <!-- Animated Coffee Cup -->
    <div class="coffee-cup-animated">
      <div class="cup-body">
        <div class="coffee-liquid" :style="{ height: fillLevel + '%' }"></div>
        <div class="coffee-foam"></div>
      </div>
      <div class="cup-handle"></div>
      <div class="steam-container">
        <div class="steam steam-1"></div>
        <div class="steam steam-2"></div>
        <div class="steam steam-3"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

// ========== Props ==========
const props = withDefaults(
  defineProps<{
    fillLevel?: number;
    animated?: boolean;
  }>(),
  {
    fillLevel: 70,
    animated: true
  }
);

// ========== State ==========
const currentFillLevel = ref(0);
let animationInterval: number | null = null;

// ========== Methods ==========
function startAnimation(): void {
  if (!props.animated) {
    currentFillLevel.value = props.fillLevel;
    return;
  }

  // Animate fill level from 0 to target
  const targetLevel = props.fillLevel;
  const duration = 2000; // 2 seconds
  const steps = 60;
  const increment = targetLevel / steps;
  const intervalTime = duration / steps;

  let currentStep = 0;

  animationInterval = window.setInterval(() => {
    if (currentStep < steps) {
      currentFillLevel.value = Math.min(currentStep * increment, targetLevel);
      currentStep++;
    } else {
      if (animationInterval !== null) {
        clearInterval(animationInterval);
        animationInterval = null;
      }
    }
  }, intervalTime);
}

function stopAnimation(): void {
  if (animationInterval !== null) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
}

// ========== Lifecycle ==========
onMounted(() => {
  startAnimation();
});

onUnmounted(() => {
  stopAnimation();
});
</script>

<style scoped>
.coffee-animation {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.coffee-cup-animated {
  position: relative;
  width: 80px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cup-body {
  position: relative;
  width: 60px;
  height: 80px;
  background: linear-gradient(to bottom, #ffffff 0%, #f5f5f5 100%);
  border: 3px solid var(--color-coffee-brown);
  border-radius: 0 0 15px 15px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.coffee-liquid {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to bottom, var(--color-coffee-latte) 0%, var(--color-coffee-brown) 100%);
  transition: height 0.3s ease-out;
  border-radius: 0 0 12px 12px;
}

.coffee-foam {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 15px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%);
  border-radius: 50% 50% 0 0;
  animation: foam-bubble 2s ease-in-out infinite;
}

@keyframes foam-bubble {
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.1);
  }
}

.cup-handle {
  position: absolute;
  right: -15px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 30px;
  border: 3px solid var(--color-coffee-brown);
  border-left: none;
  border-radius: 0 50% 50% 0;
}

.steam-container {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 30px;
}

.steam {
  position: absolute;
  width: 4px;
  height: 25px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  animation: steam-rise 2s ease-in-out infinite;
}

.steam-1 {
  left: 8px;
  animation-delay: 0s;
}

.steam-2 {
  left: 18px;
  animation-delay: 0.5s;
}

.steam-3 {
  left: 28px;
  animation-delay: 1s;
}

@keyframes steam-rise {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    transform: translateY(-20px) scale(1.5);
    opacity: 0;
  }
}
</style>
