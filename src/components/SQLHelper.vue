<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const props = defineProps<{
  theme: string
}>();

const logPath = ref('');
const logContent = ref('');
const logDisplayRef = ref<HTMLElement | null>(null);

// Extraction Logic
interface QueryExtraction {
  id: number;
  searchId: string;
  resultSql: string;
  isHighlighting?: boolean;
}

const extractions = ref<QueryExtraction[]>([
  { id: Date.now(), searchId: '', resultSql: '' }
]);

const addExtraction = () => {
  extractions.value.push({
    id: Date.now(),
    searchId: '',
    resultSql: ''
  });
};

const removeExtraction = (index: number) => {
  if (extractions.value.length > 1) {
    extractions.value.splice(index, 1);
  }
};

const clearAllExtractions = () => {
  extractions.value = [
    { id: Date.now(), searchId: '', resultSql: '' }
  ];
};


const chooseFile = async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Log Files',
        extensions: ['log', 'txt', 'sql']
      }]
    });
    
    if (selected && typeof selected === 'string') {
      logPath.value = selected;
      await loadFromFile();
    }
  } catch (e) {
    console.error('Failed to open file dialog', e);
  }
};

const loadFromFile = async () => {
  if (!logPath.value) return;
  try {
    const content = await invoke('read_file_content', { path: logPath.value }) as string;
    logContent.value = content;
    
    // Auto-scroll to bottom - use a slight timeout to ensure rendering is complete
    nextTick(() => {
      setTimeout(() => {
        if (logDisplayRef.value) {
          logDisplayRef.value.scrollTop = logDisplayRef.value.scrollHeight;
        }
      }, 100);
    });
  } catch (e) {
    alert(`Error loading file: ${e}`);
  }
};

const processSql = (index: number) => {
  let extraction = extractions.value[index];
  if (!logContent.value) return;

  const rawSearchId = extraction.searchId.trim();
  if (!rawSearchId) return;

  const cleanId = rawSearchId.replace(/^id\s*=\s*/i, '');

  // Deduplicate: remove other entries with the same ID
  for (let i = 0; i < extractions.value.length; i++) {
    if (i === index) continue;
    const otherId = extractions.value[i].searchId.trim().replace(/^id\s*=\s*/i, '');
    if (otherId === cleanId) {
      extractions.value.splice(i, 1);
      if (i < index) index--; // Adjust current index
      i--; // Check new item at this position
    }
  }
  extraction = extractions.value[index]; // Refresh ref
  const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idPattern = new RegExp(`id\\s*=\\s*${escapedId}`, 'i');

  const lines = logContent.value.split(/\r?\n/);
  let foundSql = '';
  let foundParamsStrings: string[] = [];

  // 2. Iterate lines to find SQL and Params for this specific ID
  for (const line of lines) {
    if (!idPattern.test(line)) continue;

    // We found a relevant line. Now look for sql=... or params=...
    // We use non-greedy matching to avoid capturing subsequent tags on the same line
    
    // SQL Match
    const sqlMatch = line.match(/sql\s*=\s*([\s\S]+?)(?=\s+\w+\s*=|[\r\n]|$)/i);
    if (sqlMatch) {
      foundSql = sqlMatch[1].trim();
    }

    // Params Match
    const paramsMatch = line.match(/params\s*=\s*([\s\S]+?)(?=\s+\w+\s*=|[\r\n]|$)/i);
    if (paramsMatch) {
      const pString = paramsMatch[1].trim();
      // Look for all [TYPE:INDEX:VALUE] clusters
      const blocks = pString.match(/\[([^\]]+)\]/g);
      if (blocks) {
        foundParamsStrings.push(...blocks.map(b => b.substring(1, b.length - 1)));
      }
    }
  }

  // 3. Handle failure to find SQL
  if (!isValidId(cleanId)) {
    extraction.resultSql = `-- Error: ID length is too short. Minimum 4 characters required.`;
    return;
  }

  if (!foundSql) {
    extraction.resultSql = `-- Error: No SQL found for ID: ${cleanId}\n-- Suggestions:\n-- 1. Ensure the log contains "id=${cleanId}"\n-- 2. Ensure "sql=SELECT..." appears in the same log entry.`;
    return;
  }

  // 4. Parameter Processing
  let finalSql = foundSql;
  const parsedParams = foundParamsStrings
    .map(p => {
      const parts = p.split(':');
      if (parts.length < 2) return null;
      
      const idx = parseInt(parts[1]);
      return {
        type: parts[0].toUpperCase(),
        index: isNaN(idx) ? 999 : idx,
        value: parts.slice(2).join(':')
      };
    })
    .filter(p => p !== null)
    .sort((a, b) => a!.index - b!.index);

  // 5. Sequential '?' Replacement
  parsedParams.forEach(param => {
    if (!param) return;
    let val = param.value;
    
    if (val === 'NULL') {
      val = 'NULL';
    } else if (['STRING', 'TIMESTAMP', 'DATE', 'TIME', 'CHAR', 'VARCHAR', 'NVARCHAR', 'TEXT'].includes(param.type)) {
      // Escape single quotes for SQL safety
      val = `'${val.replace(/'/g, "''")}'`;
    }
    
    // Replace the first '?' remaining in the string
    finalSql = finalSql.replace('?', val);
  });

  extraction.resultSql = finalSql;
};

