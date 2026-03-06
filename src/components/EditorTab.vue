<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as monaco from 'monaco-editor';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import ExplorerNode from './ExplorerNode.vue';
import SourceControl from './SourceControl.vue';
import { projectRootPath, triggerOpenDiff } from '../store';

// --- Common Icons ---
const ChevronRight = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
const ChevronDown = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
const FolderIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>';
const FolderOpenIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"></path></svg>';
const RefreshIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>';
const CloseIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
const ClearIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
const FileOpenIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>';
const ProjectOpenIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>';
const OpenFolderActionIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M12 11v6"></path><path d="M9 14h6"></path></svg>';

// --- Types ---
interface Tab {
  id: string;
  name: string;
  content: string;
  language: string;
  path?: string;
  isModified?: boolean;
  isDiff?: boolean;
  diffData?: { original: string; modified: string };
}

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
  extension: string;
}

// --- State ---
const tabs = ref<Tab[]>([
  { id: '1', name: 'untitled.txt', content: '', language: 'plaintext' }
]);
const activeTabIdLeft = ref('1');
const activeTabIdRight = ref('');
const focusedPane = ref<'left' | 'right'>('left');
const showSplit = ref(false);
const syncScroll = ref(false);
const showExplorer = ref(true); 
const projectRoot = ref<FileNode | null>(null);
const expandedPaths = ref<Set<string>>(new Set());
const searchQuery = ref('');
const activeSidebar = ref<'explorer' | 'git'>('explorer');
const sidebarWidth = ref(260);
const isResizing = ref(false);

const initResize = (e: MouseEvent) => {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;

  const doResize = (moveEvent: MouseEvent) => {
    if (!isResizing.value) return;
    const delta = moveEvent.clientX - startX;
    const newWidth = startWidth + delta;
    if (newWidth > 150 && newWidth < 600) {
      sidebarWidth.value = newWidth;
    }
  };

  const stopResize = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = 'default';
  };

  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
};

const activeTabLeft = computed(() => tabs.value.find(t => t.id === activeTabIdLeft.value) || tabs.value[0]);
const activeTabRight = computed(() => tabs.value.find(t => t.id === activeTabIdRight.value) || tabs.value[0]);
const activeFilePath = computed(() => activeTabLeft.value?.path || '');

const currentTab = computed(() => focusedPane.value === 'left' ? activeTabLeft.value : (activeTabRight.value || activeTabLeft.value));

const currentActiveId = computed({
  get: () => focusedPane.value === 'left' ? activeTabIdLeft.value : (activeTabIdRight.value || activeTabIdLeft.value),
  set: (val: string) => {
    if (focusedPane.value === 'left' || !showSplit.value) {
      activeTabIdLeft.value = val;
    } else {
      activeTabIdRight.value = val;
    }
  }
});

// Watch for diff requests from SourceControl
watch(triggerOpenDiff, (val) => {
  if (!val) return;
  const { path, name, original, modified, label } = val;
  const tabId = `diff-${path}-${label}`;
  const existing = tabs.value.find(t => t.id === tabId);
  if (existing) {
    currentActiveId.value = existing.id;
  } else {
    const newTab: Tab = {
      id: tabId,
      name: `${name} (${label})`,
      content: modified,
      language: getFileLanguage(path.split('.').pop() || ''),
      path: path,
      isDiff: true,
      diffData: { original, modified }
    };
    tabs.value.push(newTab);
    currentActiveId.value = newTab.id;
  }
  // Clear trigger to allow same diff to be re-triggered
  nextTick(() => { triggerOpenDiff.value = null; });
});

const editors = { left: null as any, right: null as any };

// --- Logic ---
const handleEditorMount = (editor: any, pane: 'left' | 'right') => {
  editors[pane] = editor;
  setupCtrlClick(editor);
  editor.onDidFocusEditorText(() => { focusedPane.value = pane; });
  editor.onDidScrollChange((e: any) => {
    if (!syncScroll.value) return;
    const other = editors[pane === 'left' ? 'right' : 'left'];
    if (other) { other.setScrollTop(e.scrollTop); other.setScrollLeft(e.scrollLeft); }
  });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
    generateFlowChart();
  });
};

