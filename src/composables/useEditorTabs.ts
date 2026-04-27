import { ref, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import {
  triggerOpenDiff,
  triggerEditorReload
} from '../store';
import { useFileSystem } from './useFileSystem';

export interface Tab {
  id: string;
  name: string;
  content: string;
  language: string;
  path?: string;
  isModified?: boolean;
  isDiff?: boolean;
  diffData?: { original: string; modified: string };
}

export function useEditorTabs() {
  const { readFile } = useFileSystem();

  // --- State ---
  const tabs = ref<Tab[]>([
    { id: '1', name: 'untitled.txt', content: '', language: 'plaintext' }
  ]);
  const activeTabIdLeft = ref('1');
  const activeTabIdRight = ref('');
  const focusedPane = ref<'left' | 'right'>('left');
  const showSplit = ref(false);
  const syncScroll = ref(false);

  // --- Computed ---
  const activeTabLeft = computed(() => tabs.value.find(t => t.id === activeTabIdLeft.value) || tabs.value[0]);
  const activeTabRight = computed(() => tabs.value.find(t => t.id === activeTabIdRight.value) || tabs.value[0]);

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
  const addTab = (name = 'untitled.txt', content = '', language = 'plaintext', path?: string) => {
    const id = Date.now().toString() + Math.random();
    tabs.value.push({ id, name, content, language, path });
    currentActiveId.value = id;
    return id;
  };

  const removeTab = (id: string) => {
    const i = tabs.value.findIndex(t => t.id === id);
    if (i === -1) return;
    tabs.value.splice(i, 1);
    if (tabs.value.length === 0) {
      addTab();
    } else if (currentActiveId.value === id) {
      currentActiveId.value = tabs.value[Math.max(0, i - 1)].id;
    }
    if (activeTabIdRight.value === id) activeTabIdRight.value = '';
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

      const id = addTab(name, content, getFileLanguage(ext), path);
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
        diffData: { original, modified }
      };
      tabs.value.push(newTab);
      activeTabIdLeft.value = newTab.id;
      focusedPane.value = 'left';
    }
    nextTick(() => { triggerOpenDiff.value = null; });
  });

  return {
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
  };
}
