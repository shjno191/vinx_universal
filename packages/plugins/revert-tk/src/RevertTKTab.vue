<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { Icons, useClipboard, theme as globalTheme, revertTKSettings } from '@vinx/sdk';
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor';
import * as monaco from 'monaco-editor';
import { invoke } from '@tauri-apps/api/core';
import * as XLSX from 'xlsx';

loader.config({ monaco });

const props = defineProps<{ theme?: string }>();
const { copyToClipboard } = useClipboard();

const htmlInput = ref('');
const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });
const editorRef = shallowRef<any>(null);
const decorations = ref<string[]>([]);

// Layout and Resize state
const layoutMode = ref<'vertical' | 'horizontal'>('horizontal'); // horizontal = side-by-side
const splitRatio = ref(20); // 20% HTML Source by default
const isDraggingPane = ref(false);
const splitContainerRef = ref<HTMLElement | null>(null);

const colWidths = ref([50, 200, 80, 80, 50, 100, 80]); // 7 widths for 8 columns (Note flexes)
const resizingCol = ref<number | null>(null);
const startX = ref(0);
const startWidth = ref(0);
const headers = ['No.', 'Item Name', 'Type', 'Status', 'Req', 'Max Length', 'Tab Index', 'Note'];

const lengthSearch = ref('');
const activeSubTab = ref<'extracted' | 'length'>('extracted');
const lengthItems = ref<any[]>([]);
const isLoadingLength = ref(false);

const filteredLengthItems = computed(() => {
  const q = lengthSearch.value.trim().toLowerCase();
  if (!q) return lengthItems.value;
  return lengthItems.value.filter(r =>
    (r.subsystemId + r.parameterId + String(r.parameterTx) + r.explanation).toLowerCase().includes(q)
  );
});

const loadLengthExcel = async () => {
  if (!revertTKSettings.value?.lengthExcelPath) return;
  isLoadingLength.value = true;
  try {
    const data = await invoke<number[]>('read_file_binary', { path: revertTKSettings.value.lengthExcelPath });
    const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (json.length > 1) {
      // Map to object assuming fixed structure
      lengthItems.value = json.slice(1).filter((r: any) => r && r.length > 0).map((r: any) => ({
        subsystemId: r[0] || '',
        parameterId: r[1] || '',
        parameterTx: r[2] || '',
        explanation: r[3] || ''
      }));
    } else {
      lengthItems.value = [];
    }
  } catch (err) {
    console.error('Failed to load Length Item excel:', err);
    lengthItems.value = [];
  } finally {
    isLoadingLength.value = false;
  }
};

watch(activeSubTab, (val) => {
  if (val === 'length' && lengthItems.value.length === 0) {
    loadLengthExcel();
  }
});

watch(() => revertTKSettings.value?.lengthExcelPath, () => {
  lengthItems.value = [];
  if (activeSubTab.value === 'length') {
    loadLengthExcel();
  }
});

const toggleLayout = () => {
  layoutMode.value = layoutMode.value === 'vertical' ? 'horizontal' : 'vertical';
  // Reset ratio to default 20% for horizontal, 50% for vertical
  splitRatio.value = layoutMode.value === 'horizontal' ? 20 : 50;
};

const startPaneResize = () => {
  isDraggingPane.value = true;
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onPaneResize);
  document.addEventListener('mouseup', stopPaneResize);
};

const onPaneResize = (e: MouseEvent) => {
  if (!isDraggingPane.value || !splitContainerRef.value) return;
  const rect = splitContainerRef.value.getBoundingClientRect();
  if (layoutMode.value === 'horizontal') {
    // horizontal uses row-reverse, HTML Source (left-pane) is on the right
    splitRatio.value = ((rect.right - e.clientX) / rect.width) * 100;
  } else {
    // vertical uses column, HTML Source is on top
    splitRatio.value = ((e.clientY - rect.top) / rect.height) * 100;
  }
  if (splitRatio.value < 10) splitRatio.value = 10;
  if (splitRatio.value > 90) splitRatio.value = 90;
};

const stopPaneResize = () => {
  isDraggingPane.value = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onPaneResize);
  document.removeEventListener('mouseup', stopPaneResize);
};