const openProject = async () => {
  const selected = await open({ directory: true, multiple: false, title: 'Open Project' });
  if (selected && typeof selected === 'string') {
    projectRootPath.value = selected;
    showExplorer.value = true;
    await refreshTree();
  }
};

const openFile = async () => {
  const selected = await open({ 
    multiple: true, 
    filters: [{ name: 'All Files', extensions: ['*'] }] 
  });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const p of paths) {
    try {
      const content = await invoke('read_file_content', { path: p }) as string;
      const name = p.split(/[/\\]/).pop() || p;
      const ext = p.split('.').pop() || '';
      const existing = tabs.value.find(t => t.path === p);
      if (existing) { currentActiveId.value = existing.id; continue; }
      const newTab = { id: Date.now().toString() + Math.random(), name, content, language: getFileLanguage(ext), path: p };
      tabs.value.push(newTab);
      currentActiveId.value = newTab.id;
    } catch (e) { console.error('Open file error:', e); }
  }
};

const refreshTree = async () => {
  if (!projectRootPath.value) return;
  try {
    projectRoot.value = await invoke('read_dir_tree', { path: projectRootPath.value, depth: 8 }) as FileNode;
    if (projectRoot.value && expandedPaths.value.size === 0) {
      expandedPaths.value = new Set([projectRoot.value.path]);
    }
  } catch (e) { console.error(e); }
};

const toggleFolder = (node: FileNode) => {
  if (expandedPaths.value.has(node.path)) expandedPaths.value.delete(node.path);
  else expandedPaths.value.add(node.path);
  expandedPaths.value = new Set(expandedPaths.value);
};

const openFileFromExplorer = async (node: FileNode) => {
  if (node.is_dir) { toggleFolder(node); return; }
  try {
    const existing = tabs.value.find(t => t.path === node.path);
    if (existing) { currentActiveId.value = existing.id; return; }
    const content = await invoke('read_file_content', { path: node.path }) as string;
    const newTab = { id: Date.now().toString(), name: node.name, content, language: getFileLanguage(node.extension), path: node.path };
    tabs.value.push(newTab);
    currentActiveId.value = newTab.id;
  } catch (e) { console.error(e); }
};

const getFileLanguage = (ext: string): string => {
  const m: any = { ts: 'typescript', js: 'javascript', vue: 'html', rs: 'rust', py: 'python', json: 'json', md: 'markdown', css: 'css', html: 'html', sql: 'sql' };
  return m[ext.toLowerCase()] || 'plaintext';
};

const resolveAndOpenPath = async (rawPath: string) => {
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
      const content = await invoke('read_file_content', { path: res }) as string;
      const existing = tabs.value.find(t => t.path === res);
      if (existing) { currentActiveId.value = existing.id; return; }
      tabs.value.push({ id: Date.now().toString(), name: norm.pop()!, content, language: getFileLanguage(res.split('.').pop()!), path: res });
      currentActiveId.value = tabs.value[tabs.value.length-1].id;
      return;
    } catch (_) {}
  }
};

const setupCtrlClick = (editor: any) => {
  editor.onMouseDown((e: any) => {
    if (!e.event.ctrlKey) return;
    const pos = e.target.position;
    if (!pos) return;
    const model = editor.getModel();
    if (!model) return;
    const line = model.getLineContent(pos.lineNumber);
    const m = /(?:from\s+['"]|require\s*\(\s*['"]|import\s*['"])([^'"]+)['"]/.exec(line);
    if (m) { resolveAndOpenPath(m[1]); }
  });
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (e.shiftKey) openProject();
      else openFile();
    }
    if (e.shiftKey) {
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        activeSidebar.value = 'explorer';
        showExplorer.value = true;
      }
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        activeSidebar.value = 'git';
        showExplorer.value = true;
      }
    }
  }
};

