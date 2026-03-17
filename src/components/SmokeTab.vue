<script setup lang="ts">
import { ref } from 'vue';
import Cigarette from './Cigarette.vue';
import { smokedCount, isGlobalSmoking } from '../store';

const cigRef = ref<any>(null);
</script>

<template>
  <div 
    class="smoke-tab-container" 
    @mousedown="isGlobalSmoking = true" 
    @mouseup="isGlobalSmoking = false" 
    @mouseleave="isGlobalSmoking = false"
  >
    <div class="header">
      <div class="instruction">
        Click and hold to inhale...<br/>
        <span class="shortcut-hint">Smoking: <code>Space</code> (Hold) | Flick Ash: <code>Ctrl + Space</code></span>
      </div>
      <div class="counter-badge" v-if="smokedCount > 0">
        Smoked: {{ smokedCount }}
      </div>
    </div>
    
    <div class="smoking-scene">
      <Cigarette ref="cigRef" :force-smoking="isGlobalSmoking" />
    </div>

    <!-- Relaxing vibe overlay -->
    <div class="vibe-overlay" :class="{ active: isGlobalSmoking }"></div>
  </div>
</template>

<style scoped>
.smoke-tab-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #0a0a0c;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  user-select: none;
}

.header {
  position: absolute;
  top: 10%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  pointer-events: none;
}

.instruction {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.8rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-weight: 300;
  text-align: center;
  line-height: 1.8;
}

.shortcut-hint {
  font-size: 0.65rem;
  opacity: 0.5;
  text-transform: none;
  letter-spacing: 0.5px;
}

.counter-badge {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
  font-family: 'Consolas', monospace;
  animation: fadeIn 1s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.smoking-scene {
  position: relative;
  width: 400px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vibe-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, transparent 20%, rgba(255, 87, 34, 0.05) 50%, rgba(0,0,0,0.6) 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.5s ease;
}

.vibe-overlay.active {
  opacity: 1;
}
</style>