const startColResize = (index: number, e: MouseEvent) => {
  resizingCol.value = index;
  startX.value = e.clientX;
  startWidth.value = colWidths.value[index];
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onColResize);
  document.addEventListener('mouseup', stopColResize);
};

const onColResize = (e: MouseEvent) => {
  if (resizingCol.value === null) return;
  const diff = e.clientX - startX.value;
  const newWidth = Math.max(30, startWidth.value + diff); 
  colWidths.value[resizingCol.value] = newWidth;
};

const stopColResize = () => {
  resizingCol.value = null;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onColResize);
  document.removeEventListener('mouseup', stopColResize);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', onPaneResize);
  document.removeEventListener('mouseup', stopPaneResize);
  document.removeEventListener('mousemove', onColResize);
  document.removeEventListener('mouseup', stopColResize);
});

interface ParsedItem {
  isSeparator?: boolean;
  no?: number;
  itemName: string;
  status: string;
  req: string;
  type: string;
  maxLength: string;
  tabIndex: string;
  note: string;
  searchToken?: string;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateSearchRegex(el: Element | undefined, _labelEl: Element | undefined, baseLabel: string): string {
  if (el) {
    const tag = el.tagName.toLowerCase();
    const id = el.getAttribute('id');
    const name = el.getAttribute('name');
    const value = el.getAttribute('value');
    
    // Use precise single-tag match to avoid spanning multiple elements
    if (id) return `<${tag}[^>]*id=["']${escapeRegExp(id)}["'][^>]*>`;
    if (name) return `<${tag}[^>]*name=["']${escapeRegExp(name)}["'][^>]*>`;
    if (value) {
      const escapedVal = escapeRegExp(value);
      return `<${tag}[^>]*value=["']${escapedVal}["'][^>]*>`;
    }
    
    // For inline elements with text content (no greedy cross-element matching)
    const text = el.textContent?.trim();
    if (text) {
      return `<${tag}[^>]*>[^<]*${escapeRegExp(text)}[^<]*</${tag}>`;
    }
    return `<${tag}[^>]`;
  }
  
  return escapeRegExp(baseLabel);
}

function extractItemsFromCell(labelEl: Element, inputContainerEl: Element): ParsedItem[] {
  let rawLabel = (labelEl.textContent || "").replace(/\u00A0/g, "").replace(/\n/g, "").trim();
  if (!rawLabel) return [];

  let hasStar = rawLabel.includes('*');
  let baseLabel = rawLabel.replace(/^\*/g, ""); // Remove all *

  let itemsToAdd: { name: string, el?: Element, req: string }[] = [];
  const textInputs = [...inputContainerEl.querySelectorAll('input[type="text"], input[type="tel"]')];

  if (textInputs.length >= 2) {
    itemsToAdd.push({ name: rawLabel.replace(/^\*/g, "") + "\u30B3\u30FC\u30C9", el: textInputs[0], req: hasStar ? 'O' : '' });
    itemsToAdd.push({ name: baseLabel + "\u540D", el: textInputs[1], req: '' });
  } else {
    const primaryEl = inputContainerEl.querySelector('input:not([type="button"]):not([type="submit"]):not([type="hidden"]), select, textarea, a, span');
    itemsToAdd.push({ name: baseLabel, el: primaryEl || undefined, req: hasStar ? 'O' : '' });
  }

  inputContainerEl.querySelectorAll('input[type="button"], input[type="submit"], button').forEach(btn => {
    const text = (btn as HTMLInputElement).value?.trim() || btn.textContent?.trim();
    if (text) {
      itemsToAdd.push({ name: `${baseLabel}\uFF1A${text}`, el: btn, req: '' });
    }
  });

  return itemsToAdd.map(item => {
    let status = '';
    let type = '';
    let maxLength = '';
    let tabIndex = '';
    let note = '';

    if (item.el) {
      const el = item.el as HTMLElement;
      if ((el as any).disabled || el.hasAttribute('disabled') || el.hasAttribute('readonly')) status = 'disable';

      const tagName = el.tagName.toLowerCase();
      if (tagName === 'input') {
        type = (el.getAttribute('type') || 'text').toLowerCase();
        if (type === 'tel') type = 'text'; // tel -> text
      } else if (tagName === 'select') {
        type = 'select';
      } else if (tagName === 'textarea') {
        type = 'textarea';
      } else if (tagName === 'button') {
        type = 'button';
      } else if (tagName === 'a') {
        type = 'link';
      } else if (tagName === 'span') {
        type = 'label';
      }

      maxLength = el.getAttribute('maxlength') || '';
      tabIndex = el.getAttribute('tabindex') || '';
      if (tabIndex === '-1') tabIndex = '';

      if (type === 'select') {
        const options = [...el.querySelectorAll('option')];
        note = options.map(o => o.textContent?.trim() ? `\u3010${o.textContent.trim()}\u3011` : '').join('');
      } else if (type === 'radio' || type === 'checkbox') {
        const inputs = [...inputContainerEl.querySelectorAll(`input[type="${type}"]`)];
        note = inputs.map(r => {
          let text = (r as HTMLInputElement).value;
          let next = r.nextSibling;
          if (next && next.nodeType === 3) {
            let t = next.textContent?.replace(/\u00A0/g, " ").trim();
            if (t) text = t;
          }
          const parent = r.parentElement;
          if (parent && parent.tagName.toLowerCase() === 'label') {
            let t = parent.textContent?.replace(/\u00A0/g, " ").trim();
            if (t) text = t;
          }
          return text ? `\u3010${text}\u3011` : '';
        }).filter(Boolean).join('');
      } else if (tagName === 'button' || tagName === 'a' || type === 'button' || type === 'link') {
        note = `\u30A4\u30D9\u30F3\u30C8"${item.name}"\u306E\u8AAC\u660E\u53C2\u7167\u3002`;
      }
    }

    if (item.name.endsWith('\u540D')) {
      type = 'label';
    }

    return {
      itemName: item.name,
      status,
      req: item.req,
      type,
      maxLength,
      tabIndex,
      note,
      searchToken: generateSearchRegex(item.el, labelEl, baseLabel)
    };
  });
}

const parsedData = computed<ParsedItem[]>(() => {
  if (!htmlInput.value.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlInput.value, 'text/html');

  const searchRows: ParsedItem[] = [];

  // Parse table.term and table.list1_footer1
  doc.querySelectorAll("table.term tr, table.list1_footer1 tr").forEach(tr => {
    const ths = tr.querySelectorAll("th");
    const tds = tr.querySelectorAll("td");
    const count = Math.min(ths.length, tds.length);
    for (let i = 0; i < count; i++) {
      searchRows.push(...extractItemsFromCell(ths[i], tds[i]));
    }
  });

  // Parse table.list1_search
  const listSearchRows: ParsedItem[] = [];
  const allThs = [...doc.querySelectorAll("table.list1_search th")];
  const allTds: Element[] = [];
  
  doc.querySelectorAll("table.list1_search tbody").forEach(tbody => {
    const trs = tbody.querySelectorAll("tr");
    for (let i = 0; i < trs.length; i++) {
      const tds = trs[i].querySelectorAll("td");
      if (tds.length > 0) {
        allTds.push(...tds);
        break; // strictly the first row that has TDs
      }
    }
  });

  allThs.forEach((th, i) => {
    const td = allTds[i] || th;
    const cloneTh = th.cloneNode(true) as HTMLElement;
    cloneTh.querySelectorAll('input, select, textarea, button').forEach(e => e.remove());
    listSearchRows.push(...extractItemsFromCell(cloneTh, td));
  });

  let counter = 1;
  const allItems: ParsedItem[] = [];
  
  // Parse Pagination
  const paginationRows: ParsedItem[] = [];
  doc.querySelectorAll('#linkPager, #buttonPager').forEach(pager => {
    const isPagerHidden = (pager.getAttribute('style') || '').replace(/\s/g, '').includes('display:none');
    
    pager.querySelectorAll('a, input[type="submit"], #pagingInfo').forEach(el => {
      let name = '';
      let type = '';
      let status = isPagerHidden ? 'disable' : '';
      
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === 'a') {
        name = el.textContent?.replace(/\u00A0/g, " ").trim() || '';
        type = 'link';
      } else if (tagName === 'input') {
        name = (el as HTMLInputElement).value?.trim() || '';
        type = 'button';
      } else if (tagName === 'span') {
        name = el.textContent?.replace(/\u00A0/g, " ").trim() || '';
        type = 'label';
      }

      if (!name) return;

      if ((el as any).disabled || el.hasAttribute('disabled') || el.hasAttribute('readonly')) {
        status = 'disable';
      } else {
        const style = el.getAttribute('style') || '';
        if (style.replace(/\s/g, '').includes('pointer-events:none') || style.replace(/\s/g, '').includes('visibility:hidden')) {
          status = 'disable';
        }
      }

      let tabIndex = el.getAttribute('tabindex') || '';
      if (tabIndex === '-1') tabIndex = '';
      let note = '';
      if (type === 'button' || type === 'link') {
        note = `\u30A4\u30D9\u30F3\u30C8"${name}"\u306E\u8AAC\u660E\u53C2\u7167\u3002`;
      }

      paginationRows.push({
        itemName: name,
        status,
        req: '',
        type,
        maxLength: '',
        tabIndex,
        note,
        searchToken: generateSearchRegex(el, el, name)
      });
    });
  });
  
  if (searchRows.length > 0) {
    allItems.push({ isSeparator: true, itemName: '===== SEARCH =====', status: '', req: '', type: '', maxLength: '', tabIndex: '', note: '' });
    searchRows.forEach(r => { r.no = counter++; allItems.push(r); });
  }
  
  if (listSearchRows.length > 0) {
    allItems.push({ isSeparator: true, itemName: '===== TABLE HEADER =====', status: '', req: '', type: '', maxLength: '', tabIndex: '', note: '' });
    listSearchRows.forEach(r => { r.no = counter++; allItems.push(r); });
  }

  if (paginationRows.length > 0) {
    allItems.push({ isSeparator: true, itemName: '===== PAGINATION =====', status: '', req: '', type: '', maxLength: '', tabIndex: '', note: '' });
    paginationRows.forEach(r => { r.no = counter++; allItems.push(r); });
  }

  return allItems;
});