onMounted(() => { window.addEventListener('keydown', handleKeyDown); });
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown); });

const addTab = () => {
  tabs.value.push({ id: Date.now().toString(), name: 'untitled.txt', content: '', language: 'plaintext' });
  currentActiveId.value = tabs.value[tabs.value.length-1].id;
};

const removeTab = (id: string) => {
  const i = tabs.value.findIndex(t => t.id === id);
  if (i === -1) return;
  tabs.value.splice(i, 1);
  if (tabs.value.length === 0) {
    tabs.value.push({ id: Date.now().toString(), name: 'untitled.txt', content: '', language: 'plaintext' });
  }
  if (currentActiveId.value === id || tabs.value.length > 0) {
    currentActiveId.value = tabs.value[Math.max(0, i - 1)].id;
  }
  if (activeTabIdRight.value === id) activeTabIdRight.value = '';
};

const generateFlowChart = () => {
  const code = (focusedPane.value === 'left' ? activeTabLeft.value : activeTabRight.value).content;
  currentFlowCode.value = code || '';
  triggerFlowChart.value = true;
};
</script>

<template>
  <div class="editor-tab-container">
    <!-- Activity Bar (VS Code style) -->
    <div class="activity-bar">
      <div 
        class="activity-item" 
        :class="{ active: activeSidebar === 'explorer' && showExplorer }" 
        @click="activeSidebar = 'explorer'; showExplorer = true"
        title="Explorer (Ctrl+Shift+E)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
      </div>
      <div 
        class="activity-item" 
        :class="{ active: activeSidebar === 'git' && showExplorer }" 
        @click="activeSidebar = 'git'; showExplorer = true"
        title="Source Control (Ctrl+Shift+G)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><line x1="18" y1="9" x2="18" y2="12"></line><line x1="6" y1="9" x2="6" y2="12"></line><line x1="12" y1="15" x2="18" y2="12"></line><line x1="12" y1="15" x2="6" y2="12"></line></svg>
      </div>
    </div>

    <transition name="explorer-slide">
      <div v-if="showExplorer" class="sidebar-panel" :style="{ width: sidebarWidth + 'px' }">
        <template v-if="activeSidebar === 'explorer'">
          <div class="explorer-header">
            <span class="explorer-title">EXPLORER</span>
            <div class="explorer-actions">
              <button class="explorer-icon-btn" @click="openProject" title="Open Folder (Ctrl+Shift+O)" v-html="OpenFolderActionIcon"></button>
              <button class="explorer-icon-btn" @click="refreshTree" title="Refresh" v-html="RefreshIcon"></button>
              <button class="explorer-icon-btn" @click="showExplorer = false" title="Close Explorer" v-html="CloseIcon"></button>
            </div>
          </div>
          
          <div class="explorer-search-box">
            <div class="search-input-wrapper">
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Search files..." 
                class="explorer-search-input"
                spellcheck="false"
              />
              <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''" v-html="ClearIcon"></button>
            </div>
          </div>

          <div class="explorer-root-label" v-if="projectRoot" @click="toggleFolder(projectRoot)">
            <span class="explorer-folder-arrow" v-html="expandedPaths.has(projectRoot.path) ? ChevronDown : ChevronRight"></span>
            <span class="root-icon" v-html="expandedPaths.has(projectRoot.path) ? FolderOpenIcon : FolderIcon"></span>
            <span class="explorer-name">{{ projectRoot.name }}</span>
          </div>
          
          <div class="explorer-body">
            <template v-if="projectRoot && (expandedPaths.has(projectRoot.path) || searchQuery)">
              <ExplorerNode
                v-for="child in projectRoot.children"
                :key="child.path"
                :node="child"
                :expanded-paths="expandedPaths"
                :depth="1"
                :search-query="searchQuery"
                :active-path="activeFilePath"
                @open="openFileFromExplorer"
                @toggle="toggleFolder"
              />
            </template>
            <div v-else-if="!projectRoot" class="explorer-empty">
              <p>No project folder open</p>
              <button class="open-folder-btn-minimal" @click="openProject">Open Folder</button>
            </div>
          </div>
        </template>
        <template v-else-if="activeSidebar === 'git'">
          <SourceControl />
        </template>
      </div>
    </transition>

    <div v-if="showExplorer" class="sidebar-resizer" @mousedown="initResize"></div>

    <div class="editor-main-area">
      <div class="editor-tabs-bar" @dblclick="addTab">
        <div class="tabs-scroll-area">
          <div 
            v-for="tab in tabs" 
            :key="tab.id" 
            class="editor-tab" 
            :class="{ active: tab.id === currentActiveId, 'is-diff': tab.isDiff }" 
            @click="currentActiveId = tab.id"
            @mouseup.middle.prevent="removeTab(tab.id)"
          >
            <span class="tab-name">{{ tab.name }}</span>
            <span class="tab-close" @click.stop="removeTab(tab.id)">&times;</span>
          </div>
        </div>
        <div class="tab-bar-actions">
          <button class="action-btn" @click="openFile" title="Open File (Ctrl+O)" v-html="FileOpenIcon"></button>
          <button class="action-btn folder-btn" @click="showExplorer = !showExplorer" :class="{ active: showExplorer }" title="Open Project (Ctrl+Shift+O)" v-html="ProjectOpenIcon"></button>
          <button class="action-btn" @click="generateFlowChart" title="Flow Chart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          </button>
          <button class="action-btn" @click="showSplit = !showSplit" :class="{ active: showSplit }" title="Split Screen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
          </button>
        </div>
      </div>

      <div class="editor-view-area" :class="{ 'split-view': showSplit }">
        <template v-if="currentTab?.isDiff && currentTab.diffData">
          <div class="diff-editor-pane">
            <monaco-diff-editor
              :original="currentTab.diffData.original"
              :modified="currentTab.diffData.modified"
              :language="getFileLanguage(currentTab.path?.split('.').pop() || '')"
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

