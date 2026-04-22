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
  triggerSettingsRefresh 
} from '../store';

export function useSettings() {
  const currentCategory = ref('general');
  const settings = ref({
    theme: 'dark',
    dictionary_path: '',
    advanced_translate_paths: [] as string[],
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

  const categories = [
    { id: 'general', name: 'General', icon: 'Settings' },
    { id: 'translate', name: 'Globe', icon: 'Globe' },
    { id: 'editor', name: 'Editor', icon: 'Edit3' },
    { id: 'shortcut', name: 'Shortcut', icon: 'Keyboard' },
    { id: 'ai', name: 'AI', icon: 'Cpu' },
    { id: 'chill', name: 'Chill', icon: 'Coffee' },
    { id: 'convert', name: 'Convert UI', icon: 'RefreshCw' },
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
        aiSettings.value = settings.value.ai as any;
        chillSettings.value = settings.value.chill;
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
      aiSettings.value = settings.value.ai as any;
      chillSettings.value = settings.value.chill;
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
        await saveSettings();
      }
    } catch (e) {
      console.error('[useSettings] Failed to pick dictionary:', e);
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
    downloadTemplate,
    startRecording,
    formatShortcut,
    handleShortcutKey
  };
}
