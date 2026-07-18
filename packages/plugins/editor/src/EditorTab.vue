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
  globalShortcuts,
  matchShortcut,
  useSettings,
  useFileSystem
} from '@vinx/sdk';

const { searchRepoFiles } = useGit();
const { readFile } = useFileSystem();
const { saveSettings } = useSettings();


// --- Initialization ----------------------------------------------------------
const {
  tabs,
  tabsLeft,
  tabsRight,
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
  closeAllTabs,
  moveToPane,
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
  handleGitCompare,
  onGitSelection,
  switchBranch
} = useEditorFeatures();

// --- Local State -------------------------------------------------------------
const searchQuery = ref('');
const activeSidebar = ref<'explorer' | 'search'>('explorer');
const searchContentQuery = ref('');
const searchContentResults = ref<any[]>([]);
const isSearchingContent = ref(false);

const activeEditorTheme = ref(globalTheme.value === 'dark' ? 'vs-dark' : 'vs-light');
const editors = { left: null as any, right: null as any };

let isNavigatingCursorHistory = false;

// --- Palette state ---
const showFilePalette = ref(false);
const paletteQuery = ref('');
const paletteResults = ref<string[]>([]);
const paletteSelectedIndex = ref(0);
const paletteInput = ref<HTMLInputElement | null>(null);

const searchFiles = async (query: string) => {
    let results: string[] = [];
    if (gitTabRepoPath.value && query.trim()) {
        results = await searchRepoFiles(query);
    }
    
    if (results.length === 0 && projectRoot.value) {
        const q = query.toLowerCase();
        const all: string[] = [];
        const traverse = (node: any) => {
            if (all.length >= 100) return;
            if (hiddenExplorerPaths.value.includes(node.path)) return;
            if (!node.is_dir) {
                const relPath = node.path.substring(projectRootPath.value.length + 1).replace(/\\/g, '/');
                if (!q || relPath.toLowerCase().includes(q) || node.name.toLowerCase().includes(q)) {
                    all.push(relPath);
                }
            } else if (node.children) {
                node.children.forEach(traverse);
            }
        };
        traverse(projectRoot.value);
        results = all;
    }
    return results;
};

watch(showFilePalette, async (val) => {
    if (val) {
        paletteResults.value = await searchFiles(paletteQuery.value);
        paletteSelectedIndex.value = 0;
        nextTick(() => {
            if (paletteInput.value) {
                paletteInput.value.focus();
                paletteInput.value.select();
            }
        });
    }
});

watch(paletteQuery, async (val) => {
    paletteResults.value = await searchFiles(val);
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
    setupEditorTheme();
  }
};

const openFile = async () => {
  const selected = await open({ multiple: true, filters: [{ name: 'All Files', extensions: ['*'] }] });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const p of paths) await openFileByPath(p);
};

