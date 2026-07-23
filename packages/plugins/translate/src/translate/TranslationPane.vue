<script setup lang="ts">
import { ref, computed } from 'vue';
import { sanitize, Icons } from '@vinx/sdk';
import { invoke } from '@tauri-apps/api/core';

const props = defineProps<{
  input: string;
  output: string;
  targetLang: 'en' | 'jp' | 'vi';
  highlighterInput: string;
  highlighterOutput: string;
  maxLines: number;
  hoveredLineIndex: number | null;
  folderPath: string;
  excelFiles: string[];       
  selectedFiles: Set<string>; 
  aggregatedSheets: { file: string, name: string }[]; 
  selectedSheets: Set<string>; 
  activeSheets: Set<string>;
  fileSheetCounts: Record<string, number>; 
  sheetRowCounts: Record<string, number>;  
  sheetMetadata: Record<string, { logical: string, physical: string, rowCount: number }>;
  fileSearch: string;
  sheetSearch: string;
  contentSearchMatches: Map<string, string[]>;
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
  (e: 'toggleFile', path: string): void;
  (e: 'toggleSheet', fullKey: string): void;
  (e: 'toggleActiveSheet', fullKey: string): void;
  (e: 'removeSheet', fullKey: string): void;
  (e: 'toggleAllSheets'): void;
  (e: 'update:fileSearch', val: string): void;
  (e: 'update:sheetSearch', val: string): void;
  (e: 'deepSearch', query: string): void;
  (e: 'update:isOnlySelectedSheets', val: boolean): void;
  (e: 'refreshFiles'): void;
  (e: 'refreshTechnical'): void;
  (e: 'clearSheets'): void;
  (e: 'contextAdd', text: string): void;
}>();

// == COLUMN RESIZING LOGIC (HORIZONTAL) =======================================
const colWidths = ref<number[]>([20, 30, 30, 20]); 
const isResizing = ref(false);
const activeResizer = ref<number | null>(null);

const startResizing = (index: number) => {
  isResizing.value = true;
  activeResizer.value = index;
  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', stopGlobalResizing);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

// == SHEET LIST VERTICAL RESIZING LOGIC =======================================
const selectedSheetsHeight = ref(300);
const isResizingV = ref(false);

const startVResizing = () => {
  isResizingV.value = true;
  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', stopGlobalResizing);
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
};

const handleGlobalMouseMove = (e: MouseEvent) => {
  // Horizontal Resizing
  if (isResizing.value && activeResizer.value !== null) {
    const container = document.querySelector('.split-panes-4col');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width;
    const mouseX = e.clientX - rect.left;
    const currentRatioSum = colWidths.value[activeResizer.value] + colWidths.value[activeResizer.value + 1];
    let startOfActivePair = 0;
    for (let i = 0; i < activeResizer.value; i++) {
      startOfActivePair += (colWidths.value[i] / 100) * totalWidth;
    }
    const relativeX = mouseX - startOfActivePair;
    const newLeftWidthPercent = (relativeX / totalWidth) * 100;
    const minWidthPercent = 5;
    if (newLeftWidthPercent > minWidthPercent && (currentRatioSum - newLeftWidthPercent) > minWidthPercent) {
      const newWidths = [...colWidths.value];
      newWidths[activeResizer.value] = newLeftWidthPercent;
      newWidths[activeResizer.value + 1] = currentRatioSum - newLeftWidthPercent;
      colWidths.value = newWidths;
    }
  }
  
  // Vertical Resizing (Sheet List)
  if (isResizingV.value) {
    const pane = document.querySelector('.pane-editor.side-body');
    if (!pane) return;
    const rect = pane.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const minH = 50;
    const maxH = rect.height - 50;
    if (mouseY > minH && mouseY < maxH) {
      selectedSheetsHeight.value = mouseY;
    }
  }
};

const stopGlobalResizing = () => {
  isResizing.value = false;
  isResizingV.value = false;
  activeResizer.value = null;
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', stopGlobalResizing);
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

// == FILTERING LOGIC ========================================================
const filteredFiles = computed(() => {
  if (!props.excelFiles) return [];
  const query = (props.fileSearch || '').trim().toLowerCase();
  if (!query) return props.excelFiles;
  
  return props.excelFiles.filter(f => {
    if (!f) return false;
    const pathLower = f.toLowerCase();
    const nameLower = f.split(/[/\\]/).pop()?.toLowerCase() || '';
    return pathLower.includes(query) || nameLower.includes(query);
  });
});

const filteredSheets = computed(() => {
  if (!props.aggregatedSheets) return [];
  const query = (props.sheetSearch || '').trim().toLowerCase();
  
  const base = props.aggregatedSheets;
  if (!query) return base;

  return base.filter(s => {
    const fullKey = `${s.file}::${s.name}`;
    const isNameMatch = s.name.toLowerCase().includes(query);
    const metadata = props.sheetMetadata[fullKey];
    const isLogicalMatch = metadata?.logical?.toLowerCase().includes(query);
    const isPhysicalMatch = metadata?.physical?.toLowerCase().includes(query);
    const isFileMatch = s.file.toLowerCase().includes(query);
    const isContentMatch = props.contentSearchMatches?.has(fullKey);
    
    return isNameMatch || isLogicalMatch || isPhysicalMatch || isFileMatch || isContentMatch;
  });
});

const groupedSelectedSheets = computed(() => {
  const groups = new Map<string, string[]>();
  // selectedSheets is a Set of "file::sheet"
  Array.from(props.selectedSheets).forEach(fullKey => {
    const file = fullKey.split('::')[0];
    if (!groups.has(file)) groups.set(file, []);
    groups.get(file)!.push(fullKey);
  });
  return groups;
});

// == CONTEXT MENU LOGIC =======================================================
import { onMounted, onUnmounted } from 'vue';
const contextMenu = ref({ show: false, x: 0, y: 0, text: '' });
const sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });

const onContextMenu = (e: MouseEvent) => {
  const selection = window.getSelection()?.toString().trim();
  if (selection) {
    e.preventDefault();
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      text: selection
    };
  }
};

const closeContextMenu = () => {
  contextMenu.value.show = false;
  sheetContextMenu.value.show = false;
};

const handleContextAdd = () => {
  emit('contextAdd', contextMenu.value.text);
  closeContextMenu();
};

const onSheetContextMenu = (e: MouseEvent, fullKey: string) => {
  e.preventDefault();
  const meta = props.sheetMetadata[fullKey];
  sheetContextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    logical: meta?.logical || '',
    physical: meta?.physical || fullKey.split('::').pop() || '',
    fullKey
  };
};

const copyFromSheetContext = (type: 'logical' | 'physical') => {
  const text = type === 'logical' ? sheetContextMenu.value.logical : sheetContextMenu.value.physical;
  if (text) {
    emit('copy', text, new MouseEvent('click', { clientX: sheetContextMenu.value.x, clientY: sheetContextMenu.value.y }));
  }
  closeContextMenu();
};

const openSheetInExcel = async () => {
  if (sheetContextMenu.value?.fullKey) {
    const file = sheetContextMenu.value.fullKey.split('::').slice(0, -1).join('::');
    const sheetName = sheetContextMenu.value.fullKey.split('::').pop();
    try {
      // Call the rust command silently to avoid overwriting the user's clipboard
      await invoke('open_excel_at_sheet', { path: file, sheetName });
    } catch (e) {
      console.error(e);
    }
  }
  closeContextMenu();
};

