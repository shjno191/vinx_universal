<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { globalShortcuts, editorSettings, cursorHistory, cursorHistoryIndex, theme as globalTheme, currentFlowCode, triggerFlowChart } from '../store';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

interface Tab {
  id: string;
  name: string;
  content: string;
  language: string;
  path?: string;
}

const tabs = ref<Tab[]>([
  { id: '1', name: 'Untitled-1', content: '', language: 'javascript' }
]);

const isSplit = ref(false);
const activeTabIdLeft = ref('1');
const activeTabIdRight = ref('1');
const focusedPane = ref<'left' | 'right'>('left');

const activeTabLeft = computed(() => tabs.value.find(t => t.id === activeTabIdLeft.value) || tabs.value[0]);
const activeTabRight = computed(() => tabs.value.find(t => t.id === activeTabIdRight.value) || tabs.value[0]);

const currentActiveId = computed({
  get: () => focusedPane.value === 'left' ? activeTabIdLeft.value : activeTabIdRight.value,
  set: (val: string) => {
    if (focusedPane.value === 'left') activeTabIdLeft.value = val;
    else activeTabIdRight.value = val;
  }
});

const handleEditorBeforeMount = (monaco: any) => {
  // Define custom themes that match our app's CSS variables
  monaco.editor.defineTheme('app-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#161b22', // Matches var(--container-bg) in dark
    }
  });

  monaco.editor.defineTheme('app-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff', // Matches var(--container-bg) in light
    }
  });
};

const MONACO_OPTIONS = computed(() => ({
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: true },
  fontSize: 14,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  fixedOverflowWidgets: true,
  padding: { top: 10 },
  scrollbar: {
    vertical: 'visible' as const,
    horizontal: 'visible' as const,
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  theme: globalTheme.value === 'dark' ? 'app-dark' : 'app-light'
}));

const addTab = () => {
  const newId = Date.now().toString();
  const nextNum = tabs.value.length + 1;
  tabs.value.push({
    id: newId,
    name: `Untitled-${nextNum}`,
    content: '',
    language: 'javascript'
  });
  currentActiveId.value = newId;
};

const handleOpenFile = async () => {
  try {
    const selected = await open({
      multiple: false,
    });
    if (selected && typeof selected === 'string') {
      const content = await invoke('read_file_content', { path: selected });
      const fileName = selected.split(/[\\/]/).pop() || 'Untitled';
      
      const newId = Date.now().toString();
      tabs.value.push({
        id: newId,
        name: fileName,
        content: content as string,
        language: 'javascript',
        path: selected
      });
      currentActiveId.value = newId;
    }
  } catch (e) {
    console.error('Failed to open file:', e);
  }
};

