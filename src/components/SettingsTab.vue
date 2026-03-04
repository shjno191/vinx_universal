<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import { globalShortcuts, showSettingsTrigger, editorSettings, theme, aiSettings } from '../store';

const emit = defineEmits(['theme-changed']);

const categories = [
  { id: 'general', name: 'General', icon: '\u2699\uFE0F' },
  { id: 'translate', name: 'Translate', icon: '\u{1F310}' },
  { id: 'editor', name: 'Editor', icon: '\u{1F4DD}' },
  { id: 'shortcut', name: 'Shortcut', icon: '\u2328\uFE0F' },
  { id: 'ai', name: 'AI', icon: '\u{1F916}' },
];

const currentCategory = ref('general');
const settings = ref({
  theme: 'dark',
  dictionary_path: '',
  shortcuts: {
    focus_search: 'ctrl+f',
    open_settings: 'ctrl+shift+s',
    open_file: 'ctrl+o'
  },
  editor: {
    middleClickClose: true,
    doubleClickNewTab: true,
    mouseNavHistory: true
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

  // Define modifier keys to ignore as standalone keys, but track them as modifiers
  const modifiers = ['control', 'shift', 'alt', 'meta'];
  if (modifiers.includes(k)) return; // Wait for a non-modifier key
  
  const forbidden = ['capslock', 'tab', 'enter', 'backspace', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  if (forbidden.includes(k)) return;

  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  if (e.metaKey) parts.push('meta');
  
  parts.push(k);
  const newShortcut = parts.join('+');
  
  if (!settings.value.shortcuts) {
    settings.value.shortcuts = { focus_search: 'ctrl+f', open_settings: 'ctrl+shift+s' };
  }
  
  // 1. Update component state
  (settings.value.shortcuts as any)[key] = newShortcut;
  
  // 2. Sync to global store immediately for real-time app update
  (globalShortcuts.value as any)[key] = newShortcut;
  
  // 3. Save to persistent storage
  saveSettings();
  
  isRecording.value = null;
};

const updateEditorSettings = () => {
    editorSettings.value = { ...settings.value.editor };
    saveSettings();
};

const loadSettings = async () => {
  try {
    const s = await invoke('get_settings') as any;
    if (s) {
      // Merge properties manually to preserve the structure if some keys are missing
      if (s.theme) {
        settings.value.theme = s.theme;
        theme.value = s.theme;
      }
      if (s.dictionary_path) settings.value.dictionary_path = s.dictionary_path;
      if (s.shortcuts) {
        settings.value.shortcuts = { ...settings.value.shortcuts, ...s.shortcuts };
        globalShortcuts.value = { ...globalShortcuts.value, ...s.shortcuts };
      }
      if (s.editor) {
        settings.value.editor = { ...settings.value.editor, ...s.editor };
        editorSettings.value = { ...editorSettings.value, ...s.editor };
      }
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
};

const chooseDictionaryFile = async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Excel Files',
        extensions: ['xlsx', 'xls']
      }]
    });
    
    if (selected && typeof selected === 'string') {
      settings.value.dictionary_path = selected;
      await saveSettings();
    }
  } catch (e) {
    console.error('Failed to open file dialog', e);
  }
};

const saveSettings = async () => {
  try {
    theme.value = settings.value.theme; // Update global theme immediately
    await invoke('save_settings', { settings: settings.value });
    emit('theme-changed', settings.value.theme);
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

// ── AI Settings ────────────────────────────────────────────────────────────────
const aiSaveStatus = ref<'idle' | 'saving' | 'saved'>('idle');

const saveAISettings = () => {
  aiSaveStatus.value = 'saving';
  // Persist to localStorage for simplicity (keys should not go to server-side settings)
  try {
    localStorage.setItem('ai_settings', JSON.stringify(aiSettings.value));
    aiSaveStatus.value = 'saved';
    setTimeout(() => { aiSaveStatus.value = 'idle'; }, 2000);
  } catch (e) {
    console.error('Failed to save AI settings', e);
    aiSaveStatus.value = 'idle';
  }
};

const loadAISettings = () => {
  try {
    const stored = localStorage.getItem('ai_settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      aiSettings.value = { ...aiSettings.value, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load AI settings', e);
  }
};

const openSettingsFile = async () => {
  try {
    await invoke('open_settings_file');
  } catch (e) {
    console.error('Failed to open settings file', e);
  }
};

const refreshSettings = async () => {
  await loadSettings();
  emit('theme-changed', settings.value.theme);
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
        ['‚±‚ñ‚É‚¿‚Í', 'Hello', 'Xin ch?o'],
        ['‚ ‚è‚ª‚Æ‚¤', 'Thank you', 'C?m ?n']
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
      alert('Template saved successfully to: ' + chosenPath);
    }
  } catch (e) {
    console.error('Failed to save template:', e);
    alert('Failed to save template: ' + e);
  }
};

