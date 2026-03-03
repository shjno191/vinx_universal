<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';

const emit = defineEmits(['theme-changed']);

const categories = [
  { id: 'general', name: 'General', icon: '\u2699\uFE0F' },
  { id: 'translate', name: 'Translate', icon: '\u{1F310}' }
];

const currentCategory = ref('general');
const settings = ref({
  theme: 'dark',
  dictionary_path: ''
});

const loadSettings = async () => {
  try {
    const s = await invoke('get_settings');
    settings.value = s as any;
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
    await invoke('save_settings', { settings: settings.value });
    emit('theme-changed', settings.value.theme);
  } catch (e) {
    console.error('Failed to save settings', e);
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

onMounted(() => {
  loadSettings();
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
    </main>
  </div>
</template>

<style scoped>
.settings-layout {
  display: flex;
  height: 350px;
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

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.setting-item label {
  font-weight: 500;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.theme-select {
  padding: 6px 12px;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  min-width: 150px;
}

.setting-item-vertical {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.setting-item-vertical label {
  font-weight: 500;
  font-size: 0.95rem;
}

.path-picker {
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  font-size: 0.85rem;
}

.theme-input {
  padding: 6px 12px;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
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

.setting-actions {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.action-item p {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  opacity: 0.8;
}

.theme-button {
  background-color: var(--button-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  padding: 8px 16px;
  cursor: pointer;
  font-weight: bold;
}

.theme-button:hover {
  background-color: var(--button-hover);
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
</style>