.activity-bar {
  width: 48px;
  background: rgba(0,0,0,0.2);
  border-right: var(--border-style);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10px;
  flex-shrink: 0;
}

.activity-item {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
  opacity: 0.4;
  cursor: pointer;
  transition: opacity 0.2s, color 0.2s;
  position: relative;
}

.activity-item:hover { opacity: 1; }
.activity-item.active { opacity: 1; color: var(--accent-color); }
.activity-item.active::after {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: var(--accent-color);
}

.sidebar-panel { border-right: none; display: flex; flex-direction: column; background: var(--container-bg); z-index: 10; flex-shrink: 0; }

.sidebar-resizer {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 20;
  border-right: var(--border-style);
}

.sidebar-resizer:hover, .sidebar-resizer:active {
  background: var(--accent-color);
  opacity: 0.5;
}

.editor-main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; box-shadow: -4px 0 15px rgba(0,0,0,0.1); z-index: 5; }

.explorer-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: var(--border-style); height: 40px; }
.explorer-title { font-size: 0.65rem; font-weight: 800; opacity: 0.6; letter-spacing: 1.2px; text-transform: uppercase; }
.explorer-actions { display: flex; gap: 4px; }
.explorer-icon-btn { background: transparent; border: none; color: var(--text-color); cursor: pointer; opacity: 0.5; width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.explorer-icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }

.explorer-search-box { padding: 8px 10px; border-bottom: var(--border-style); }
.search-input-wrapper { position: relative; display: flex; align-items: center; }
.explorer-search-input { width: 100%; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 5px 25px 5px 10px; color: var(--text-color); font-size: 0.75rem; outline: none; transition: border-color 0.2s; }
.explorer-search-input:focus { border-color: var(--accent-color); }
.clear-search { position: absolute; right: 6px; background: transparent; border: none; color: var(--text-color); opacity: 0.4; cursor: pointer; padding: 0 4px; font-size: 0.9rem; }
.clear-search:hover { opacity: 1; }