onMounted(() => document.addEventListener('click', closeContextMenu));
onUnmounted(() => document.removeEventListener('click', closeContextMenu));
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
            <button @click="emit('refreshFiles')" class="icon-btn-ghost" title="Refresh Base Dictionary" v-html="Icons.RefreshCw"></button>
            <button @click="emit('refreshTechnical')" class="icon-btn-ghost icon-btn-tech" title="Rebuild Technical Cache" v-html="Icons.Database"></button>
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

            <div v-if="!folderPath && filteredFiles.length === 0" class="empty-hint">No folder selected</div>
            <div v-else-if="filteredFiles.length === 0" class="empty-hint">No files found</div>
            <div v-for="file in filteredFiles" :key="file"
                 v-memo="[file, selectedFiles.has(file), fileSheetCounts[file]]"
                 class="file-item" :class="{ selected: selectedFiles.has(file) }"
                 @click="emit('toggleFile', file)"
                 :title="file">
              <input type="checkbox" 
                     class="file-checkbox"
                     :checked="selectedFiles.has(file)"
                     @click.stop
                     @change="emit('toggleFile', file)" />
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
          <div class="header-left">
            <span class="pane-label">INPUT SOURCE</span>
            <div class="hl-legend">
              <div class="legend-item" title="Translated from Base Dictionary">
                <span class="legend-dot base"></span>
                <span class="legend-text">BASE</span>
              </div>
              <div class="legend-item" title="Translated from Technical Sheets">
                <span class="legend-dot tech"></span>
                <span class="legend-text">TECH</span>
              </div>
              <div class="legend-item" title="Found in both sources">
                <span class="legend-dot composed"></span>
                <span class="legend-text">BOTH</span>
              </div>
            </div>
          </div>
          <div class="header-right">
            <button @click="emit('format')" class="ghost-btn format-btn">FORMAT</button>
            <button @click="emit('clear')" class="ghost-btn clear-btn">CLEAR ALL</button>
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
                      @contextmenu="onContextMenu"
                      placeholder="Paste text here..."></textarea>
            <div class="highlighter" 
                 v-html="sanitize(highlighterInput)" 
                 ref="inputHighlighter" 
                 @click="emit('highlighterClick', $event)" 
                 @mouseover="emit('highlighterMouseOver', $event)" 
                 @mouseout="emit('highlighterMouseOut')"
                 @contextmenu="onContextMenu">
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
                      @contextmenu="onContextMenu"
                      placeholder="Translation..." 
                      class="clickable-result"></textarea>
            <div class="highlighter" 
                 v-html="sanitize(highlighterOutput)" 
                 ref="resultHighlighter" 
                 @click="emit('highlighterClick', $event)" 
                 @mouseover="emit('highlighterMouseOver', $event)" 
                 @mouseout="emit('highlighterMouseOut')"
                 @contextmenu="onContextMenu">
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
            <label class="only-checkbox" 
                   :class="{ 'disabled-checkbox': activeSheets.size === 0 }"
                   title="Only use selected sheets (Requires at least one active sheet in the list)">
              <input type="checkbox" 
                     :disabled="activeSheets.size === 0"
                     :checked="isOnlySelectedSheets && activeSheets.size > 0"
                     @change="emit('update:isOnlySelectedSheets', ($event.target as HTMLInputElement).checked)" />
              <span>ONLY</span>
            </label>
          </div>
          <div class="header-right">
            <button v-if="selectedSheets.size > 0" 
                    @click="emit('clearSheets')" 
                    class="ghost-btn clear-sheets-btn">
              CLEAR ({{ selectedSheets.size }})
            </button>
          </div>
        </div>
        <div class="pane-editor glass side-body no-flex">
          <div class="sheet-split-container">
            <!-- PART 1: Selected Sheets (Top) -->
            <div class="selected-sheets-zone" :style="{ height: selectedSheetsHeight + 'px' }">
              <div class="zone-label">ENABLED IN TRANSLATOR ({{ selectedSheets.size }})</div>
              <div class="sheet-list-scroll">
                <div v-if="selectedSheets.size === 0" class="empty-hint-small">No sheets enabled</div>
                
                <div v-else v-for="[file, fullKeys] in Array.from(groupedSelectedSheets)" :key="'group-' + file" class="sheet-group-container">
                  <div class="sheet-group-header">
                    <span v-html="Icons.File" class="group-icon"></span>
                    <span class="group-filename">{{ file.split(/[/\\]/).pop() }}</span>
                  </div>
                  <label v-for="fullKey in fullKeys" :key="'sel-' + fullKey" 
                         class="sheet-item compact" :title="sheetMetadata[fullKey]?.physical || fullKey" @contextmenu.prevent="onSheetContextMenu($event, fullKey)">
                    <input type="checkbox" :checked="activeSheets.has(fullKey)" @change="emit('toggleActiveSheet', fullKey)" />
                    <div class="sheet-info-v">
                      <div class="sheet-header-line">
                        <span class="sheet-name-label" :style="{ opacity: activeSheets.has(fullKey) ? 1 : 0.4 }">{{ fullKey.split('::').pop() }}</span>
                        <button class="remove-sheet-btn" @click.prevent.stop="emit('removeSheet', fullKey)" title="Remove from list">
                          <span v-html="Icons.Trash2 || Icons.X || '✕'"></span>
                        </button>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <!-- RESIZER (Vertical) -->
            <div class="v-resizer" @mousedown="startVResizing">
              <div class="resizer-handle"></div>
            </div>

            <!-- PART 2: Aggregated Sheets & Search (Bottom) -->
            <div class="available-sheets-zone">
              <div class="zone-label">{{ selectedFiles.size === 0 ? `ALL SHEETS (${aggregatedSheets.length})` : `SELECTED FILES (${selectedFiles.size})` }}</div>
              <div class="side-search-box" v-if="aggregatedSheets.length > 0">
                <input :value="sheetSearch" 
                       @input="emit('update:sheetSearch', ($event.target as HTMLInputElement).value)" 
                       @keydown.enter="emit('deepSearch', sheetSearch)"
                       placeholder="Filter sheets..." />
                <button class="deep-search-btn" 
                        @click="emit('deepSearch', sheetSearch)"
                        title="Search inside sheet content (Deep Search)">
                  <span v-html="Icons.Search"></span>
                </button>
              </div>
              <div class="sheet-list-scroll full">
                <div v-if="aggregatedSheets.length === 0" class="empty-hint">No sheets available</div>
                <label v-for="s in filteredSheets" :key="'all-' + s.file + '::' + s.name" 
                       v-memo="[s.name, s.file, selectedSheets.has(s.file + '::' + s.name), sheetRowCounts[s.file + '::' + s.name]]"
                       class="sheet-item" :title="sheetMetadata[s.file + '::' + s.name]?.physical || s.name" @contextmenu.prevent="onSheetContextMenu($event, s.file + '::' + s.name)">
                  <input type="checkbox" 
                         :checked="selectedSheets.has(s.file + '::' + s.name)"
                         @change="emit('toggleSheet', s.file + '::' + s.name)" />
                  <div class="sheet-info-v">
                    <div class="sheet-header-line">
                      <span class="sheet-name-label">{{ s.name }}</span>
                      <span class="file-source-tag" v-if="selectedFiles.size !== 1">{{ s.file.split(/[/\\]/).pop() }}</span>
                    </div>
                    <div class="sheet-meta-sub" v-if="sheetMetadata[s.file + '::' + s.name] || contentSearchMatches.has(s.file + '::' + s.name)">
                      <span class="table-logical" v-if="sheetMetadata[s.file + '::' + s.name]?.logical && sheetMetadata[s.file + '::' + s.name].logical !== s.name">
                        {{ sheetMetadata[s.file + '::' + s.name].logical }}
                      </span>
                      <span class="item-stats" v-if="sheetRowCounts[s.file + '::' + s.name]">({{ sheetRowCounts[s.file + '::' + s.name] }} rows)</span>
                    </div>
                    <div class="matched-columns" v-if="contentSearchMatches.has(s.file + '::' + s.name)">
                      <span class="match-tag" v-for="col in contentSearchMatches.get(s.file + '::' + s.name)" :key="col">
                        {{ col }}
                      </span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div v-if="contextMenu.show" 
           class="vinx-context-menu glass" 
           :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
           @click.stop>
        <div class="menu-item" @click="handleContextAdd">
          <span v-html="Icons.Plus"></span> Add to Base Dictionary
        </div>
      </div>

      <div v-if="sheetContextMenu.show" 
           class="vinx-context-menu glass" 
           :style="{ left: sheetContextMenu.x + 'px', top: sheetContextMenu.y + 'px' }"
           @click.stop>
        <div class="menu-item" @click="copyFromSheetContext('physical')" v-if="sheetContextMenu.physical">
          <span v-html="Icons.Copy || '📋'"></span> Copy EN name 
          <span class="context-preview">{{ sheetContextMenu.physical }}</span>
        </div>
        <div class="menu-item" @click="copyFromSheetContext('logical')" v-if="sheetContextMenu.logical">
          <span v-html="Icons.Copy || '📋'"></span> Copy JP name 
          <span class="context-preview">{{ sheetContextMenu.logical }}</span>
        </div>
        <div class="menu-divider" style="height: 1px; background: rgba(128,128,128,0.2); margin: 4px 0;"></div>
        <div class="menu-item" @click="openSheetInExcel">
          <span v-html="Icons.ExternalLink || '↗'"></span> Open Excel Here
        </div>
      </div>
    </Teleport>
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
.pane-group { display: flex; flex-direction: column; gap: 8px; overflow: hidden; padding: 0 4px; height: 100%; }
.pane-header { display: flex; justify-content: space-between; align-items: center; height: 36px; padding: 0 10px; flex-shrink: 0; }
.pane-label-group { display: flex; flex-direction: column; line-height: 1.1; }
.path-description { font-size: 0.55rem; font-weight: 700; opacity: 0.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.header-left { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-right: 12px; }
.pane-label { font-size: 0.6rem; font-weight: 950; opacity: 0.4; letter-spacing: 0.1em; color: var(--text-color); white-space: nowrap; text-transform: uppercase; }
.pane-editor { flex: 1; display: flex; overflow: hidden; border-radius: 12px; border: 1px solid rgba(128,128,128,0.12); position: relative; }
.side-body { background: var(--input-bg); }
.panel-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 4px; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.72rem; color: var(--text-color); transition: all 0.2s; }
.file-item:hover { background: rgba(99,102,241,0.08); transform: translateX(2px); }
.file-item.selected { background: rgba(99,102,241,0.05); color: var(--accent-color); border-left: 2px solid var(--accent-color); }
.file-checkbox { cursor: pointer; accent-color: var(--accent-color); width: 14px; height: 14px; flex-shrink: 0; }
.sheet-header-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
.file-source-tag { 
  font-size: 0.5rem; 
  opacity: 0.7; 
  background: var(--accent-color); 
  color: #fff;
  padding: 1px 6px; 
  border-radius: 4px; 
  font-weight: 800; 
  font-family: 'Inter', sans-serif; 
  white-space: nowrap; 
  max-width: 80px; 
  overflow: hidden; 
  text-overflow: ellipsis;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.file-info-v, .sheet-info-v { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.item-stats { font-size: 0.55rem; opacity: 0.4; font-weight: 500; font-style: italic; }

.sheet-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.72rem; color: var(--text-color); transition: background 0.2s; }
.sheet-item:hover { background: rgba(99,102,241,0.08); }
.sheet-item input { cursor: pointer; accent-color: var(--accent-color); width: 14px; height: 14px; }
.sheet-name-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; font-weight: 750; }
.sheet-meta-sub { display: flex; align-items: center; gap: 6px; }
.table-logical { font-size: 0.55rem; opacity: 0.6; color: var(--accent-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.sheet-count { font-size: 0.65rem; font-weight: 950; color: var(--accent-color); background: rgba(99, 102, 241, 0.1); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(99,102,241,0.2); }
.empty-hint { font-size: 0.7rem; opacity: 0.3; text-align: center; padding: 40px 10px; font-style: italic; }

.icon-btn-ghost { background: transparent; border: 1px solid rgba(128,128,128,0.15); color: var(--text-color); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.icon-btn-ghost:hover { background: rgba(99, 102, 241, 0.05); border-color: var(--accent-color); color: var(--accent-color); transform: translateY(-1px); }\n.icon-btn-tech { border-color: rgba(245, 158, 11, 0.3); color: rgba(245, 158, 11, 0.8); }\n.icon-btn-tech:hover { background: rgba(245, 158, 11, 0.08) !important; border-color: rgb(245, 158, 11) !important; color: rgb(245, 158, 11) !important; }
.file-icon { display: flex; align-items: center; justify-content: center; opacity: 0.5; color: var(--text-color); }
.lang-segmented { display: flex; background: rgba(128, 128, 128, 0.08); padding: 3px; border-radius: 10px; border: 1px solid rgba(128,128,128,0.1); }
.lang-segmented button { padding: 4px 12px; font-size: 0.65rem; border: none; background: transparent; font-weight: 850; border-radius: 8px; cursor: pointer; opacity: 0.4; color: var(--text-color); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.lang-segmented button.active { background: var(--accent-color); color: #fff; opacity: 1; box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
.ghost-btn { background: transparent; border: 1px solid rgba(128,128,128,0.15); color: var(--text-color); padding: 4px 12px; border-radius: 8px; font-weight: 850; font-size: 0.65rem; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); white-space: nowrap; }
.ghost-btn:hover { background: rgba(99, 102, 241, 0.05); border-color: var(--accent-color); color: var(--accent-color); transform: translateY(-1px); }
.clear-sheets-btn { padding: 4px 10px; height: 26px; font-size: 0.6rem; border-color: rgba(239, 68, 68, 0.2); color: #ef4444; opacity: 0.8; font-weight: 900; border-radius: 8px; }
.clear-sheets-btn:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; color: #ef4444; opacity: 1; transform: translateY(-1px); }

.format-btn { border-color: rgba(99, 102, 241, 0.2); color: var(--accent-color); }
.clear-btn { border-color: rgba(239, 68, 68, 0.15); color: #ef4444; opacity: 0.8; }
.clear-btn:hover { background: rgba(239, 68, 68, 0.05); border-color: #ef4444; color: #ef4444; opacity: 1; }

.line-numbers { width: 34px; background: rgba(0,0,0,0.02); padding: 15px 0; overflow: hidden; flex-shrink: 0; }
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
.only-checkbox { display: flex; align-items: center; gap: 4px; font-size: 0.55rem; font-weight: 950; color: var(--accent-color); cursor: pointer; opacity: 0.6; transition: opacity 0.2s; margin-left: 10px; }
.only-checkbox:hover { opacity: 1; }
.only-checkbox input { width: 12px; height: 12px; cursor: pointer; accent-color: var(--accent-color); margin: 0; }
.disabled-checkbox { opacity: 0.3 !important; pointer-events: none; cursor: not-allowed; }

/* SHEET SPLIT STYLES */
.no-flex { display: block !important; }
.sheet-split-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--input-bg); }
.selected-sheets-zone, .available-sheets-zone { display: flex; flex-direction: column; overflow: hidden; min-height: 50px; }
.available-sheets-zone { flex: 1; border-top: 1px solid rgba(128,128,128,0.05); }
.sheet-list-scroll { flex: 1; overflow-y: auto; padding: 4px 10px 10px 10px; display: flex; flex-direction: column; gap: 4px; }
.sheet-list-scroll.full { padding-top: 0; }

/* Visibility Improvements for Scrollbars */
.sheet-list-scroll::-webkit-scrollbar, .panel-body::-webkit-scrollbar {
  width: 6px;
}
.sheet-list-scroll::-webkit-scrollbar-track, .panel-body::-webkit-scrollbar-track {
  background: transparent;
}
.sheet-list-scroll::-webkit-scrollbar-thumb, .panel-body::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.2);
  border-radius: 10px;
}
.sheet-list-scroll::-webkit-scrollbar-thumb:hover, .panel-body::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.4);
}

.zone-label { font-size: 0.55rem; font-weight: 850; opacity: 0.3; padding: 8px 12px 4px 12px; letter-spacing: 0.05em; color: var(--text-color); flex-shrink: 0; }
.empty-hint-small { font-size: 0.65rem; opacity: 0.2; text-align: center; padding: 20px 10px; font-style: italic; }

.v-resizer { 
  height: 8px; 
  cursor: row-resize; 
  background: transparent; 
  position: relative; 
  z-index: 60; 
  margin: -4px 0;
  flex-shrink: 0;
  transition: background 0.2s;
}
.v-resizer:hover, .v-resizer:active { background: rgba(99,102,241,0.2); }
.v-resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 20%;
  right: 20%;
  height: 1px;
  background: rgba(128,128,128,0.1);
  transform: translateY(-50%);
}

