<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as monaco from 'monaco-editor';
import { VueMonacoEditor, VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

// Composables & Utils
import { useEditorTabs, type Tab } from '../composables/useEditorTabs';
import { useExplorer } from '../composables/useExplorer';
import { useEditorFeatures } from '../composables/useEditorFeatures';
import { Icons } from '../utils/icons';

// Sub-components
import ExplorerNode from './ExplorerNode.vue';
import ExplorerContextMenu from './ExplorerContextMenu.vue';
import TabContextMenu from './TabContextMenu.vue';
import GitSelectionModal from './GitSelectionModal.vue';

// Store
import { 
  projectRootPath, 
  theme as globalTheme, 
  activeTabContextMenu, 
  gitTabRepoPath, 
  gitBranches, 
  triggerGitRefresh, 
  triggerCloseModals, 
  cursorHistory, 
  cursorHistoryIndex, 
  editorSettings 
} from '../store';

// --- Initialization ----------------------------------------------------------
const {
  tabs,
  activeTabIdLeft,
  activeTabIdRight,
  activeTabLeft,
  activeTabRight,
  focusedPane,
  showSplit,
  syncScroll,
  currentActiveId,
  addTab,
  removeTab,
  openFileByPath,
  saveCurrentFile,
  getFileLanguage
} = useEditorTabs();

const {
  projectRoot,
  expandedPaths,
  showExplorer,
  sidebarWidth,
  refreshTree,
  toggleFolder,
  closeProject,
  handleSidebarResize
} = useExplorer();

const {
  selectionModal,
  showBranchSwitcher,
  generateFlowChart,
  handleGitCompare,
  onGitSelection,
  switchBranch
} = useEditorFeatures();

// --- Local State -------------------------------------------------------------
const searchQuery = ref('');
const activeSidebar = ref<'explorer'>('explorer');

const editors = { left: null as any, right: null as any };
let isNavigatingCursorHistory = false;

// --- Computed ----------------------------------------------------------------
const currentBranchName = computed(() => gitBranches.value.find(b => b.isCurrent)?.name || '');
const activeFilePath = computed(() => activeTabLeft.value?.path || '');

// --- Methods -----------------------------------------------------------------
const openProject = async () => {
  const selected = await open({ directory: true, multiple: false, title: 'Open Project' });
  if (selected && typeof selected === 'string') {
    projectRootPath.value = selected;
    showExplorer.value = true;
    try {
      const toplevel = await invoke<string>('git_execute', { args: ['rev-parse', '--show-toplevel'], cwd: selected });
      gitTabRepoPath.value = toplevel?.trim() || '';
    } catch (_) { gitTabRepoPath.value = ''; }
  }
};

const openFile = async () => {
  const selected = await open({ multiple: true, filters: [{ name: 'All Files', extensions: ['*'] }] });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const p of paths) await openFileByPath(p);
};

const handleEditorMount = (editor: any, pane: 'left' | 'right') => {
  editors[pane] = editor;
  if (pane === 'left') setupCtrlClick(editor);
  editor.onDidFocusEditorText(() => { focusedPane.value = pane; });
  
  editor.onDidChangeCursorPosition((e: any) => {
    if (isNavigatingCursorHistory) return;
    const tabId = pane === 'left' ? activeTabIdLeft.value : activeTabIdRight.value;
    const newPos = { tabId, line: e.position.lineNumber, column: e.position.column };
    const current = cursorHistory.value[cursorHistoryIndex.value];
    if (current && current.tabId === newPos.tabId && Math.abs(current.line - newPos.line) < 5) return;
    if (cursorHistoryIndex.value < cursorHistory.value.length - 1) cursorHistory.value = cursorHistory.value.slice(0, cursorHistoryIndex.value + 1);
    cursorHistory.value.push(newPos);
    if (cursorHistory.value.length > 50) cursorHistory.value.shift();
    cursorHistoryIndex.value = cursorHistory.value.length - 1;
  });

  editor.onDidScrollChange((e: any) => {
    if (!syncScroll.value) return;
    const other = editors[pane === 'left' ? 'right' : 'left'];
    if (other) { other.setScrollTop(e.scrollTop); other.setScrollLeft(e.scrollLeft); }
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyG, () => generateFlowChart(activeTabLeft.value?.content || ''));
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave());
};