.explorer-root-label { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; font-size: 0.85rem; font-weight: 700; background: rgba(255,255,255,0.02); border-bottom: var(--border-style); }
.explorer-root-label:hover { background: rgba(255,255,255,0.05); }
.explorer-folder-arrow { 
  font-size: 0.6rem; 
  opacity: 0.4; 
  width: 12px; 
  display: flex; 
  justify-content: center;
}
.root-icon { 
  font-size: 1rem; 
  color: #fbbf24;
  display: flex;
  align-items: center;
}
:root.theme-light .root-icon { color: #d97706; }
.explorer-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.explorer-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding-bottom: 20px; }
.explorer-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.5; padding: 20px; text-align: center; font-size: 0.8rem; }
.open-folder-btn-minimal { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-color); padding: 6px 14px; border-radius: 4px; cursor: pointer; margin-top: 10px; font-size: 0.75rem; }
.open-folder-btn-minimal:hover { background: rgba(255,255,255,0.1); }

.editor-tabs-bar { height: 35px; background: rgba(0,0,0,0.15); display: flex; align-items: center; border-bottom: var(--border-style); padding: 0 10px; flex-shrink: 0; }
.tabs-scroll-area { display: flex; gap: 2px; flex: 1; overflow-x: auto; height: 100%; align-items: center; }
.tabs-scroll-area::-webkit-scrollbar { display: none; }

.editor-tab { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 28px; background: rgba(255,255,255,0.04); border-radius: 4px 4px 0 0; cursor: pointer; font-size: 0.8rem; transition: background 0.2s, opacity 0.2s; white-space: nowrap; max-width: 160px; border: 1px solid transparent; border-bottom: none; }
.editor-tab.active { background: var(--container-bg); border-color: rgba(255,255,255,0.08); opacity: 1; }
.editor-tab.is-diff { border-bottom: 2px solid #f59e0b; }
.editor-tab.is-diff .tab-name { color: #f59e0b; }
.tab-name { overflow: hidden; text-overflow: ellipsis; opacity: 0.7; }
.active .tab-name { opacity: 1; font-weight: 500; }
.tab-close { opacity: 0.3; font-size: 1rem; transition: opacity 0.2s; }
.tab-close:hover { opacity: 1; color: #f87171; }

.tab-bar-actions { display: flex; align-items: center; gap: 4px; padding-left: 10px; border-left: var(--border-style); margin-left: 4px; }
.action-btn { background: transparent; border: none; color: var(--text-color); opacity: 0.5; cursor: pointer; padding: 5px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
.action-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }
.action-btn.active { opacity: 1; color: var(--accent-color); }
.folder-btn { color: #fbbf24; }

.editor-view-area { flex: 1; display: flex; min-height: 0; }
.editor-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.editor-pane.focused { box-shadow: inset 0 0 0 1px var(--accent-color); z-index: 10; }
.monaco-instance { flex: 1; }

.diff-editor-pane { flex: 1; display: flex; flex-direction: column; }
.diff-header { height: 35px; background: rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: space-between; padding: 0 15px; border-bottom: var(--border-style); }
.diff-title { font-size: 0.75rem; font-weight: 600; opacity: 0.8; }
.close-diff { background: transparent; border: none; color: var(--text-color); cursor: pointer; opacity: 0.6; }
.close-diff:hover { opacity: 1; }

.pane-header { height: 32px; background: rgba(0,0,0,0.1); display: flex; align-items: center; padding: 0 10px; border-bottom: var(--border-style); }
.tab-select { background: transparent; border: none; color: var(--text-color); font-size: 0.75rem; width: 100%; outline: none; opacity: 0.7; }

.explorer-slide-enter-active, .explorer-slide-leave-active { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.explorer-slide-enter-from, .explorer-slide-leave-to { width: 0; opacity: 0; }

:root.theme-light .explorer-search-input { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); }
:root.theme-light .editor-tab { background: rgba(0,0,0,0.03); }
:root.theme-light .editor-tab.active { background: #fff; }
</style>