const copyResult = (text: string) => {
  navigator.clipboard.writeText(text);
};

// Smart Highlighting Logic
const highlightedLog = computed(() => {
  if (!logContent.value) return '<div class="placeholder-text">Log file content will appear here...</div>';
  
  // Get all unique IDs currently in extraction list
  const existingIds = new Set(
    extractions.value
      .map(ex => ex.searchId.trim().replace(/^id\s*=\s*/i, '').toLowerCase())
      .filter(id => id.length > 0)
  );

  // Escape HTML to prevent XSS/rendering issues
  let escaped = logContent.value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight id=xxxxxxxx (8 hex chars or similar)
  // We'll catch "id=" followed by word characters
  return escaped.replace(/(id\s*=\s*)([a-zA-Z0-9_-]{4,})/gi, (match, prefix, id) => {
    const isExisting = existingIds.has(id.toLowerCase());
    const extraClass = isExisting ? ' existing-id' : '';
    return `${prefix}<span class="clickable-id${extraClass}" data-id="${id}">${id}</span>`;
  });
});

const handleLogClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('clickable-id')) {
    const id = target.getAttribute('data-id');
    if (id) {
      handleIdClick(id);
    }
  }
};

const handleIdClick = (id: string) => {
  const cleanId = id.trim().replace(/^id\s*=\s*/i, '');
  
  // Deduplicate: remove existing entry with this ID
  const existingIdx = extractions.value.findIndex(ex => 
    ex.searchId.trim().replace(/^id\s*=\s*/i, '') === cleanId
  );
  if (existingIdx !== -1) {
    extractions.value.splice(existingIdx, 1);
  }

  // Check if we already have an empty extraction unit to use
  let unitIndex = extractions.value.findIndex(ex => !ex.searchId.trim());
  
  if (unitIndex === -1) {
    // None found, add a new one
    addExtraction();
    unitIndex = extractions.value.length - 1;
  }
  
  extractions.value[unitIndex].searchId = id;
  processSql(unitIndex);

  // Trigger highlight
  extractions.value[unitIndex].isHighlighting = true;
  setTimeout(() => {
    if (extractions.value[unitIndex]) {
      extractions.value[unitIndex].isHighlighting = false;
    }
  }, 2000);
};

const isValidId = (id: string) => {
  const trimmed = id.trim().replace(/^id\s*=\s*/i, '');
  return trimmed.length >= 4; // User can adjust this
};

</script>

<template>
  <div class="sql-helper-split">
    <!-- Top Control Bar -->
    <div class="control-bar">
      <div class="file-picker-group">
        <button @click="chooseFile" class="theme-button choose-btn">📂 Open Log File</button>
        <span v-if="logPath" class="file-path-display-full" :title="logPath">{{ logPath }}</span>
        <span v-else class="file-path-placeholder"></span>
      </div>
      <button @click="addExtraction" class="theme-button add-query-btn">➕ Add Query ID</button>
    </div>

    <div class="split-workspace">
      <!-- Left: Log Viewer -->
      <div class="log-viewer-pane">
        <div class="pane-header">
          <span>Log Content</span>
          <button v-if="logPath" @click="loadFromFile" class="refresh-log-btn" title="Refresh Log Content">🔄</button>
        </div>
        <div 
          ref="logDisplayRef"
          class="log-display" 
          v-html="highlightedLog"
          @click="handleLogClick"
        ></div>
      </div>

      <!-- Right: Extraction Units -->
      <div class="extraction-pane">
        <div class="pane-header">
          <span>GET SQL</span>
          <button @click="clearAllExtractions" class="clear-all-btn" title="Clear All Queries">🗑️ Clear All</button>
        </div>
        <div class="extraction-list">
          <div 
            v-for="(ext, index) in extractions" 
            :key="ext.id" 
            class="extraction-unit"
          >
            <div class="unit-header">
              <div class="input-group">
                <input 
                  v-model="ext.searchId" 
                  placeholder="id..." 
                  class="theme-input mini-id" 
                  :class="{ 'highlighted-input': ext.isHighlighting }"
                  @keyup.enter="processSql(index)" 
                />
              </div>
              <div class="unit-actions">
                <button @click="processSql(index)" class="theme-button get-btn">GET</button>
                <button v-if="extractions.length > 1" @click="removeExtraction(index)" class="remove-btn">&times;</button>
              </div>
            </div>
            
            <div v-if="ext.resultSql" class="result-area">
              <div class="result-toolbar">
                <span>Result:</span>
                <button @click="copyResult(ext.resultSql)" class="copy-btn">Copy</button>
              </div>
              <pre class="sql-output"><code>{{ ext.resultSql }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sql-helper-split {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0;
  overflow: hidden;
  position: absolute; /* Force it to stay within its container's bounds if flex is weird */
  top: 0; left: 0; right: 0; bottom: 0;
}

.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  border-bottom: var(--border-style);
  flex-shrink: 0;
  background-color: var(--container-bg);
}