defineExpose({
  refreshSettings,
  openSettingsFile,
  downloadTemplate
});

watch(showSettingsTrigger, (val) => {
  if (val && val.category) {
    currentCategory.value = val.category;
  }
});

onMounted(() => {
  loadSettings();
  loadAISettings();
});
</script>

<template>
  <div class="settings-layout">
    <aside class="settings-sidebar">
      <button 
        v-for="cat in categories" 
        :key="cat.id"
        @click="currentCategory = cat.id"
        class="category-btn"
        :class="{ 'active': currentCategory === cat.id }"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <span class="cat-name">{{ cat.name }}</span>
      </button>
    </aside>

    <main class="settings-content">
      <div v-if="currentCategory === 'general'" class="settings-section">
        <div class="setting-item">
          <label>Theme</label>
          <select v-model="settings.theme" @change="saveSettings" class="theme-select">
            <option value="dark">Dark (Modern)</option>
            <option value="light">Light</option>
            <option value="95">Windows 95</option>
          </select>
        </div>
      </div>

      <div v-if="currentCategory === 'translate'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Dictionary Excel File (JP, EN, VI)</label>
          <div class="path-picker">
            <input v-model="settings.dictionary_path" placeholder="Path to excel file..." class="theme-input path-input" readonly />
            <button @click="chooseDictionaryFile" class="theme-button">Browse...</button>
          </div>
          <div class="helper-actions">
            <button @click="downloadTemplate" class="text-link-btn">Download Excel Template</button>
          </div>
        </div>
      </div>

      <div v-if="currentCategory === 'editor'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Mouse Features</label>
          <div class="setting-checkbox-list">
            <div class="checkbox-row">
              <label class="checkbox-container">
                <input type="checkbox" v-model="settings.editor.middleClickClose" @change="updateEditorSettings" />
                <span class="checkmark"></span>
                Middle-click to close tab
              </label>
            </div>
            <div class="checkbox-row">
              <label class="checkbox-container">
                <input type="checkbox" v-model="settings.editor.doubleClickNewTab" @change="updateEditorSettings" />
                <span class="checkmark"></span>
                Double-click on tab bar to create tab
              </label>
            </div>
            <div class="checkbox-row">
              <label class="checkbox-container">
                <input type="checkbox" v-model="settings.editor.mouseNavHistory" @change="updateEditorSettings" />
                <span class="checkmark"></span>
                Mouse Button 4/5 for navigation
              </label>
            </div>
          </div>
        </div>

        <div class="setting-item-vertical">
          <label>Editor Shortcuts</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('open_file')">
              <span class="shortcut-desc">Open File</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'open_file' }">
                {{ isRecording === 'open_file' ? 'PLEASE PRESS NEW KEYS...' : formatShortcut(settings.shortcuts?.open_file) }}
              </span>
              <input v-if="isRecording === 'open_file'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey('open_file', $event)" @blur="isRecording = null" />
            </div>
          </div>
          <p class="shortcut-hint">These shortcuts only work within the Editor tab.</p>
        </div>
      </div>

      <div v-if="currentCategory === 'shortcut'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Global Shortcuts (Click to change)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('focus_search')">
              <span class="shortcut-desc">Focus Dictionary Search</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'focus_search' }">
                {{ isRecording === 'focus_search' ? 'PLEASE PRESS NEW KEYS...' : formatShortcut(settings.shortcuts?.focus_search) }}
              </span>
              <input v-if="isRecording === 'focus_search'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey('focus_search', $event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('open_settings')">
              <span class="shortcut-desc">Open Settings</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'open_settings' }">
                {{ isRecording === 'open_settings' ? 'PLEASE PRESS NEW KEYS...' : formatShortcut(settings.shortcuts?.open_settings) }}
              </span>
              <input v-if="isRecording === 'open_settings'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey('open_settings', $event)" @blur="isRecording = null" />
            </div>
          </div>
          <p class="shortcut-hint">Tip: Press Escape to cancel recording.</p>
        </div>
      </div>

      <!-- AI Provider Settings -->
      <div v-if="currentCategory === 'ai'" class="settings-section">
        <div class="ai-settings-header">
          <h3 style="margin:0;font-size:1rem;">AI Provider Settings</h3>
          <p style="margin:4px 0 0;font-size:0.75rem;opacity:0.6;">Used by the Flow Chart feature to generate diagrams from code.</p>
        </div>

        <div class="setting-item">
          <label>Default Provider</label>
          <select v-model="aiSettings.provider" class="theme-select">
            <option value="gemini">Gemini (Google)</option>
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>

        <!-- Gemini -->
        <div class="provider-block" :class="{ active: aiSettings.provider === 'gemini' }">
          <div class="provider-label">
            <span class="provider-dot gemini"></span> Gemini (Google)
          </div>
          <div class="setting-item-vertical">
            <label>API Key</label>
            <input v-model="aiSettings.geminiKey" type="password" class="text-input" placeholder="AIza..." autocomplete="off" />
            <span class="hint-text">Get your key at <a href="https://ai.google.dev" target="_blank">ai.google.dev</a></span>
          </div>
          <div class="setting-item-vertical">
            <label>Model</label>
            <select v-model="aiSettings.geminiModel" class="theme-select">
              <option value="gemini-1.5-flash">gemini-1.5-flash (Free, Fast)</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro (Better quality)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash (Latest, Paid)</option>
              <option value="gemini-2.0-pro">gemini-2.0-pro (Best quality)</option>
            </select>
          </div>
        </div>

        <!-- OpenAI -->
        <div class="provider-block" :class="{ active: aiSettings.provider === 'openai' }">
          <div class="provider-label">
            <span class="provider-dot openai"></span> ChatGPT (OpenAI)
          </div>
          <div class="setting-item-vertical">
            <label>API Key</label>
            <input v-model="aiSettings.openaiKey" type="password" class="text-input" placeholder="sk-..." autocomplete="off" />
          </div>
          <div class="setting-item-vertical">
            <label>Model</label>
            <select v-model="aiSettings.openaiModel" class="theme-select">
              <option value="gpt-4o-mini">gpt-4o-mini (Cheap, Fast)</option>
              <option value="gpt-4o">gpt-4o (Best)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
            </select>
          </div>
        </div>

        <!-- Claude -->
        <div class="provider-block" :class="{ active: aiSettings.provider === 'claude' }">
          <div class="provider-label">
            <span class="provider-dot claude"></span> Claude (Anthropic)
          </div>
          <div class="setting-item-vertical">
            <label>API Key</label>
            <input v-model="aiSettings.claudeKey" type="password" class="text-input" placeholder="sk-ant-..." autocomplete="off" />
          </div>
          <div class="setting-item-vertical">
            <label>Model</label>
            <select v-model="aiSettings.claudeModel" class="theme-select">
              <option value="claude-3-haiku-20240307">claude-3-haiku (Fast, Cheap)</option>
              <option value="claude-3-5-sonnet-20241022">claude-3.5-sonnet (Best)</option>
              <option value="claude-3-opus-20240229">claude-3-opus (Powerful)</option>
            </select>
          </div>
        </div>

        <!-- Ollama -->
        <div class="provider-block" :class="{ active: aiSettings.provider === 'ollama' }">
          <div class="provider-label">
            <span class="provider-dot ollama"></span> Ollama (Local)
          </div>
          <div class="setting-item-vertical">
            <label>Server URL</label>
            <input v-model="aiSettings.ollamaUrl" type="text" class="text-input" placeholder="http://localhost:11434/api/generate" />
          </div>
          <div class="setting-item-vertical">
            <label>Model Name</label>
            <input v-model="aiSettings.ollamaModel" type="text" class="text-input" placeholder="llama3" />
            <span class="hint-text">e.g.: llama3, mistral, codellama, deepseek-coder</span>
          </div>
        </div>

        <div class="setting-item">
          <button class="save-all-btn" @click="saveAISettings" :disabled="aiSaveStatus === 'saving'">
            <span v-if="aiSaveStatus === 'saved'">Saved!</span>
            <span v-else>Save AI Settings</span>
          </button>
          <span class="hint-text" style="margin-left:10px;">Stored locally in browser.</span>
        </div>
      </div>
    </main>
  </div>
  </div>
