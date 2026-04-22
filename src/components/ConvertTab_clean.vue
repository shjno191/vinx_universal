<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VueMonacoEditor, VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { theme as globalTheme } from '../store';

import { writeText } from '@tauri-apps/plugin-clipboard-manager';

// --- State ---
const inputText = ref('');
const resultText = ref('');
const isProcessing = ref(false);
const showDiff = ref(false);
const convertMode = ref<'PDA' | 'Common'>('PDA');
const selectedEncoding = ref('Shift_JIS');
const status = ref({ type: '', msg: '' });
const leftEditorRef = ref<any>(null);
const rightEditorRef = ref<any>(null);
const diffEditorRef = ref<any>(null);


// --- Monaco Options ---
const editorOptions = computed(() => ({
  fontSize: 13,
  minimap: { enabled: false },
  wordWrap: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  theme: globalTheme.value === 'dark' ? 'vs-dark' : 'vs',
  lineNumbers: 'on' as const,
  readOnly: false,
  padding: { top: 10, bottom: 10 },
  scrollbar: {
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    vertical: 'visible' as const,
    horizontal: 'visible' as const,
  },
}));

const handleLeftMount = (editor: any) => { leftEditorRef.value = editor; updateSearchHighlights(); };
const handleRightMount = (editor: any) => { rightEditorRef.value = editor; updateSearchHighlights(); };
const handleDiffMount = (editor: any) => { diffEditorRef.value = editor; updateSearchHighlights(); };

// --- Search Highlighting ---
const updateSearchHighlights = () => {
  // Feature removed
};


watch(showDiff, () => nextTick(() => updateSearchHighlights()));

// --- Actions ---
const clearAll = () => {
  inputText.value = '';
  resultText.value = '';
  status.value = { type: '', msg: '' };
  showDiff.value = false;
};

const copyResult = async () => {
  if (!resultText.value) return;
  try {
    await writeText(resultText.value);
    status.value = { type: 'success', msg: 'Copied to clipboard!' };
    setTimeout(() => { if (status.value.msg === 'Copied to clipboard!') status.value = { type: '', msg: '' }; }, 2000);
  } catch {
    status.value = { type: 'error', msg: 'Failed to copy' };
  }
};

const handleConvert = async () => {
  if (!inputText.value.trim()) {
    status.value = { type: 'warn', msg: 'Please enter code first' };
    return;
  }
  isProcessing.value = true;
  status.value = { type: '', msg: 'Processing...' };
  try {
    await new Promise(r => setTimeout(r, 400));
    let result = inputText.value;

    if (convertMode.value === 'PDA') {
      result = addVersionComment(result);   // STEP 1
      result = fixCssLinks(result);         // STEP 2
      result = normalizeHtml(result);       // STEP 3
      result = buildStyleBlock(result);     // STEP 4
      result = normalizeIndent(result);     // STEP 5
    } else {
      result = addVersionComment(result);
      result = normalizeHtml(result);
      result = normalizeIndent(result);
    }

    resultText.value = result;
    showDiff.value = true;
    status.value = { type: 'success', msg: `Successfully converted using ${convertMode.value} mode!` };
  } catch (err: any) {
    status.value = { type: 'error', msg: 'Conversion failed: ' + err.message };
  } finally {
    isProcessing.value = false;
  }
};

// ==========================================================================================================================================================
// STEP 1: Add version info to the header comment block <%-- --%>
// Logic: Find the last "- Version X.0Y" line within the header block,
// increment the minor version, and append a new entry before the block closing " --%>"
// ==========================================================================================================================================================
const addVersionComment = (code: string): string => {
  // Extract all version lines inside the header comment block
  const headerBlock = code.match(/<%--[\s\S]*?--%>/);
  if (!headerBlock) return code;

  const allVersions = [...headerBlock[0].matchAll(/-\s*Version\s+(\d+)\.(\d+)/g)];
  if (!allVersions.length) return code;

  const last = allVersions[allVersions.length - 1];
  const major = last[1];
  const minor = parseInt(last[2], 10);
  const newMinor = String(minor + 1).padStart(2, '0');
  const newLine = ` - Version ${major}.${newMinor} 2026/04/22 VINX Standardization`;

  // Insert after the last version line, before the closing tag " --%>"
  const lastVersionLineRegex = /([ \t]*-\s*Version\s+\d+\.\d+[^\n]*)(\n[ \t]*--%>)/;
  if (lastVersionLineRegex.test(code)) {
    return code.replace(lastVersionLineRegex, `$1\n${newLine}$2`);
  }
  return code;
};