const matchShortcut = (e: KeyboardEvent, shortcutStr: string) => {
  if (!shortcutStr) return false;
  const parts = shortcutStr.toLowerCase().split('+');
  const key = parts.pop();
  const ctrl = parts.includes('ctrl');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const meta = parts.includes('meta');
  
  return e.key.toLowerCase() === key &&
         e.ctrlKey === ctrl &&
         e.shiftKey === shift &&
         e.altKey === alt &&
         e.metaKey === meta;
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (matchShortcut(e, globalShortcuts.value.open_file)) {
    e.preventDefault();
    handleOpenFile();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

const closeTab = (id: string, event: Event) => {
  event.stopPropagation();
  if (tabs.value.length === 1) return;
  
  const index = tabs.value.findIndex(t => t.id === id);
  if (index !== -1) {
    tabs.value.splice(index, 1);
    const replacementId = tabs.value[Math.max(0, index - 1)].id;
    if (activeTabIdLeft.value === id) activeTabIdLeft.value = replacementId;
    if (activeTabIdRight.value === id) activeTabIdRight.value = replacementId;
  }
};

const toggleSplit = () => {
  isSplit.value = !isSplit.value;
  if (isSplit.value) {
    activeTabIdRight.value = activeTabIdLeft.value;
  }
};

// --- Context Menu Logic ---
const showContextMenu = ref(false);
const contextMenuPos = ref({ x: 0, y: 0 });
const contextMenuTabId = ref<string | null>(null);

const handleTabContextMenu = (id: string, event: MouseEvent) => {
  event.preventDefault();
  contextMenuTabId.value = id;
  contextMenuPos.value = { x: event.clientX, y: event.clientY };
  showContextMenu.value = true;
};

const closeContextMenu = () => {
  showContextMenu.value = false;
};

const closeOtherTabs = (id: string) => {
  tabs.value = tabs.value.filter(t => t.id === id);
  activeTabIdLeft.value = id;
  activeTabIdRight.value = id;
  closeContextMenu();
};

const closeAllTabs = () => {
  const firstTabId = '1';
  tabs.value = [{ id: firstTabId, name: 'Untitled-1', content: '', language: 'javascript' }];
  activeTabIdLeft.value = firstTabId;
  activeTabIdRight.value = firstTabId;
  closeContextMenu();
};

// --- Editor Instance Management ---
const editors = {
  left: null as any,
  right: null as any
};

const handleEditorMount = (editor: any, pane: 'left' | 'right') => {
  editors[pane] = editor;
  
  // Track cursor position changes for history
  editor.onDidChangeCursorPosition((e: any) => {
    // Only track intentional cursor movements (reason = 0 means explicit movement)
    if (isNavigating.value) return;
    const currentTabId = pane === 'left' ? activeTabIdLeft.value : activeTabIdRight.value;
    handleCursorChange(e, currentTabId);
  });
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('click', closeContextMenu);
  // Note: Most mice buttons are handled via handleEditorMount mouseup on monaco instances
  // for cases where mouse is outside but in our tab bar etc.
  window.addEventListener('mouseup', handleMouseNavigation);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('mouseup', handleMouseNavigation);
});

// --- Navigation History Logic ---
const isNavigating = ref(false);
let cursorDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const handleCursorChange = (e: any, tabId: string) => {
  if (isNavigating.value || !editorSettings.value.mouseNavHistory) return;
  
  const pos = e.position;
  if (!pos) return;
  const newPos = { tabId, line: pos.lineNumber, column: pos.column };
  
  // Debounce: only push to history after user stops typing for 500ms
  if (cursorDebounceTimer) clearTimeout(cursorDebounceTimer);
  cursorDebounceTimer = setTimeout(() => {
    // Only push if different from last
    const last = cursorHistory.value[cursorHistoryIndex.value];
    if (last && last.tabId === newPos.tabId && last.line === newPos.line && last.column === newPos.column) return;

    // Truncate future if we were back in time
    if (cursorHistoryIndex.value < cursorHistory.value.length - 1) {
      cursorHistory.value = cursorHistory.value.slice(0, cursorHistoryIndex.value + 1);
      cursorHistoryIndex.value = cursorHistory.value.length - 1;
    }

    cursorHistory.value.push(newPos);
    if (cursorHistory.value.length > 100) cursorHistory.value.shift();
    else cursorHistoryIndex.value = cursorHistory.value.length - 1;
  }, 500);
};

const handleMouseNavigation = (e: MouseEvent) => {
  if (!editorSettings.value.mouseNavHistory) return;
  // USER Request: Mouse 4 for Back, Mouse 3 for Forward
  // Browser standard: 3 is Back, 4 is Forward.
  if (e.button === 3) { // Physical Back
    navigateHistory(-1);
  } else if (e.button === 4) { // Physical Forward
    navigateHistory(1);
  }
};

const navigateHistory = (dir: number) => {
  if (cursorHistory.value.length === 0) return;
  const nextIdx = cursorHistoryIndex.value + dir;
  if (nextIdx < 0 || nextIdx >= cursorHistory.value.length) return;

  isNavigating.value = true;
  if (cursorDebounceTimer) clearTimeout(cursorDebounceTimer); // Cancel pending history push
  cursorHistoryIndex.value = nextIdx;
  const pos = cursorHistory.value[nextIdx];
  
  // Switch tab if needed
  if (pos.tabId !== currentActiveId.value) {
    currentActiveId.value = pos.tabId;
  }
  
  nextTick(() => {
    const targetEditor = focusedPane.value === 'left' ? editors.left : editors.right;
    if (targetEditor) {
      targetEditor.setPosition({ lineNumber: pos.line, column: pos.column });
      targetEditor.revealPositionInCenter({ lineNumber: pos.line, column: pos.column });
      targetEditor.focus();
    }
    setTimeout(() => { isNavigating.value = false; }, 300); // Larger guard to prevent re-tracking
  });
};

const copyPath = async (id: string) => {
  const tab = tabs.value.find(t => t.id === id);
  if (tab?.path) {
    await writeText(tab.path);
  }
  closeContextMenu();
};

const openFolder = async (id: string) => {
  const tab = tabs.value.find(t => t.id === id);
  if (tab?.path) {
    await invoke('open_file_path', { path: tab.path }); // Already opens explorer pointing to file
  }
  closeContextMenu();
};

const handleMiddleClick = (id: string, e: MouseEvent) => {
  if (editorSettings.value.middleClickClose && e.button === 1) {
    closeTab(id, e);
  }
};

const handleTabBarDbClick = (e: MouseEvent) => {
  if (!editorSettings.value.doubleClickNewTab) return;
  // Ensure we didn't click on a tab (event delegation)
  if ((e.target as HTMLElement).classList.contains('tabs-scroll-area') || (e.target as HTMLElement).classList.contains('editor-tabs-bar')) {
    addTab();
  }
};

// „Ÿ„Ÿ Flow Chart Trigger „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ
const generateFlowChart = () => {
  // Get content from the focused pane's active tab
  const code = focusedPane.value === 'left'
    ? activeTabLeft.value.content
    : activeTabRight.value.content;
  currentFlowCode.value = code || '';
  triggerFlowChart.value = true;
};
</script>

<template>
  <div class="editor-tab-container">
    <!-- Tab Bar -->
    <div class="editor-tabs-bar" @dblclick="handleTabBarDbClick">
      <div class="tabs-scroll-area">
        <div 
          v-for="tab in tabs" 
          :key="tab.id"
          class="editor-tab"
          :class="{ active: tab.id === currentActiveId }"
          @click="currentActiveId = tab.id"
          @dblclick.stop
          @auxclick="handleMiddleClick(tab.id, $event)"
          @contextmenu="handleTabContextMenu(tab.id, $event)"
        >
          <span class="tab-icon">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1h6.5l3.5 3.5zm-4.5.5V1.5L3 1.5V14h10V5h-3.5z"/></svg>
          </span>
          <span class="tab-name">{{ tab.name }}</span>
          <button class="tab-close" @click="closeTab(tab.id, $event)">&times;</button>
        </div>
      </div>
      
      <div class="tab-bar-actions">
        <button class="action-btn" @click="addTab" title="New Tab">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/></svg>
        </button>
        <button 
          class="action-btn split-btn" 
          :class="{ active: isSplit }" 
          @click="toggleSplit" 
          title="Split Editor"
        >
          <!-- Better intuitive Split/Single icons -->
          <svg v-if="!isSplit" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm1 0v12h12V2H2z"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm1 0v12h5V2H2zm6 0v12h6V2H8z"/>
          </svg>
        </button>
        <!-- Flow Chart button -->
        <button
          class="action-btn flow-btn"
          @click="generateFlowChart"
          title="Generate Flow Chart from this code (AI)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="6" height="4" rx="1"/>
            <rect x="9" y="10" width="6" height="4" rx="1"/>
            <rect x="16" y="17" width="6" height="4" rx="1"/>
            <line x1="5" y1="7" x2="12" y2="10"/>
            <line x1="15" y1="14" x2="19" y2="17"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Editor Content -->
    <div class="editor-view-area" :class="{ 'split-view': isSplit }">
      <!-- Left/Single Pane -->
      <div 
        class="pane" 
        :class="{ active: focusedPane === 'left' && isSplit }"
        @mousedown="focusedPane = 'left'"
      >
        <div v-if="isSplit" class="pane-header">{{ activeTabLeft.name }}</div>
        <VueMonacoEditor
          v-model:value="activeTabLeft.content"
          :theme="globalTheme === 'dark' ? 'app-dark' : 'app-light'"
          :language="activeTabLeft.language"
          :options="MONACO_OPTIONS"
          class="monaco-instance"
          @mount="handleEditorMount($event, 'left')"
          @before-mount="handleEditorBeforeMount"
        />
      </div>

      <!-- Right Pane -->
      <div 
        v-if="isSplit" 
        class="pane" 
        :class="{ active: focusedPane === 'right' }"
        @mousedown="focusedPane = 'right'"
      >
        <div class="pane-header">{{ activeTabRight.name }}</div>
        <VueMonacoEditor
          v-model:value="activeTabRight.content"
          :theme="globalTheme === 'dark' ? 'app-dark' : 'app-light'"
          :language="activeTabRight.language"
          :options="MONACO_OPTIONS"
          class="monaco-instance"
          @mount="handleEditorMount($event, 'right')"
          @before-mount="handleEditorBeforeMount"
        />
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div 
        v-if="showContextMenu" 
        class="context-menu" 
        :style="{ top: contextMenuPos.y + 'px', left: contextMenuPos.x + 'px' }"
        @click.stop
      >
        <div class="context-item" @click="contextMenuTabId && (closeTab(contextMenuTabId, $event), closeContextMenu())">Close</div>
        <div class="context-item" @click="contextMenuTabId && closeOtherTabs(contextMenuTabId)">Close Others</div>
        <div class="context-item" @click="closeAllTabs">Close All</div>
        <template v-if="contextMenuTabId && tabs.find(t => t.id === contextMenuTabId)?.path">
          <div class="context-divider"></div>
          <div class="context-item" @click="copyPath(contextMenuTabId)">Copy Path</div>
          <div class="context-item" @click="openFolder(contextMenuTabId)">Open Folder</div>
        </template>
        <div class="context-divider"></div>
        <div class="context-item" @click="addTab(), closeContextMenu()">New Untitled File</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.editor-tab-container {
  width: 100%;
  height: 100%;
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-color);
}