</template>

<style scoped>
.settings-layout {
  display: flex;
  height: 500px;
  background-color: var(--container-bg);
  color: var(--text-color);
}

.settings-sidebar {
  width: 160px;
  border-right: var(--border-style);
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  gap: 2px;
}

.category-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  border: none;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  text-align: left;
  font-size: 0.9rem;
  transition: background 0.1s;
}

.category-btn:hover {
  background-color: var(--button-hover);
}

.category-btn.active {
  background-color: var(--accent-color);
  color: #fff;
}

.settings-content {
  flex: 1;
  padding: 25px;
  overflow-y: auto;
  text-align: left;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(128, 128, 128, 0.05);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.1);
}

.checkbox-row {
  display: flex;
  align-items: center;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
  color: var(--text-color);
  opacity: 0.9;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  height: 18px;
  width: 18px;
  background-color: var(--button-bg);
  border: var(--border-style);
  border-radius: 4px;
}

.checkbox-container:hover input ~ .checkmark {
  background-color: var(--button-hover);
}

.checkbox-container input:checked ~ .checkmark {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(128, 128, 128, 0.05);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.1);
}

.shortcut-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
  border: 1px solid transparent;
}

.shortcut-row:hover {
  background: rgba(99, 102, 241, 0.05);
  border-color: rgba(99, 102, 241, 0.1);
}

