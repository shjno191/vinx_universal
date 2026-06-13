<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Icons } from '@vinx/sdk';

interface SlotConfig {
  title: string;
  color: string;
}

const images = ref<(string | null)>([null, null, null, null]);
const selectedIndices = ref<number[]>([]);
const overlayMode = ref(false);
const opacity = ref(0.5);
const isVertical = ref(true); // Default is vertical now
const zoomLevel = ref(1);
const activeSlot = ref<number>(0); // Tracks which slot will receive the next paste
const lockedBaseIndex = ref<number | null>(null); // Explicit locked Base slot

const showSettings = ref(false);
const slotConfigs = ref<SlotConfig[]>([
  { title: 'Base', color: '#ef4444' },     // Red
  { title: 'IE', color: '#7dd3fc' },       // Light Blue
  { title: 'Chrome', color: '#78350f' },   // Brown
  { title: 'Edge', color: '#2563eb' }      // Blue
]);

const pane1Ref = ref<HTMLElement | null>(null);
const pane2Ref = ref<HTMLElement | null>(null);

const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) {
        const url = URL.createObjectURL(blob);
        
        let targetIdx = activeSlot.value;
        // If the targeted active slot is full, and there is an empty slot somewhere, pick the empty one first.
        // Otherwise, it will overwrite the active slot.
        if (images.value[targetIdx] !== null) {
          const emptyIdx = images.value.findIndex(img => img === null);
          if (emptyIdx !== -1) {
            targetIdx = emptyIdx;
          }
        }

        if (images.value[targetIdx] !== null) {
          URL.revokeObjectURL(images.value[targetIdx]!);
        }

        images.value[targetIdx] = url;
        
        // Auto-select logic based on lockedBaseIndex
        if (lockedBaseIndex.value !== null) {
          if (targetIdx !== lockedBaseIndex.value && selectedIndices.value.length < 2) {
            selectedIndices.value[1] = targetIdx;
          }
        } else {
          if (!selectedIndices.value.includes(targetIdx) && selectedIndices.value.length < 2) {
            selectedIndices.value.push(targetIdx);
          }
        }

        // Move active slot to next
        activeSlot.value = (targetIdx + 1) % 4;
      }
    }
  }
};

// --- Synchronized Scrolling ---
const isSyncing1 = ref(false);
const isSyncing2 = ref(false);

const onScroll1 = () => {
  if (overlayMode.value) return;
  if (!isSyncing1.value) {
    isSyncing2.value = true;
    if (pane2Ref.value && pane1Ref.value) {
      pane2Ref.value.scrollTop = pane1Ref.value.scrollTop;
      pane2Ref.value.scrollLeft = pane1Ref.value.scrollLeft;
    }
  }
  isSyncing1.value = false;
};

const onScroll2 = () => {
  if (overlayMode.value) return;
  if (!isSyncing2.value) {
    isSyncing1.value = true;
    if (pane1Ref.value && pane2Ref.value) {
      pane1Ref.value.scrollTop = pane2Ref.value.scrollTop;
      pane1Ref.value.scrollLeft = pane2Ref.value.scrollLeft;
    }
  }
  isSyncing2.value = false;
};
// -----------------------------

// --- Mouse Panning Logic ---
const isDragging = ref(false);
const startPos = ref({ x: 0, y: 0 });
const scrollPos = ref({ left: 0, top: 0 });
const activePane = ref<HTMLElement | null>(null);

const startPan = (e: MouseEvent, pane: HTMLElement | null) => {
  if (!pane) return;
  isDragging.value = true;
  activePane.value = pane;
  startPos.value = { x: e.clientX, y: e.clientY };
  scrollPos.value = { left: pane.scrollLeft, top: pane.scrollTop };
  pane.style.cursor = 'grabbing';
};

