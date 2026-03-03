<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';

const subTab = ref('dictionary'); // dictionary | quick-translate
const dictionaryData = ref<any[]>([]);
const searchQuery = ref('');
const isLoading = ref(false);
const dictionaryPath = ref('');

// Quick Translate states
const quickInput = ref('');
const quickOutput = ref('');

const loadDictionary = async () => {
  try {
    isLoading.value = true;
    const s = await invoke('get_settings') as any;
    dictionaryPath.value = s.dictionary_path;

    if (!dictionaryPath.value) {
      dictionaryData.value = [];
      isLoading.value = false;
      return;
    }

    const bytes = await invoke('read_file_binary', { path: dictionaryPath.value }) as number[];
    const data = new Uint8Array(bytes);
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Assume the first sheet contains the data
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON with JP, EN, VI columns
    // We expect the excel to have these headers or at least 3 columns
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length > 0) {
      // Find headers or assume 0:JP, 1:EN, 2:VI
      const rows = jsonData.slice(1).map(row => ({
        jp: row[0] || '',
        en: row[1] || '',
        vi: row[2] || ''
      }));
      dictionaryData.value = rows;
    }

  } catch (e) {
    console.error('Failed to load dictionary:', e);
  } finally {
    isLoading.value = false;
  }
};

const filteredDictionary = computed(() => {
  if (!searchQuery.value) return dictionaryData.value;
  const q = searchQuery.value.toLowerCase();
  return dictionaryData.value.filter(item => 
    item.jp.toLowerCase().includes(q) || 
    item.en.toLowerCase().includes(q) || 
    item.vi.toLowerCase().includes(q)
  );
});

const handleQuickTranslate = () => {
  // Simple "reverse" or placeholder logic for now
  // In a real app, this might call an API
  quickOutput.value = quickInput.value.split('').reverse().join('');
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

onMounted(() => {
  loadDictionary();
});
</script>

<template>
  <div class="translate-container">
    <div class="sub-tabs">
      <button 
        @click="subTab = 'dictionary'" 
        :class="{ active: subTab === 'dictionary' }"
      >
        Dictionary
      </button>
      <button 
        @click="subTab = 'quick-translate'" 
        :class="{ active: subTab === 'quick-translate' }"
      >
        Quick Translate
      </button>
    </div>

    <div class="tab-content">
      <!-- Dictionary Tab -->
      <div v-if="subTab === 'dictionary'" class="dictionary-view">
        <div class="search-bar">
          <input 
            v-model="searchQuery" 
            placeholder="Search keywords (JP, EN, VI)..." 
            class="theme-input search-input" 
          />
          <button @click="loadDictionary" class="theme-button refresh-btn" title="Reload from File">&#128260;</button>
        </div>

        <div v-if="!dictionaryPath" class="empty-state">
          <div class="no-path-alert">
            Please configure the Dictionary Excel Path in Settings &#9881;&#65039;
          </div>
          <p class="empty-hint">
            You can download the dictionary template here: 
            <button @click="downloadTemplate" class="text-link-btn">Dictionary_Template.xlsx</button>
          </p>
        </div>

        <div v-else class="table-container">
          <table class="dictionary-table">
            <thead>
              <tr>
                <th>Japanese (JP)</th>
                <th>English (EN)</th>
                <th>Vietnamese (VI)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in filteredDictionary" :key="idx">
                <td>{{ item.jp }}</td>
                <td>{{ item.en }}</td>
                <td>{{ item.vi }}</td>
              </tr>
              <tr v-if="filteredDictionary.length === 0">
                <td colspan="3" class="no-results">No matches found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="status-bar" v-if="dictionaryPath">
          Total items: {{ dictionaryData.length }} | Showing: {{ filteredDictionary.length }}
        </div>
      </div>

      <!-- Quick Translate Tab -->
      <div v-if="subTab === 'quick-translate'" class="quick-translate-view">
        <div class="translate-grid">
          <div class="input-pane">
            <label>Input Text</label>
            <textarea v-model="quickInput" placeholder="Enter text to translate..." class="theme-textarea"></textarea>
          </div>
          <div class="actions-pane">
            <button @click="handleQuickTranslate" class="theme-button translate-btn">Translate &#10144;</button>
          </div>
          <div class="output-pane">
            <label>Result</label>
            <textarea v-model="quickOutput" readonly placeholder="Result will appear here..." class="theme-textarea readonly"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.translate-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--container-bg);
}

.sub-tabs {
  display: flex;
  gap: 10px;
  padding: 10px 20px;
  border-bottom: var(--border-style);
}

.sub-tabs button {
  padding: 8px 16px;
  background: transparent;
  color: var(--text-color);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.sub-tabs button.active {
  border-bottom-color: var(--accent-color);
  color: var(--accent-color);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Dictionary Styles */
.dictionary-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
}

.table-container {
  flex: 1;
  overflow-y: auto;
  border: var(--border-style);
  border-radius: var(--border-radius);
  background-color: var(--input-bg);
}

.dictionary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.dictionary-table th {
  position: sticky;
  top: 0;
  background-color: var(--button-bg);
  padding: 10px;
  text-align: left;
  border-bottom: var(--border-style);
  z-index: 10;
}

.dictionary-table td {
  padding: 10px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.dictionary-table tr:hover {
  background-color: rgba(128, 128, 128, 0.05);
}

.no-results {
  text-align: center;
  padding: 40px;
  opacity: 0.5;
  font-style: italic;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.no-path-alert {
  padding: 40px;
  text-align: center;
  border: 1px dashed var(--accent-color);
  border-radius: 8px;
  color: var(--accent-color);
  max-width: 400px;
}

.empty-hint {
  font-size: 0.9rem;
  opacity: 0.8;
}

.text-link-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  padding: 0;
  cursor: pointer;
  font-size: inherit;
  font-weight: bold;
  text-decoration: underline;
}

.text-link-btn:hover {
  opacity: 0.8;
}

.status-bar {
  padding-top: 10px;
  font-size: 0.8rem;
  opacity: 0.6;
}

/* Quick Translate Styles */
.quick-translate-view {
  flex: 1;
  padding: 20px;
}

.translate-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  height: 100%;
}

.input-pane, .output-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions-pane {
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-textarea {
  flex: 1;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  padding: 15px;
  resize: none;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
}

.theme-textarea.readonly {
  opacity: 0.7;
}

.translate-btn {
  padding: 12px 24px;
  background-color: var(--accent-color);
  color: #fff;
  border: none;
  font-weight: bold;
}

.theme-input {
  padding: 8px 15px;
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
}

.theme-button {
  padding: 8px 16px;
  background-color: var(--button-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: bold;
}

.theme-button:hover {
  background-color: var(--button-hover);
}

/* Win95 Variations */
:root.theme-95 .sub-tabs button.active {
  background: #000080;
  color: #fff;
  border-bottom: none;
}

:root.theme-95 .dictionary-table th {
  background: #c0c0c0;
  border: 2px solid;
  border-top-color: #fff;
  border-left-color: #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  color: #000;
}

:root.theme-95 .theme-textarea {
  background: #fff;
  color: #000;
  border: 2px solid;
  border-top-color: #808080;
  border-left-color: #808080;
  border-right-color: #fff;
  border-bottom-color: #fff;
}
</style>