.file-picker-group {
  display: flex;
  align-items: center;
  gap: 15px;
}

.split-workspace {
  display: flex;
  flex: 1; /* Stretch vertically */
  gap: 20px;
  overflow: hidden;
  padding: 10px; /* Minimal padding for professional breathing room */
  min-height: 0; /* Important for flex children to stretch correctly in some browsers */
}

.log-viewer-pane, .extraction-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: var(--border-style);
  border-radius: var(--border-radius);
  background-color: var(--container-bg);
  overflow: hidden;
}

.pane-header {
  padding: 8px 12px;
  background-color: var(--button-bg);
  border-bottom: var(--border-style);
  font-weight: bold;
  font-size: 0.85rem;
  opacity: 0.8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.refresh-log-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0 4px;
  display: flex;
  align-items: center;
  transition: transform 0.2s;
}

.refresh-log-btn:hover {
  transform: scale(1.1);
}

.clear-all-btn {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.2);
  color: var(--text-color);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-all-btn:hover {
  background: rgba(255, 0, 0, 0.2);
  transform: scale(1.05);
}

.log-display {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 10px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Custom Scrollbar */
.log-display::-webkit-scrollbar {
  width: 10px; /* Slightly wider for better visibility */
}

.log-display::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.log-display::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.5); /* More opaque */
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.log-display::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.8);
}

:deep(.clickable-id) {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
  font-weight: bold;
  padding: 0 2px;
  border-radius: 2px;
  transition: background 0.2s, color 0.2s;
}

:deep(.clickable-id.existing-id) {
  color: #ff9800; /* Distinct color for existing IDs */
  text-decoration-style: dashed;
}

:deep(.clickable-id:hover) {
  background-color: var(--accent-color);
  color: #fff;
}

.placeholder-text {
  opacity: 0.5;
  font-style: italic;
}

.extraction-pane {
  background-color: transparent;
  border: none;
}

.extraction-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 1px;
}

.extraction-unit {
  background-color: var(--container-bg);
  border: var(--border-style);
  border-radius: var(--border-radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.highlighted-input {
  border-color: var(--accent-color) !important;
  box-shadow: 0 0 10px var(--accent-color);
  transform: scale(1.05);
  transition: all 0.3s ease;
}

.unit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mini-id {
  width: 150px !important;
  padding: 4px 8px !important;
  font-size: 0.9rem !important;
}

.unit-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.remove-btn {
  background: none;
  border: none;
  color: #ff4d4d;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 5px;
}

.result-area {
  margin-top: 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.result-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  opacity: 0.7;
}

.copy-btn {
  background: none;
  border: 1px solid var(--border-style);
  color: var(--text-color);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.sql-output {
  margin: 0;
  padding: 10px;
  background-color: #1e1e1e;
  color: #d4d4d4;
  overflow-x: auto;
  border-radius: 4px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.theme-input {
  background-color: var(--input-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  padding: 6px 10px;
}

.theme-button {
  background-color: var(--button-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  padding: 6px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}

.theme-button:hover {
  background-color: var(--button-hover);
}

.choose-btn {
  background-color: var(--accent-color);
  color: #fff;
  border: none;
}

.add-query-btn {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.file-path-display-full {
  font-size: 0.85rem;
  color: #888; /* Gray color */
  word-break: break-all;
  line-height: 1.2;
}

.get-btn {
  background-color: var(--accent-color) !important;
  color: #fff !important;
  min-width: 60px;
}

</style>