const handleSave = async () => {
  const success = await saveCurrentFile();
  if (success) triggerGitRefresh.value++;
};

const jumpToHistory = (pos: any) => {
    isNavigatingCursorHistory = true;
    if (activeTabIdLeft.value !== pos.tabId) activeTabIdLeft.value = pos.tabId;
    nextTick(() => {
        const editor = editors.left;
        if (editor) {
            editor.setPosition({ lineNumber: pos.line, column: pos.column });
            editor.revealPositionInCenter({ lineNumber: pos.line, column: pos.column }, monaco.editor.ScrollType.Smooth);
            editor.focus();
        }
        setTimeout(() => { isNavigatingCursorHistory = false; }, 100);
    });
};

const handleEditorMouseUp = (e: MouseEvent) => {
    if (!editorSettings.value.mouseNavHistory) return;
    if (e.button === 3 && cursorHistoryIndex.value > 0) {
        e.stopPropagation(); cursorHistoryIndex.value--; jumpToHistory(cursorHistory.value[cursorHistoryIndex.value]);
    } else if (e.button === 4 && cursorHistoryIndex.value < cursorHistory.value.length - 1) {
        e.stopPropagation(); cursorHistoryIndex.value++; jumpToHistory(cursorHistory.value[cursorHistoryIndex.value]);
    }
};

const setupCtrlClick = (editor: any) => {
  editor.onMouseDown((e: any) => {
    if (!e.event.ctrlKey) return;
    const model = editor.getModel();
    const pos = e.target.position;
    if (!model || !pos) return;
    const line = model.getLineContent(pos.lineNumber);
    const m = /(?:from\s+['"]|require\s*\(\s*['"]|import\s*['"])([^'"]+)['"]/.exec(line);
    if (m) resolveAndOpenPath(m[1]);
  });
};

const resolveAndOpenPath = async (rawPath: string) => {
  try {
    await openFileByPath(rawPath);
  } catch (_) {
    const cur = tabs.value.find(t => t.id === currentActiveId.value);
    const base = cur?.path ? cur.path.replace(/[/\\][^/\\]+$/, '') : projectRootPath.value;
    if (!base) return;
    const exts = rawPath.includes('.') ? [rawPath] : [rawPath, rawPath+'.ts', rawPath+'.tsx', rawPath+'.js', rawPath+'.jsx', rawPath+'.vue'];
    const sep = base.includes('/') ? '/' : '\\';
    for (const t of exts) {
      const parts = [...base.split(/[/\\]/), ...t.split(/[/\\]/)];
      const norm: string[] = [];
      for (const p of parts) { if (p === '..') norm.pop(); else if (p && p !== '.') norm.push(p); }
      const res = norm.join(sep);
      try {
        await openFileByPath(res);
        return;
      } catch (_) {}
    }
  }
};

// --- Handlers ---
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'o') { e.preventDefault(); e.shiftKey ? openProject() : openFile(); }
    if (e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
    if (e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); activeSidebar.value = 'explorer'; showExplorer.value = true; }
  }
};

const showTabContextMenu = (e: MouseEvent, tab: Tab) => {
  if (tab.isDiff) return;
  activeTabContextMenu.value = { x: e.clientX, y: e.clientY, tab };
};

watch(triggerCloseModals, () => {
    activeTabContextMenu.value = null; 
});

const handleExplorerCompare = async (mode: 'branch' | 'local' | 'commit', node: any) => {
  await openFileByPath(node.path);
  const tab = tabs.value.find(t => t.path === node.path);
  if (tab) {
    handleGitCompare(mode, tab);
  }
};