.editor-tabs-bar {
  display: flex;
  align-items: center;
  background-color: var(--container-bg);
  height: 35px;
  flex-shrink: 0;
  border-bottom: var(--border-style);
  padding: 0 5px;
}

.tabs-scroll-area {
  flex: 1;
  display: flex;
  height: 100%;
  overflow-x: auto;
  gap: 2px;
}

.tabs-scroll-area::-webkit-scrollbar { height: 0; }

.editor-tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 28px;
  margin-top: 7px;
  min-width: 120px;
  max-width: 200px;
  background-color: var(--button-bg);
  color: var(--text-color);
  opacity: 0.6;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  border: var(--border-style);
  border-bottom: none;
  font-size: 0.72rem;
  user-select: none;
  transition: all 0.2s;
  position: relative;
}

.editor-tab:hover {
  opacity: 0.9;
  background-color: var(--button-hover);
}

.editor-tab.active {
  opacity: 1;
  background-color: var(--bg-color);
  border-bottom: 2px solid var(--accent-color);
  z-index: 2;
}

.tab-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
  opacity: 0.7;
}

.tab-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}

.tab-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1rem;
  padding: 0 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.4;
  transition: all 0.2s;
}

.tab-close:hover {
  opacity: 1;
  background-color: rgba(255, 0, 0, 0.2);
}

