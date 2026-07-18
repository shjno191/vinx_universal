// Settings management composable (Singleton)
import { ref, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import {
  globalShortcuts,
  editorSettings,
  theme,
  chillSettings,
  loadingTheme,
  triggerSettingsRefresh,
  globalDictionaryPath,
  advancedTranslateGroups,
  hiddenExplorerPaths,
  translateSettings
} from '../store';


export interface Settings {
  theme: string;
  loading_theme: string;
  dictionary_path: string;
  advanced_translate_paths: string[];
  advanced_translate_groups: any[];
  shortcuts: {
    focus_search: string;
    global_search: string;
    open_settings: string;
    open_file: string;
    new_tab: string;
    save_file: string;
    close_tab: string;
    close_all_tabs: string;
    prev_tab: string;
    next_tab: string;
    move_tab_left: string;
    move_tab_right: string;
    quick_open_tabs: string;
  };
  editor: {
    middleClickClose: boolean;
    doubleClickNewTab: boolean;
    mouseNavHistory: boolean;
    indentSize: number;
    insertSpaces: boolean;
    renderWhitespace: boolean;
    colors: {
      function: string;
      variable: string;
      comment: string;
      keyword: string;
    };
  };


  hidden_explorer_paths: string[];
  last_project_root: string;

  last_git_repo: string;
  chill: {
    shortcutSmoke: string;
    shortcutFlick: string;
    burnTimeMinutes: number;
    enableWidget: boolean;
  };
  translate: {
    baseHighlightColor: string;
    techHighlightColor: string;
    composedHighlightColor: string;
  };
}

export const settings = ref<Settings>({
  theme: 'dark',
  loading_theme: 'cute',
  dictionary_path: '',
  advanced_translate_paths: [],
  advanced_translate_groups: [],
  shortcuts: {
    focus_search: 'ctrl+f',
    global_search: 'ctrl+shift+f',
    open_settings: 'ctrl+shift+s',
    open_file: 'ctrl+p',
    new_tab: 'ctrl+n',
    save_file: 'ctrl+s',
    close_tab: 'ctrl+w',
    close_all_tabs: 'ctrl+shift+w',
    prev_tab: 'ctrl+shift+[',
    next_tab: 'ctrl+shift+]',
    move_tab_left: 'alt+arrowleft',
    move_tab_right: 'alt+arrowright',
    quick_open_tabs: 'ctrl+~'
  },
  editor: {
    middleClickClose: true,
    doubleClickNewTab: true,
    mouseNavHistory: true,
    indentSize: 4,
    insertSpaces: true,
    renderWhitespace: false,
    colors: {
      function: '#e27a00',
      variable: '#2a2a2a',
      comment: '#3F7F5F',
      keyword: '#000080'
    }
  },


  hidden_explorer_paths: [],
  last_project_root: '',

  last_git_repo: '',
  chill: {
    shortcutSmoke: 'ctrl+space',
    shortcutFlick: 'ctrl+space+space',
    burnTimeMinutes: 5,
    enableWidget: false
  },
  translate: {
    baseHighlightColor: '#3b82f6',
    techHighlightColor: '#eab308',
    composedHighlightColor: '#10b981'
  }
});

const isRecording = ref<string | null>(null);
const shortcutInputRef = ref<HTMLInputElement | null>(null);

export function useSettings() {
  const currentCategory = ref('general');

  const categories = [
    { id: 'general', name: 'Appearance', icon: 'Settings' },
    { id: 'translate', name: 'Dictionary', icon: 'Globe' },
    { id: 'editor', name: 'Editor', icon: 'Edit3' },
    { id: 'shortcut', name: 'Shortcuts', icon: 'Keyboard' },
    { id: 'chill', name: 'Relaxing', icon: 'Coffee' },
    { id: 'convert', name: 'Converter', icon: 'RefreshCw' },
  ];


  const refreshSettings = async () => {
    try {
      const raw = await invoke('get_settings') as string;
      const s = JSON.parse(raw || '{}');
      if (s && Object.keys(s).length > 0) {
        settings.value = { ...settings.value, ...s };
        if (settings.value.editor && !settings.value.editor.colors) {
            settings.value.editor.colors = { function: '#e27a00', variable: '#2a2a2a', comment: '#3F7F5F', keyword: '#000080' };
        } else if (settings.value.editor && settings.value.editor.colors) {
            const c = settings.value.editor.colors;
            if (!c.keyword) {
                c.keyword = '#000080';
                c.function = '#e27a00';
                c.variable = '#2a2a2a';
                c.comment = '#3F7F5F';
            } else if ((c.function === '#000080' || c.function === '#DCDCAA' || c.function === '#000000') && (c.keyword === '#C586C0' || c.keyword === '#7F0055' || c.keyword === '#000080')) {
                // Migrate from previous defaults
                c.function = '#e27a00';
                c.variable = '#2a2a2a';
                c.comment = '#3F7F5F';
                c.keyword = '#000080';
            }
        }
        globalShortcuts.value = settings.value.shortcuts;
        editorSettings.value = settings.value.editor;
        theme.value = settings.value.theme as 'light' | 'dark' | '95';
        loadingTheme.value = (settings.value.loading_theme || 'cute') as any;
        chillSettings.value = settings.value.chill;
        globalDictionaryPath.value = settings.value.dictionary_path || '';
        
        // Migration: If we have old paths but no groups, create a default group
        const oldPaths = settings.value.advanced_translate_paths || [];
        if (oldPaths.length > 0 && (!settings.value.advanced_translate_groups || settings.value.advanced_translate_groups.length === 0)) {
          const defaultGroup = {
            id: 'default-' + Date.now(),
            name: 'Default Group',
            active: true,
            paths: oldPaths.map((p: string) => ({
              path: p,
              type: (p.toLowerCase().endsWith('.xlsx') || p.toLowerCase().endsWith('.xls')) ? 'file' : 'folder'
            }))
          };
          settings.value.advanced_translate_groups = [defaultGroup];
          // Clear old paths once migrated to avoid duplication
          settings.value.advanced_translate_paths = [];
        }

        advancedTranslateGroups.value = settings.value.advanced_translate_groups || [];
        hiddenExplorerPaths.value = settings.value.hidden_explorer_paths || [];
        if (settings.value.translate) {
          translateSettings.value = settings.value.translate;
        }
      }

    } catch (e) {
      console.error('[useSettings] Failed to get settings:', e);
    }
  };

  const saveSettings = async () => {
    try {
      // Sync back to translateSettings before saving
      if (settings.value.translate) {
        translateSettings.value = { ...settings.value.translate };
      }
      
      await invoke('save_settings', { settings: JSON.stringify(settings.value, null, 2) });
      globalShortcuts.value = settings.value.shortcuts;
      editorSettings.value = settings.value.editor;
      theme.value = settings.value.theme as 'light' | 'dark' | '95';
      loadingTheme.value = (settings.value.loading_theme || 'cute') as any;
      chillSettings.value = settings.value.chill;
      advancedTranslateGroups.value = settings.value.advanced_translate_groups || [];
      settings.value.hidden_explorer_paths = [...hiddenExplorerPaths.value];
      triggerSettingsRefresh.value++;

    } catch (e) {
      console.error('[useSettings] Failed to save settings:', e);
    }
  };

  const openSettingsFile = async () => {
    try {
      await invoke('open_settings_file');
    } catch (e) {
      console.error('[useSettings] Failed to open config folder:', e);
    }
  };

  const pickDictionary = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
      });
      if (selected) {
        settings.value.dictionary_path = Array.isArray(selected) ? selected[0] : selected;
        globalDictionaryPath.value = settings.value.dictionary_path;
        await saveSettings();
      }
    } catch (e) {
      console.error('[useSettings] Failed to pick dictionary:', e);
    }
  };

  const pickAdvancedPath = async (isFolder: boolean = true): Promise<string | null> => {
    try {
      const selected = await open({
        multiple: false,
        directory: isFolder,
        filters: isFolder ? undefined : [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (!settings.value.advanced_translate_paths) {
          settings.value.advanced_translate_paths = [];
        }
        if (!settings.value.advanced_translate_paths.includes(path)) {
          settings.value.advanced_translate_paths.push(path);
          await saveSettings();
        }
        return path;
      }
      return null;
    } catch (e) {
      console.error('[useSettings] Failed to pick advanced translation path:', e);
      return null;
    }
  };

  const removeAdvancedPath = async (index: number) => {
    if (settings.value.advanced_translate_paths) {
      settings.value.advanced_translate_paths.splice(index, 1);
      await saveSettings();
    }
  };

  const addTranslateGroup = async () => {
    if (!settings.value.advanced_translate_groups) settings.value.advanced_translate_groups = [];
    const newGroup = {
      id: 'group-' + Date.now(),
      name: 'New Group ' + (settings.value.advanced_translate_groups.length + 1),
      active: true,
      paths: []
    };
    settings.value.advanced_translate_groups.push(newGroup);
    await saveSettings();
  };

  const removeTranslateGroup = async (groupId: string) => {
    if (!settings.value.advanced_translate_groups) return;
    settings.value.advanced_translate_groups = settings.value.advanced_translate_groups.filter(g => g.id !== groupId);
    await saveSettings();
  };

  const renameTranslateGroup = async (groupId: string, newName: string) => {
    if (!settings.value.advanced_translate_groups) return;
    const group = settings.value.advanced_translate_groups.find(g => g.id === groupId);
    if (group) {
      group.name = newName;
      await saveSettings();
    }
  };

  const toggleGroupActive = async (groupId: string) => {
    if (!settings.value.advanced_translate_groups) return;
    const group = settings.value.advanced_translate_groups.find(g => g.id === groupId);
    if (group) {
      group.active = !group.active;
      await saveSettings();
    }
  };

  const addPathToGroup = async (groupId: string, isFolder: boolean) => {
    if (!settings.value.advanced_translate_groups) return;
    const group = settings.value.advanced_translate_groups.find(g => g.id === groupId);
    if (group) {
      try {
        const selected = await open({
          multiple: false,
          directory: isFolder,
          filters: isFolder ? undefined : [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
        });
        if (selected) {
          const path = Array.isArray(selected) ? selected[0] : selected;
          if (!group.paths.some((p: any) => p.path === path)) {
            group.paths.push({
              path,
              type: isFolder ? 'folder' : 'file'
            });
            await saveSettings();
          }
        }
      } catch (e) {
        console.error('[useSettings] Failed to add path to group:', e);
      }
    }
  };

  const removePathFromGroup = async (groupId: string, pathIndex: number) => {
    if (!settings.value.advanced_translate_groups) return;
    const group = settings.value.advanced_translate_groups.find(g => g.id === groupId);
    if (group && group.paths) {
      group.paths.splice(pathIndex, 1);
      await saveSettings();
    }
  };

  const downloadTemplate = async () => {
    try {
      const chosenPath = await save({
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        defaultPath: 'Dictionary_Template.xlsx'
      });

      if (chosenPath) {
        const data = [
          ['Japanese (JP)', 'English (EN)', 'Vietnamese (VI)'],
          ['こんにちは', 'Hello', 'Xin chào'],
          ['ありがとう', 'Thank you', 'Cảm ơn']
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Dictionary');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const uint8 = new Uint8Array(wbout);

        await invoke('write_file_binary', {
          path: chosenPath,
          data: Array.from(uint8)
        });
      }
    } catch (e) {
      console.error('[useSettings] Failed to save template:', e);
    }
  };

  const startRecording = (key: string) => {
    if (['focus_search', 'open_settings'].includes(key)) return;
    isRecording.value = key;
    nextTick(() => {
      shortcutInputRef.value?.focus();
    });
  };

  const formatShortcut = (str: string) => {
    if (!str) return 'NOT SET';
    return str.split('+').map(part => part.trim().toUpperCase()).join(' + ');
  };

  const handleShortcutKey = (e: KeyboardEvent) => {
    if (!isRecording.value) return;
    e.preventDefault();
    e.stopPropagation();

    const k = e.key.toLowerCase();
    if (k === 'escape') {
      isRecording.value = null;
      return;
    }

    const modifiers = ['control', 'shift', 'alt', 'meta'];
    if (modifiers.includes(k)) return;

    const forbidden = ['capslock', 'tab', 'enter', 'backspace'];
    if (forbidden.includes(k)) return;

    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (!isRecording.value.includes('tab')) return;
    }

    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    if (e.metaKey) parts.push('meta');

    parts.push(k);
    const newShortcut = parts.join('+');

    if (settings.value.shortcuts) {
      (settings.value.shortcuts as any)[isRecording.value] = newShortcut;
      saveSettings();
    }
    isRecording.value = null;
  };

  return {
    currentCategory,
    settings,
    categories,
    isRecording,
    shortcutInputRef,
    refreshSettings,
    saveSettings,
    openSettingsFile,
    pickDictionary,
    pickAdvancedPath,
    removeAdvancedPath,
    addTranslateGroup,
    removeTranslateGroup,
    renameTranslateGroup,
    toggleGroupActive,
    addPathToGroup,
    removePathFromGroup,
    downloadTemplate,
    startRecording,
    formatShortcut,
    handleShortcutKey
  };
}