// Layout refresh for Monaco when UI layout changes
watch([showExplorer, showSplit, sidebarWidth], () => {
  nextTick(() => {
    editors.left?.layout();
    editors.right?.layout();
  });
});


onMounted(() => { window.addEventListener('keydown', handleKeyDown); });
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown); });
</script>

<template>
  <div class="editor-tab-container">
    <div class="activity-bar">
      <div class="activity-item" :class="{ active: activeSidebar === 'explorer' && showExplorer }" 
           @click="activeSidebar = 'explorer'; showExplorer = true" title="Explorer (Ctrl+Shift+E)">
        <span v-html="Icons.Folder"></span>
      </div>
    </div>

    <div v-if="showExplorer" class="sidebar-panel" :style="{ width: sidebarWidth + 'px' }">
      <div class="explorer-header">
        <span class="explorer-title">EXPLORER</span>
        <div class="explorer-actions">
          <button class="explorer-icon-btn" @click="openProject" title="Open Folder" v-html="Icons.Folder"></button>
          <button class="explorer-icon-btn" @click="refreshTree" title="Refresh" v-html="Icons.Refresh"></button>
          <button class="explorer-icon-btn danger-hover" @click="closeProject" title="Close Project" v-html="Icons.Close"></button>
        </div>
      </div>
      
      <div class="explorer-body">
        <div class="explorer-root-label" v-if="projectRoot" @click="toggleFolder(projectRoot)">
          <span class="explorer-folder-arrow" v-html="expandedPaths.has(projectRoot.path) ? Icons.ChevronDown : Icons.ChevronRight"></span>
          <span class="root-icon" v-html="expandedPaths.has(projectRoot.path) ? Icons.FolderOpen : Icons.Folder"></span>
          <span class="explorer-name">{{ projectRoot.name }}</span>
        </div>

        <template v-if="projectRoot && (expandedPaths.has(projectRoot.path) || searchQuery)">
          <ExplorerNode
            v-for="child in projectRoot.children"
            :key="child.path"
            :node="child"
            :expanded-paths="expandedPaths"
            :depth="1"
            :search-query="searchQuery"
            :active-path="activeFilePath"
            @open="(node) => node.is_dir ? toggleFolder(node) : openFileByPath(node.path)"
            @toggle="toggleFolder"
          />
        </template>
        
        <div v-if="!projectRoot" class="explorer-empty">
          <p>No project folder open</p>
          <button class="open-folder-btn-minimal" @click="openProject">Open Folder</button>
        </div>
      </div>

      <div class="explorer-footer" v-if="currentBranchName" title="Switch Branch" @click="showBranchSwitcher = true">
          <span class="footer-icon" v-html="Icons.Branch"></span>
          <span class="footer-branch">{{ currentBranchName }}</span>
      </div>
    </div>

    <div class="sidebar-resizer" v-if="showExplorer" @mousedown="handleSidebarResize"></div>

    <ExplorerContextMenu @open="(node) => openFileByPath(node.path)" @compare="handleExplorerCompare" />
    <TabContextMenu @compare="handleGitCompare" />
    
    <GitSelectionModal 
      v-if="selectionModal" 
      :mode="selectionModal.mode" 
      :file-path="selectionModal.tab.path?.replace(gitTabRepoPath || projectRootPath, '').replace(/^[\\\/]/, '').replace(/\\/g, '/') || ''"
      :on-select="onGitSelection" 
      :on-close="() => selectionModal = null" 
    />

    <GitSelectionModal 
      v-if="showBranchSwitcher" 
      mode="branch" 
      action="checkout" 
      file-path=""
      :on-select="switchBranch" 
      :on-close="() => showBranchSwitcher = false" 
    />

    <div class="editor-main-area">
      <div class="editor-tabs-bar" @dblclick="addTab()">
        <div class="tabs-scroll-area">
          <div v-for="tab in tabs" :key="tab.id" class="editor-tab" :class="{ active: tab.id === currentActiveId, 'is-diff': tab.isDiff }" 
               @click="currentActiveId = tab.id" @mouseup.middle.prevent="removeTab(tab.id)" @contextmenu.prevent.stop="showTabContextMenu($event, tab)">
            <span class="tab-name">{{ tab.name }}</span>
            <span class="tab-close" @click.stop="removeTab(tab.id)">&times;</span>
          </div>
        </div>
        <div class="tab-bar-actions">
          <button class="action-btn" @click="handleSave" title="Save File" v-html="Icons.Save"></button>
          <button class="action-btn" @click="openFile" title="Open File" v-html="Icons.File"></button>
          <button class="action-btn folder-btn" @click="showExplorer = !showExplorer" :class="{ active: showExplorer }" title="Explorer" v-html="Icons.Project"></button>
          <button class="action-btn" @click="generateFlowChart(activeTabLeft?.content || '')" title="Flow Chart (Ctrl+Shift+G)" v-html="Icons.Git"></button>
          <button class="action-btn" @click="showSplit = !showSplit" :class="{ active: showSplit }" title="Split Screen" v-html="Icons.CompareInline"></button>
        </div>
      </div>

      <div class="editor-view-area" :class="{ 'split-view': showSplit }" @mouseup="handleEditorMouseUp">
        <template v-if="activeTabLeft?.isDiff && activeTabLeft.diffData">
          <div class="diff-editor-pane">
            <VueMonacoDiffEditor 
              :key="activeTabLeft.id" 
              :original="activeTabLeft.diffData.original" 
              :modified="activeTabLeft.diffData.modified"
              :language="getFileLanguage(activeTabLeft.path?.split('.').pop() || '')" 
              :theme="globalTheme === 'dark' ? 'vs-dark' : 'vs-light'" 
              class="monaco-instance" 
            />
          </div>
        </template>
        <template v-else>
          <div class="editor-pane" :class="{ focused: focusedPane === 'left' }" @mousedown="focusedPane = 'left'">
            <VueMonacoEditor 
              v-model:value="activeTabLeft.content" 
              :language="activeTabLeft.language" 
              :theme="globalTheme === 'dark' ? 'vs-dark' : 'vs-light'"
              class="monaco-instance" 
              @mount="handleEditorMount($event, 'left')" 
            />
          </div>
          <div v-if="showSplit" class="editor-pane" :class="{ focused: focusedPane === 'right' }" @mousedown="focusedPane = 'right'">
            <div class="pane-header">
              <select v-model="activeTabIdRight" class="tab-select">
                <optgroup label="Open Tabs">
                  <option v-for="t in tabs" :key="t.id" :value="t.id">{{ t.name }}</option>
                </optgroup>
              </select>
            </div>
            <VueMonacoEditor 
              v-model:value="activeTabRight.content" 
              :language="activeTabRight.language" 
              :theme="globalTheme === 'dark' ? 'vs-dark' : 'vs-light'"
              class="monaco-instance" 
              @mount="handleEditorMount($event, 'right')" 
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-tab-container { display: flex; height: 100%; background: var(--container-bg); }
.activity-bar { width: 48px; background: rgba(0,0,0,0.2); border-right: var(--border-style); display: flex; flex-direction: column; align-items: center; padding-top: 10px; flex-shrink: 0; }
.activity-item { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: var(--text-color); opacity: 0.4; cursor: pointer; transition: 0.2s; position: relative; margin-bottom: 10px; border-radius: 8px; }
.activity-item:hover { opacity: 1; background: rgba(128,128,128,0.1); }
.activity-item.active { opacity: 1; color: var(--accent-color); background: rgba(99, 102, 241, 0.1); }
.sidebar-panel { border-right: none; display: flex; flex-direction: column; background: var(--container-bg); z-index: 10; flex-shrink: 0; }
.sidebar-resizer { width: 4px; cursor: col-resize; background: transparent; transition: background 0.2s; z-index: 20; border-right: var(--border-style); }
.sidebar-resizer:hover, .sidebar-resizer:active { background: var(--accent-color); }
.explorer-header { height: 35px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: var(--border-style); flex-shrink: 0; }
.explorer-title { font-size: 0.65rem; font-weight: 900; opacity: 0.6; letter-spacing: 0.1em; }
.explorer-actions { display: flex; gap: 4px; }
.explorer-icon-btn { background: transparent; border: none; color: var(--text-color); opacity: 0.5; padding: 4px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.explorer-icon-btn:hover { opacity: 1; background: rgba(128,128,128,0.1); }
.danger-hover:hover { color: #f43f5e; }
.explorer-body { flex: 1; overflow-y: auto; padding-top: 10px; }
.explorer-root-label { display: flex; align-items: center; gap: 6px; padding: 4px 12px; cursor: pointer; font-size: 0.72rem; font-weight: 800; transition: background 0.2s; }
.explorer-root-label:hover { background: rgba(128,128,128,0.05); }
.explorer-folder-arrow { display: flex; align-items: center; width: 12px; opacity: 0.4; }
.root-icon { color: var(--accent-color); opacity: 0.8; }
.explorer-empty { padding: 40px 20px; text-align: center; opacity: 0.3; font-style: italic; font-size: 0.7rem; }
.open-folder-btn-minimal { margin-top: 15px; background: var(--accent-color); color: white; border: none; padding: 6px 15px; border-radius: 6px; font-weight: 800; font-size: 0.65rem; cursor: pointer; }
.explorer-footer { height: 28px; border-top: var(--border-style); display: flex; align-items: center; padding: 0 12px; gap: 6px; cursor: pointer; background: rgba(0,0,0,0.1); transition: background 0.2s; }
.explorer-footer:hover { background: rgba(99, 102, 241, 0.1); }
.footer-icon { color: var(--accent-color); }
.footer-branch { font-size: 0.65rem; font-weight: 800; opacity: 0.8; }
.editor-main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.editor-tabs-bar { height: 35px; background: rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; padding-right: 10px; border-bottom: var(--border-style); }
.tabs-scroll-area { flex: 1; display: flex; overflow-x: auto; scrollbar-width: none; height: 100%; }
.tabs-scroll-area::-webkit-scrollbar { display: none; }
.editor-tab { display: flex; align-items: center; gap: 10px; padding: 0 15px; min-width: 100px; max-width: 200px; border-right: var(--border-style); background: rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s; position: relative; }
.editor-tab.active { background: var(--container-bg); border-top: 2px solid var(--accent-color); }
.tab-name { font-size: 0.72rem; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.7; }
.active .tab-name { opacity: 1; }
.tab-close { font-size: 1.1rem; opacity: 0; transition: 0.2s; }
.editor-tab:hover .tab-close { opacity: 0.5; }
.tab-close:hover { opacity: 1; color: #f43f5e; }
.tab-bar-actions { display: flex; gap: 8px; margin-left: 10px; }
.action-btn { background: transparent; border: none; color: var(--text-color); opacity: 0.4; padding: 4px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; }
.action-btn:hover { opacity: 1; }
.action-btn.active { color: var(--accent-color); opacity: 1; }
.editor-view-area { flex: 1; display: flex; overflow: hidden; position: relative; }
.editor-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.split-view .editor-pane:first-child { border-right: var(--border-style); }
.editor-pane.focused { box-shadow: inset 0 0 0 1px var(--accent-color); }
.pane-header { height: 28px; background: rgba(0,0,0,0.1); display: flex; align-items: center; padding: 0 10px; }
.tab-select { background: transparent; border: none; color: var(--text-color); font-size: 0.65rem; font-weight: 800; outline: none; }
.monaco-instance { width: 100%; height: 100%; }
.diff-editor-pane { flex: 1; width: 100%; height: 100%; }
</style>