.tab-bar-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 5px;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: var(--button-hover);
  opacity: 1;
}

.action-btn.active {
  color: var(--accent-color);
  opacity: 1;
}

.flow-btn {
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.flow-btn:hover {
  background: rgba(167, 139, 250, 0.15) !important;
  opacity: 1 !important;
  color: #c4b5fd;
}

.editor-view-area {
  flex: 1;
  display: flex;
  background-color: var(--bg-color);
  overflow: hidden;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.pane.active {
  box-shadow: inset 0 0 0 1px var(--accent-color);
}

.pane-header {
  height: 22px;
  background-color: var(--container-bg);
  color: var(--text-color);
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: var(--border-style);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.monaco-instance {
  flex: 1;
}

/* Context Menu */
.context-menu {
  position: fixed;
  z-index: 10000;
  background-color: var(--container-bg);
  border: var(--border-style);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 5px 0;
  min-width: 160px;
  backdrop-filter: blur(10px);
}

.context-item {
  padding: 8px 15px;
  font-size: 0.75rem;
  color: var(--text-color);
  cursor: pointer;
  transition: background 0.15s;
}

.context-item:hover {
  background-color: var(--button-hover);
}

.context-divider {
  height: 1px;
  background-color: var(--border-style);
  margin: 5px 0;
}
</style>