const showToast = (e: MouseEvent) => {
  copyPos.value = { x: e.clientX, y: e.clientY };
  showCopyToast.value = true;
  setTimeout(() => { showCopyToast.value = false; }, 1200);
}

const handleCopyFeedback = async (event: MouseEvent) => {
  if (parsedData.value.length === 0) return;
  
  const rows = parsedData.value.filter(i => !i.isSeparator).map(row => {
    return [
      row.no,
      row.itemName,
      row.type,
      row.status,
      row.req,
      row.maxLength,
      row.tabIndex,
      row.note
    ].join('\t');
  });
  
  const header = headers.join('\t');
  const textToCopy = [header, ...rows].join('\n');
  
  if (await copyToClipboard(textToCopy)) showToast(event);
};

const handleNoteCopy = async (note: string, event: MouseEvent) => {
  if (!note) return;
  if (await copyToClipboard(note)) showToast(event);
};

const handleEditorMount = (editor: any) => {
  editorRef.value = editor;
};

const handleFormatHTML = () => {
  if (editorRef.value) {
    editorRef.value.getAction('editor.action.formatDocument')?.run();
  }
};

const highlightItem = (row: ParsedItem) => {
  const editor = editorRef.value;
  if (!editor || !row.searchToken || row.isSeparator) return;
  
  const model = editor.getModel();
  if (!model) return;
  
  // Search for the token using regex
  const matches = model.findMatches(row.searchToken, false, true, false, null, true);
  
  if (matches.length > 0) {
    editor.revealLineInCenterIfOutsideViewport(matches[0].range.startLineNumber);
    
    decorations.value = editor.deltaDecorations(decorations.value, matches.map((m: any) => ({
      range: m.range,
      options: {
        isWholeLine: false,
        className: 'revert-tk-highlight',
        stickiness: 1
      }
    })));
  }
};

