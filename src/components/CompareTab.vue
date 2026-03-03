<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { sharedInput, sharedOutput } from '../store';

const compInputLineNumbers = ref<HTMLDivElement | null>(null);
const compResultLineNumbers = ref<HTMLDivElement | null>(null);
const compInputTextarea = ref<HTMLTextAreaElement | null>(null);
const compResultTextarea = ref<HTMLTextAreaElement | null>(null);

const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });

const inputLines = computed(() => {
  const lines = sharedInput.value.split('\n').length;
  return lines > 0 ? lines : 1;
});

const outputLines = computed(() => {
  const lines = sharedOutput.value.split('\n').length;
  return lines > 0 ? lines : 1;
});

const syncScroll = (side: 'input' | 'result') => {
  if (side === 'input' && compInputTextarea.value && compInputLineNumbers.value) {
    compInputLineNumbers.value.scrollTop = compInputTextarea.value.scrollTop;
    if (compResultTextarea.value) compResultTextarea.value.scrollTop = compInputTextarea.value.scrollTop;
  } else if (side === 'result' && compResultTextarea.value && compResultLineNumbers.value) {
    compResultLineNumbers.value.scrollTop = compResultTextarea.value.scrollTop;
    if (compInputTextarea.value) compInputTextarea.value.scrollTop = compResultTextarea.value.scrollTop;
  }
};

const copyToClipboard = async (text: string, event: MouseEvent) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyPos.value = { x: event.clientX, y: event.clientY };
    showCopyToast.value = true;
    setTimeout(() => { showCopyToast.value = false; }, 1200);
  } catch (e) {
    console.error('Copy failed:', e);
  }
};

onMounted(async () => {
  await nextTick();
  syncScroll('input');
});

watch(sharedInput, async () => {
  await nextTick();
  syncScroll('input');
});

watch(sharedOutput, async () => {
  await nextTick();
  syncScroll('result');
});
</script>

<template>
  <div class="compare-container">
    <div class="split-panes">
      <div class="pane-group">
        <div class="pane-header"><span class="pane-label">ORIGINAL SOURCE</span></div>
        <div class="pane-editor glass">
          <div class="line-numbers" ref="compInputLineNumbers">
            <div v-for="n in inputLines" :key="n" class="line-num">{{ n }}</div>
          </div>
          <textarea v-model="sharedInput" ref="compInputTextarea" @scroll="syncScroll('input')" placeholder="Source text..." spellcheck="false"></textarea>
        </div>
      </div>
      <div class="pane-group">
        <div class="pane-header"><span class="pane-label">TRANSLATED RESULT</span></div>
        <div class="pane-editor glass-result">
          <div class="line-numbers" ref="compResultLineNumbers">
            <div v-for="n in outputLines" :key="n" class="line-num">{{ n }}</div>
          </div>
          <textarea v-model="sharedOutput" ref="compResultTextarea" @scroll="syncScroll('result')" placeholder="Translation result..." spellcheck="false"></textarea>
        </div>
      </div>
    </div>

    <!-- Copy Bubble -->
    <transition name="bubble">
      <div v-if="showCopyToast" class="copy-bubble" :style="{ left: copyPos.x + 'px', top: (copyPos.y - 30) + 'px' }">
        Copied!
      </div>
    </transition>
  </div>
</template>

<style scoped>
.compare-container { flex: 1; display: flex; flex-direction: column; height: 100%; padding: 10px 15px; background: var(--container-bg); gap: 15px; box-sizing: border-box; }
.split-panes { display: flex; gap: 20px; height: 100%; }
.pane-group { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pane-header { display: flex; align-items: center; height: 32px; padding: 0 5px; }
.pane-label { font-size: 0.6rem; font-weight: 950; opacity: 0.45; letter-spacing: 0.08em; }
.pane-editor { flex: 1; display: flex; overflow: hidden; background: var(--input-bg); border-radius: 12px; border: 1px solid rgba(128,128,128,0.12); }
.glass-result { background: rgba(99, 102, 241, 0.02); border: 1px solid rgba(99, 102, 241, 0.15); }
.line-numbers { width: 36px; background: rgba(0, 0, 0, 0.02); border-right: 1px solid rgba(128, 128, 128, 0.08); padding: 15px 0; overflow: hidden; user-select: none; }
.line-num { font-size: 0.7rem; line-height: 1.6; text-align: center; color: var(--text-color); opacity: 0.2; font-family: 'Consolas', monospace; }
textarea { flex: 1; background: transparent; border: none; padding: 15px; color: var(--text-color); font-family: 'Consolas', monospace; font-size: 0.85rem; line-height: 1.6; resize: none; outline: none; white-space: pre; overflow-x: auto; }
.clickable-area { cursor: pointer; transition: background 0.2s; }
.clickable-area:hover { background: rgba(99, 102, 241, 0.02); }
.clickable-area:active { background: rgba(99, 102, 241, 0.05); }

/* Bubble styles */
.copy-bubble {
  position: fixed;
  background: #10b981;
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 900;
  box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
  z-index: 3000;
  pointer-events: none;
  transform: translateX(-50%);
}
.bubble-enter-active, .bubble-leave-active { transition: all 0.2s ease; }
.bubble-enter-from { opacity: 0; transform: translate(-50%, 10px) scale(0.8); }
.bubble-leave-to { opacity: 0; transform: translate(-50%, -10px) scale(0.8); }
</style>
