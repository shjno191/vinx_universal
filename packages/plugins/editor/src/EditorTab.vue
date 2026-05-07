<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as monaco from 'monaco-editor';
import { VueMonacoEditor, VueMonacoDiffEditor, loader } from '@guolao/vue-monaco-editor';

// Thống nhất instance Monaco để các ngôn ngữ/theme đã đăng ký có hiệu lực
loader.config({ monaco });

import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

// Composables & Utils
import { useEditorTabs, type Tab } from './composables/useEditorTabs';
import { useExplorer } from './composables/useExplorer';
import { useEditorFeatures } from './composables/useEditorFeatures';
import { useGit } from '@vinx/sdk';

// Sub-components
import ExplorerNode from './components/ExplorerNode.vue';
import ExplorerContextMenu from './components/ExplorerContextMenu.vue';
import TabContextMenu from './components/TabContextMenu.vue';
import GitSelectionModal from './components/GitSelectionModal.vue';
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
  editorSettings,
  hiddenExplorerPaths,
  selectedExplorerPaths,
  lastSelectedPath,
  Icons,
  boiMonarch,
  useSettings,
  useFileSystem
} from '@vinx/sdk';

const { searchRepoFiles } = useGit();
const { readFile } = useFileSystem();
const { saveSettings } = useSettings();


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

const activeEditorTheme = ref(globalTheme.value === 'dark' ? 'vs-dark' : 'vs-light');
const editors = { left: null as any, right: null as any };

let isNavigatingCursorHistory = false;

// --- Palette state ---
const showFilePalette = ref(false);
const paletteQuery = ref('');
const paletteResults = ref<string[]>([]);
const paletteSelectedIndex = ref(0);
const paletteInput = ref<HTMLInputElement | null>(null);

watch(showFilePalette, (val) => {
    if (val) {
        nextTick(() => {
            paletteInput.value?.focus();
        });
    }
});

watch(paletteQuery, async (val) => {
    paletteResults.value = await searchRepoFiles(val);
    paletteSelectedIndex.value = 0;
});

// Watch for editor settings changes (indentation, etc.)
watch(() => editorSettings.value, (newSettings) => {
    Object.values(editors).forEach(editor => {
        if (editor) {
            editor.updateOptions({
                tabSize: newSettings.indentSize,
                insertSpaces: newSettings.insertSpaces,
                renderWhitespace: newSettings.renderWhitespace ? 'all' : 'selection'
            });
        }
    });
}, { deep: true });



const isHiddenGroupExpanded = ref(false);

const visibleChildren = computed(() => {
  if (!projectRoot.value || !projectRoot.value.children) return [];
  return projectRoot.value.children.filter(child => !hiddenExplorerPaths.value.includes(child.path));
});

const hiddenNodes = computed(() => {
  if (!projectRoot.value) return [];
  const list: any[] = [];
  const findHidden = (node: any) => {
    if (hiddenExplorerPaths.value.includes(node.path)) {
      list.push(node);
      return; // Stop recursion for hidden items
    }
    if (node.children) {
      node.children.forEach(findHidden);
    }
  };
  if (projectRoot.value.children) {
    projectRoot.value.children.forEach(findHidden);
  }
  return list;
});

const handleUnhide = (path: string) => {
  hiddenExplorerPaths.value = hiddenExplorerPaths.value.filter(p => p !== path);
};


// --- Computed ----------------------------------------------------------------
const currentBranchName = computed(() => gitBranches.value.find(b => b.isCurrent)?.name || '');

const editorOptions = computed(() => ({
    tabSize: editorSettings.value.indentSize,
    insertSpaces: editorSettings.value.insertSpaces,
    renderWhitespace: editorSettings.value.renderWhitespace ? 'all' : 'selection',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    minimap: { enabled: true }
}));


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
    loadVSCodeTheme();
  }
};

const openFile = async () => {
  const selected = await open({ multiple: true, filters: [{ name: 'All Files', extensions: ['*'] }] });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const p of paths) await openFileByPath(p);
};

