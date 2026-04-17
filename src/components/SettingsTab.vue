<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import { globalShortcuts, showSettingsTrigger, editorSettings, theme, aiSettings, chillSettings, triggerSettingsRefresh } from '../store';

const emit = defineEmits(['theme-changed']);

const categories = [
  { id: 'general', name: 'General', icon: 'settings' },
  { id: 'translate', name: 'Translate', icon: 'globe' },
  { id: 'editor', name: 'Editor', icon: 'edit-3' },
  { id: 'shortcut', name: 'Shortcut', icon: 'keyboard' },
  { id: 'ai', name: 'AI', icon: 'cpu' },
  { id: 'chill', name: 'Chill', icon: 'coffee' },
  { id: 'convert', name: 'Convert UI', icon: 'refresh-cw' },
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
  if (key === 'focus_search' || key === 'open_settings') return; // Fixed shortcuts
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

const handleShortcutKey = (_key: string, e: KeyboardEvent) => {
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
    const raw = await invoke('get_settings') as string;
    const s = JSON.parse(raw || '{}');
    if (s && Object.keys(s).length > 0) {
      // Merge with default values to ensure all properties exist
      settings.value = { ...settings.value, ...s };
      globalShortcuts.value = settings.value.shortcuts;
      editorSettings.value = settings.value.editor;
      theme.value = settings.value.theme as 'light' | 'dark' | '95';
      aiSettings.value = settings.value.ai as any;
      chillSettings.value = settings.value.chill;
    }
  } catch (e) {
    console.error('Failed to get settings:', e);
  }
};


onMounted(() => {
  refreshSettings();
});

