// Settings management composable (Singleton)
import { ref, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import {
  globalShortcuts,
  editorSettings,
  theme,
  aiSettings,
  chillSettings,
  loadingTheme,
  triggerSettingsRefresh,
  globalDictionaryPath,
  advancedTranslatePaths,
  hiddenExplorerPaths
} from '../store';


export interface Settings {
  theme: string;
  loading_theme: string;
  dictionary_path: string;
  advanced_translate_paths: string[];
  shortcuts: {
    focus_search: string;
    open_settings: string;
    open_file: string;
    prev_tab: string;
    next_tab: string;
  };
  editor: {
    middleClickClose: boolean;
    doubleClickNewTab: boolean;
    mouseNavHistory: boolean;
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
  ai: {
    provider: string;
    geminiKey: string;
    geminiModel: string;
    openaiKey: string;
    openaiModel: string;
    claudeKey: string;
    claudeModel: string;
    ollamaUrl: string;
    ollamaModel: string;
  };
}

export const settings = ref<Settings>({
  theme: 'dark',
  loading_theme: 'cute',
  dictionary_path: '',
  advanced_translate_paths: [],
  shortcuts: {
    focus_search: 'ctrl+f',
    open_settings: 'ctrl+shift+s',
    open_file: 'ctrl+o',
    prev_tab: 'ctrl+arrowleft',
    next_tab: 'ctrl+arrowright'
  },
  editor: {
    middleClickClose: true,
    doubleClickNewTab: true,
    mouseNavHistory: true
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
  ai: {
    provider: 'gemini',
    geminiKey: '',
    geminiModel: 'gemini-1.5-flash',
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    claudeKey: '',
    claudeModel: 'claude-3-haiku-20240307',
    ollamaUrl: 'http://localhost:11434/api/generate',
    ollamaModel: 'llama3',
  }
});

const isRecording = ref<string | null>(null);
const shortcutInputRef = ref<HTMLInputElement | null>(null);

export function useSettings() {
  const currentCategory = ref('general');

  const categories = [
    { id: 'general', name: 'Giao diện & Hệ thống', icon: 'Settings' },
    { id: 'translate', name: 'Dictionary & Translate', icon: 'Globe' },
    { id: 'git', name: 'Git Control Tab', icon: 'GitBranch' },
    { id: 'editor', name: 'Editor Tab', icon: 'Edit3' },
    { id: 'shortcut', name: 'Phím tắt bàn phím', icon: 'Keyboard' },
    { id: 'ai', name: 'AI Service (Flowchart)', icon: 'Cpu' },
    { id: 'chill', name: 'Smoking Tab', icon: 'Coffee' },
    { id: 'convert', name: 'Convert UI Tab', icon: 'RefreshCw' },
  ];

  const refreshSettings = async () => {
    try {
      const raw = await invoke('get_settings') as string;
      const s = JSON.parse(raw || '{}');
      if (s && Object.keys(s).length > 0) {
        settings.value = { ...settings.value, ...s };
        globalShortcuts.value = settings.value.shortcuts;
        editorSettings.value = settings.value.editor;
        theme.value = settings.value.theme as 'light' | 'dark' | '95';
        loadingTheme.value = (settings.value.loading_theme || 'cute') as any;
        aiSettings.value = settings.value.ai as any;
        chillSettings.value = settings.value.chill;
        globalDictionaryPath.value = settings.value.dictionary_path || '';
        advancedTranslatePaths.value = settings.value.advanced_translate_paths || [];
        hiddenExplorerPaths.value = settings.value.hidden_explorer_paths || [];
      }

    } catch (e) {
      console.error('[useSettings] Failed to get settings:', e);
    }
  };

  const saveSettings = async () => {
    try {
      await invoke('save_settings', { settings: JSON.stringify(settings.value, null, 2) });
      globalShortcuts.value = settings.value.shortcuts;
      editorSettings.value = settings.value.editor;
      theme.value = settings.value.theme as 'light' | 'dark' | '95';
      loadingTheme.value = (settings.value.loading_theme || 'cute') as any;
      aiSettings.value = settings.value.ai as any;
      chillSettings.value = settings.value.chill;
      advancedTranslatePaths.value = settings.value.advanced_translate_paths || [];
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

  const pickAdvancedPath = async (): Promise<string | null> => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        if (!settings.value.advanced_translate_paths) {
          settings.value.advanced_translate_paths = [];
        }
        if (!settings.value.advanced_translate_paths.includes(path)) {
          settings.value.advanced_translate_paths.push(path);
          advancedTranslatePaths.value = [...settings.value.advanced_translate_paths];
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
      advancedTranslatePaths.value = [...settings.value.advanced_translate_paths];
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
    downloadTemplate,
    startRecording,
    formatShortcut,
    handleShortcutKey
  };
}
