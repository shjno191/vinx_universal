<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { sharedInput, sharedOutput } from '../store';

// States for the editors
const sideCodeText = ref(sharedInput.value);
const sideExcelText = ref(sharedOutput.value);

// Sync local states with store if needed (or just use local for comparison)
watch(sharedInput, (val) => sideCodeText.value = val);
watch(sharedOutput, (val) => sideExcelText.value = val);

const compInputLineNumbers = ref<HTMLDivElement | null>(null);
const compExcelLineNumbers = ref<HTMLDivElement | null>(null);
const diffCodeLineNumbers = ref<HTMLDivElement | null>(null);
const diffExcelLineNumbers = ref<HTMLDivElement | null>(null);

const compInputTextarea = ref<HTMLTextAreaElement | null>(null);
const compExcelTextarea = ref<HTMLTextAreaElement | null>(null);
const diffCodeArea = ref<HTMLDivElement | null>(null);
const diffExcelArea = ref<HTMLDivElement | null>(null);

const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });

// Data items for the UI
const missingCount = ref(0);
const extraCount = ref(0);
const duplicateCount = ref(0);

// Result lists for analysis sidebar
const missingItems = ref<string[]>([]);
const extraItems = ref<string[]>([]);
const duplicateItems = ref<string[]>([]);

// Diff results structure
interface DiffLine {
  text: string;
  type: 'normal' | 'added' | 'removed';
  num?: number;
}
const diffCodeLines = ref<DiffLine[]>([]);
const diffExcelLines = ref<DiffLine[]>([]);

const inputLines = computed(() => {
  const lines = sideCodeText.value.split('\n').length;
  return lines > 0 ? lines : 1;
});

const excelLines = computed(() => {
  const lines = sideExcelText.value.split('\n').length;
  return lines > 0 ? lines : 1;
});

const syncScrollEditors = (side: 'code' | 'excel') => {
  if (side === 'code' && compInputTextarea.value && compInputLineNumbers.value) {
    compInputLineNumbers.value.scrollTop = compInputTextarea.value.scrollTop;
  } else if (side === 'excel' && compExcelTextarea.value && compExcelLineNumbers.value) {
    compExcelLineNumbers.value.scrollTop = compExcelTextarea.value.scrollTop;
  }
};