// ==========================================================================================================================================================
// STEP 2: Fix CSS links and script wrappers
// 2a: Replace common.css with common_pda.css (PDA mode only)
// 2b: Remove legacy link tags
// 2c: Remove legacy HTML comment wrappers <!-- ... //--> inside <script> tags
// ==========================================================================================================================================================
const fixCssLinks = (code: string): string => {
  // 2a - Switch to common_pda.css
  code = code.replace(
    /(<link[^>]*href=["'])css\/common\.css(["'][^>]*>)/g,
    '$1css/common_pda.css$2'
  );

  // 2b - Remove outdated default_*.css links
  code = code.replace(/^[ \t]*<link[^>]+href=["'][^"']*default_[^"']*["'][^>]*>[ \t]*\n?/gm, '');

  // 2c - Clear legacy HTML comment wrappers inside script tags
  code = code.replace(
    /(<script[^>]*>)\s*\n[ \t]*<!--[ \t]*\n([\s\S]*?)\n[ \t]*\/\/-->[ \t]*\n/g,
    (_, openTag, inner) => {
      // Remove legacy 4-space indentation from old formatter
      const trimmed = inner.replace(/^    /gm, '');
      return `${openTag}\n${trimmed}\n`;
    }
  );

  return code;
};

// ==========================================================================================================================================================
// STEP 3: Normalize HTML structure
// - Remove empty <br> tags used for spacing
// - Replace window.close() with a reliable self-closing script
// - Remove obsolete layout attributes (border=0, etc.) from tables
// ==========================================================================================================================================================
const normalizeHtml = (code: string): string => {
  // Remove redundant <br> spacing lines
  code = code.replace(/^[ \t]*<br\s*\/?>[ \t]*\n/gm, '');

  // Fix window.close consistency
  code = code.replace(/window\.close\(\);/g, "window.open('about:blank', '_self').close();");

  // Remove legacy layout attributes
  code = code.replace(/\s+border=["']0["']/g, '');
  code = code.replace(/\s+cellspacing=["']0["']/g, '');
  code = code.replace(/\s+cellpadding=["']0["']/g, '');

  return code;
};

// ==========================================================================================================================================================
// STEP 4: Build <style> block from extracted inline styles
// Logic: Extract more inline style="..." and convert each to a CSS rule using tag+class or tag#id selector
// Skip button styles (width/height/border) to use standard pda_btn instead.
// Keep display:none inline for dynamic control.
// ==========================================================================================================================================================
const buildStyleBlock = (code: string): string => {
  const cssRules: string[] = [];
  const seen = new Set<string>();

  // Extract tags with inline styles
  const tagRegex = /<([\w:]+)([^>]*?)>/gs;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(code)) !== null) {
    const tag = m[1];
    const attrs = m[2];

    const styleMatch = attrs.match(/\bstyle=["']([^"']+)["']/);
    if (!styleMatch) continue;

    const styleVal = styleMatch[1].trim();

    // Keep display:none inline
    if (/^\s*display\s*:\s*none\s*;?\s*$/.test(styleVal)) continue;
    // Skip button styles
    if (/width\s*:/.test(styleVal) && /height\s*:/.test(styleVal) && /(border|border-radius)\s*:/.test(styleVal)) continue;

    const classMatch = attrs.match(/\bclass=["']([^"']+)["']/);
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
    const propMatch = attrs.match(/\bproperty=['"]([^'"]+)['"]/);

    let selector = '';
    if (classMatch) {
      const firstClass = classMatch[1].trim().split(/\s+/)[0];
      selector = `${tag}.${firstClass}`;
    } else if (idMatch) {
      selector = `${tag}#${idMatch[1]}`;
    } else if (propMatch) {
      const cleanId = propMatch[1].replace(/[[\].]/g, '_');
      selector = `span#${cleanId}`;
    }

    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    const props = styleVal
      .split(';')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `\t\t${p};`)
      .join('\n');

    cssRules.push(`\t${selector} {\n${props}\n\t}`);
  }

  if (cssRules.length === 0) return code;

  const styleBlock = `<style type="text/css">\n${cssRules.join('\n\n')}\n</style>`;

  // Remove existing style block
  code = code.replace(/<style[^>]*>[\s\S]*?<\/style>\n?/g, '');

  // Insert before </head>
  return code.replace(/(\n?)([ \t]*<\/head>)/i, `\n${styleBlock}\n$2`);
};

// ==========================================================================================================================================================
// STEP 5: Normalize indentation using Tabs
// Logic:
//   - Uses \t (1 tab = 1 indentation level)
//   - JSP directives and headers stay at level 0
//   - Decrement depth BEFORE printing the closing tag
//   - Increment depth AFTER printing an opening tag (skip self-closing tags)
// ==========================================================================================================================================================
const normalizeIndent = (code: string): string => {
  const TAB = '\t';
  const lines = code.split('\n');
  const result: string[] = [];
  let depth = 0;

  // Indent-triggering tags
  const BLOCK_OPEN = /^<(html:html|html:form|head|body|table|tbody|thead|tfoot|tr|td|th|div|ul|ol|li|select|option|style|script|fvo:span|logic:iterate|logic:notEmpty|logic:empty|logic:equal|logic:notEqual|bean:define)(\s|>)/i;

  // Self-closing tags that do not increase depth
  const SELF_CLOSE = /\/>$|^<(meta|link|input|br|hr|img|jsp:include|jsp:param|fvo:text|fvo:submit|fvo:checkbox|fvo:button|fvo:hidden|html:hidden)(\s|>|\/)/i;

  // Closing tags that decrease depth
  const BLOCK_CLOSE = /^<\/(html:html|html:form|head|body|table|tbody|thead|tfoot|tr|td|th|div|ul|ol|li|select|option|style|script|fvo:span|logic:iterate|logic:notEmpty|logic:empty|logic:equal|logic:notEqual|bean:define)>/i;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { result.push(''); continue; }

    // Level 0 tags
    if (/^<%[@!]/.test(line) || /^<%--/.test(line) || /^--%>/.test(line) || /^<!DOCTYPE/i.test(line)) {
      result.push(line);
      continue;
    }

    if (BLOCK_CLOSE.test(line)) {
      depth = Math.max(0, depth - 1);
    }

    result.push(TAB.repeat(depth) + line);

    if (BLOCK_OPEN.test(line) && !SELF_CLOSE.test(line) && !BLOCK_CLOSE.test(line)) {
      const tagName = line.match(/^<([\w:]+)/)?.[1] ?? '';
      const closeOnSameLine = new RegExp(`</${tagName.replace(':', '\\:')}>`, 'i').test(line);
      if (!closeOnSameLine) {
        depth++;
      }
    }
  }

  return result.join('\n');
};
</script>

<template>
  <div class="convert-root" :class="{ 'win95-bg': globalTheme === '95' }">
    <header class="main-toolbar glass">
      <div class="t-left">
        <span class="t-brand">CONVERT UI</span>
        <div class="t-controls">
          <div class="control-group">
            <span class="c-label">MODE</span>
            <select v-model="convertMode" class="c-select">
              <option value="PDA">PDA JSP</option>
              <option value="Common">Common</option>
            </select>
          </div>
          <div class="control-group">
            <span class="c-label">ENCODING</span>
            <select v-model="selectedEncoding" class="c-select">
              <option value="Shift_JIS">Shift_JIS (JP)</option>
              <option value="UTF-8">UTF-8</option>
              <option value="EUC-JP">EUC-JP (JP)</option>
              <option value="Windows-31J">MS932</option>
            </select>
          </div>
        </div>
      </div>
      <div class="t-right">
        <button class="t-btn-icon" @click="clearAll" title="Clear All">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <div class="t-divider"></div>
        <button class="t-btn-text" @click="showDiff = !showDiff" :class="{ active: showDiff }">
          {{ showDiff ? 'View Result' : 'Comparison' }}
        </button>
        <button class="t-btn-text" @click="copyResult" :disabled="!resultText">Copy</button>
        <button class="t-btn-primary" @click="handleConvert" :disabled="isProcessing">
          <span v-if="!isProcessing">Convert</span>
          <span v-else class="t-loader"></span>
        </button>
      </div>
    </header>

    <div class="status-tip" v-if="status.msg" :class="status.type">
      {{ status.msg }}
    </div>

    <main class="workspace" :class="{ 'is-unified': showDiff }">
      <template v-if="!showDiff">
        <div class="w-pane">
          <div class="w-header"><span class="w-label">SOURCE (INPUT)</span></div>
          <div class="w-editor">
            <VueMonacoEditor
              v-model:value="inputText"
              language="html"
              :options="editorOptions"
              @mount="handleLeftMount"
            />
          </div>
        </div>
        <div class="w-pane">
          <div class="w-header"><span class="w-label">RESULT (OUTPUT)</span></div>
          <div class="w-editor">
            <VueMonacoEditor
              v-model:value="resultText"
              language="html"
              :options="{ ...editorOptions, readOnly: true }"
              @mount="handleRightMount"
            />
          </div>
        </div>
      </template>
      <div v-else class="w-pane full-width">
        <div class="w-header"><span class="w-label">COMPARISON: SOURCE VS CONVERTED</span></div>
        <div class="w-editor">
          <VueMonacoDiffEditor
            :original="inputText"
            :modified="resultText"
            language="html"
            :options="{ ...editorOptions, readOnly: true }"
            @mount="handleDiffMount"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.convert-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 12px;
  box-sizing: border-box;
  background: var(--container-bg);
  color: var(--text-color);
}
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.main-toolbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-radius: 12px;
  flex-shrink: 0;
}
.t-left { display: flex; align-items: center; gap: 24px; }
.t-brand { font-weight: 900; font-size: 0.8rem; letter-spacing: 0.15em; color: var(--accent-color); }
.t-controls { display: flex; align-items: center; gap: 16px; }
.control-group { display: flex; align-items: center; gap: 8px; }
.c-label { font-size: 0.6rem; font-weight: 800; opacity: 0.4; letter-spacing: 0.05em; }
.c-select {
  background: rgba(0,0,0,0.06);
  border: 1px solid var(--glass-border);
  color: var(--text-color);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  outline: none;
  cursor: pointer;
}
.t-right { display: flex; align-items: center; gap: 10px; }
.t-divider { width: 1px; height: 16px; background: var(--glass-border); }
.t-btn-icon {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-color);
  width: 30px; height: 30px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.t-btn-icon:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.t-btn-text {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-color);
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
.t-btn-text:disabled { opacity: 0.4; cursor: not-allowed; }
.t-btn-text.active { background: var(--accent-color); color: white; border-color: var(--accent-color); }
.t-btn-primary {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 5px 16px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  height: 30px;
}
.t-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.status-tip {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
}
.status-tip.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
.status-tip.warn    { background: rgba(234, 179, 8, 0.1);  color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); }
.status-tip.error   { background: rgba(239, 68, 68, 0.1);  color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.workspace { flex: 1; display: flex; gap: 12px; min-height: 0; }
.workspace.is-unified { flex-direction: column; }
.w-pane {
  flex: 1; display: flex; flex-direction: column;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
}
.w-pane.full-width { flex: none; height: 100%; }
.w-header {
  height: 32px; display: flex; align-items: center;
  padding: 0 12px;
  background: rgba(0,0,0,0.03);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}
.w-label { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.4; }
.w-editor { flex: 1; min-height: 0; }
.t-loader {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,.3);
  border-radius: 50%; border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.win95-bg .glass {
  background: #c0c0c0 !important;
  border: 2px solid !important;
  border-color: #ffffff #808080 #808080 #ffffff !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}
</style>