.shortcut-desc {
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 0.9;
}

.shortcut-key {
  background: var(--button-bg);
  padding: 6px 14px;
  border-radius: 6px;
  border: var(--border-style);
  font-family: 'Consolas', monospace;
  font-weight: bold;
  font-size: 0.85rem;
  color: var(--accent-color);
  min-width: 100px;
  text-align: center;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.shortcut-key.recording {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
  animation: pulse 1.5s infinite;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.02); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.hidden-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}

.shortcut-hint {
  font-size: 0.75rem;
  opacity: 0.5;
  margin-top: 10px;
  font-style: italic;
  text-align: center;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.setting-item label {
  font-weight: 600;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.theme-select {
  padding: 8px 12px;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  min-width: 180px;
  outline: none;
}

.setting-item-vertical {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.setting-item-vertical label {
  font-weight: 600;
  font-size: 0.95rem;
}

.path-picker {
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  font-size: 0.85rem;
  opacity: 0.8;
}

.theme-input {
  padding: 8px 12px;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  outline: none;
}

.helper-actions {
  margin-top: 5px;
}

.text-link-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  padding: 0;
  cursor: pointer;
  font-size: 0.85rem;
  text-decoration: underline;
}

.text-link-btn:hover {
  opacity: 0.8;
}

/* Win95 Variations */
:root.theme-95 .category-btn.active {
  background: #000080;
  color: #fff;
}

:root.theme-95 .theme-select {
  border: 2px solid;
  border-top-color: #808080;
  border-left-color: #808080;
  border-right-color: #fff;
  border-bottom-color: #fff;
  background: white;
  color: black;
  border-radius: 0;
}

:root.theme-95 .theme-button {
  border: 2px solid;
  border-top-color: #fff;
  border-left-color: #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  background: #c0c0c0;
  color: #000;
  border-radius: 0;
}

:root.theme-95 .theme-button:active {
  border-top-color: #808080;
  border-left-color: #808080;
  border-right-color: #fff;
  border-bottom-color: #fff;
}

/* AI Settings */
.ai-settings-header {
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.text-input {
  width: 100%;
  padding: 8px 12px;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.text-input:focus {
  border-color: var(--accent-color);
}

.hint-text {
  font-size: 0.72rem;
  opacity: 0.5;
  font-style: italic;
}

.hint-text a {
  color: var(--accent-color);
  text-decoration: underline;
}

.save-all-btn {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.save-all-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.save-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* AI Provider blocks */
.provider-block {
  padding: 15px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.15);
  background: rgba(128, 128, 128, 0.04);
  display: flex;
  flex-direction: column;
  gap: 14px;
  opacity: 0.6;
  transition: opacity 0.2s, border-color 0.2s;
}

.provider-block.active {
  opacity: 1;
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.04);
}

.provider-label {
  font-weight: 700;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.provider-dot.gemini { background: #4285f4; }
.provider-dot.openai { background: #10a37f; }
.provider-dot.claude { background: #d97706; }
.provider-dot.ollama { background: #a78bfa; }
</style>
