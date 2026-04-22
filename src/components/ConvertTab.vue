<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VueMonacoEditor, VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { theme as globalTheme } from '../store';

import { writeText } from '@tauri-apps/plugin-clipboard-manager';
// import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

// --- State ---
const inputText = ref('');
const resultText = ref('');
const isProcessing = ref(false);
const showDiff = ref(false);
const convertMode = ref<'PDA' | 'Common'>('PDA');
const selectedEncoding = ref('Shift_JIS');
const lastOpenedPath = ref('');
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
  tabSize: 4,
  insertSpaces: false,
  detectIndentation: false,
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

// Encoding Re-open logic
const reopenWithEncoding = async () => {
  if (!lastOpenedPath.value) return;
  try {
    const content = await invoke('read_file_content', { path: lastOpenedPath.value });
    inputText.value = content as string;
    status.value = { type: 'success', msg: `Re-opened with ${selectedEncoding.value}` };
  } catch (e) {
    status.value = { type: 'error', msg: 'Re-open failed' };
  }
};

watch(selectedEncoding, () => {
  if (lastOpenedPath.value) reopenWithEncoding();
});

// --- Actions ---
/*
const openFile = async () => {
  const selected = await open({ 
    multiple: false, 
    filters: [{ name: 'JSP Files', extensions: ['jsp'] }, { name: 'All Files', extensions: ['*'] }] 
  });
  if (!selected) return;
  const p = Array.isArray(selected) ? selected[0] : selected;
  try {
    const content = await invoke('read_file_content', { path: p });
    inputText.value = content as string;
    lastOpenedPath.value = p;
    status.value = { type: 'success', msg: `Opened: ${p.split(/[/\\]/).pop()}` };
  } catch (e) {
    status.value = { type: 'error', msg: 'Open file error' };
  }
};
*/

const clearAll = () => {
  inputText.value = '';
  resultText.value = '';
  lastOpenedPath.value = '';
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
  const newLine = ` - Version ${major}.${newMinor} 2026/04/10 VINX redmine#43477_UI_Standardization`;

  // Insert after the last version line, before the closing tag " --%>"
  // Regex: matches the entire last version line and captures the trailing closing tag block
  const lastVersionLineRegex = /([ \t]*-\s*Version\s+\d+\.\d+[^\n]*)(\n[ \t]*--%>)/;
  if (lastVersionLineRegex.test(code)) {
    return code.replace(lastVersionLineRegex, `$1\n${newLine}$2`);
  }
  return code;
};