const clearHighlight = () => {
  const editor = editorRef.value;
  if (editor) {
    decorations.value = editor.deltaDecorations(decorations.value, []);
  }
};
</script>

<template>
  <div class="revert-tk-plugin" :class="[{ 'win95': props.theme === '95' }, `layout-${layoutMode}`]">
    
    <component :is="'style'">
      .revert-tk-highlight {
        background-color: {{ revertTKSettings?.highlightColor || '#ffff00' }} !important;
        color: #000;
      }
    </component>

    <div class="split-container" ref="splitContainerRef">
      
      <!-- LPane: HTML Source Input -->
      <div class="pane left-pane" :style="{ flexBasis: splitRatio + '%' }">
        <div class="pane-header glass">
          <div class="header-title">
            <span class="header-icon" v-html="Icons.Code"></span>
            <h3>HTML Source Input</h3>
          </div>
          <div class="header-actions">
            <button class="action-btn" @click="handleFormatHTML" title="Format HTML">
              Format Code
            </button>
          </div>
        </div>
        <div class="pane-content glass-content" style="position: relative;">
          <VueMonacoEditor
            v-model:value="htmlInput"
            language="html"
            :theme="globalTheme === 'dark' ? 'vs-dark' : 'vs-light'"
            :options="{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 13,
              fontFamily: 'JetBrains Mono',
              formatOnPaste: true,
              automaticLayout: true
            }"
            @mount="handleEditorMount"
            class="code-editor monaco-wrapper"
          />
        </div>
      </div>

      <div class="pane-splitter" @mousedown.prevent="startPaneResize"></div>

      <!-- RPane: Data Table -->
      <div class="pane right-pane" :style="{ flexBasis: (100 - splitRatio) + '%' }">
        <div class="pane-header glass">
          <div class="header-title" style="flex: 1; display: flex; align-items: center; gap: 12px;">
            <div class="sub-tabs">
              <button class="sub-tab-btn" :class="{ active: activeSubTab === 'extracted' }" @click="activeSubTab = 'extracted'">
                <span v-html="Icons.Database"></span> Extracted Data
                <span class="count-badge" v-if="parsedData.length > 0">{{ parsedData.length }}</span>
              </button>
              <button class="sub-tab-btn" :class="{ active: activeSubTab === 'length' }" @click="activeSubTab = 'length'">
                <span v-html="Icons.File"></span> Length Item
                <span class="count-badge" v-if="lengthItems.length > 0">{{ lengthItems.length }}</span>
              </button>
            </div>
          </div>
          
          <div class="header-actions">
            <button class="action-btn icon-only" @click="toggleLayout" title="Toggle Layout (Vertical/Horizontal)">
              <svg v-if="layoutMode === 'vertical'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="12" x2="21" y2="12"></line>
              </svg>
            </button>
            <button class="action-btn" @click="handleCopyFeedback" :disabled="parsedData.length === 0" v-if="activeSubTab === 'extracted'">
              <span v-html="Icons.Copy" class="btn-icon"></span>
              Copy Result
            </button>
          </div>
        </div>
        
        <div class="pane-content glass-content table-container" v-show="activeSubTab === 'extracted'">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="(header, i) in headers" :key="i" :style="i < colWidths.length ? { width: colWidths[i] + 'px' } : {}">
                  {{ header }}
                  <div v-if="i < colWidths.length" class="col-resizer" @mousedown.prevent="startColResize(i, $event)"></div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="parsedData.length === 0">
                <td :colspan="headers.length" class="empty-state">No data extracted. Paste HTML to begin.</td>
              </tr>
              <template v-for="(row, idx) in parsedData" :key="idx">
                <tr v-if="row.isSeparator" class="separator-row">
                  <td :colspan="headers.length" class="separator-cell">{{ row.itemName }}</td>
                </tr>
                <tr v-else @mouseenter="highlightItem(row)" @mouseleave="clearHighlight">
                  <td class="center-col no-col">{{ row.no }}</td>
                  <td class="item-name-col cell-truncate" :title="row.itemName">{{ row.itemName }}</td>
                  <td class="cell-truncate">{{ row.type }}</td>
                  <td class="center-col status-col" :class="{'is-disable': row.status === 'disable'}">{{ row.status }}</td>
                  <td class="center-col">{{ row.req }}</td>
                  <td class="center-col cell-truncate">{{ row.maxLength }}</td>
                  <td class="center-col">{{ row.tabIndex }}</td>
                  <td class="cell-truncate red-ellipsis" :title="row.note" @click="handleNoteCopy(row.note, $event)">
                    <span class="note-text">{{ row.note }}</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="pane-content glass-content length-tab-wrapper" v-show="activeSubTab === 'length'">
          <!-- Toolbar: search + refresh -->
          <div class="length-toolbar">
            <div class="length-search-wrap">
              <span class="search-icon" v-html="Icons.Search"></span>
              <input
                v-model="lengthSearch"
                type="text"
                class="length-search-input"
                placeholder="Search SUBSYSTEM / PARAMETER / EXPLANATION..."
              />
              <button v-if="lengthSearch" class="length-clear-btn" @click="lengthSearch = ''" title="Clear search">
                <span v-html="Icons.Close"></span>
              </button>
            </div>
            <button class="action-btn" @click="loadLengthExcel" :disabled="isLoadingLength" title="Reload Excel file">
              <span class="btn-icon" v-html="Icons.RefreshCw"></span>
              {{ isLoadingLength ? 'Loading...' : 'Refresh' }}
            </button>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 25%">SUBSYSTEM_ID</th>
                  <th style="width: 25%">PARAMETER_ID</th>
                  <th style="width: 15%" class="center-col">PARAMETER_TX</th>
                  <th style="width: 35%">EXPLANATION</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoadingLength">
                  <td colspan="4" class="empty-state">Loading Excel data...</td>
                </tr>
                <tr v-else-if="!revertTKSettings?.lengthExcelPath">
                  <td colspan="4" class="empty-state">No Excel path configured. Please configure it in Settings → Revert TK.</td>
                </tr>
                <tr v-else-if="lengthItems.length === 0">
                  <td colspan="4" class="empty-state">No data found in the Excel file.</td>
                </tr>
                <tr v-else-if="filteredLengthItems.length === 0">
                  <td colspan="4" class="empty-state">No results match "{{ lengthSearch }}".</td>
                </tr>
                <template v-else>
                  <tr v-for="(row, idx) in filteredLengthItems" :key="idx">
                    <td class="cell-truncate" :title="row.subsystemId">{{ row.subsystemId }}</td>
                    <td class="item-name-col cell-truncate" :title="row.parameterId">{{ row.parameterId }}</td>
                    <td class="center-col">{{ row.parameterTx }}</td>
                    <td class="cell-truncate" :title="row.explanation"><span class="note-text">{{ row.explanation }}</span></td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>

    <!-- Toast -->
    <Teleport to="body">
      <transition name="bubble">
        <div v-if="showCopyToast" class="copy-bubble" :style="{ left: copyPos.x + 'px', top: (copyPos.y - 30) + 'px' }">
          <span v-html="Icons.Check" style="display:inline-block; margin-right:4px;"></span>
          Copied!
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.revert-tk-plugin {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  padding-bottom: 24px; /* Give footer some breathing room */
  background: var(--container-bg);
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

.icon-only {
  padding: 6px;
}

.split-container {
  display: flex;
  height: 100%;
  width: 100%;
}

/* Layout Modes */
.layout-horizontal .split-container {
  flex-direction: row-reverse;
}

.layout-vertical .split-container {
  flex-direction: column;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
}

.pane-splitter {
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.2s;
  z-index: 5;
}

.pane-splitter::after {
  content: '';
  position: absolute;
  background: var(--glass-border);
  border-radius: 4px;
}

.layout-horizontal .pane-splitter {
  width: 6px;
  cursor: col-resize;
  margin: 0 2px;
}
.layout-horizontal .pane-splitter::after {
  width: 2px;
  height: 24px;
}
.layout-horizontal .pane-splitter:hover, .layout-horizontal .pane-splitter:active {
  background: rgba(99, 102, 241, 0.1);
}

.layout-vertical .pane-splitter {
  height: 6px;
  cursor: row-resize;
  margin: 2px 0;
}
.layout-vertical .pane-splitter::after {
  height: 2px;
  width: 24px;
}
.layout-vertical .pane-splitter:hover, .layout-vertical .pane-splitter:active {
  background: rgba(99, 102, 241, 0.1);
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-radius: 12px;
}

.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.glass-content {
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  display: flex;
  align-items: center;
  color: var(--accent-color);
  width: 18px;
  height: 18px;
}

.pane-header h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-color);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.count-badge {
  background: var(--accent-color);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 900;
  padding: 2px 8px;
  border-radius: 20px;
}