const loadVSCodeTheme = async () => {
    if (!projectRootPath.value) return;
    try {
        const settingsPath = `${projectRootPath.value}/.vscode/settings.json`;
        const content = await readFile(settingsPath);
        const settings = JSON.parse(content);
        const customizations = settings['editor.tokenColorCustomizations'];
        
        if (customizations) {
            const rules: any[] = [];
            
            // 1. Basic Colors Mapping (Legacy Support)
            if (customizations.functions) {
                rules.push({ token: 'function', foreground: customizations.functions });
                rules.push({ token: 'entity.name.function', foreground: customizations.functions });
            }
            if (customizations.keywords) {
                rules.push({ token: 'keyword', foreground: customizations.keywords });
            }
            if (customizations.variables) {
                rules.push({ token: 'variable', foreground: customizations.variables });
            }
            if (customizations.strings) {
                rules.push({ token: 'string', foreground: customizations.strings });
            }
            if (customizations.comments) {
                rules.push({ token: 'comment', foreground: customizations.comments });
            }

            // 2. TextMate Rules Mapping (Advanced Support)
            if (customizations.textMateRules && Array.isArray(customizations.textMateRules)) {
                customizations.textMateRules.forEach((rule: any) => {
                    const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
                    const foreground = rule.settings?.foreground;
                    const fontStyle = rule.settings?.fontStyle;
                    
                    if (foreground || fontStyle) {
                        scopes.forEach((scope: string) => {
                            if (!scope) return;
                            
                            // Map common TM scopes to Monaco tokens
                            let monacoToken = scope.split('.')[0]; 
                            
                            // Advanced mapping for functions to ensure they match Monarch tokens
                            const functionScopes = [
                                'entity.name.function', 
                                'support.function', 
                                'meta.function-call', 
                                'variable.function',
                                'meta.method.declaration',
                                'meta.function.definition'
                            ];
                            
                            if (functionScopes.some(fs => scope.includes(fs))) {
                                monacoToken = 'function';
                            }
                            
                            if (scope.includes('entity.name.type')) monacoToken = 'type.identifier';
                            if (scope.includes('constant.numeric')) monacoToken = 'number';
                            if (scope.includes('constant.language')) monacoToken = 'keyword';
                            if (scope.includes('storage.type')) monacoToken = 'keyword';

                            const ruleObj: any = { token: monacoToken };
                            if (foreground) ruleObj.foreground = foreground;
                            if (fontStyle) {
                                if (fontStyle.includes('bold')) ruleObj.fontStyle = 'bold';
                                if (fontStyle.includes('italic')) ruleObj.fontStyle = (ruleObj.fontStyle || '') + ' italic';
                                if (fontStyle.includes('underline')) ruleObj.fontStyle = (ruleObj.fontStyle || '') + ' underline';
                            }
                            rules.push(ruleObj);
                        });
                    }
                });
            }

            console.log('[Theme] Generated Rules:', rules);
            monaco.editor.defineTheme('vscode-custom', {
                base: globalTheme.value === 'dark' ? 'vs-dark' : 'vs',
                inherit: true,
                rules: rules,
                colors: {}
            });
            monaco.editor.setTheme('vscode-custom');
            activeEditorTheme.value = 'vscode-custom';

        } else {
            activeEditorTheme.value = globalTheme.value === 'dark' ? 'vs-dark' : 'vs-light';
            monaco.editor.setTheme(globalTheme.value === 'dark' ? 'vs-dark' : 'vs');
        }
    } catch (e) {
        // Silently fail if file doesn't exist or JSON is invalid
        activeEditorTheme.value = globalTheme.value === 'dark' ? 'vs-dark' : 'vs-light';
        monaco.editor.setTheme(globalTheme.value === 'dark' ? 'vs-dark' : 'vs');
    }
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
    if (e.key.toLowerCase() === 'p') { e.preventDefault(); showFilePalette.value = true; paletteQuery.value = ''; }
    if (e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); activeSidebar.value = 'explorer'; showExplorer.value = true; }
  }
};

const handlePaletteKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        paletteSelectedIndex.value = (paletteSelectedIndex.value + 1) % paletteResults.value.length;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        paletteSelectedIndex.value = (paletteSelectedIndex.value - 1 + paletteResults.value.length) % paletteResults.value.length;
    } else if (e.key === 'Enter') {
        if (paletteResults.value[paletteSelectedIndex.value]) {
            openFileByPath(projectRootPath.value + '/' + paletteResults.value[paletteSelectedIndex.value]);
            showFilePalette.value = false;
        }
    } else if (e.key === 'Escape') {
        showFilePalette.value = false;
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

const handleExplorerSelect = (node: any, e: MouseEvent) => {
  if (e.shiftKey && lastSelectedPath.value) {
    // Range selection
    const allNodes: any[] = [];
    const flatten = (n: any) => {
      if (hiddenExplorerPaths.value.includes(n.path)) return;
      allNodes.push(n);
      if (n.is_dir && expandedPaths.value.has(n.path) && n.children) {
        n.children.forEach(flatten);
      }
    };
    if (projectRoot.value) flatten(projectRoot.value);

    const idx1 = allNodes.findIndex(n => n.path === lastSelectedPath.value);
    const idx2 = allNodes.findIndex(n => n.path === node.path);
    if (idx1 !== -1 && idx2 !== -1) {
      const start = Math.min(idx1, idx2);
      const end = Math.max(idx1, idx2);
      for (let i = start; i <= end; i++) {
        selectedExplorerPaths.value.add(allNodes[i].path);
      }
    }
  } else if (e.ctrlKey || e.metaKey) {
    // Multi-select toggle
    if (selectedExplorerPaths.value.has(node.path)) {
      selectedExplorerPaths.value.delete(node.path);
    } else {
      selectedExplorerPaths.value.add(node.path);
    }
    lastSelectedPath.value = node.path;
  } else {
    // Single select
    selectedExplorerPaths.value.clear();
    selectedExplorerPaths.value.add(node.path);
    lastSelectedPath.value = node.path;
  }
};

// Auto-save hidden paths to system settings
watch(hiddenExplorerPaths, () => {
    saveSettings();
}, { deep: true });

// Layout refresh for Monaco when UI layout changes
watch([showExplorer, showSplit, sidebarWidth], () => {
  nextTick(() => {
    editors.left?.layout();
    editors.right?.layout();
  });
});

watch(projectRootPath, () => { loadVSCodeTheme(); });
watch(globalTheme, (nt) => { 
    loadVSCodeTheme(); 
    if (activeEditorTheme.value !== 'vscode-custom') {
        activeEditorTheme.value = nt === 'dark' ? 'vs-dark' : 'vs-light';
    }
    monaco.editor.setTheme(nt === 'dark' ? 'vs-dark' : 'vs'); 
});

onMounted(async () => { 
    window.addEventListener('keydown', handleKeyDown); 

    // Register BOI Script language if not already registered
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'boi-script')) {
        monaco.languages.register({ id: 'boi-script' });
        monaco.languages.setMonarchTokensProvider('boi-script', boiMonarch);
    }

    const { refreshSettings } = useSettings();
    await refreshSettings();
    await loadVSCodeTheme();
});


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
            v-for="child in visibleChildren"
            :key="child.path"
            :node="child"
            :expanded-paths="expandedPaths"
            :depth="1"
            :search-query="searchQuery"
            :active-path="activeTabLeft?.path || activeTabRight?.path"
            @open="(node) => node.is_dir ? toggleFolder(node) : openFileByPath(node.path)"
            @toggle="toggleFolder"
            @select="handleExplorerSelect"
          />

        </template>

        <!-- HIDDEN GROUP -->
        <div v-if="projectRoot && hiddenNodes.length > 0" class="hidden-group">
          <div class="hidden-header" @click="isHiddenGroupExpanded = !isHiddenGroupExpanded">
            <span class="explorer-folder-arrow" v-html="isHiddenGroupExpanded ? Icons.ChevronDown : Icons.ChevronRight"></span>
            <span class="hidden-label">HIDDEN ({{ hiddenNodes.length }})</span>
          </div>
          <div v-if="isHiddenGroupExpanded" class="hidden-content">
            <div v-for="node in hiddenNodes" :key="node.path" class="hidden-item">
              <span class="node-icon" :class="node.is_dir ? 'icon-folder' : 'icon-file'" v-html="node.is_dir ? Icons.Folder : Icons.File"></span>
              <span class="hidden-name" @click="node.is_dir ? toggleFolder(node) : openFileByPath(node.path)">{{ node.name }}</span>
              <button class="unhide-btn" title="Unhide" @click.stop="handleUnhide(node.path)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
        </div>
        
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

    <!-- Command Palette -->
    <Teleport to="body">
        <transition name="fade">
            <div v-if="showFilePalette" class="palette-backdrop" @click.self="showFilePalette = false">
                <div class="palette-container glass-effect">
                    <div class="palette-input-wrapper">
                        <span class="palette-icon" v-html="Icons.Search"></span>
                        <input 
                            ref="paletteInput"
                            v-model="paletteQuery" 
                            class="palette-input" 
                            placeholder="Search files..." 
                            autofocus
                            @keydown="handlePaletteKeyDown"
                        />
                    </div>
                    <div v-if="paletteResults.length > 0" class="palette-results">
                        <div 
                            v-for="(res, idx) in paletteResults" 
                            :key="res" 
                            class="palette-item"
                            :class="{ active: idx === paletteSelectedIndex }"
                            @click="openFileByPath(projectRootPath + '/' + res); showFilePalette = false"
                        >
                            <span class="file-icon" v-html="Icons.File"></span>
                            <div class="file-info">
                                <div class="file-name">{{ res.split('/').pop() }}</div>
                                <div class="file-path">{{ res }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
    </Teleport>

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
              :theme="activeEditorTheme" 
              :options="editorOptions"
              class="monaco-instance" 
            />


          </div>
        </template>
        <template v-else>
          <div class="editor-pane" :class="{ focused: focusedPane === 'left' }" @mousedown="focusedPane = 'left'">
            <VueMonacoEditor 
              v-model:value="activeTabLeft.content" 
              :language="activeTabLeft.language" 
              :theme="activeEditorTheme"
              :options="editorOptions"
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
              :theme="activeEditorTheme"
              :options="editorOptions"
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

/* HIDDEN GROUP STYLES */
.hidden-group { border-top: 1px solid rgba(128,128,128,0.05); margin-top: 10px; }
.hidden-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; opacity: 0.35; transition: 0.2s; font-size: 0.65rem; font-weight: 950; }
.hidden-header:hover { opacity: 0.8; background: rgba(255,255,255,0.03); }
.hidden-label { letter-spacing: 0.08em; }
.hidden-content { display: flex; flex-direction: column; padding-bottom: 20px; }
.hidden-item { display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 15px 0 34px; font-size: 0.75rem; opacity: 0.5; transition: 0.2s; cursor: pointer; }
.hidden-item:hover { opacity: 1; background: rgba(255,255,255,0.05); }
.hidden-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unhide-btn { background: transparent; border: none; padding: 4px; color: var(--accent-color); cursor: pointer; opacity: 0; transition: 0.2s; display: flex; }
.hidden-item:hover .unhide-btn { opacity: 1; }
.icon-folder { color: #fbbf24; }
.icon-file { color: #60a5fa; }

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
.editor-tabs-bar { min-height: 35px; height: auto; background: rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: flex-start; padding-right: 10px; border-bottom: var(--border-style); }
.tabs-scroll-area { flex: 1; display: flex; flex-wrap: wrap; overflow-x: visible; height: auto; }
.tabs-scroll-area::-webkit-scrollbar { display: none; }
.editor-tab { display: flex; align-items: center; gap: 10px; padding: 0 15px; height: 35px; border-right: var(--border-style); border-bottom: var(--border-style); background: rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s; position: relative; flex-shrink: 0; }
.editor-tab.active { background: var(--container-bg); border-top: 2px solid var(--accent-color); height: 34px; }
.tab-name { font-size: 0.72rem; font-weight: 650; white-space: nowrap; opacity: 0.7; }
.active .tab-name { opacity: 1; }
.tab-close { font-size: 1.1rem; opacity: 0; transition: 0.2s; }
.editor-tab:hover .tab-close { opacity: 0.5; }
.tab-close:hover { opacity: 1; color: #f43f5e; }
.tab-bar-actions { display: flex; gap: 8px; margin-left: 10px; padding-top: 5px; }
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

/* Command Palette */
.palette-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; padding-top: 10vh; z-index: 10000; }
.palette-container { width: 600px; max-width: 90%; background: #1a1b1e; border: 1px solid var(--accent-color); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; height: fit-content; max-height: 400px; }
.palette-input-wrapper { padding: 15px; border-bottom: 1px solid rgba(128,128,128,0.1); display: flex; align-items: center; gap: 12px; }
.palette-input { flex: 1; background: transparent; border: none; color: var(--text-color); font-size: 0.9rem; outline: none; }
.palette-results { overflow-y: auto; }
.palette-item { padding: 10px 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-bottom: 1px solid rgba(128,128,128,0.05); transition: 0.2s; }
.palette-item:hover, .palette-item.active { background: rgba(99, 102, 241, 0.15); }
.file-info { display: flex; flex-direction: column; gap: 2px; }
.file-name { font-size: 0.85rem; font-weight: 700; color: var(--text-color); }
.file-path { font-size: 0.65rem; opacity: 0.4; }
.palette-icon { opacity: 0.5; display: flex; }
</style>
