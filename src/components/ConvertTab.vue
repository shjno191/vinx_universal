<script setup lang="ts">
import { ref, computed, watch } from 'vue';

type ConversionType = 'JSON_TO_TS' | 'BASE64_ENCODE' | 'BASE64_DECODE' | 'URL_ENCODE' | 'URL_DECODE' | 'UPPERCASE' | 'LOWERCASE' | 'CLEAN_JSON';

const inputText = ref('');
const resultText = ref('');
const selectedType = ref<ConversionType>('JSON_TO_TS');
const isProcessing = ref(false);

const conversionOptions: { value: ConversionType; label: string }[] = [
  { value: 'JSON_TO_TS', label: 'JSON to TypeScript Interface' },
  { value: 'CLEAN_JSON', label: 'Clean & Format JSON' },
  { value: 'BASE64_ENCODE', label: 'Base64 Encode' },
  { value: 'BASE64_DECODE', label: 'Base64 Decode' },
  { value: 'URL_ENCODE', label: 'URL Encode' },
  { value: 'URL_DECODE', label: 'URL Decode' },
  { value: 'UPPERCASE', label: 'To Uppercase' },
  { value: 'LOWERCASE', label: 'To Lowercase' },
];

const handleConvert = () => {
  if (!inputText.value) {
    resultText.value = '';
    return;
  }

  isProcessing.value = true;
  try {
    switch (selectedType.value) {
      case 'JSON_TO_TS':
        resultText.value = jsonToTs(inputText.value);
        break;
      case 'CLEAN_JSON':
        resultText.value = JSON.stringify(JSON.parse(inputText.value), null, 2);
        break;
      case 'BASE64_ENCODE':
        resultText.value = btoa(inputText.value);
        break;
      case 'BASE64_DECODE':
        resultText.value = atob(inputText.value);
        break;
      case 'URL_ENCODE':
        resultText.value = encodeURIComponent(inputText.value);
        break;
      case 'URL_DECODE':
        resultText.value = decodeURIComponent(inputText.value);
        break;
      case 'UPPERCASE':
        resultText.value = inputText.value.toUpperCase();
        break;
      case 'LOWERCASE':
        resultText.value = inputText.value.toLowerCase();
        break;
    }
  } catch (e) {
    resultText.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    isProcessing.value = false;
  }
};

const jsonToTs = (jsonStr: string): string => {
  try {
    const obj = JSON.parse(jsonStr);
    let ts = 'interface GeneratedInterface {\n';
    
    const parseObj = (o: any, indent = '  ') => {
      let result = '';
      for (const key in o) {
        const type = typeof o[key];
        if (type === 'object' && o[key] !== null) {
          if (Array.isArray(o[key])) {
            const itemType = o[key].length > 0 ? typeof o[key][0] : 'any';
            result += `${indent}${key}: ${itemType}[];\n`;
          } else {
            result += `${indent}${key}: {\n${parseObj(o[key], indent + '  ')}${indent}};\n`;
          }
        } else {
          result += `${indent}${key}: ${type};\n`;
        }
      }
      return result;
    };

    ts += parseObj(obj);
    ts += '}';
    return ts;
  } catch {
    return 'Invalid JSON for TS conversion';
  }
};

const clearAll = () => {
  inputText.value = '';
  resultText.value = '';
};

const swapText = () => {
  const temp = inputText.value;
  inputText.value = resultText.value;
  resultText.value = temp;
};

const copyResult = () => {
  navigator.clipboard.writeText(resultText.value);
};

// Syncing scroll
const leftBox = ref<HTMLTextAreaElement | null>(null);
const rightBox = ref<HTMLTextAreaElement | null>(null);

const syncScroll = (side: 'left' | 'right') => {
  if (side === 'left' && leftBox.value && rightBox.value) {
    rightBox.value.scrollTop = leftBox.value.scrollTop;
  } else if (side === 'right' && leftBox.value && rightBox.value) {
    leftBox.value.scrollTop = rightBox.value.scrollTop;
  }
};

watch(inputText, () => {
  handleConvert();
});

watch(selectedType, () => {
  handleConvert();
});
</script>

<template>
  <div class="convert-container">
    <header class="convert-header glass">
      <div class="toolbar-left">
        <span class="toolbar-label">CONVERSION TYPE</span>
        <select v-model="selectedType" class="premium-select">
          <option v-for="opt in conversionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="toolbar-right">
        <button @click="swapText" class="action-btn" title="Swap Input/Output">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/></svg>
        </button>
        <button @click="clearAll" class="action-btn danger" title="Clear All">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
        <div class="divider"></div>
        <button @click="copyResult" class="action-btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          COPY RESULT
        </button>
      </div>
    </header>

    <main class="convert-main">
      <div class="editor-pane glass">
        <div class="pane-header">INPUT</div>
        <textarea 
          ref="leftBox"
          v-model="inputText" 
          @scroll="syncScroll('left')"
          placeholder="Paste data here..."
          spellcheck="false"
        ></textarea>
      </div>

      <div class="editor-pane glass">
        <div class="pane-header">OUTPUT</div>
        <textarea 
          ref="rightBox"
          v-model="resultText" 
          @scroll="syncScroll('right')"
          placeholder="Result will appear here..."
          spellcheck="false"
          readonly
        ></textarea>
      </div>
    </main>
  </div>
</template>

<style scoped>
.convert-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 15px;
  gap: 15px;
  background: var(--container-bg);
  box-sizing: border-box;
  overflow: hidden;
}

.convert-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-radius: 12px;
  flex-shrink: 0;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.toolbar-label {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  opacity: 0.6;
  color: var(--text-color);
}

.premium-select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-color);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  min-width: 220px;
  transition: all 0.2s;
}

.premium-select:hover {
  background: rgba(255, 255, 255, 0.08);
}

.action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: var(--text-color);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.8;
}

.action-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.action-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.action-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.convert-main {
  flex: 1;
  display: flex;
  gap: 15px;
  min-height: 0;
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.pane-header {
  height: 34px;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  padding: 0 15px;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.15em;
  opacity: 0.4;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-color);
  padding: 15px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:root.theme-light .premium-select {
  background: rgba(0, 0, 0, 0.05);
  color: #334155;
}

:root.theme-light .action-btn {
  background: rgba(0, 0, 0, 0.05);
  color: #334155;
}
</style>