.pane-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.monaco-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.revert-tk-highlight) {
  background-color: rgba(99, 102, 241, 0.4);
  border-bottom: 2px solid var(--accent-color);
}
.win95 :deep(.revert-tk-highlight) {
  background-color: #000080;
  color: #fff;
}

.table-container {
  overflow: auto;
}

.data-table {
  table-layout: fixed;
  width: 100%;
  border-collapse: collapse;
  color: var(--text-color);
  font-size: 0.85rem;
}

.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  position: relative;
}

.data-table th {
  font-weight: 800;
  text-transform: uppercase;
  font-size: 0.75rem;
  background: rgba(0, 0, 0, 0.03);
  position: sticky;
  top: 0;
  z-index: 1;
  backdrop-filter: blur(10px);
  user-select: none;
}

.col-resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
}
.col-resizer:hover, .col-resizer:active {
  background: var(--accent-color);
}

.data-table tr:hover {
  background: rgba(99, 102, 241, 0.05);
}

.no-col {
  font-weight: 800;
  opacity: 0.6;
}

.item-name-col {
  font-weight: 600;
  color: var(--accent-color);
}

.status-col.is-disable {
  color: #ef4444;
  font-weight: 800;
  text-transform: uppercase;
}

.separator-row {
  background: rgba(99, 102, 241, 0.1) !important;
}