const pan = (e: MouseEvent) => {
  if (!isDragging.value || !activePane.value) return;
  e.preventDefault();
  const dx = e.clientX - startPos.value.x;
  const dy = e.clientY - startPos.value.y;
  
  // Directly set scroll on the active pane. The @scroll listener will handle synchronization.
  activePane.value.scrollLeft = scrollPos.value.left - dx;
  activePane.value.scrollTop = scrollPos.value.top - dy;
};

const endPan = () => {
  if (activePane.value) {
    activePane.value.style.cursor = 'grab';
  }
  isDragging.value = false;
  activePane.value = null;
};

const handleWheel = (e: WheelEvent) => {
  if (e.deltaY < 0) {
    zoomIn();
  } else if (e.deltaY > 0) {
    zoomOut();
  }
};
// ---------------------------

onMounted(() => {
  window.addEventListener('paste', handlePaste);
  window.addEventListener('mousemove', pan);
  window.addEventListener('mouseup', endPan);
});

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste);
  window.removeEventListener('mousemove', pan);
  window.removeEventListener('mouseup', endPan);
  images.value.forEach(url => { if(url) URL.revokeObjectURL(url) });
});

// --- Slot Selection & Base Locking ---
const setBase = (idx: number) => {
  if (lockedBaseIndex.value === idx) {
    lockedBaseIndex.value = null; // Unbase
  } else {
    lockedBaseIndex.value = idx;
    const currentCompare = selectedIndices.value[1] !== undefined ? selectedIndices.value[1] : undefined;
    selectedIndices.value = [idx];
    if (currentCompare !== undefined && currentCompare !== idx) {
       selectedIndices.value.push(currentCompare);
    }
  }
};

const handleSlotClick = (index: number) => {
  activeSlot.value = index;
  if (images.value[index]) {
    if (lockedBaseIndex.value !== null) {
      if (index === lockedBaseIndex.value) return; // Base is locked, do nothing on click
      
      if (selectedIndices.value[1] === index) {
        selectedIndices.value.splice(1, 1); // Deselect compare
      } else {
        selectedIndices.value[1] = index; // Select compare
      }
    } else {
      const selIndex = selectedIndices.value.indexOf(index);
      if (selIndex !== -1) {
        selectedIndices.value.splice(selIndex, 1);
      } else {
        if (selectedIndices.value.length >= 2) {
          selectedIndices.value.shift();
        }
        selectedIndices.value.push(index);
      }
    }
  }
};

const clearImages = async () => {
  const confirmed = await window.confirm("Bạn có chắc chắn muốn xóa tất cả ảnh không?");
  if (!confirmed) return;
  images.value.forEach(url => { if(url) URL.revokeObjectURL(url) });
  images.value = [null, null, null, null];
  selectedIndices.value = [];
  zoomLevel.value = 1;
  overlayMode.value = false;
  activeSlot.value = 0;
  lockedBaseIndex.value = null;
};

const removeImage = (index: number) => {
  if (images.value[index]) {
    URL.revokeObjectURL(images.value[index]!);
    images.value[index] = null;
    selectedIndices.value = selectedIndices.value.filter(i => i !== index);
    if (lockedBaseIndex.value === index) lockedBaseIndex.value = null;
    activeSlot.value = index;
  }
};

const swapBaseCompare = () => {
  if (selectedIndices.value.length === 2) {
    selectedIndices.value = [selectedIndices.value[1], selectedIndices.value[0]];
    // If we swap, we should probably reset lock so user isn't confused, or lock the new Base.
    if (lockedBaseIndex.value !== null) {
      lockedBaseIndex.value = selectedIndices.value[0];
    }
  }
};

// --- Drag & Drop ---
const onDragStart = (e: DragEvent, idx: number) => {
  e.dataTransfer?.setData('text/plain', idx.toString());
};