const setupEditorTheme = async () => {
    monaco.editor.defineTheme('vinx-dark', {
        base: 'vs-dark', inherit: true, colors: {},
        rules: [
            { token: 'function', foreground: (editorSettings.value?.colors?.function || '#e27a00').replace('#', '') },
            { token: 'entity.name.function', foreground: (editorSettings.value?.colors?.function || '#e27a00').replace('#', '') },
            { token: 'variable', foreground: (editorSettings.value?.colors?.variable || '#2a2a2a').replace('#', '') },
            { token: 'comment', foreground: (editorSettings.value?.colors?.comment || '#3F7F5F').replace('#', '') },
            { token: 'keyword', foreground: (editorSettings.value?.colors?.keyword || '#000080').replace('#', ''), fontStyle: 'bold' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'string', foreground: 'CE9178' }
        ]
    });
    monaco.editor.defineTheme('vinx-light', {
        base: 'vs', inherit: true, colors: {},
        rules: [
            { token: 'function', foreground: (editorSettings.value?.colors?.function || '#e27a00').replace('#', '') },
            { token: 'entity.name.function', foreground: (editorSettings.value?.colors?.function || '#e27a00').replace('#', '') },
            { token: 'variable', foreground: (editorSettings.value?.colors?.variable || '#2a2a2a').replace('#', '') },
            { token: 'comment', foreground: (editorSettings.value?.colors?.comment || '#3F7F5F').replace('#', '') },
            { token: 'keyword', foreground: (editorSettings.value?.colors?.keyword || '#000080').replace('#', ''), fontStyle: 'bold' },
            { token: 'number', foreground: '000000' },
            { token: 'string', foreground: 'bb5352' }
        ]
    });
    activeEditorTheme.value = globalTheme.value === 'dark' ? 'vinx-dark' : 'vinx-light';
    monaco.editor.setTheme(activeEditorTheme.value);
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
  const shortcuts = globalShortcuts.value;

  if (matchShortcut(e, shortcuts.open_file || 'ctrl+p')) {
    e.preventDefault();
    showFilePalette.value = true;
    return;
  }

  if (matchShortcut(e, shortcuts.save_file || 'ctrl+s')) {
    e.preventDefault();
    handleSave();
    return;
  }

  if (matchShortcut(e, shortcuts.close_tab || 'ctrl+w')) {
    e.preventDefault();
    if (currentActiveId.value) {
      removeTab(currentActiveId.value);
    }
    return;
  }

  if (matchShortcut(e, shortcuts.close_all_tabs || 'ctrl+shift+w')) {
    e.preventDefault();
    closeAllTabs();
    return;
  }

  if (matchShortcut(e, shortcuts.new_tab || 'ctrl+n')) {
    e.preventDefault();
    addTab(undefined, undefined, undefined, undefined, focusedPane.value);
    return;
  }

  if (matchShortcut(e, shortcuts.move_tab_left || 'alt+arrowleft')) {
    e.preventDefault();
    if (currentActiveId.value) {
      moveToPane(currentActiveId.value, 'left');
    }
    return;
  }

  if (matchShortcut(e, shortcuts.move_tab_right || 'alt+arrowright')) {
    e.preventDefault();
    if (currentActiveId.value) {
      moveToPane(currentActiveId.value, 'right');
    }
    return;
  }

  // Global Search
  if (matchShortcut(e, shortcuts.global_search || 'ctrl+shift+f')) {
    e.preventDefault();
    activeSidebar.value = 'search';
    showExplorer.value = true;
    nextTick(() => {
        document.getElementById('global-search-input')?.focus();
    });
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey && e.key.toLowerCase() === 'e') { 
      e.preventDefault(); 
      activeSidebar.value = 'explorer'; 
      showExplorer.value = true; 
    }
  }
};

const performGlobalSearch = async () => {
    const root = gitTabRepoPath.value || projectRootPath.value;
    if (!searchContentQuery.value.trim() || !root) return;
    
    isSearchingContent.value = true;
    searchContentResults.value = [];
    
    try {
        // Use git grep with -- to search in current directory
        // Added --ignore-case (-i) and --line-number (-n)
        const raw = await invoke('git_execute', {
            args: ['grep', '-n', '-i', '--fixed-strings', '--context=0', '--untracked', searchContentQuery.value.trim(), '--', '.'],
            cwd: root
        }).catch(err => {
            // git grep returns exit code 1 if no matches are found, which Tauri might treat as an error
            if (err.toString().includes('1') || err.toString().includes('status 1')) {
                return '';
            }
            throw err;
        }) as string;
        
        if (!raw) {
            searchContentResults.value = [];
            return;
        }

        const lines = raw.split('\n').filter(l => l.trim()).slice(0, 500);
        searchContentResults.value = lines.map(line => {
            const firstColon = line.indexOf(':');
            const secondColon = line.indexOf(':', firstColon + 1);
            if (firstColon === -1 || secondColon === -1) return null;
            
            const path = line.substring(0, firstColon);
            const lineNum = parseInt(line.substring(firstColon + 1, secondColon));
            const content = line.substring(secondColon + 1).trim();
            
            return {
                path,
                fullPath: root + '/' + path,
                line: lineNum,
                content
            };
        }).filter(r => r !== null);
    } catch (e) {
        console.error('Global search failed:', e);
        searchContentResults.value = [];
    } finally {
        isSearchingContent.value = false;
    }
};

const handleGlobalSearchClick = (res: any) => {
    openFileByPath(res.fullPath);
};