.separator-cell {
  font-weight: 900;
  text-align: center !important;
  color: var(--accent-color);
  letter-spacing: 0.1em;
}

.center-col {
  text-align: center !important;
}

.cell-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.red-ellipsis {
  color: #ef4444 !important;
  font-weight: 900;
  cursor: pointer;
}
.red-ellipsis:hover {
  background: rgba(99, 102, 241, 0.1);
}
.note-text {
  color: var(--text-color);
  font-weight: normal;
}

.empty-state {
  text-align: center;
  padding: 40px !important;
  opacity: 0.5;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.25);
}

.action-btn:disabled {
  background: rgba(128, 128, 128, 0.3);
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
  box-shadow: none;
}

.btn-icon {
  display: flex;
  align-items: center;
}

.sub-tabs {
  display: flex;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 8px;
}

.sub-tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-color);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s;
}

.sub-tab-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.05);
}

.sub-tab-btn.active {
  opacity: 1;
  background: var(--accent-color);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

/* Length Tab */
.length-tab-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 !important;
}

.length-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.03);
}

.length-search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 8px;
  padding: 0 10px;
  height: 32px;
}

.search-icon {
  width: 14px;
  height: 14px;
  opacity: 0.4;
  flex-shrink: 0;
}

.length-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-color);
  font-size: 0.78rem;
  font-weight: 500;
}
.length-search-input::placeholder { opacity: 0.35; }
.length-search-input:focus { outline: none; }