.check-all-btn { 
  width: 24px; 
  height: 24px; 
  padding: 0 !important; 
  display: flex !important; 
  align-items: center; 
  justify-content: center;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.05) !important;
  border: 1px solid rgba(99, 102, 241, 0.15) !important;
  color: var(--accent-color) !important;
  transition: all 0.2s;
}
.check-all-btn:hover {
  background: var(--accent-color) !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(99,102,241,0.2);
}
.check-all-btn :deep(svg) { width: 14px; height: 14px; }

.sheet-item.compact { padding: 4px 10px; }
.sheet-item.compact .sheet-name-label { font-size: 0.68rem; opacity: 0.8; transition: opacity 0.2s; }
.remove-sheet-btn { background: transparent; border: none; color: var(--text-color); opacity: 0.2; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px; border-radius: 4px; transition: all 0.2s; }
.remove-sheet-btn:hover { opacity: 1; background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.remove-sheet-btn :deep(svg) { width: 12px; height: 12px; }

/* Group Styles */
.sheet-group-container { 
  margin-bottom: 12px; 
  border: 1px solid rgba(128,128,128,0.08); 
  border-radius: 12px; 
  overflow: hidden; 
  background: rgba(0,0,0,0.015); 
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.sheet-group-header { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  background: rgba(99, 102, 241, 0.04); 
  padding: 6px 12px; 
  border-bottom: 1px solid rgba(128,128,128,0.06); 
  border-left: 3px solid var(--accent-color);
}
.group-icon { width: 14px; height: 14px; opacity: 0.4; display: flex; align-items: center; color: var(--accent-color); }
.group-filename { 
  font-size: 0.65rem; 
  font-weight: 900; 
  color: var(--accent-color); 
  text-transform: uppercase; 
  letter-spacing: 0.08em; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  white-space: nowrap; 
}

.side-search-box { margin: 4px 10px 8px 10px; position: sticky; top: 0; z-index: 10; background: var(--input-bg); border-radius: 8px; border: 1px solid rgba(128,128,128,0.15); padding: 2px 8px; display: flex; align-items: center; }
.side-search-box input { width: 100%; background: transparent; border: none; outline: none; color: var(--text-color); font-size: 0.65rem; font-weight: 700; height: 20px; }
.deep-search-btn { 
  background: transparent; 
  border: none; 
  padding: 0 4px; 
  cursor: pointer; 
  opacity: 0.3; 
  color: var(--text-color); 
  display: flex; 
  align-items: center; 
  transition: all 0.2s;
}
.deep-search-btn:hover { opacity: 1; color: var(--accent-color); transform: scale(1.1); }
.deep-search-btn :deep(svg) { width: 12px; height: 12px; }

.matched-columns { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.match-tag { 
  font-size: 0.55rem; 
  background: rgba(16, 185, 129, 0.1); 
  color: #10b981; 
  padding: 1px 6px; 
  border-radius: 4px; 
  font-weight: 700; 
  border: 1px solid rgba(16, 185, 129, 0.2);
}

/* Highlight Legend */
.hl-legend { display: flex; align-items: center; gap: 10px; margin-left: 12px; background: rgba(128,128,128,0.05); padding: 3px 8px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.1); }
.legend-item { display: flex; align-items: center; gap: 4px; cursor: help; }
.legend-dot { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 4px currentColor; }
.legend-dot.base { background: var(--hl-base-color, #3b82f6); color: var(--hl-base-color, #3b82f6); }
.legend-dot.tech { background: var(--hl-tech-color, #eab308); color: var(--hl-tech-color, #eab308); }
.legend-dot.composed { background: var(--hl-composed-color, #10b981); color: var(--hl-composed-color, #10b981); }
.legend-text { font-size: 0.55rem; font-weight: 900; opacity: 0.7; color: var(--text-color); }

/* Context Menu */
.vinx-context-menu { position: fixed; z-index: 10000; padding: 4px; border-radius: 8px; min-width: 160px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); border: 1px solid var(--glass-border); background: var(--container-bg); }
.menu-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 0.75rem; font-weight: 600; color: var(--text-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.menu-item:hover { background: var(--accent-color); color: #fff; }
.menu-item :deep(svg) { width: 14px; height: 14px; }

.context-preview { opacity: 0.6; font-size: 0.85em; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: inline-block; vertical-align: middle; }
.context-preview { opacity: 0.6; font-size: 0.85em; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: inline-block; vertical-align: middle; }
</style>