const onDrop = (e: DragEvent, targetIdx: number) => {
  const sourceIdxStr = e.dataTransfer?.getData('text/plain');
  if (!sourceIdxStr) return;
  const sourceIdx = parseInt(sourceIdxStr);
  if (sourceIdx >= 0 && sourceIdx < 4 && images.value[sourceIdx]) {
    if (lockedBaseIndex.value !== null && targetIdx === 0) {
       // If dropping on Base but Base is locked, either update the lock or ignore.
       // It makes sense to update the lock to the dropped image.
       lockedBaseIndex.value = sourceIdx;
    }

    const newIndices = [...selectedIndices.value];
    if (newIndices.length === 0) {
      newIndices[0] = sourceIdx;
    } else {
      newIndices[targetIdx] = sourceIdx;
      if (newIndices[0] === undefined) newIndices[0] = newIndices[1];
    }
    selectedIndices.value = newIndices;
  }
};
// -------------------

const img1 = computed(() => selectedIndices.value.length > 0 ? images.value[selectedIndices.value[0]] : null);
const img2 = computed(() => selectedIndices.value.length > 1 ? images.value[selectedIndices.value[1]] : null);

const zoomIn = () => zoomLevel.value = Math.min(zoomLevel.value + 0.25, 5);
const zoomOut = () => zoomLevel.value = Math.max(zoomLevel.value - 0.25, 0.25);
const resetZoom = () => zoomLevel.value = 1;

const hasAnyImage = computed(() => images.value.some(img => img !== null));
</script>

