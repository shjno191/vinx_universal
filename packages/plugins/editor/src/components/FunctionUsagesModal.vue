<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { 
  type FunctionUsageItem, 
  getFunctionUsagesModalAction, 
  cycleUsageIndex 
} from '@vinx/sdk';

const props = defineProps<{
  visible: boolean;
  functionName: string;
  usages: FunctionUsageItem[];
  selectedIndex: number;
  theme?: string;
}>();

const emit = defineEmits<{
  (e: 'select', item: FunctionUsageItem, index: number): void;
  (e: 'confirm', item: FunctionUsageItem): void;
  (e: 'close'): void;
}>();

const listContainerRef = ref<HTMLElement | null>(null);
const modalContainerRef = ref<HTMLElement | null>(null);

const scrollActiveItemIntoView = () => {
  nextTick(() => {
    const container = listContainerRef.value;
    if (!container) return;
    const activeEl = container.querySelector('.usage-item.active') as HTMLElement;
    if (!activeEl) return;
    const elRect = activeEl.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    if (elRect.top < cRect.top) {
      container.scrollTop -= (cRect.top - elRect.top);
    } else if (elRect.bottom > cRect.bottom) {
      container.scrollTop += (elRect.bottom - cRect.bottom);
    }
  });
};

watch(() => props.selectedIndex, () => {
  scrollActiveItemIntoView();
});

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      modalContainerRef.value?.focus();
      scrollActiveItemIntoView();
    });
  }
});

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.visible || props.usages.length === 0) return;

  const result = getFunctionUsagesModalAction(e);
  if (result.preventDefault) e.preventDefault();
  if (result.stopPropagation) e.stopPropagation();

  if (result.action === 'next') {
    const nextIdx = cycleUsageIndex(props.selectedIndex, props.usages.length, 'next');
    emit('select', props.usages[nextIdx], nextIdx);
  } else if (result.action === 'prev') {
    const prevIdx = cycleUsageIndex(props.selectedIndex, props.usages.length, 'prev');
    emit('select', props.usages[prevIdx], prevIdx);
  } else if (result.action === 'confirm') {
    const chosen = props.usages[props.selectedIndex] || props.usages[0];
    if (chosen) emit('confirm', chosen);
  } else if (result.action === 'close') {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, true);
  if (props.visible) {
    nextTick(() => {
      modalContainerRef.value?.focus();
      scrollActiveItemIntoView();
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true);
});

const handleItemClick = (item: FunctionUsageItem, idx: number) => {
  emit('select', item, idx);
  emit('confirm', item);
};
</script>

<template>
  <div
    v-if="visible"
    class="usages-modal-backdrop"
    @mousedown.self="emit('close')"
    @click.self="emit('close')"
    :class="{ win95: theme === '95' }"
  >
    <div
      ref="modalContainerRef"
      class="usages-modal-container"
      tabindex="-1"
    >
      <header class="usages-header">
        <div class="header-left">
          <span class="usages-title">Usages of <strong class="fn-highlight">{{ functionName }}</strong></span>
          <span class="usages-count-badge">{{ usages.length }}</span>
        </div>
        <div class="header-right">
          <div class="header-hint">
            <span>&uarr;&darr; / Ctrl+&uarr;&darr; Preview</span>
            <span class="dot">&bull;</span>
            <span>Enter Choose</span>
            <span class="dot">&bull;</span>
            <span>Esc Close</span>
          </div>
          <button
            class="close-btn"
            type="button"
            @click.stop="emit('close')"
            title="Close (Esc)"
          >
            &times;
          </button>
        </div>
      </header>

      <div class="usages-list" ref="listContainerRef">
        <div
          v-for="(item, idx) in usages"
          :key="`${item.line}:${item.column}`"
          class="usage-item"
          :class="{ active: idx === selectedIndex }"
          @click="handleItemClick(item, idx)"
          @dblclick="handleItemClick(item, idx)"
        >
          <span class="line-badge">Line {{ item.line }}</span>
          <span class="preview-text" :title="item.preview">{{ item.preview }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usages-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 60px;
  z-index: 10050;
}

.usages-modal-container {
  width: 580px;
  max-width: 90vw;
  max-height: 400px;
  background: var(--container-bg);
  border: 1px solid var(--accent-color);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideDown 0.15s ease-out;
  outline: none;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.usages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.15);
  border-bottom: var(--border-style);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.usages-title {
  font-size: 0.8rem;
  color: var(--text-color);
}

.fn-highlight {
  color: var(--accent-color);
}

.usages-count-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--accent-color);
  color: white;
}

.header-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.65rem;
  opacity: 0.55;
  color: var(--text-color);
}

.header-hint .dot {
  opacity: 0.4;
}

.usages-list {
  flex: 1;
  overflow-y: auto;
  max-height: 330px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.usage-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
  border-left: 3px solid transparent;
}

.usage-item:hover {
  background: rgba(128, 128, 128, 0.1);
}

.usage-item.active {
  background: rgba(99, 102, 241, 0.18);
  border-left-color: var(--accent-color);
}

.line-badge {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--accent-color);
  font-family: monospace;
  background: rgba(128, 128, 128, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.preview-text {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  opacity: 0.85;
}

.usage-item.active .preview-text {
  opacity: 1;
  font-weight: 600;
}

/* Win95 Theme */
.win95 .usages-modal-container {
  border: 2px outset #fff;
  border-radius: 0;
  background: #c0c0c0;
  box-shadow: none;
}
.win95 .usages-header {
  background: #000080;
  color: #fff;
  border-bottom: 2px inset #fff;
}
.win95 .usages-title,
.win95 .header-hint {
  color: #fff;
}
.win95 .fn-highlight {
  color: #ffff00;
}
.win95 .usage-item.active {
  background: #000080;
  color: #fff;
  border-left-color: #ffff00;
}
.win95 .usage-item.active .line-badge,
.win95 .usage-item.active .preview-text {
  color: #fff;
}
.win95 .close-btn {
  background: #c0c0c0;
  border: 2px outset #fff;
  color: #000;
  font-weight: bold;
  font-size: 0.85rem;
  padding: 0 4px;
}
.win95 .close-btn:active {
  border: 2px inset #fff;
}
</style>