// ==========================================================================================================================================================
// STEP 2: Fix CSS links and script wrappers
// 2a: Replace common.css with common_pda.css (PDA mode only)
// 2b: Remove all default_*.css and dailyorder.css link lines
// 2c: Remove legacy HTML comment wrappers <!-- ... //--> inside <script> tags
// ==========================================================================================================================================================
const fixCssLinks = (code: string): string => {
  // 2a - Switch to common_pda.css exclusively
  code = code.replace(
    /(<link[^>]*href=["'])css\/common\.css(["'][^>]*>)/g,
    '$1css/common_pda.css$2'
  );

  // 2b - Remove outdated CSS links
  code = code.replace(/^[ \t]*<link[^>]+href=["'][^"' ]*default_[^"' ]*["'][^>]*>[ \t]*\n?/gm, '');
  code = code.replace(/^[ \t]*<link[^>]+href=["'][^"' ]*dailyorder[^"' ]*["'][^>]*>[ \t]*\n?/gm, '');

  // 2c - Clear legacy HTML comment wrappers inside script tags
  code = code.replace(
    /(<script[^>]*>)\s*\n[ \t]*<!--[ \t]*\n([\s\S]*?)\n[ \t]*\/\/-->[ \t]*\n/g,
    (_, openTag, inner) => {
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

  // Remove legacy layout attributes from Tables and ensure PDA-standard attributes
  code = code.replace(/<table([^>]*)>/gi, (_match, attrs) => {
    // Strip old positioning attributes if present
    let cleanAttrs = attrs.replace(/\s+(border|cellspacing|cellpadding|width)=["'][^"']*["']/gi, '');
    // Append mandatory PDA attributes
    return `<table${cleanAttrs} cellpadding="0" cellspacing="0" border="0" width="100%">`;
  });

  // Restructure Body if pda_list wrapper is missing
  if (code.includes('<body>') && !code.includes('class="pda_list')) {
    code = code.replace(/(<body[^>]*>)\s*([\s\S]*?)\s*(<\/body>)/i, (match, bodyOpen, content, bodyClose) => {
      const formMatch = content.match(/(<html:form[^>]*>)([\s\S]*?)(<\/html:form>)/i);
      if (formMatch) {
        const [_, formOpen, formInner, formClose] = formMatch;
        // Wrap form content in a centered 100% table for alignment
        const wrappedInner = `
	<table cellpadding="0" cellspacing="0" border="0" width="100%">
		<tr>
			<td align="center" valign="top">
				${formInner.trim()}
			</td>
		</tr>
	</table>
`;
        
        let finalInner = wrappedInner;
        // Auto-wrap child tables with pda_listX classes into corresponding Divs
        finalInner = finalInner.replace(/(<table[^>]*class=["'](pda_list\d+)[^"']*["'][^>]*>[\s\S]*?<\/table>)/g, (_m, table, className) => {
           return `<div class="${className}">\n${table}\n</div>`;
        });
        
        return `${bodyOpen}\n${formOpen}${finalInner}${formClose}\n${bodyClose}`;
      }
      return match;
    });
  }
  return code;
};

// ==========================================================================================================================================================
// STEP 4: Build <style> block from extracted inline styles
// Logic: Extract inline style="..." and convert each to a CSS rule using tag+class or tag#id selector
// Skip button styles (width/height/border) to use standard pda_btn instead.
// Keep display:none inline for dynamic control.
// ==========================================================================================================================================================
const buildStyleBlock = (code: string): string => {
  const cssRules = [];
  const seen = new Set();

  // Add default PDA styles
  cssRules.push("\tdiv[class^=\"pda_list\"] {\n\t\twidth: 240px;\n\t\tpadding-top: 10px;\n\t}\n\n\ttable[class^=\"pda_list\"] {\n\t\twidth: 240px;\n\t}\n\n\ttable.pda_list2_alarm {\n\t\twidth: 200px;\n\t\theight: 213px;\n\t\tbackground-color: red;\n\t\tmargin: auto;\n\t}\n\n\tth.pda_list2_alarm_title {\n\t\ttext-align: center;\n\t\theight: 28px;\n\t}\n\n\ttd.pda_list2_alarm_msg {\n\t\tvertical-align: top;\n\t\ttext-align: left;\n\t\tbackground-color: white;\n\t\tpadding: 5px;\n\t\theight: 180px;\n\t}\n\n\tspan#disp_alarm_title {\n\t\tfont-size: 16px;\n\t\tcolor: white;\n\t}");

  const tagRegex = /<([\w:]+)([^>]*?)>/gs;
  let m;
  while ((m = tagRegex.exec(code)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    const styleMatch = attrs.match(/\bstyle=["']([^"']+)["']/);
    if (!styleMatch) continue;

    const styleVal = styleMatch[1].trim();
    if (/^\s*display\s*:\s*none\s*;?\s*$/.test(styleVal)) continue;
    if (/width\s*:/.test(styleVal) && /height\s*:/.test(styleVal) && /border-radius\s*:/.test(styleVal)) continue;

    const classMatch = attrs.match(/\bclass=["']([^"']+)["']/);
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
    const propMatch = attrs.match(/\bproperty=['"]([^'"]+)['"]/);

    let selector = "";
    if (classMatch) {
      selector = `${tag}.${classMatch[1].trim().split(/\s+/)[0]}`;
    } else if (idMatch) {
      selector = `${tag}#${idMatch[1]}`;
    } else if (propMatch) {
      selector = `${tag}#${propMatch[1].replace(/[[\].]/g, "_")}`;
    }

    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    const props = styleVal.split(";").map(p => p.trim()).filter(Boolean).map(p => `\t\t${p};`).join("\n");
    cssRules.push(`\t${selector} {\n${props}\n\t}`);
  }

  const styleBlock = cssRules.length > 0 ? `<style type="text/css">\n${cssRules.join("\n\n")}\n</style>` : "";
  code = code.replace(/<style[^>]*>[\s\S]*?<\/style>\n?/g, "");

  if (code.includes("<script type=\"text/JavaScript\">")) {
    return code.replace(/([ \t]*<script type=["']text\/JavaScript["']>)/i, `${styleBlock}\n$1`);
  }
  if (code.includes("<script")) {
    return code.replace(/([ \t]*<script)/i, `${styleBlock}\n$1`);
  }
  if (code.includes("commonName.jsp")) {
    return code.replace(/([ \t]*<%@\s*include\s*file=["']commonName\.jsp["']\s*%>)/i, `${styleBlock}\n$1`);
  }
  return code.replace(/([ \t]*<\/head>)/i, `${styleBlock}\n$1`);
};

// ==========================================================================================================================================================
// STEP 5: Normalize indentation using Tabs
// Logic:
//   - Uses \t (1 tab = 1 indentation level)
//   - JSP directives and headers stay at level 0
//   - Decrement depth BEFORE printing the closing tag
//   - Increment depth AFTER printing an opening tag (skip self-closing tags)
//   - Handle nested Ruby/JS/CSS blocks by tracking brace depth (simplified approach)
// ==========================================================================================================================================================
const normalizeIndent = (code: string): string => {
  const TAB = '\t';
  const lines = code.split('\n');
  const result = [];
  let depth = 0;

  const BLOCK_OPEN = /^<(html:html|html:form|head|body|table|tbody|thead|tfoot|tr|td|th|div|ul|ol|li|select|option|style|script|fvo:span|logic:iterate|logic:notEmpty|logic:empty|logic:equal|logic:notEqual|bean:define)(\s|>)/i;
  const SELF_CLOSE = /\/>$|^<(meta|link|input|br|hr|img|jsp:include|jsp:param|fvo:text|fvo:submit|fvo:checkbox|fvo:button|fvo:hidden|html:hidden)(\s|>|\/)/i;
  const BLOCK_CLOSE = /^<\/(html:html|html:form|head|body|table|tbody|thead|tfoot|tr|td|th|div|ul|ol|li|select|option|style|script|fvo:span|logic:iterate|logic:notEmpty|logic:empty|logic:equal|logic:notEqual|bean:define)>/i;

  for (const raw of lines) {
    let line = raw.trim();
    if (!line) { result.push(''); continue; }

    const isLevel0 = /^<%[@!-]|<%--|<html:html|<!DOCTYPE|<html|<body|<head|--%>/.test(line);
    if (BLOCK_CLOSE.test(line)) depth = Math.max(0, depth - 1);
    
    const currentIndent = isLevel0 ? 0 : depth;
    result.push(TAB.repeat(currentIndent) + line);

    if (BLOCK_OPEN.test(line) && !SELF_CLOSE.test(line)) {
      const tagMatch = line.match(/^<([\w:]+)/);
      if (tagMatch) {
         const tagName = tagMatch[1];
         const closeRegex = new RegExp(`</${tagName.replace(':', '\\:')}>`, 'i');
         if (!closeRegex.test(line)) depth++;
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
              :options="editorOptions"
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
            :options="editorOptions"
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

.t-btn-icon:hover { 
  background: rgba(239, 68, 68, 0.1); 
  color: #ef4444; 
  transform: translateY(-1px);
}

.t-btn-primary:active {
  transform: translateY(1px);
}

.w-pane {
  transition: all 0.3s ease;
}

.w-pane:hover {
  border-color: var(--accent-color);
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
</style>