<template>
  <div class="image-compare-container" :class="{ 'layout-vertical': isVertical }">
    <!-- Main Left Content -->
    <div class="main-content">
      <!-- Large Images -->
      <div class="large-panes" @wheel.prevent="handleWheel">
        <!-- Hide Pane 1 completely if overlay is active to maximize Pane 2 space -->
        <div class="pane pane-1 glass" v-show="!overlayMode" 
             ref="pane1Ref" 
             @mousedown="startPan($event, pane1Ref)"
             @scroll="onScroll1"
             @dragover.prevent
             @drop="onDrop($event, 0)"
        >
          <div class="pane-label" v-if="!overlayMode">BASE</div>
          <div class="zoom-container" :style="{ width: zoomLevel * 100 + '%', height: zoomLevel * 100 + '%' }">
            <div v-if="!img1" class="empty-state">Drop or Select Base Image</div>
            <img v-else :src="img1" class="preview-img" draggable="false" />
          </div>
        </div>
        <div class="pane pane-2 glass" 
             ref="pane2Ref" 
             @mousedown="startPan($event, pane2Ref)"
             @scroll="onScroll2"
             @dragover.prevent
             @drop="onDrop($event, 1)"
        >
          <div class="pane-label" v-if="!overlayMode">COMPARE</div>
          <div class="pane-label" v-else>OVERLAY</div>
          <div class="zoom-container" :style="{ width: zoomLevel * 100 + '%', height: zoomLevel * 100 + '%' }">
            <div v-if="!img2" class="empty-state">Drop or Select Compare Image</div>
            <template v-else>
              <img v-if="overlayMode && img1" :src="img1" class="overlay-img base-img" draggable="false" />
              <img :src="img2" class="preview-img" :class="{ 'overlay-img top-img': overlayMode }" :style="overlayMode ? { opacity: opacity } : {}" draggable="false" />
            </template>
          </div>
        </div>
      </div>


    </div>

    <!-- Right Sidebar -->
    <div class="sidebar glass">
      <!-- Small Images (Always on the right sidebar) -->
      <div class="small-slots vertical-slots">
        <div 
          v-for="idx in [0, 1, 2, 3]" 
          :key="'v-'+idx"
          class="slot glass"
          :class="{ 
            'has-image': images[idx],
            'selected': selectedIndices.includes(idx) && (lockedBaseIndex !== idx || selectedIndices[0] === idx),
            'active-slot': activeSlot === idx
          }"
          @click="handleSlotClick(idx)"
          draggable="true"
          @dragstart="images[idx] && onDragStart($event, idx)"
        >
          <div class="slot-label" :style="{ backgroundColor: slotConfigs[idx].color }">
            {{ slotConfigs[idx].title }}
          </div>
          
          <template v-if="images[idx]">
            <img :src="images[idx]" class="slot-img" draggable="false" />
            <div class="slot-overlay">
              <span class="sel-badge base-badge" v-if="selectedIndices[0] === idx">Base</span>
              <span class="sel-badge compare-badge" v-if="selectedIndices[1] === idx && selectedIndices[0] !== idx">Compare</span>
              
              <button v-if="lockedBaseIndex === null || lockedBaseIndex === idx" class="set-base-btn" @click.stop="setBase(idx)" :class="{ 'is-locked': lockedBaseIndex === idx }">
                {{ lockedBaseIndex === idx ? 'UNBASE' : 'SET BASE' }}
              </button>

              <button class="remove-btn" @click.stop="removeImage(idx)">×</button>
            </div>
          </template>
          <template v-else>
            <div class="empty-slot-text">Slot {{ idx + 1 }}</div>
          </template>
        </div>
      </div>

      <!-- Options Panel -->
      <div class="options-panel">
        <div class="hint" v-if="!hasAnyImage">Paste images<br/>(Ctrl+V)</div>
        
        <div class="option-group">
          <button class="compact-btn" @click="showSettings = true" title="Settings">
            <span class="btn-icon" v-html="Icons.Settings"></span> Settings
          </button>
          <button class="compact-btn" @click="isVertical = !isVertical" title="Toggle Layout">
            <span class="btn-icon" v-html="isVertical ? Icons.Columns : Icons.Rows"></span> 
            {{ isVertical ? 'Horizontal' : 'Vertical' }}
          </button>
          <button class="compact-btn" @click="swapBaseCompare" v-if="selectedIndices.length === 2 && lockedBaseIndex === null" title="Swap Base & Compare">
            <span class="btn-icon" v-html="Icons.RefreshCw"></span> Swap Base
          </button>
          <button class="compact-btn danger" @click="clearImages" v-if="hasAnyImage" title="Clear All">
            <span class="btn-icon" v-html="Icons.Trash2"></span> Clear All
          </button>
        </div>

        <div class="option-group overlay-controls" v-if="selectedIndices.length === 2">
          <label class="toggle-label">
            <input type="checkbox" v-model="overlayMode" />
            Overlay Mode
          </label>
          <input 
            v-if="overlayMode" 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            v-model.number="opacity" 
            class="opacity-slider"
            title="Adjust Opacity"
          />
        </div>

        <div class="option-group zoom-controls" v-if="selectedIndices.length > 0">
          <div class="zoom-header">Zoom ({{ Math.round(zoomLevel * 100) }}%)</div>
          <div class="zoom-buttons">
            <button class="compact-btn icon-only" @click="zoomOut" :disabled="zoomLevel <= 0.25">
              <span class="btn-icon" v-html="Icons.Minus"></span>
            </button>
            <button class="compact-btn icon-only" @click="resetZoom">
              <span class="btn-icon" v-html="Icons.RefreshCw"></span>
            </button>
            <button class="compact-btn icon-only" @click="zoomIn" :disabled="zoomLevel >= 5">
              <span class="btn-icon" v-html="Icons.Plus"></span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Settings Modal -->
  <div v-if="showSettings" class="modal-overlay">
    <div class="modal-content glass">
      <h3>Slot Configuration</h3>
      <div class="settings-list">
        <div class="setting-row" v-for="(cfg, idx) in slotConfigs" :key="'cfg-'+idx">
          <span class="setting-idx">Slot {{ idx + 1 }}:</span>
          <input type="color" v-model="cfg.color" class="color-picker" />
          <input type="text" v-model="cfg.title" class="title-input" placeholder="Title" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="compact-btn" @click="showSettings = false">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-compare-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  gap: 12px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.large-panes {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

.layout-vertical .large-panes {
  flex-direction: column;
}

.pane {
  flex: 1;
  border-radius: 12px;
  overflow: auto; /* Allow scrolling for zoomed images */
  position: relative;
  background: rgba(0,0,0,0.2);
  cursor: grab;
}

.pane::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.pane::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.pane-label {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  z-index: 20;
  pointer-events: none;
}

.zoom-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100%;
  min-height: 100%;
  position: relative;
  transition: width 0.2s, height 0.2s;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.overlay-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.empty-state {
  color: var(--text-color);
  opacity: 0.5;
  font-weight: bold;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  text-align: center;
}

.sidebar {
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  border-radius: 12px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.options-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: auto;
}

.hint {
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.7;
  text-align: center;
  padding: 8px;
  background: rgba(0,0,0,0.05);
  border-radius: 8px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zoom-header {
  font-size: 0.8rem;
  color: var(--text-color);
  text-align: center;
  opacity: 0.8;
  font-weight: bold;
}

.zoom-buttons {
  display: flex;
  gap: 4px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text-color);
}

.opacity-slider {
  width: 100%;
}

.compact-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  box-sizing: border-box;
  background: rgba(0,0,0,0.05);
  font-size: 0.85rem;
  font-weight: bold;
  border-radius: 8px;
  border: 1px solid rgba(128,128,128,0.2);
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s;
}

