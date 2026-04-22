<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import { Icons } from '../utils/icons';
import { showSettingsTrigger, theme } from '../store';

const emit = defineEmits(['theme-changed']);

const {
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
} = useSettings();

onMounted(() => {
  refreshSettings();
});

const handleSaveAndEmit = async () => {
  await saveSettings();
  emit('theme-changed', theme.value);
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
      <button 
        v-for="cat in categories" 
        :key="cat.id" 
        class="category-btn" 
        :class="{ active: currentCategory === cat.id }" 
        @click="currentCategory = cat.id as any"
      >
        <span class="category-icon-wrapper" v-html="Icons[cat.icon as keyof typeof Icons]"></span>
        {{ cat.name }}
      </button>
    </aside>

    <main v-if="settings && settings.editor" class="settings-content">
      <div v-show="currentCategory === 'general'" class="settings-section">
        <div class="setting-item">
          <label>Theme</label>
          <select v-model="settings.theme" class="theme-select" @change="handleSaveAndEmit">
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
             <button class="text-link-btn" @click="downloadTemplate">
               <span v-html="Icons.Download" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span>
               Download Template
             </button>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Open Config Folder</label>
          <button class="save-all-btn" @click="openSettingsFile">Open Folder</button>
        </div>
      </div>

      <div v-show="currentCategory === 'translate'" class="settings-section">
        <div class="setting-item-vertical">
          <label>Primary Translation Dictionary (.xlsx)</label>
          <div class="path-picker">
            <input v-model="settings.dictionary_path" type="text" class="text-input path-input" readonly placeholder="No dictionary selected..." />
            <button class="save-all-btn" @click="pickDictionary">Browse</button>
          </div>
          <div class="helper-actions">
             <button class="text-link-btn" @click="downloadTemplate">
               <span v-html="Icons.Download" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span>
               Download Template
             </button>
          </div>
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
          <select v-model="settings.ai.provider" class="theme-select" @change="saveSettings">
            <option value="gemini">Gemini (Google)</option>
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>

        <div class="provider-block glass" :class="{ active: settings.ai.provider === 'gemini' }">
          <div class="provider-label"><span class="provider-dot gemini"></span> Gemini</div>
          <input v-model="settings.ai.geminiKey" type="password" class="text-input" placeholder="AIza... (API Key)" @change="saveSettings"/>
          <select v-model="settings.ai.geminiModel" class="theme-select" @change="saveSettings">
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
.settings-layout { display: flex; flex: 1; height: 100%; background-color: var(--container-bg); color: var(--text-color); overflow: hidden; }
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

.hidden-input { position: absolute; opacity: 0; pointer-events: none; }

/* Win95 Variations */
.theme-95 .settings-layout, .theme-95 .settings-sidebar, .theme-95 .category-btn, .theme-95 .settings-content, .theme-95 .glass, .theme-95 .rule-group, .theme-95 .shortcut-row {
  background: #c0c0c0 !important; border-radius: 0 !important; border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; backdrop-filter: none !important; color: #000 !important;
}
.theme-95 .category-btn.active { background: #000080 !important; color: #fff !important; border: none !important; }
.theme-95 .save-all-btn { border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; background: #c0c0c0 !important; color: #000 !important; border-radius: 0; }
.theme-95 .theme-select, .theme-95 .text-input { border: 2px solid !important; border-color: #808080 #fff #fff #808080 !important; border-radius: 0; background: #fff !important; color: #000 !important; }
</style>
