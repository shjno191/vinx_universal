<script setup lang="ts">
import { ref, computed } from 'vue';
import { sanitize } from '../../utils/security';
import { Icons } from '../../utils/icons';

const props = defineProps<{
  input: string;
  output: string;
  targetLang: 'en' | 'jp' | 'vi';
  highlighterInput: string;
  highlighterOutput: string;
  maxLines: number;
  hoveredLineIndex: number | null;
  activeSourcesCount: number;
  folderPath: string;
  excelFiles: string[];       // list of files in column 1
  selectedFile: string;       // currently active file
  sheets: string[];           // list of sheets in column 4
  selectedSheets: Set<string>; // currently checked sheets
  fileSheetCounts: Record<string, number>; // sheet count per file
  sheetRowCounts: Record<string, number>;  // row count per sheet
  sheetMetadata: Record<string, { logical: string, physical: string, colCount: number }>;
  fileSearch: string;
  sheetSearch: string;
  isOnlySelectedSheets: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:input', val: string): void;
  (e: 'update:targetLang', val: 'en' | 'jp' | 'vi'): void;
  (e: 'format'): void;
  (e: 'clear'): void;
  (e: 'copy', text: string, event: MouseEvent): void;
  (e: 'scroll', side: 'input' | 'result'): void;
  (e: 'highlighterClick', event: MouseEvent): void;
  (e: 'highlighterMouseOver', event: MouseEvent): void;
  (e: 'highlighterMouseOut'): void;
  (e: 'mouseMove', event: MouseEvent, target: HTMLTextAreaElement | null): void;
  (e: 'update:hoveredLineIndex', val: number | null): void;
  (e: 'selectFolder'): void;
  (e: 'selectFile', path: string): void;
  (e: 'toggleSheet', name: string): void;
  (e: 'toggleAllSheets'): void;
  (e: 'update:fileSearch', val: string): void;
  (e: 'update:sheetSearch', val: string): void;
  (e: 'update:isOnlySelectedSheets', val: boolean): void;
}>();

// == COLUMN RESIZING LOGIC ====================================================
// Initial ratio 3-4-4-3 (approx: 20%, 30%, 30%, 20%)
const colWidths = ref<number[]>([20, 30, 30, 20]); 
const isResizing = ref(false);
const activeResizer = ref<number | null>(null);