.length-clear-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  opacity: 0.4;
  cursor: pointer;
  padding: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
}
.length-clear-btn:hover { opacity: 1; }

.length-toolbar .action-btn {
  padding: 5px 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.length-tab-wrapper .table-container {
  flex: 1;
  overflow: auto;
}


/* Toast */
.copy-bubble {
  position: fixed;
  background: #10b981;
  color: #fff;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 900;
  z-index: 10000;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
}
.bubble-enter-active, .bubble-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.bubble-enter-from { opacity: 0; transform: translate(-50%, 15px) scale(0.8); }
.bubble-leave-to { opacity: 0; transform: translate(-50%, -15px) scale(0.8); }

/* Win95 Variations */
.win95 .glass, .win95 .glass-content {
  background: #c0c0c0 !important;
  border-radius: 0 !important;
  border: 2px solid !important;
  border-color: #fff #808080 #808080 #fff !important;
  backdrop-filter: none !important;
  color: #000 !important;
}

.win95 .monaco-wrapper {
  background: #fff;
  border: 2px solid;
  border-color: #808080 #fff #fff #808080;
  border-radius: 0;
}

.win95 .data-table th {
  background: #c0c0c0;
  border: 2px solid;
  border-color: #fff #808080 #808080 #fff;
  color: #000;
}

.win95 .data-table td {
  border: 1px solid #808080;
}

.win95 .item-name-col {
  color: #000080;
}

.win95 .action-btn {
  background: #c0c0c0;
  color: #000;
  border: 2px solid;
  border-color: #fff #808080 #808080 #fff;
  border-radius: 0;
  box-shadow: none;
}

.win95 .action-btn:active:not(:disabled) {
  border-color: #808080 #fff #fff #808080;
  transform: translateY(1px);
}
</style>