const syncScrollDiff = (side: 'code' | 'excel') => {
  if (side === 'code' && diffCodeArea.value && diffCodeLineNumbers.value && diffExcelArea.value) {
    diffCodeLineNumbers.value.scrollTop = diffCodeArea.value.scrollTop;
    diffExcelArea.value.scrollTop = diffCodeArea.value.scrollTop;
  } else if (side === 'excel' && diffExcelArea.value && diffExcelLineNumbers.value && diffCodeArea.value) {
    diffExcelLineNumbers.value.scrollTop = diffExcelArea.value.scrollTop;
    diffCodeArea.value.scrollTop = diffExcelArea.value.scrollTop;
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

const handleRunCompare = () => {
  // Logic will be implemented later
  console.log('Running compare...');
};

const swapInputs = () => {
  const temp = sideCodeText.value;
  sideCodeText.value = sideExcelText.value;
  sideExcelText.value = temp;
};

const clearInputs = () => {
  sideCodeText.value = '';
  sideExcelText.value = '';
};

onMounted(async () => {
  await nextTick();
});
</script>

<template>
  <div class="compare-container">
    <!-- Top Editors Section -->
    <div class="top-editors">
      <div class="editor-pane-group">
        <div class="pane-header">
          <span class="pane-label">SIDE CODE</span>
          <span class="line-counter">{{ sideCodeText ? inputLines : 0 }} lines</span>
        </div>
        <div class="pane-editor glass">
          <div class="line-numbers" ref="compInputLineNumbers">
            <div v-for="n in inputLines" :key="n" class="line-num">{{ n }}</div>
          </div>
          <textarea v-model="sideCodeText" ref="compInputTextarea" @scroll="syncScrollEditors('code')" placeholder="Paste original code here..." spellcheck="false"></textarea>
        </div>
      </div>

      <div class="editor-pane-group">
        <div class="pane-header">
          <span class="pane-label">SIDE EXCEL</span>
          <span class="line-counter">{{ sideExcelText ? excelLines : 0 }} lines</span>
        </div>
        <div class="pane-editor glass">
          <div class="line-numbers" ref="compExcelLineNumbers">
            <div v-for="n in excelLines" :key="n" class="line-num">{{ n }}</div>
          </div>
          <textarea v-model="sideExcelText" ref="compExcelTextarea" @scroll="syncScrollEditors('excel')" placeholder="Paste excel content here..." spellcheck="false"></textarea>
        </div>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="action-bar glass">
      <div class="left-actions">
        <button class="run-btn" @click="handleRunCompare">
          <span class="icon">?</span> RUN COMPARE
        </button>
      </div>
      
      <div class="status-badges">
        <div class="badge badge-missing">
          MISSING SIDE CODE: <span>{{ missingCount }}</span>
        </div>
        <div class="badge badge-extra">
          EXTRA SIDE EXCEL: <span>{{ extraCount }}</span>
        </div>
        <div class="badge badge-dup">
          DUP A: 0 | B: {{ duplicateCount }}
        </div>
      </div>

      <div class="right-actions">
        <button class="tool-btn" @click="swapInputs">
          <span class="icon">?</span> SWAP
        </button>
        <button class="tool-btn" @click="clearInputs">
          <span class="icon">??</span> CLEAR
        </button>
        <button class="tool-btn highlight">
          <span class="icon">?</span> QUICK TRANSLATE
        </button>
      </div>
    </div>

    <!-- Main Diff Section -->
    <div class="main-diff-area">
      <div class="diff-view-container glass">
        <div class="diff-header">
          <div class="diff-header-side">
            <span>SIDE CODE</span>
            <button class="copy-all-btn" @click="copyToClipboard(sideCodeText, $event)">COPY ALL</button>
          </div>
          <div class="diff-header-side">
            <span>SIDE EXCEL</span>
            <button class="copy-all-btn" @click="copyToClipboard(sideExcelText, $event)">COPY ALL</button>
          </div>
        </div>
        
        <div class="diff-body">
          <!-- Diff Code Side -->
          <div class="diff-pane" ref="diffCodeArea" @scroll="syncScrollDiff('code')">
             <div class="diff-line-numbers" ref="diffCodeLineNumbers">
                <div v-for="line in diffCodeLines" :key="line.num" class="line-num">{{ line.num }}</div>
             </div>
             <div class="diff-content">
                <div v-for="(line, idx) in diffCodeLines" :key="idx" class="diff-row" :class="line.type">
                  <span class="marker"></span>
                  <span class="text">{{ line.text }}</span>
                </div>
                <div v-if="diffCodeLines.length === 0" class="empty-state">No comparison data</div>
             </div>
          </div>
          
          <!-- Diff Excel Side -->
          <div class="diff-pane" ref="diffExcelArea" @scroll="syncScrollDiff('excel')">
              <div class="diff-line-numbers" ref="diffExcelLineNumbers">
                <div v-for="line in diffExcelLines" :key="line.num" class="line-num">{{ line.num }}</div>
             </div>
             <div class="diff-content">
                <div v-for="(line, idx) in diffExcelLines" :key="idx" class="diff-row" :class="line.type">
                  <span class="marker"></span>
                  <span class="text">{{ line.text }}</span>
                </div>
                <div v-if="diffExcelLines.length === 0" class="empty-state">No comparison data</div>
             </div>
          </div>
        </div>
      </div>

      <!-- Analysis Sidebar -->
      <div class="analysis-sidebar">
        <div class="analysis-group glass">
          <div class="analysis-header missing">
            MISSING IN SIDE EXCEL
            <span class="count">{{ missingCount }}</span>
          </div>
          <div class="analysis-items">
            <div v-for="(item, idx) in missingItems" :key="idx" class="item">{{ item }}</div>
            <div v-if="missingItems.length === 0" class="empty-item">None</div>
          </div>
        </div>

        <div class="analysis-group glass">
          <div class="analysis-header extra">
            EXTRA IN SIDE EXCEL
            <span class="count">{{ extraCount }}</span>
          </div>
          <div class="analysis-items">
            <div v-for="(item, idx) in extraItems" :key="idx" class="item">{{ item }}</div>
            <div v-if="extraItems.length === 0" class="empty-item">None</div>
          </div>
        </div>

        <div class="analysis-group glass">
          <div class="analysis-header dup">
            DUPLICATES
            <span class="count">{{ duplicateCount }}</span>
          </div>
          <div class="analysis-items">
            <div v-for="(item, idx) in duplicateItems" :key="idx" class="item">{{ item }}</div>
            <div v-if="duplicateItems.length === 0" class="empty-item">None</div>
          </div>
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
.compare-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 15px;
  background: var(--container-bg);
  gap: 12px;
  box-sizing: border-box;
  overflow: hidden;
}

/* Top Editors */
.top-editors {
  display: flex;
  gap: 15px;
  height: 25%;
  min-height: 150px;
}

.editor-pane-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 5px;
}