const saveSettings = async () => {
  try {
    await invoke('save_settings', { settings: JSON.stringify(settings.value, null, 2) });
    globalShortcuts.value = settings.value.shortcuts;
    editorSettings.value = settings.value.editor;
    theme.value = settings.value.theme as 'light' | 'dark' | '95';
    aiSettings.value = settings.value.ai as any;
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
    const selected = await open({
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
        <span class="category-icon-wrapper">
          <svg v-if="cat.icon === 'settings'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <svg v-else-if="cat.icon === 'globe'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          <svg v-else-if="cat.icon === 'edit-3'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          <svg v-else-if="cat.icon === 'keyboard'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="6" y1="9" x2="6" y2="9"></line><line x1="10" y1="9" x2="10" y2="9"></line><line x1="14" y1="9" x2="14" y2="9"></line><line x1="18" y1="9" x2="18" y2="9"></line><line x1="6" y1="13" x2="6" y2="13"></line><line x1="10" y1="13" x2="10" y2="13"></line><line x1="14" y1="13" x2="14" y2="13"></line><line x1="18" y1="13" x2="18" y2="13"></line></svg>
          <svg v-else-if="cat.icon === 'cpu'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>
          <svg v-else-if="cat.icon === 'coffee'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
          <svg v-else-if="cat.icon === 'refresh-cw'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        </span>
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
            <div class="shortcut-row locked">
              <span class="shortcut-desc">Global Text Search</span>
              <span class="shortcut-key">CTRL + SHIFT + F</span>
            </div>
            <div class="shortcut-row locked">
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
        <div class="ai-settings-header glass">
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

        <div class="provider-block glass" :class="{ active: aiSettings.provider === 'gemini' }">
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
        <div class="ai-settings-header glass">
          <h3 style="margin:0;font-size:1rem;">Convert UI Transformation Rules</h3>
          <p style="margin:4px 0 0;font-size:0.75rem;opacity:0.6;">Rules applied during JSP to PDA/Common conversion.</p>
        </div>
        <div class="rules-container">
          <div class="rule-group glass">
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
.settings-sidebar { 
  width: 180px; 
  border-right: 1px solid rgba(128, 128, 128, 0.1); 
  display: flex; 
  flex-direction: column; 
  padding: 15px 0; 
  background: rgba(128, 128, 128, 0.04); 
}
.category-btn { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 10px 20px; 
  border: none; 
  background: transparent; 
  color: var(--text-color); 
  cursor: pointer; 
  text-align: left; 
  font-size: 0.8rem; 
  font-weight: 700; 
  opacity: 0.6; 
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.category-btn:hover { background-color: rgba(128, 128, 128, 0.08); opacity: 1; }
.category-btn.active { background-color: var(--accent-color); color: #fff; opacity: 1; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2); }

.category-icon-wrapper { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }

.settings-content { flex: 1; padding: 25px 35px; overflow-y: auto; background: var(--container-bg); }
.settings-section { display: flex; flex-direction: column; gap: 20px; }

.glass {
  background: rgba(128, 128, 128, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 12px;
  padding: 16px;
}

.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.08); }
.setting-item-vertical { display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.08); }
.setting-item label, .setting-item-vertical label { font-weight: 800; font-size: 0.7rem; text-transform: uppercase; opacity: 0.4; letter-spacing: 0.1em; }

.theme-select, .text-input { 
  padding: 8px 12px; 
  background-color: rgba(0,0,0,0.1); 
  color: var(--text-color); 
  border: 1px solid rgba(128, 128, 128, 0.2); 
  border-radius: 8px; 
  font-size: 0.8rem; 
  font-weight: 600;
  outline: none; 
  transition: border-color 0.2s;
}
.theme-select:focus, .text-input:focus { border-color: var(--accent-color); }

.path-picker { display: flex; gap: 8px; }
.path-input { flex: 1; opacity: 0.7; cursor: default; }

.save-all-btn { 
  background: var(--accent-color); 
  color: white; border: none; 
  padding: 6px 16px; 
  border-radius: 8px; 
  font-weight: 700; 
  font-size: 0.75rem; 
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.2s;
}
.save-all-btn:hover { box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); transform: translateY(-1px); }

.shortcut-list { display: flex; flex-direction: column; gap: 8px; }
.shortcut-row { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 10px 14px; background: rgba(0,0,0,0.1); 
  border-radius: 8px; cursor: pointer; border: 1px solid transparent;
  transition: all 0.2s;
}
.shortcut-row:hover { border-color: var(--accent-color); background: rgba(99, 102, 241, 0.05); }
.shortcut-row.locked { opacity: 0.5; cursor: default; }
.shortcut-row.locked:hover { border-color: transparent; background: rgba(0,0,0,0.1); }

.shortcut-desc { font-size: 0.8rem; font-weight: 600; }
.shortcut-key { 
  font-family: 'Consolas', monospace; font-size: 0.75rem; 
  background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);
}
.shortcut-key.recording { color: var(--accent-color); font-weight: 800; animation: pulse 1.5s infinite; }

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

.rule-group { background: rgba(0,0,0,0.1); padding: 16px; }
.rule-title { margin: 0 0 12px 0; font-size: 0.75rem; color: var(--accent-color); font-weight: 900; letter-spacing: 0.05em; }
.rule-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.75rem; }
.rule-tag { background: rgba(99, 102, 241, 0.15); color: var(--accent-color); padding: 2px 8px; border-radius: 4px; font-weight: 900; min-width: 60px; text-align: center; }
.rule-item p { margin: 0; opacity: 0.7; font-weight: 600; }

.helper-actions { margin-top: 4px; }
.text-link-btn { background: none; border: none; color: var(--accent-color); padding: 0; font-size: 0.7rem; font-weight: 700; cursor: pointer; text-decoration: underline; opacity: 0.7; }
.text-link-btn:hover { opacity: 1; }

.provider-block { margin-top: 10px; display: flex; flex-direction: column; gap: 12px; opacity: 0.4; pointer-events: none; transition: opacity 0.3s; }
.provider-block.active { opacity: 1; pointer-events: all; }
.provider-label { font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.provider-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
.provider-dot.gemini { background: #4285f4; }

/* Win95 Variations */
.theme-95 .settings-layout, .theme-95 .settings-sidebar, .theme-95 .category-btn, .theme-95 .settings-content, .theme-95 .glass, .theme-95 .rule-group, .theme-95 .shortcut-row {
  background: #c0c0c0 !important; border-radius: 0 !important; border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; backdrop-filter: none !important; color: #000 !important;
}
.theme-95 .category-btn.active { background: #000080 !important; color: #fff !important; border: none !important; }
.theme-95 .save-all-btn { border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; background: #c0c0c0 !important; color: #000 !important; border-radius: 0; }
.theme-95 .theme-select, .theme-95 .text-input { border: 2px solid !important; border-color: #808080 #fff #fff #808080 !important; border-radius: 0; background: #fff !important; color: #000 !important; }
</style>
