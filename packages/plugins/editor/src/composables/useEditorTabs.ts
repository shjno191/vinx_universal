import { ref, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import {
  triggerOpenDiff,
  triggerEditorReload,
  useFileSystem
} from '@vinx/sdk';

export interface Tab {
  id: string;
  name: string;
  content: string;
  language: string;
  path?: string;
  isModified?: boolean;
  isDiff?: boolean;
  diffData?: { original: string; modified: string };
  pane?: 'left' | 'right';
}

export function useEditorTabs() {
  const { readFile } = useFileSystem();

  // --- State ---
  const tabs = ref<Tab[]>([
    { id: '1', name: 'untitled.s', content: '', language: 'boi-script', pane: 'left' }
  ]);
  const activeTabIdLeft = ref('1');
  const activeTabIdRight = ref('');
  const focusedPane = ref<'left' | 'right'>('left');
  const showSplit = ref(false);
  const syncScroll = ref(false);

  // --- Computed ---
  const activeTabLeft = computed(() => tabs.value.find(t => t.id === activeTabIdLeft.value) || tabs.value.find(t => t.pane === 'left' || !t.pane));
  const activeTabRight = computed(() => tabs.value.find(t => t.id === activeTabIdRight.value) || tabs.value.find(t => t.pane === 'right'));

  const tabsLeft = computed(() => tabs.value.filter(t => !t.pane || t.pane === 'left'));
  const tabsRight = computed(() => tabs.value.filter(t => t.pane === 'right'));

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

  // --- Methods ---
  let untitledCounter = 0;
  const addTab = (name?: string, content = '', language = 'boi-script', path?: string, pane: 'left' | 'right' = 'left') => {
    let finalName = name;
    if (!finalName || finalName === 'untitled.s') {
        finalName = untitledCounter === 0 ? 'untitled.s' : `untitled${untitledCounter}.s`;
        untitledCounter++;
    }

    const id = Date.now().toString() + Math.random();
    tabs.value.push({ id, name: finalName, content, language, path, pane });
    if (pane === 'left') {
        activeTabIdLeft.value = id;
    } else {
        activeTabIdRight.value = id;
    }
    focusedPane.value = pane;
    return id;
  };

  const removeTab = (id: string) => {
    const i = tabs.value.findIndex(t => t.id === id);
    if (i === -1) return;
    tabs.value.splice(i, 1);
    if (tabs.value.length > 0 && currentActiveId.value === id) {
      const remaining = tabs.value.filter(t => t.pane === (focusedPane.value === 'left' ? 'left' : 'right') || !t.pane);
      currentActiveId.value = remaining.length > 0 ? remaining[Math.max(0, remaining.length - 1)].id : '';
    }
    if (activeTabIdRight.value === id) activeTabIdRight.value = '';
    
    // Check if right pane is empty after remove
    if (tabs.value.filter(t => t.pane === 'right').length === 0) {
        showSplit.value = false;
    }
  };

  const closeAllTabs = () => {
    tabs.value = [];
    activeTabIdLeft.value = '';
    activeTabIdRight.value = '';
    showSplit.value = false;
  };

  const moveToPane = (tabId: string, pane: 'left' | 'right') => {
    const tab = tabs.value.find(t => t.id === tabId);
    if (!tab) return;
    tab.pane = pane;
    
    if (pane === 'left') {
      activeTabIdLeft.value = tabId;
      if (activeTabIdRight.value === tabId) {
        const remainingRight = tabs.value.filter(t => t.pane === 'right' && t.id !== tabId);
        activeTabIdRight.value = remainingRight.length > 0 ? remainingRight[remainingRight.length - 1].id : '';
      }
    } else {
      activeTabIdRight.value = tabId;
      if (activeTabIdLeft.value === tabId) {
        const remainingLeft = tabs.value.filter(t => (t.pane === 'left' || !t.pane) && t.id !== tabId);
        activeTabIdLeft.value = remainingLeft.length > 0 ? remainingLeft[remainingLeft.length - 1].id : '';
      }
      showSplit.value = true;
    }
    focusedPane.value = pane;

    // Check if right pane is empty after move
    const rightCount = tabs.value.filter(t => t.pane === 'right').length;
    if (rightCount === 0) {
        showSplit.value = false;
    }
  };

  const openFileByPath = async (path: string) => {
    try {
      const existing = tabs.value.find(t => t.path === path);
      if (existing) {
        currentActiveId.value = existing.id;
        return;
      }

      const content = await readFile(path);
      const name = path.split(/[/\\]/).pop() || path;
      const ext = path.split('.').pop() || '';

      const id = addTab(name, content, getFileLanguage(ext), path, focusedPane.value);
      return id;
    } catch (e) {
      console.error('[EditorTabs] Failed to open file:', e);
    }
  };

  const getFileLanguage = (ext: string): string => {
    const m: Record<string, string> = {
      ts: 'typescript', js: 'javascript', vue: 'html', rs: 'rust',
      py: 'python', json: 'json', md: 'markdown', css: 'css',
      html: 'html', sql: 'sql', s: 'boi-script'
    };
    return m[ext.toLowerCase()] || 'plaintext';
  };

  const saveCurrentFile = async () => {
    const curTab = focusedPane.value === 'left' ? activeTabLeft.value : activeTabRight.value;
    if (!curTab || !curTab.path || curTab.isDiff) return;

    try {
      const data = new TextEncoder().encode(curTab.content);
      await invoke('write_file_binary', { path: curTab.path, data: Array.from(data) });

      // Visual feedback
      const originalName = curTab.name;
      if (!originalName.includes('(Saved)')) {
        curTab.name = `${originalName} (Saved)`;
        setTimeout(() => { curTab.name = originalName; }, 1500);
      }
      return true;
    } catch (e) {
      console.error('[EditorTabs] Save failed:', e);
      return false;
    }
  };

  // --- Watchers ---
  watch(triggerEditorReload, async () => {
    for (const tab of tabs.value) {
      if (tab.path && !tab.isDiff) {
        try {
          tab.content = await readFile(tab.path);
        } catch (e) {
          console.warn(`[EditorTabs] Failed to reload ${tab.path}:`, e);
        }
      }
    }
  });

  watch(triggerOpenDiff, (val) => {
    if (!val) return;
    const { path, name, original, modified, label } = val;
    const tabId = `diff-${path}-${label}`;
    const existing = tabs.value.find(t => t.id === tabId);

    if (existing) {
      activeTabIdLeft.value = existing.id;
      focusedPane.value = 'left';
    } else {
      const newTab: Tab = {
        id: tabId,
        name: `${name} (${label})`,
        content: modified,
        language: getFileLanguage(path.split('.').pop() || ''),
        path: path,
        isDiff: true,
        diffData: { original, modified },
        pane: 'left'
      };
      tabs.value.push(newTab);
      activeTabIdLeft.value = newTab.id;
      focusedPane.value = 'left';
    }
    nextTick(() => { triggerOpenDiff.value = null; });
  });

  return {
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
  };
}