const handleSidebarClick = (sidebar: 'explorer' | 'search') => {
    activeSidebar.value = sidebar;
    showExplorer.value = true;
    if (sidebar === 'search') {
        nextTick(() => {
            document.getElementById('global-search-input')?.focus();
        });
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

watch(projectRootPath, () => { setupEditorTheme(); });
watch(globalTheme, (nt) => { 
    setupEditorTheme(); 
    if (activeEditorTheme.value !== 'vscode-custom') {
        activeEditorTheme.value = nt === 'dark' ? 'vinx-dark' : 'vinx-light';
    }
    monaco.editor.setTheme(activeEditorTheme.value); 
});

watch(() => editorSettings.value?.colors, () => {
    setupEditorTheme();
    monaco.editor.setTheme(activeEditorTheme.value);
}, { deep: true });

onMounted(async () => { 
    window.addEventListener('keydown', handleKeyDown); 

    // Register BOI Script language if not already registered
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'boi-script')) {
        monaco.languages.register({ id: 'boi-script' });
    }
    
    // Setup Monarch tokenizer for boi-script syntax highlighting
    monaco.languages.setMonarchTokensProvider('boi-script', {
        tokenizer: {
            root: [
                // Comments
                [/\/\/.*$/, 'comment'],
                
                // Functions declaration keyword
                [/\bfunction\b/, 'keyword'],
                
                // Function calls and names
                [/\b[a-zA-Z_]\w*(?=\s*\()/, 'function'],
                
                // Variables (starting with $ or #)
                [/[$\#][a-zA-Z_]\w*/, 'variable'],
                
                // Keywords
                [/\b(if|endif|while|endwhile|return|else)\b/, 'keyword'],
                
                // Numbers
                [/\b\d+\b/, 'number'],
                
                // Strings
                [/"([^"\\]|\\.)*$/, 'string.invalid' ],
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' } ],
            ],
            string: [
                [/[^\\"]+/,  'string'],
                [/\\./,      'string.escape.invalid'],
                [/"/,        { token: 'string.quote', bracket: '@close', next: '@pop' } ]
            ],
        }
    });

    // Configure language settings for correct word selection
    monaco.languages.setLanguageConfiguration('boi-script', {
        wordPattern: /[#$a-zA-Z_]\w*/
    });

    // Register Go to Definition Provider for Ctrl+Click
    monaco.languages.registerDefinitionProvider('boi-script', {
        provideDefinition: (model, position, token) => {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;
            
            const word = wordInfo.word;
            const text = model.getValue();
            const lines = text.split('\n');
            
            let targetLine = -1;
            let targetCol = -1;
            
            // If it's a variable (starts with $ or #)
            if (word.startsWith('$') || word.startsWith('#')) {
                // Escape $ for regex
                const escapedWord = word.replace('$', '\\$').replace('#', '\\#');
                // Find first assignment or declaration, ignoring equality checks (==)
                const regex = new RegExp(`(?:int|string|float)\\s+${escapedWord}\\b|${escapedWord}\\s*=(?!=)`);
                
                // 1. Search locally upwards from the current line
                for (let i = position.lineNumber - 1; i >= 0; i--) {
                    const match = lines[i].match(regex);
                    if (match) {
                        targetLine = i + 1;
                        targetCol = match.index! + 1;
                        break;
                    }
                    // Stop if we hit the function signature (boundary of local scope)
                    if (/^\s*function\b/.test(lines[i])) {
                        break;
                    }
                }
                
                // 2. If not found locally, search globally at the top of the file
                if (targetLine === -1) {
                    for (let i = 0; i < lines.length; i++) {
                        // Stop if we hit the first function (end of global scope)
                        if (/^\s*function\b/.test(lines[i])) {
                            break;
                        }
                        const match = lines[i].match(regex);
                        if (match) {
                            targetLine = i + 1;
                            targetCol = match.index! + 1;
                            break;
                        }
                    }
                }
            } else {
                // Otherwise assume function name
                const regex = new RegExp(`\\bfunction\\s+${word}\\b`);
                for (let i = 0; i < lines.length; i++) {
                    const match = lines[i].match(regex);
                    if (match) {
                        targetLine = i + 1;
                        targetCol = match.index! + 1;
                        break;
                    }
                }
            }
            
            if (targetLine !== -1) {
                return {
                    uri: model.uri,
                    range: new monaco.Range(targetLine, targetCol, targetLine, targetCol + word.length)
                };
            }
            
            return null; // Return null so hover underline doesn't show
        }
    });

    const { refreshSettings } = useSettings();
    await refreshSettings();
    await setupEditorTheme();
});


onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown); });
</script>

<template>
  <div class="editor-tab-container">
    <div class="activity-bar">
      <div class="activity-item" :class="{ active: activeSidebar === 'explorer' && showExplorer }" 
           @click="handleSidebarClick('explorer')" title="Explorer (Ctrl+Shift+E)">
        <span v-html="Icons.Folder"></span>
      </div>
      <div class="activity-item" :class="{ active: activeSidebar === 'search' && showExplorer }" 
           @click="handleSidebarClick('search')" title="Search (Ctrl+Shift+F)">
        <span v-html="Icons.Search"></span>
      </div>
    </div>

    <div v-if="showExplorer" class="sidebar-panel" :style="{ width: sidebarWidth + 'px' }">
      <!-- Explorer Sidebar -->
      <template v-if="activeSidebar === 'explorer'">
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
      </template>

      <!-- Global Search Sidebar -->
      <template v-else-if="activeSidebar === 'search'">
        <div class="explorer-header">
          <span class="explorer-title">SEARCH</span>
        </div>
        <div class="search-sidebar-body">
          <div class="search-input-container">
            <input 
              id="global-search-input"
              v-model="searchContentQuery" 
              class="search-content-input" 
              placeholder="Search in files..." 
              @keydown.enter="performGlobalSearch"
            />
            <button class="search-btn" @click="performGlobalSearch" :disabled="isSearchingContent">
                <span v-if="isSearchingContent" class="spinner-small"></span>
                <span v-else v-html="Icons.Search"></span>
            </button>
          </div>
          <div class="search-results-list">
            <div v-if="searchContentResults.length === 0 && !isSearchingContent" class="no-results">
              {{ searchContentQuery ? 'No results found' : 'Type to search...' }}
            </div>
            <div v-for="(res, idx) in searchContentResults" :key="idx" class="search-result-item" @click="handleGlobalSearchClick(res)">
                <div class="search-result-file">
                    <span class="file-icon" v-html="Icons.File"></span>
                    <span class="file-name">{{ res.path }}</span>
                </div>
                <div class="search-result-preview">
                    <span class="line-number">{{ res.line }}:</span>
                    <span class="content-preview">{{ res.content }}</span>
                </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="sidebar-resizer" v-if="showExplorer" @mousedown="handleSidebarResize"></div>

    <ExplorerContextMenu @open="(node) => openFileByPath(node.path)" @compare="handleExplorerCompare" />
    <TabContextMenu @close-all="closeAllTabs" @move-left="moveToPane($event, 'left')" @move-right="moveToPane($event, 'right')" />
    
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

      <div class="editor-view-area" :class="{ 'split-view': showSplit }" @mouseup="handleEditorMouseUp">
        
        <div class="editor-pane" :class="{ focused: focusedPane === 'left' }" @mousedown="focusedPane = 'left'">
          <div class="editor-tabs-bar" 
               @dblclick="addTab(undefined, undefined, undefined, undefined, 'left')"
               @dragover.prevent 
               @dragenter.prevent 
               @drop="(e) => moveToPane(e.dataTransfer?.getData('text/plain') || '', 'left')">
            <div class="tabs-scroll-area">
              <div v-for="tab in tabsLeft" :key="tab.id" class="editor-tab" :class="{ active: tab.id === activeTabIdLeft, 'is-diff': tab.isDiff }" 
                   @click="currentActiveId = tab.id" @mouseup.middle.prevent="removeTab(tab.id)" @contextmenu.prevent.stop="showTabContextMenu($event, tab)"
                   draggable="true"
                   @dragstart="(e) => e.dataTransfer?.setData('text/plain', tab.id)">
                <span class="tab-name">{{ tab.name }}</span>
                <span class="tab-close" @click.stop="removeTab(tab.id)">&times;</span>
              </div>
            </div>
            <div class="tab-bar-actions" v-if="!showSplit">
              <button class="action-btn" @click="handleSave" title="Save File" v-html="Icons.Save"></button>
              <button class="action-btn" @click="openFile" title="Open File" v-html="Icons.File"></button>
              <button class="action-btn folder-btn" @click="showExplorer = !showExplorer" :class="{ active: showExplorer }" title="Explorer" v-html="Icons.Project"></button>
              <button class="action-btn" @click="showSplit = !showSplit" :class="{ active: showSplit }" title="Split Screen" v-html="Icons.CompareInline"></button>
            </div>
          </div>
          
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
          <template v-else-if="activeTabLeft">
            <VueMonacoEditor 
              v-model:value="activeTabLeft.content" 
              :language="activeTabLeft.language" 
              :theme="activeEditorTheme"
              :options="editorOptions"
              class="monaco-instance" 
              @mount="handleEditorMount($event, 'left')" 
            />
          </template>
        </div>

        <div v-if="showSplit" class="editor-pane" :class="{ focused: focusedPane === 'right' }" @mousedown="focusedPane = 'right'">
          <div class="editor-tabs-bar" 
               @dblclick="addTab(undefined, undefined, undefined, undefined, 'right')"
               @dragover.prevent 
               @dragenter.prevent 
               @drop="(e) => moveToPane(e.dataTransfer?.getData('text/plain') || '', 'right')">
            <div class="tabs-scroll-area">
              <div v-for="tab in tabsRight" :key="tab.id" class="editor-tab" :class="{ active: tab.id === activeTabIdRight, 'is-diff': tab.isDiff }" 
                   @click="currentActiveId = tab.id" @mouseup.middle.prevent="removeTab(tab.id)" @contextmenu.prevent.stop="showTabContextMenu($event, tab)"
                   draggable="true"
                   @dragstart="(e) => e.dataTransfer?.setData('text/plain', tab.id)">
                <span class="tab-name">{{ tab.name }}</span>
                <span class="tab-close" @click.stop="removeTab(tab.id)">&times;</span>
              </div>
            </div>
            <div class="tab-bar-actions">
              <button class="action-btn" @click="handleSave" title="Save File" v-html="Icons.Save"></button>
              <button class="action-btn" @click="openFile" title="Open File" v-html="Icons.File"></button>
              <button class="action-btn folder-btn" @click="showExplorer = !showExplorer" :class="{ active: showExplorer }" title="Explorer" v-html="Icons.Project"></button>
              <button class="action-btn" @click="showSplit = !showSplit" :class="{ active: showSplit }" title="Split Screen" v-html="Icons.CompareInline"></button>
            </div>
          </div>
          
          <template v-if="activeTabRight?.isDiff && activeTabRight.diffData">
            <div class="diff-editor-pane">
              <VueMonacoDiffEditor 
                :key="activeTabRight.id" 
                :original="activeTabRight.diffData.original" 
                :modified="activeTabRight.diffData.modified"
                :language="getFileLanguage(activeTabRight.path?.split('.').pop() || '')" 
                :theme="activeEditorTheme" 
                :options="editorOptions"
                class="monaco-instance" 
              />
            </div>
          </template>
          <template v-else-if="activeTabRight">
            <VueMonacoEditor 
              v-model:value="activeTabRight.content" 
              :language="activeTabRight.language" 
              :theme="activeEditorTheme"
              :options="editorOptions"
              class="monaco-instance" 
              @mount="handleEditorMount($event, 'right')" 
            />
          </template>
        </div>
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
.palette-container { width: 600px; max-width: 90%; background: var(--container-bg); border: 1px solid var(--accent-color); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; height: fit-content; max-height: 400px; }
.palette-input-wrapper { padding: 15px; border-bottom: 1px solid rgba(128,128,128,0.1); display: flex; align-items: center; gap: 12px; }
.palette-input { flex: 1; background: var(--input-bg); border: none; color: var(--text-color); font-size: 0.9rem; outline: none; padding: 6px; border-radius: 4px; }
.palette-results { overflow-y: auto; }
.palette-item { padding: 10px 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-bottom: 1px solid rgba(128,128,128,0.05); transition: 0.2s; }
.palette-item:hover, .palette-item.active { background: rgba(99, 102, 241, 0.15); }
.file-info { display: flex; flex-direction: column; gap: 2px; }
.file-name { font-size: 0.85rem; font-weight: 700; color: var(--text-color); }
.file-path { font-size: 0.65rem; opacity: 0.4; }
.palette-icon { opacity: 0.5; display: flex; }
.search-sidebar-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 10px; }
.search-input-container { display: flex; gap: 4px; margin-bottom: 15px; }
.search-content-input { flex: 1; background: var(--input-bg); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-color); padding: 4px 8px; font-size: 0.75rem; outline: none; }
.search-content-input:focus { border-color: var(--accent-color); }
.search-btn { background: var(--accent-color); color: white; border: none; border-radius: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.search-results-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.no-results { text-align: center; opacity: 0.4; font-size: 0.75rem; margin-top: 20px; }
.search-result-item { padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
.search-result-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
.search-result-file { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 800; opacity: 0.8; margin-bottom: 4px; }
.search-result-preview { font-size: 0.7rem; display: flex; gap: 6px; opacity: 0.6; font-family: monospace; }
.line-number { color: var(--accent-color); font-weight: 800; flex-shrink: 0; }
.content-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.spinner-small { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