const startResizing = (index: number) => {
  isResizing.value = true;
  activeResizer.value = index;
  document.addEventListener('mousemove', handleDragging);
  document.addEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const handleDragging = (e: MouseEvent) => {
  if (!isResizing.value || activeResizer.value === null) return;
  
  const container = document.querySelector('.split-panes-4col');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  const totalWidth = rect.width;
  const mouseX = e.clientX - rect.left;
  
  // Update the boundary between col[activeResizer] and col[activeResizer+1]
  const currentRatioSum = colWidths.value[activeResizer.value] + colWidths.value[activeResizer.value + 1];
  
  // Calculate relative position within the combined space of the two neighbor columns
  let startOfActivePair = 0;
  for (let i = 0; i < activeResizer.value; i++) {
    startOfActivePair += (colWidths.value[i] / 100) * totalWidth;
  }
  
  const relativeX = mouseX - startOfActivePair;
  const newLeftWidthPercent = (relativeX / totalWidth) * 100;
  const minWidthPercent = 5; // Prevent columns from disappearing
  
  if (newLeftWidthPercent > minWidthPercent && (currentRatioSum - newLeftWidthPercent) > minWidthPercent) {
    const newWidths = [...colWidths.value];
    newWidths[activeResizer.value] = newLeftWidthPercent;
    newWidths[activeResizer.value + 1] = currentRatioSum - newLeftWidthPercent;
    colWidths.value = newWidths;
  }
};

const stopResizing = () => {
  isResizing.value = false;
  activeResizer.value = null;
  document.removeEventListener('mousemove', handleDragging);
  document.removeEventListener('mouseup', stopResizing);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

const gridStyle = computed(() => {
  return {
    display: 'grid',
    gridTemplateColumns: `${colWidths.value[0]}% 6px ${colWidths.value[1]}% 6px ${colWidths.value[2]}% 6px ${colWidths.value[3]}%`
  };
});

// Refs for synchronization
const inputTextarea = ref<HTMLTextAreaElement | null>(null);
const resultTextarea = ref<HTMLTextAreaElement | null>(null);
const inputLineNumbers = ref<HTMLDivElement | null>(null);
const resultLineNumbers = ref<HTMLDivElement | null>(null);
const inputHighlighter = ref<HTMLDivElement | null>(null);
const resultHighlighter = ref<HTMLDivElement | null>(null);

defineExpose({
  inputTextarea,
  resultTextarea,
  inputLineNumbers,
  resultLineNumbers,
  inputHighlighter,
  resultHighlighter
});

const localInput = computed({
  get: () => props.input,
  set: (val) => emit('update:input', val)
});

const handleScroll = (side: 'input' | 'result') => {
  emit('scroll', side);
};
</script>

<template>
  <div class="quick-translate-container">
    <div class="split-panes-4col" :style="gridStyle">
      <!-- COLUMN 1: File List -->
      <div class="pane-group file-panel-group">
        <div class="pane-header">
          <div class="header-left">
            <span class="pane-label">FILES LIST</span>
          </div>
          <div class="header-right">
            <button @click="emit('selectFolder')" class="icon-btn-ghost" title="Select Folder" v-html="Icons.Folder"></button>
          </div>
        </div>
        <div class="pane-editor glass side-body">
          <div class="panel-body">
            <!-- File Filter -->
            <div class="side-search-box" v-if="folderPath || excelFiles.length > 0">
              <input :value="fileSearch" 
                     @input="emit('update:fileSearch', ($event.target as HTMLInputElement).value)" 
                     placeholder="Filter files..." />
            </div>

            <div v-if="!folderPath && excelFiles.length === 0" class="empty-hint">No folder selected</div>
            <div v-else-if="excelFiles.length === 0" class="empty-hint">No files found</div>
            <div v-for="file in excelFiles" :key="file"
                 v-memo="[file, selectedFile === file, fileSheetCounts[file]]"
                 class="file-item" :class="{ active: selectedFile === file }"
                 @click="emit('selectFile', file)"
                 :title="file">
              <span class="file-icon" v-html="Icons.File"></span>
              <div class="file-info-v">
                <span class="file-name-label">{{ file.split(/[/\\]/).pop() }}</span>
                <span class="item-stats" v-if="fileSheetCounts[file]">({{ fileSheetCounts[file] }} sheets)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RESIZER 1 -->
      <div class="col-resizer" @mousedown="startResizing(0)"></div>

      <!-- COLUMN 2: Input Pane -->
      <div class="pane-group">
        <div class="pane-header">
          <span class="pane-label">INPUT SOURCE</span>
          <div class="header-right">
            <button @click="emit('format')" class="ghost-btn format-btn">FORMAT</button>
            <button @click="emit('clear')" class="clear-btn">CLEAR ALL</button>
          </div>
        </div>
        <div class="pane-editor glass">
          <div class="line-numbers" ref="inputLineNumbers">
            <div v-for="n in maxLines" :key="n" 
                 v-memo="[n, hoveredLineIndex === n]"
                 class="line-num" 
                 @mouseover="emit('update:hoveredLineIndex', n)" 
                 @mouseout="emit('update:hoveredLineIndex', null)" 
                 :class="{ 'hl-active': hoveredLineIndex === n }">
              {{ n }}
            </div>
          </div>

          <div class="editor-sub-container" 
               @mousemove="emit('mouseMove', $event, inputTextarea)" 
               @mouseleave="emit('update:hoveredLineIndex', null)">
            <div class="hover-row-overlay" 
                 v-if="hoveredLineIndex !== null" 
                 :style="{ top: 'calc(15px + ' + ((hoveredLineIndex - 1) * 1.36) + 'rem)' }">
            </div>
            <textarea v-model="localInput" 
                      ref="inputTextarea" 
                      @scroll="handleScroll('input')" 
                      placeholder="Paste text here..."></textarea>
            <div class="highlighter" 
                 v-html="sanitize(highlighterInput)" 
                 ref="inputHighlighter" 
                 @click="emit('highlighterClick', $event)" 
                 @mouseover="emit('highlighterMouseOver', $event)" 
                 @mouseout="emit('highlighterMouseOut')">
            </div>
          </div>
        </div>
      </div>

      <!-- RESIZER 2 -->
      <div class="col-resizer" @mousedown="startResizing(1)"></div>

      <!-- COLUMN 3: Result Pane -->
      <div class="pane-group">
        <div class="pane-header">
          <div class="header-left">
            <span class="pane-label">RESULT TO</span>
            <div class="lang-segmented">
              <button @click="emit('update:targetLang', 'en')" :class="{ active: targetLang === 'en' }">EN</button>
              <button @click="emit('update:targetLang', 'jp')" :class="{ active: targetLang === 'jp' }">JP</button>
              <button @click="emit('update:targetLang', 'vi')" :class="{ active: targetLang === 'vi' }">VI</button>
            </div>
          </div>
          <div class="header-right">
            <button @click="emit('copy', props.output, $event)" class="ghost-btn">COPY RESULT</button>
          </div>
        </div>
        <div class="pane-editor glass">
          <div class="line-numbers" ref="resultLineNumbers">
            <div v-for="n in maxLines" :key="n" 
                 v-memo="[n, hoveredLineIndex === n]"
                 class="line-num" 
                 @mouseover="emit('update:hoveredLineIndex', n)" 
                 @mouseout="emit('update:hoveredLineIndex', null)" 
                 :class="{ 'hl-active': hoveredLineIndex === n }">
              {{ n }}
            </div>
          </div>

          <div class="editor-sub-container" 
               @mousemove="emit('mouseMove', $event, resultTextarea)" 
               @mouseleave="emit('update:hoveredLineIndex', null)">
            <div class="hover-row-overlay" 
                 v-if="hoveredLineIndex !== null" 
                 :style="{ top: 'calc(15px + ' + ((hoveredLineIndex - 1) * 1.36) + 'rem)' }">
            </div>
            <textarea :value="output" 
                      readonly 
                      ref="resultTextarea" 
                      @scroll="handleScroll('result')" 
                      placeholder="Translation..." 
                      class="clickable-result"></textarea>
            <div class="highlighter" 
                 v-html="sanitize(highlighterOutput)" 
                 ref="resultHighlighter" 
                 @click="emit('highlighterClick', $event)" 
                 @mouseover="emit('highlighterMouseOver', $event)" 
                 @mouseout="emit('highlighterMouseOut')">
            </div>
          </div>
        </div>
      </div>

      <!-- RESIZER 3 -->
      <div class="col-resizer" @mousedown="startResizing(2)"></div>

      <!-- COLUMN 4: Sheet List -->
      <div class="pane-group sheet-panel-group">
        <div class="pane-header">
          <div class="header-left">
            <span class="pane-label">SHEETS LIST</span>
            <label class="only-checkbox" title="Only use selected sheets (skip base dictionary)">
              <input type="checkbox" 
                     :checked="isOnlySelectedSheets"
                     @change="emit('update:isOnlySelectedSheets', ($event.target as HTMLInputElement).checked)" />
              <span>ONLY</span>
            </label>
          </div>
          <div class="header-right">
            <button v-if="sheets.length > 0" @click="emit('toggleAllSheets')" class="icon-btn-ghost check-all-btn" title="Toggle All" v-html="Icons.CheckAll"></button>
            <span class="sheet-count" v-if="selectedSheets.size > 0">{{ selectedSheets.size }}</span>
          </div>
        </div>
        <div class="pane-editor glass side-body">
          <div class="panel-body">
            <!-- Sheet Filter -->
            <div class="side-search-box" v-if="selectedFile">
              <input :value="sheetSearch" 
                     @input="emit('update:sheetSearch', ($event.target as HTMLInputElement).value)" 
                     placeholder="Filter sheets..." />
            </div>

            <div v-if="!selectedFile" class="empty-hint">Select a file first</div>
            <label v-for="sheet in sheets" :key="sheet" 
                   v-memo="[sheet, selectedSheets.has(sheet), sheetRowCounts[sheet]]"
                   class="sheet-item" :title="sheetMetadata[sheet]?.physical || sheet">
              <input type="checkbox" 
                     :checked="selectedSheets.has(sheet)"
                     @change="emit('toggleSheet', sheet)" />
              <div class="sheet-info-v">
                <span class="sheet-name-label">{{ sheet }}</span>
                <div class="sheet-meta-sub" v-if="sheetMetadata[sheet]">
                  <span class="table-logical" v-if="sheetMetadata[sheet].logical && sheetMetadata[sheet].logical !== sheet">{{ sheetMetadata[sheet].logical }}</span>
                  <span class="item-stats" v-if="sheetRowCounts[sheet]">({{ sheetRowCounts[sheet] }} cols)</span>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-translate-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.split-panes-4col { gap: 0; height: 100%; transition: none; }
.col-resizer { 
  width: 12px; 
  cursor: col-resize; 
  background: transparent; 
  position: relative; 
  margin: 0 -6px; 
  z-index: 50; 
  transition: background 0.2s;
}
.col-resizer:hover, .col-resizer:active { background: rgba(99,102,241,0.2) !important; }
.col-resizer::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 1px;
  height: 40px;
  background: rgba(128,128,128,0.15);
}
.pane-group { display: flex; flex-direction: column; gap: 8px; overflow: hidden; padding: 0 4px; }
.pane-header { display: flex; justify-content: space-between; align-items: center; height: 36px; padding: 0 4px; flex-shrink: 0; }
.pane-label-group { display: flex; flex-direction: column; line-height: 1.1; }
.path-description { font-size: 0.55rem; font-weight: 700; opacity: 0.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.header-left { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.pane-label { font-size: 0.6rem; font-weight: 950; opacity: 0.4; letter-spacing: 0.1em; color: var(--text-color); white-space: nowrap; text-transform: uppercase; }
.pane-editor { flex: 1; display: flex; overflow: hidden; border-radius: 12px; border: 1px solid rgba(128,128,128,0.12); position: relative; }
.side-body { background: var(--input-bg); }
.panel-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 4px; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.72rem; color: var(--text-color); transition: all 0.2s; }
.file-item:hover { background: rgba(99,102,241,0.08); transform: translateX(2px); }
.file-item.active { background: rgba(99,102,241,0.12); color: var(--accent-color); font-weight: 800; border-left: 3px solid var(--accent-color); }
.file-info-v, .sheet-info-v { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.item-stats { font-size: 0.55rem; opacity: 0.4; font-weight: 500; font-style: italic; }

.side-search-box { margin-bottom: 8px; position: sticky; top: 0; z-index: 10; background: var(--input-bg); border-radius: 8px; border: 1px solid rgba(128,128,128,0.15); padding: 4px 8px; display: flex; align-items: center; }
.side-search-box input { width: 100%; background: transparent; border: none; outline: none; color: var(--text-color); font-size: 0.65rem; font-weight: 700; height: 24px; }
.side-search-box input::placeholder { opacity: 0.4; font-weight: 500; }

.sheet-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.72rem; color: var(--text-color); transition: background 0.2s; }
.sheet-item:hover { background: rgba(99,102,241,0.08); }
.sheet-item input { cursor: pointer; accent-color: var(--accent-color); width: 14px; height: 14px; }
.sheet-name-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; font-weight: 750; }
.sheet-meta-sub { display: flex; align-items: center; gap: 6px; }
.table-logical { font-size: 0.55rem; opacity: 0.6; color: var(--accent-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.sheet-count { font-size: 0.65rem; font-weight: 950; color: var(--accent-color); background: rgba(99,102,241,0.1); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(99,102,241,0.2); }
.check-all-btn { font-size: 0.55rem !important; padding: 3px 8px !important; border-color: rgba(99,102,241,0.3) !important; color: var(--accent-color) !important; }
.empty-hint { font-size: 0.7rem; opacity: 0.3; text-align: center; padding: 40px 10px; font-style: italic; }

.icon-btn-ghost { background: transparent; border: 1px solid rgba(128,128,128,0.15); color: var(--text-color); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: 0.2s; }
.icon-btn-ghost:hover { background: var(--button-hover); border-color: var(--accent-color); color: var(--accent-color); }
.file-icon { display: flex; align-items: center; justify-content: center; opacity: 0.5; color: var(--text-color); }
.lang-segmented { display: flex; background: rgba(128, 128, 128, 0.08); padding: 3px; border-radius: 10px; }
.lang-segmented button { padding: 4px 12px; font-size: 0.65rem; border: none; background: transparent; font-weight: 950; border-radius: 8px; cursor: pointer; opacity: 0.4; color: var(--text-color); transition: all 0.2s; }
.lang-segmented button.active { background: var(--accent-color); color: #fff; opacity: 1; box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
.pane-editor { flex: 1; display: flex; overflow: hidden; border-radius: 12px; border: 1px solid rgba(128,128,128,0.12); }
.line-numbers { width: 34px; background: rgba(0,0,0,0.02); padding: 15px 0; overflow: hidden; }
.line-num { font-size: 0.85rem; line-height: 1.6; text-align: center; opacity: 0.2; font-family: 'Consolas', monospace; color: var(--text-color); }
.line-num.hl-active { opacity: 1; color: var(--accent-color); }
.editor-sub-container { position: relative; flex: 1; display: flex; overflow: hidden; }
.highlighter {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  padding: 15px; box-sizing: border-box;
  font-family: 'Consolas', monospace; font-size: 0.85rem; line-height: 1.6;
  white-space: pre; overflow: hidden; word-break: normal;
  color: transparent; pointer-events: none; z-index: 2;
}
.hover-row-overlay {
  position: absolute;
  left: 0;
  width: 100%;
  height: 1.36rem;
  background: rgba(99, 102, 241, 0.08);
  pointer-events: none;
  z-index: 0;
  border-top: 1px solid rgba(99, 102, 241, 0.15);
  border-bottom: 1px solid rgba(99, 102, 241, 0.15);
  box-sizing: border-box;
}
textarea {
  flex: 1; background: transparent; border: none; padding: 15px;
  color: var(--text-color); font-family: 'Consolas', monospace; font-size: 0.85rem; line-height: 1.6;
  resize: none; outline: none; position: relative; z-index: 1;
  white-space: pre; overflow: auto; word-break: normal;
}
.clickable-result { transition: background 0.2s; }
.clickable-result:hover { background: rgba(99, 102, 241, 0.01); }
.glass { background: var(--input-bg); }
.active-source-indicator { display: flex; align-items: center; gap: 6px; background: rgba(99, 102, 241, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.15); margin-right: 10px; }
.indicator-label { font-size: 0.6rem; font-weight: 800; opacity: 0.5; color: var(--text-color); }
.indicator-value { font-size: 0.65rem; font-weight: 950; color: var(--accent-color); }
.only-checkbox { display: flex; align-items: center; gap: 4px; font-size: 0.55rem; font-weight: 950; color: var(--accent-color); cursor: pointer; opacity: 0.6; transition: opacity 0.2s; margin-left: 6px; background: rgba(99, 102, 241, 0.08); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.15); }
.only-checkbox:hover { opacity: 1; background: rgba(99, 102, 241, 0.12); }
.only-checkbox input { width: 12px; height: 12px; cursor: pointer; accent-color: var(--accent-color); margin: 0; }
</style>