.pane-label {
  font-size: 0.65rem;
  font-weight: 800;
  opacity: 0.5;
  letter-spacing: 0.05em;
  color: var(--text-color);
}

.line-counter {
  font-size: 0.6rem;
  opacity: 0.3;
  font-family: monospace;
}

.pane-editor {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--input-bg);
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.12);
  position: relative;
}

.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.1);
}

.line-numbers {
  width: 32px;
  background: rgba(0, 0, 0, 0.05);
  border-right: 1px solid rgba(128, 128, 128, 0.08);
  padding: 10px 0;
  overflow: hidden;
  user-select: none;
}

.line-num {
  font-size: 0.65rem;
  line-height: 1.5;
  text-align: center;
  color: var(--text-color);
  opacity: 0.25;
  font-family: 'Consolas', monospace;
}

textarea {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px;
  color: var(--text-color);
  font-family: 'Consolas', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  resize: none;
  outline: none;
  white-space: pre;
  overflow-x: auto;
}

/* Action Bar */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 15px;
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.15);
}

.run-btn {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}

.run-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.status-badges {
  display: flex;
  gap: 12px;
}

.badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(128, 128, 128, 0.1);
  border: 1px solid rgba(128, 128, 128, 0.1);
}

.badge span {
  font-weight: 900;
  margin-left: 2px;
}

.badge-missing { color: #f87171; border-color: rgba(248, 113, 113, 0.2); background: rgba(248, 113, 113, 0.05); }
.badge-extra { color: #4ade80; border-color: rgba(74, 222, 128, 0.2); background: rgba(74, 222, 128, 0.05); }
.badge-dup { color: #fbbf24; border-color: rgba(251, 191, 36, 0.2); background: rgba(251, 191, 36, 0.05); }

.right-actions {
  display: flex;
  gap: 8px;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.2);
  color: var(--text-color);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.tool-btn:hover { background: rgba(255, 255, 255, 0.1); }
.tool-btn.highlight { border-color: rgba(99, 102, 241, 0.4); color: #818cf8; }

/* Main Diff Area */
.main-diff-area {
  flex: 1;
  display: flex;
  gap: 15px;
  overflow: hidden;
}

.diff-view-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.1);
  overflow: hidden;
}

.diff-header {
  display: flex;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(128, 128, 128, 0.08);
}

.diff-header-side {
  flex: 1;
  padding: 8px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.65rem;
  font-weight: 700;
  opacity: 0.6;
}

.copy-all-btn {
  background: transparent;
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #6366f1;
  font-size: 0.6rem;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.diff-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.diff-pane {
  flex: 1;
  overflow: auto;
  display: flex;
  position: relative;
}

.diff-line-numbers {
  width: 32px;
  padding: 10px 0;
  background: rgba(0, 0, 0, 0.02);
  border-right: 1px solid rgba(128, 128, 128, 0.05);
  user-select: none;
}

.diff-content {
  flex: 1;
  padding: 10px 0;
}

.diff-row {
  display: flex;
  align-items: center;
  padding: 0 10px;
  min-height: 24px;
  font-family: 'Consolas', monospace;
  font-size: 0.8rem;
  white-space: pre;
}

.diff-row .marker { width: 4px; height: 100%; margin-right: 10px; border-radius: 2px; }

.diff-row.removed { background: rgba(239, 68, 68, 0.05); }
.diff-row.removed .marker { background: #ef4444; }
.diff-row.added { background: rgba(34, 197, 94, 0.05); }
.diff-row.added .marker { background: #22c55e; }

/* Sidebar */
.analysis-sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.analysis-group {
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.1);
  padding: 12px;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 900;
  margin-bottom: 10px;
}

.analysis-header .count {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.65rem;
  color: white;
}

.analysis-header.missing { color: #f87171; }
.analysis-header.missing .count { background: #ef4444; }
.analysis-header.extra { color: #4ade80; }
.analysis-header.extra .count { background: #22c55e; }
.analysis-header.dup { color: #fbbf24; }
.analysis-header.dup .count { background: #f97316; }

.analysis-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analysis-items .item {
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 0.65rem;
  font-family: monospace;
  word-break: break-all;
  border: 1px solid rgba(128, 128, 128, 0.08);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.75rem;
  opacity: 0.3;
  font-style: italic;
}

.empty-item {
  padding: 10px;
  font-size: 0.65rem;
  opacity: 0.2;
  text-align: center;
  border: 1px dashed rgba(128, 128, 128, 0.2);
  border-radius: 6px;
}

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

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.2); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.3); }

</style>

