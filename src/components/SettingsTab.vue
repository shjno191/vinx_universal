<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import { globalShortcuts, showSettingsTrigger, editorSettings, theme, aiSettings, chillSettings, triggerSettingsRefresh } from '../store';

const emit = defineEmits(['theme-changed']);

const categories = [
  { id: 'general', name: 'General', icon: '\u2699\uFE0F' },
  { id: 'translate', name: 'Translate', icon: '\u{1F310}' },
  { id: 'editor', name: 'Editor', icon: '\u{1F4DD}' },
  { id: 'shortcut', name: 'Shortcut', icon: '\u2328\uFE0F' },
  { id: 'ai', name: 'AI', icon: '\u{1F916}' },
  { id: 'chill', name: 'Chill', icon: '\u{1F6AC}' },
  { id: 'convert', name: 'Convert UI', icon: '\u{1F504}' },
];

const currentCategory = ref('general');
const settings = ref({
  theme: 'dark',
  dictionary_path: '',
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

const startRecording = (key: string) => {
  isRecording.value = key;
  nextTick(() => {
    if (shortcutInputRef.value) {
      shortcutInputRef.value.focus();
    }
  });
};

const formatShortcut = (str: string) => {
  if (!str) return 'NOT SET';
  return str.split('+').map(part => {
    const p = part.trim().toUpperCase();
    if (p === 'CTRL') return 'CTRL';
    if (p === 'SHIFT') return 'SHIFT';
    if (p === 'ALT') return 'ALT';
    return p;
  }).join(' + ');
};

const handleShortcutKey = (key: string, e: KeyboardEvent) => {
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

const refreshSettings = async () => {
  try {
    const s = await invoke('get_settings') as any;
    settings.value = s;
    globalShortcuts.value = s.shortcuts;
    editorSettings.value = s.editor;
    theme.value = s.theme;
    aiSettings.value = s.ai;
    chillSettings.value = s.chill;
  } catch (e) {
    console.error('Failed to get settings:', e);
  }
};

onMounted(() => {
  refreshSettings();
});

const saveSettings = async () => {
  try {
    await invoke('save_settings', { settings: settings.value });
    globalShortcuts.value = settings.value.shortcuts;
    editorSettings.value = settings.value.editor;
    theme.value = settings.value.theme;
    aiSettings.value = settings.value.ai;
    chillSettings.value = settings.value.chill;
    triggerSettingsRefresh.value++;
    emit('theme-changed', settings.value.theme);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

const openSettingsFile = async () => {
  try {
    await invoke('open_settings_file');
  } catch (e) {
    console.error('Failed to open settings file:', e);
  }
};

const pickDictionary = async () => {
  try {
    const selected = await openDialog({
      multiple: false,
      filters: [{
        name: 'Excel',
        extensions: ['xlsx', 'xls']
      }]
    });
    if (selected) {
      settings.value.dictionary_path = Array.isArray(selected) ? selected[0] : selected;
      saveSettings();
    }
  } catch (e) {
    console.error('Failed to pick dictionary:', e);
  }
};

const downloadTemplate = async () => {
  try {
    const chosenPath = await save({
      filters: [{
        name: 'Excel',
        extensions: ['xlsx']
      }],
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
      alert('Template saved successfully!');
    }
  } catch (e) {
    console.error('Failed to save template:', e);
  }
};

defineExpose({
  refreshSettings,
  openSettingsFile,
  downloadTemplate
});

watch(showSettingsTrigger, (val) => {
  if (val && val.category) {
    currentCategory.value = val.category as any;
  }
});
</script>

<template>
  <div class="settings-layout">
    <aside class="settings-sidebar">
      <button v-for="cat in categories" :key="cat.id" class="category-btn" :class="{ active: currentCategory === cat.id }" @click="currentCategory = cat.id as any">
        <span class="category-icon">{{ cat.icon }}</span>
        {{ cat.name }}
      </button>
    </aside>

    <main v-if="settings && settings.editor" class="settings-content">
      <div v-show="currentCategory === 'general'" class="settings-section">
        <div class="setting-item">
          <label>Theme</label>
          <select v-model="settings.theme" class="theme-select" @change="saveSettings">
            <option value="dark">Dark Mode</option>
            <option value="light">Light Mode</option>
            <option value="95">Windows 95</option>
          </select>
        </div>

        <div class="setting-item-vertical">
          <label>Translation Dictionary (.xlsx)</label>
          <div class="path-picker">
            <input v-model="settings.dictionary_path" type="text" class="text-input path-input" readonly placeholder="No dictionary selected..." />
            <button class="save-all-btn" @click="pickDictionary">Browse</button>
          </div>
          <div class="helper-actions">
             <button class="text-link-btn" @click="downloadTemplate">Download Template</button>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Open Config Folder</label>
          <button class="save-all-btn" @click="openSettingsFile">Open Folder</button>
        </div>
      </div>

      <div v-show="currentCategory === 'editor'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Editor Behavior</label>
          <div class="setting-checkbox-list">
            <label class="checkbox-container">
              <input type="checkbox" v-model="settings.editor.middleClickClose" @change="saveSettings" />
              <span class="checkmark"></span>
              Middle click to close tab
            </label>
            <label class="checkbox-container">
              <input type="checkbox" v-model="settings.editor.doubleClickNewTab" @change="saveSettings" />
              <span class="checkmark"></span>
              Double click bar to open new tab
            </label>
            <label class="checkbox-container">
              <input type="checkbox" v-model="settings.editor.mouseNavHistory" @change="saveSettings" />
              <span class="checkmark"></span>
              Mouse back/forward buttons for tab history
            </label>
          </div>
        </div>
      </div>

      <div v-show="currentCategory === 'shortcut'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Editor Shortcuts (Click to change)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('open_file')">
              <span class="shortcut-desc">Open File</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'open_file' }">
                {{ isRecording === 'open_file' ? 'PLEASE PRESS NEW KEYS...' : formatShortcut(settings.shortcuts?.open_file) }}
              </span>
              <input v-if="isRecording === 'open_file'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey('open_file', $event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" style="pointer-events:none; opacity:0.7;">
              <span class="shortcut-desc">Global Text Search</span>
              <span class="shortcut-key">CTRL + SHIFT + F</span>
            </div>
            <div class="shortcut-row" style="pointer-events:none; opacity:0.7;">
              <span class="shortcut-desc">Generate Flow Chart</span>
              <span class="shortcut-key">CTRL + SHIFT + G</span>
            </div>
          </div>
        </div>

        <div class="setting-item-vertical">
          <label>Tab Navigation Shortcuts (Global)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('prev_tab')">
              <span class="shortcut-desc">Switch to Previous Tab</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'prev_tab' }">
                {{ isRecording === 'prev_tab' ? 'PLEASE PRESS NEW KEYS...' : formatShortcut(settings.shortcuts?.prev_tab) }}
              </span>
              <input v-if="isRecording === 'prev_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey('prev_tab', $event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('next_tab')">
              <span class="shortcut-desc">Switch to Next Tab</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'next_tab' }">
                {{ isRecording === 'next_tab' ? 'PLEASE PRESS NEW KEYS...' : formatShortcut(settings.shortcuts?.next_tab) }}
              </span>
              <input v-if="isRecording === 'next_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey('next_tab', $event)" @blur="isRecording = null" />
            </div>
          </div>
        </div>
      </div>

      <div v-show="currentCategory === 'ai'" class="settings-section">
        <div class="ai-settings-header">
          <h3 style="margin:0;font-size:1rem;">AI Provider Settings</h3>
          <p style="margin:4px 0 0;font-size:0.75rem;opacity:0.6;">Used by the Flow Chart feature to generate diagrams from code.</p>
        </div>
        <div class="setting-item">
          <label>Default Provider</label>
          <select v-model="aiSettings.provider" class="theme-select" @change="saveSettings">
            <option value="gemini">Gemini (Google)</option>
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>

        <div class="provider-block" :class="{ active: aiSettings.provider === 'gemini' }">
          <div class="provider-label"><span class="provider-dot gemini"></span> Gemini</div>
          <input v-model="aiSettings.geminiKey" type="password" class="text-input" placeholder="AIza... (API Key)" @change="saveSettings"/>
          <select v-model="aiSettings.geminiModel" class="theme-select" @change="saveSettings">
            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
          </select>
        </div>
      </div>

      <div v-show="currentCategory === 'chill'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Chill Widget</label>
          <label class="checkbox-container">
            <input type="checkbox" v-model="settings.chill.enableWidget" @change="saveSettings" />
            <span class="checkmark"></span>
            Show smoking widget
          </label>
        </div>
      </div>

      <div v-show="currentCategory === 'convert'" class="settings-section">
        <div class="ai-settings-header">
          <h3 style="margin:0;font-size:1rem;">Convert UI Transformation Rules</h3>
          <p style="margin:4px 0 0;font-size:0.75rem;opacity:0.6;">Rules applied during JSP to PDA/Common conversion.</p>
        </div>
        <div class="rules-container">
          <div class="rule-group">
            <h4 class="rule-title">Type: PDA JSP</h4>
            <div class="rule-list">
              <div class="rule-item"><span class="rule-tag">CSS</span><p>Replaces with <code>common_pda.css</code>.</p></div>
              <div class="rule-item"><span class="rule-tag">LAYOUT</span><p>Wraps in <code>div.pda_list</code>.</p></div>
              <div class="rule-item"><span class="rule-tag">STYLE</span><p>Extracts to <code>&lt;style&gt;</code> before script.</p></div>
              <div class="rule-item"><span class="rule-tag">INDENT</span><p>Uses 4-char tabs.</p></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-layout { display: flex; height: 500px; background-color: var(--container-bg); color: var(--text-color); border-radius: 12px; overflow: hidden; }
.settings-sidebar { width: 180px; border-right: var(--border-style); display: flex; flex-direction: column; padding: 10px 0; background: rgba(0,0,0,0.05); }
.category-btn { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border: none; background: transparent; color: var(--text-color); cursor: pointer; text-align: left; font-size: 0.85rem; font-weight: 600; opacity: 0.7; transition: all 0.2s; }
.category-btn:hover { background-color: rgba(255,255,255,0.05); opacity: 1; }
.category-btn.active { background-color: var(--accent-color); color: #fff; opacity: 1; }
.settings-content { flex: 1; padding: 30px; overflow-y: auto; }
.settings-section { display: flex; flex-direction: column; gap: 24px; }
.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.1); }
.setting-item-vertical { display: flex; flex-direction: column; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.1); }
.setting-item label, .setting-item-vertical label { font-weight: 700; font-size: 0.85rem; text-transform: uppercase; opacity: 0.5; letter-spacing: 0.05em; }
.theme-select, .text-input { padding: 8px 12px; background-color: rgba(0,0,0,0.2); color: var(--text-color); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.85rem; outline: none; }
.save-all-btn { background: var(--accent-color); color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.75rem; cursor: pointer; }
.rule-group { background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 16px; }
.rule-title { margin: 0 0 12px 0; font-size: 0.75rem; color: var(--accent-color); font-weight: 800; }
.rule-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.75rem; }
.rule-tag { background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-weight: 800; min-width: 50px; text-align: center; }
.rule-item p { margin: 0; opacity: 0.7; }
</style>




