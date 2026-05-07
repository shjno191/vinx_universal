<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { chillSettings, triggerFlick, smokedCount, activeTab } from '@vinx/sdk';


const props = defineProps({
  isWidget: {
    type: Boolean,
    default: false
  },
  forceSmoking: {
    type: Boolean,
    default: false
  }
});

const isSmoking = ref(false);
const burnProgress = ref(0); // 0 to 100
const ashPixels = ref(0);
const smokeParticles = ref<{ id: number; x: number; y: number; delay: number; scale: number; blur: number; opacity: number }[]>([]);
const isFlicking = ref(false);

let particleId = 0;
let burnInterval: any = null;
const isWindowFocused = ref(true);


const TOTAL_BODY_WIDTH = 180;
const FILTER_WIDTH = 60;

const currentBodyWidth = computed(() => {
  const base = TOTAL_BODY_WIDTH * (1 - burnProgress.value / 100);
  return Math.max(0, base);
});

const createSmoke = (isHeavy = false) => {
  // Chance to skip if not heavy to reduce "h?i nhi?u"
  if (!isHeavy && Math.random() < 0.7) return;
  
  const count = isHeavy ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const id = particleId++;
    smokeParticles.value.push({
      id,
      x: Math.random() * 6 - 3,
      y: Math.random() * 6 - 3,
      delay: Math.random() * 0.5,
      scale: (isHeavy ? 1.2 : 0.6) + Math.random() * 1.5,
      blur: 0, // No blur
      opacity: 0.4 + (Math.random() * 0.3)
    });
  }
  
  if (smokeParticles.value.length > 25) {
    smokeParticles.value.splice(0, smokeParticles.value.length - 25);
  }
};

const updateBurn = () => {
  // If window is not focused, or we are not in Chill tab and widget is not enabled, pause logic to save CPU
  const isCigVisible = props.isWidget ? chillSettings.value.enableWidget : (activeTab.value === 'Chill');
  if (!isWindowFocused.value || !isCigVisible) {
    // Clear particles if hidden long enough
    if (smokeParticles.value.length > 0 && Math.random() < 0.1) smokeParticles.value = [];
    return;
  }

  createSmoke(isSmoking.value);

  
  const burnTime = chillSettings.value.burnTimeMinutes || 5;
  const baseIncrement = 100 / (burnTime * 60 * 5); // 5 ticks per sec
  const smokingMultiplier = 15;
  
  const increment = isSmoking.value ? (baseIncrement * smokingMultiplier) : baseIncrement;
  
  if (burnProgress.value < 100) {
    burnProgress.value += increment;
    // Ash grows based on burn progress
    // Let's say 1% burn = 1.2px ash
    ashPixels.value += (increment * 1.2);
  } else {
    smokedCount.value++;
    burnProgress.value = 0;
    ashPixels.value = 0;
  }
};

const startSmoking = () => {
  isSmoking.value = true;
};

const stopSmoking = () => {
  if (!props.forceSmoking) {
    isSmoking.value = false;
  }
};

const flickAsh = () => {
  if (ashPixels.value < 5) return;
  
  isFlicking.value = true;
  setTimeout(() => {
    ashPixels.value = 0;
    isFlicking.value = false;
  }, 300);
};

watch(triggerFlick, () => {
  flickAsh();
});

watch(() => props.forceSmoking, (val) => {
  isSmoking.value = val;
});

const handleBlur = () => { isWindowFocused.value = false; };
const handleFocus = () => { isWindowFocused.value = true; };

onMounted(() => {
  burnInterval = setInterval(updateBurn, 200);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
});

onUnmounted(() => {
  if (burnInterval) clearInterval(burnInterval);
  window.removeEventListener('blur', handleBlur);
  window.removeEventListener('focus', handleFocus);
});


defineExpose({ flickAsh });
</script>

<template>
  <div 
    class="cigarette-container" 
    :class="{ 'is-widget': isWidget, 'smoking': isSmoking }"
    @mousedown="startSmoking" 
    @mouseup="stopSmoking" 
    @mouseleave="stopSmoking"
  >
    <div class="cigarette-wrapper" :class="{ 'flick-shake': isFlicking }">
      <!-- Static Filter -->
      <div class="filter"></div>
      
      <!-- Shortening Body -->
      <div class="body" :style="{ width: currentBodyWidth + 'px' }">
        <div class="lines"></div>
      </div>
      
      <!-- Consumed space (visual reference for 'burnt' part) -->
      <div class="consumed-track" :style="{ width: (TOTAL_BODY_WIDTH - currentBodyWidth) + 'px' }"></div>

      <!-- Burning Tip & Smoke & Ash (Anchored to the end of body) -->
      <div class="tip-anchor" :style="{ left: (FILTER_WIDTH + currentBodyWidth) + 'px' }">
        
        <!-- Smoke container relative to tip -->
        <div class="smoke-container">
          <div 
            v-for="p in smokeParticles" 
            :key="p.id" 
            class="smoke-particle"
            :style="{ 
              left: p.x + 'px', 
              bottom: p.y + 'px',
              animationDelay: p.delay + 's',
              transform: `scale(${p.scale})`,
              opacity: p.opacity
            }"
          ></div>
        </div>

        <!-- The actual glowing tip -->
        <div class="burning-tip" :class="{ active: isSmoking }">
          <div class="glow"></div>
          <div class="ember"></div>
        </div>

        <!-- Ash segment that grows -->
        <div class="ash-segment" :class="{ 'flicking': isFlicking }" :style="{ width: ashPixels + 'px' }">
          <div class="ash-texture"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cigarette-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
}