.compact-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
}

.compact-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.compact-btn.icon-only {
  padding: 6px;
  justify-content: center;
  flex: 1;
}

.compact-btn.danger {
  color: #ef4444;
}

.compact-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.horizontal-slots {
  height: 130px;
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.vertical-slots {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.slot {
  flex: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 2px dashed rgba(128, 128, 128, 0.3);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 0;
}

.slot.active-slot::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border: 3px solid rgba(255, 255, 255, 0.6);
  pointer-events: none;
  z-index: 20;
}

.slot.has-image {
  border-style: solid;
  border-color: transparent;
}

.slot.selected {
  border: 3px solid var(--accent-color, #3b82f6);
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
  transform: scale(1.02);
  z-index: 2;
}

.slot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-slot-text {
  color: var(--text-color);
  opacity: 0.3;
  font-size: 0.8rem;
}

.slot-label {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  font-size: 0.75rem;
  font-weight: bold;
  text-align: center;
  color: #fff;
  padding: 4px 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  pointer-events: none;
  z-index: 5;
}

.slot-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.4);
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
}

.slot:hover .slot-overlay,
.slot-overlay:has(.set-base-btn.is-locked) {
  opacity: 1;
}

.set-base-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid white;
  color: white;
  font-weight: bold;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 20;
  font-size: 0.8rem;
}

.set-base-btn:hover {
  background: white;
  color: black;
}

.set-base-btn.is-locked {
  background: #ef4444; /* Red color to indicate locked */
  border-color: #ef4444;
}

.sel-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  color: white;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.75rem;
  z-index: 15;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.base-badge {
  background: #ef4444;
}

.compare-badge {
  background: #3b82f6;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255,0,0,0.8);
  color: white;
  border: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  z-index: 15;
}

.remove-btn:hover {
  background: red;
}

.glass {
  background: var(--glass-bg, rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
}

/* Modal Styles */
.modal-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal-content {
  padding: 24px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 320px;
  background: var(--glass-bg);
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  border: 1px solid var(--glass-border);
}

.modal-content h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-color);
  text-align: center;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-idx {
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.8;
  width: 48px;
}

.color-picker {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.title-input {
  flex: 1;
  padding: 6px 12px;
  background: rgba(0,0,0,0.1);
  border: 1px solid rgba(128,128,128,0.3);
  color: var(--text-color);
  border-radius: 6px;
  font-size: 0.85rem;
}

.title-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