.is-widget {
  transform: scale(0.6);
  transform-origin: bottom right;
}

.cigarette-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  height: 24px;
}

.filter {
  width: 60px;
  height: 24px;
  background: #e6a23c;
  border-radius: 2px 0 0 2px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
  z-index: 5;
}

.body {
  height: 24px;
  background: #fdfdfd;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.3);
  position: relative;
  overflow: hidden;
  transition: width 0.2s linear;
}

.consumed-track {
  height: 24px;
  background: transparent;
  pointer-events: none;
}

.lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: linear-gradient(90deg, transparent 95%, rgba(0,0,0,0.03) 95%);
  background-size: 8px 100%;
}

.tip-anchor {
  position: absolute;
  top: 0;
  height: 24px;
  display: flex;
  align-items: center;
  transition: left 0.2s linear;
}

.burning-tip {
  width: 6px;
  height: 24px;
  background: #333;
  position: relative;
  z-index: 10;
}

.ember {
  position: absolute;
  right: 0;
  top: 1px;
  bottom: 1px;
  width: 6px;
  background: #ff3300;
  box-shadow: 0 0 10px #ff3d00, 0 0 20px #ff6d00;
  border-radius: 0 2px 2px 0;
}

.glow {
  position: absolute;
  right: -15px;
  top: -15px;
  width: 44px;
  height: 44px;
  background: radial-gradient(circle, rgba(255, 63, 0, 0.6) 0%, transparent 70%);
  opacity: 0.3;
  transition: opacity 0.3s;
  pointer-events: none;
}

.active .ember {
  animation: flicker 0.3s infinite alternate;
  background: #ffae00;
  box-shadow: 0 0 15px #ffae00, 0 0 30px #ff3300;
}

.active .glow {
  opacity: 0.8;
  transform: scale(1.3);
}

.ash-segment {
  height: 20px;
  background: #999;
  position: relative;
  border-radius: 0 4px 4px 0;
  box-shadow: 2px 0 5px rgba(0,0,0,0.2);
  transition: width 0.2s linear;
  margin-left: -2px;
}

.ash-texture {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 20% 30%, #ccc 0%, transparent 20%),
    radial-gradient(circle at 70% 60%, #888 0%, transparent 30%),
    radial-gradient(circle at 40% 80%, #aaa 0%, transparent 25%);
  filter: contrast(1.2);
  border-radius: inherit;
}

.flicking {
  animation: flick-away 0.3s ease-in forwards;
}

@keyframes flick-away {
  0% { transform: translateY(0) rotate(0); opacity: 1; }
  100% { transform: translateY(100px) rotate(45deg); opacity: 0; }
}

/* Smoke Particles */
.smoke-container {
  position: absolute;
  bottom: 20px;
  left: 3px;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.smoke-particle {
  position: absolute;
  bottom: 0;
  width: 15px; /* Smaller circles */
  height: 15px;
  background: rgba(200, 200, 200, 0.6);
  border-radius: 50%;
  animation: rise 5s ease-out forwards;
}

@keyframes rise {
  0% {
    transform: translateY(0) scale(0.5);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateY(-250px) scale(4) translateX(40px);
    opacity: 0;
  }
}

@keyframes flicker {
  from { opacity: 0.7; transform: scale(1); }
  to { opacity: 1; transform: scale(1.1); }
}

.flick-shake {
  animation: shake-body 0.2s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake-body {
  10%, 90% { transform: translate3d(-1px, 0.5px, 0); }
  20%, 80% { transform: translate3d(2px, -0.5px, 0); }
  30%, 50%, 70% { transform: translate3d(-2px, 1px, 0); }
  40%, 60% { transform: translate3d(2px, -1px, 0); }
}

.smoking .cigarette-wrapper {
  transform: translateY(-2px);
  transition: transform 0.2s;
}
</style>
