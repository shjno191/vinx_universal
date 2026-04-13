<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VueMonacoEditor, VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { theme as globalTheme, globalSearchQuery } from '../store';
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
const leftDecorations = ref<string[]>([]);
const rightDecorations = ref<string[]>([]);
const diffDecorations = ref<{ original: string[]; modified: string[] }>({ original: [], modified: [] });

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
  const query = globalSearchQuery.value;
  const getDecorations = (model: any, q: string) => {
    if (!model || !q) return [];
    try {
      const matches = model.findMatches(q, false, false, false, null, false);
      return (matches || []).map((m: any) => ({ range: m.range, options: { inlineClassName: 'global-search-match' } }));
    } catch { return []; }
  };
  if (leftEditorRef.value && !showDiff.value) {
    const model = leftEditorRef.value.getModel();
    if (model) leftDecorations.value = leftEditorRef.value.deltaDecorations(leftDecorations.value, query ? getDecorations(model, query) : []);
  }
  if (rightEditorRef.value && !showDiff.value) {
    const model = rightEditorRef.value.getModel();
    if (model) rightDecorations.value = rightEditorRef.value.deltaDecorations(rightDecorations.value, query ? getDecorations(model, query) : []);
  }
  if (diffEditorRef.value && showDiff.value) {
    const original = diffEditorRef.value.getOriginalEditor();
    const modified = diffEditorRef.value.getModifiedEditor();
    const oModel = original?.getModel();
    const mModel = modified?.getModel();
    if (oModel) diffDecorations.value.original = original.deltaDecorations(diffDecorations.value.original, query ? getDecorations(oModel, query) : []);
    if (mModel) diffDecorations.value.modified = modified.deltaDecorations(diffDecorations.value.modified, query ? getDecorations(mModel, query) : []);
  }
};

watch(globalSearchQuery, () => updateSearchHighlights());
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

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// STEP 1 ? Th?m version v?o header comment <%-- --%>
// C?ng th?c: t?m d?ng "- Version X.0Y" cu?i c?ng trong block <%-- --%>,
// t?ng minor +1, th?m d?ng m?i ngay sau, tr??c d?ng " --%>"
// ����������������������������������������������������������������������������������������������������������������������������������������������������������
const addVersionComment = (code: string): string => {
  // L?y t?t c? d?ng version b?n trong <%-- ... --%>
  const headerBlock = code.match(/<%--[\s\S]*?--%>/);
  if (!headerBlock) return code;

  const allVersions = [...headerBlock[0].matchAll(/-\s*Version\s+(\d+)\.(\d+)/g)];
  if (!allVersions.length) return code;

  const last = allVersions[allVersions.length - 1];
  const major = last[1];
  const minor = parseInt(last[2], 10);
  const newMinor = String(minor + 1).padStart(2, '0');
  const newLine = ` - Version ${major}.${newMinor} 2026/04/10 VINX redmine#43477_UI���P�Ή�`;

  // Ch?n sau d?ng version cu?i, tr??c " --%>"
  // Regex: kh?p ??ng d?ng version cu?i c?ng (to?n d?ng) r?i ch?n sau n?
  const lastVersionLineRegex = /([ \t]*-\s*Version\s+\d+\.\d+[^\n]*)(\n[ \t]*--%>)/;
  if (lastVersionLineRegex.test(code)) {
    return code.replace(lastVersionLineRegex, `$1\n${newLine}$2`);
  }
  return code;
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// STEP 2 ? Fix CSS links
// 2a: href="css/common.css"  ��  href="css/common_pda.css"  (ch? khi mode PDA)
// 2b: x?a to?n b? d?ng c? link default_*.css
// 2c: x?a <!-- ... //--> wrapper b?n trong <script>
// ����������������������������������������������������������������������������������������������������������������������������������������������������������
const fixCssLinks = (code: string): string => {
  // 2a ? ch? ??i khi href tr? ??ng common.css (kh?ng ph?i common_pda ?? ??ng r?i)
  code = code.replace(
    /(<link[^>]*href=["'])css\/common\.css(["'][^>]*>)/g,
    '$1css/common_pda.css$2'
  );

  // 2b ? x?a c? d?ng ch?a link default_*.css
  code = code.replace(/^[ \t]*<link[^>]+href=["'][^"']*default_[^"']*["'][^>]*>[ \t]*\n?/gm, '');

  // 2c ? x?a <!-- ... //--> wrapper trong <script type="text/JavaScript">
  // Gi? nguy?n n?i dung JS b?n trong, ch? b? d?ng <!-- v? //--> 
  code = code.replace(
    /(<script[^>]*>)\s*\n[ \t]*<!--[ \t]*\n([\s\S]*?)\n[ \t]*\/\/-->[ \t]*\n/g,
    (_, openTag, inner) => {
      // B? indent th?a 4 space t? format c?
      const trimmed = inner.replace(/^    /gm, '');
      return `${openTag}\n${trimmed}\n`;
    }
  );

  return code;
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// STEP 3 ? Chu?n h?a HTML
// - X?a <br> / <br /> d?ng l?m spacing (d?ng ch? c? <br>)
// - window.close() �� window.open('about:blank','_self').close()
// - X?a border=0, cellspacing=0, cellpadding=0 (clean attribute th?a)
// ����������������������������������������������������������������������������������������������������������������������������������������������������������
const normalizeHtml = (code: string): string => {
  // X?a d?ng ch? ch?a <br> ho?c <br /> (spacing r?c)
  code = code.replace(/^[ \t]*<br\s*\/?>[ \t]*\n/gm, '');

  // Fix window.close
  code = code.replace(/window\.close\(\);/g, "window.open('about:blank', '_self').close();");

  // X?a attribute layout th?a tr?n table
  code = code.replace(/\s+border=["']0["']/g, '');
  code = code.replace(/\s+cellspacing=["']0["']/g, '');
  code = code.replace(/\s+cellpadding=["']0["']/g, '');

  return code;
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// STEP 4 ? Build <style> block t? inline style
// C?ng th?c: m?i inline style="..." �� 1 CSS rule v?i selector tagname.class ho?c tag#id
// Style button (width/height/border/border-radius) �� KH?NG t?o class �� b?
// Ch? display:none �� gi? nguy?n inline
// ����������������������������������������������������������������������������������������������������������������������������������������������������������
const buildStyleBlock = (code: string): string => {
  const cssRules: string[] = [];
  const seen = new Set<string>();

  // Regex qu?t t?ng th? HTML/JSP c? inline style
  const tagRegex = /<([\w:]+)([^>]*?)>/gs;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(code)) !== null) {
    const tag = m[1];
    const attrs = m[2];

    const styleMatch = attrs.match(/\bstyle=["']([^"']+)["']/);
    if (!styleMatch) continue;

    const styleVal = styleMatch[1].trim();

    // Gi? l?i display:none inline ? kh?ng tr?ch ra
    if (/^\s*display\s*:\s*none\s*;?\s*$/.test(styleVal)) continue;
    // B? qua style button (width + height + border) �� d?ng class pda_btn
    if (/width\s*:/.test(styleVal) && /height\s*:/.test(styleVal) && /(border|border-radius)\s*:/.test(styleVal)) continue;

    // T?m class
    const classMatch = attrs.match(/\bclass=["']([^"']+)["']/);
    // T?m id
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
    // fvo: property �� d?ng l?m id
    const propMatch = attrs.match(/\bproperty=['"]([^'"]+)['"]/);

    let selector = '';
    if (classMatch) {
      const firstClass = classMatch[1].trim().split(/\s+/)[0];
      selector = `${tag}.${firstClass}`;
    } else if (idMatch) {
      selector = `${tag}#${idMatch[1]}`;
    } else if (propMatch) {
      // fvo:span property='disp_alarm_title' �� span#disp_alarm_title
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

  // X?a <style> block c? n?u c?
  code = code.replace(/<style[^>]*>[\s\S]*?<\/style>\n?/g, '');

  // Ch?n tr??c </head>
  return code.replace(/(\n?)([ \t]*<\/head>)/i, `\n${styleBlock}\n$2`);
};

// ����������������������������������������������������������������������������������������������������������������������������������������������������������
// STEP 5 ? Chu?n h?a tab indent
// Quy t?c:
//   - D?ng \t (1 tab = 1 c?p)
//   - JSP directive / comment header �� level 0, kh?ng indent
//   - Closing tag �� gi?m depth TR??C khi in d?ng
//   - Opening tag t? ??ng (/>), <meta>, <link>, <br>, fvo:text/submit/checkbox �� kh?ng t?ng depth
//   - CSS b?n trong <style>: m?i { t?ng 1, m?i } gi?m 1 (t??ng ??i v?i depth hi?n t?i)
//   - JS b?n trong <script>: m?i { t?ng 1, m?i } gi?m 1
// ����������������������������������������������������������������������������������������������������������������������������������������������������������
const normalizeIndent = (code: string): string => {
  const TAB = '\t';
  const lines = code.split('\n');
  const result: string[] = [];
  let depth = 0;

  // Tags m? l?m t?ng depth (c?n tag ??ng t??ng ?ng)
  const BLOCK_OPEN = /^<(html:html|html:form|head|body|table|tbody|thead|tfoot|tr|td|th|div|ul|ol|li|select|option|style|script|fvo:span|logic:iterate|logic:notEmpty|logic:empty|logic:equal|logic:notEqual|bean:define)(\s|>)/i;

  // Tags t? ??ng ? kh?ng t?ng depth
  const SELF_CLOSE = /\/>$|^<(meta|link|input|br|hr|img|jsp:include|jsp:param|fvo:text|fvo:submit|fvo:checkbox|fvo:button|fvo:hidden|html:hidden)(\s|>|\/)/i;

  // Tags ??ng ? gi?m depth
  const BLOCK_CLOSE = /^<\/(html:html|html:form|head|body|table|tbody|thead|tfoot|tr|td|th|div|ul|ol|li|select|option|style|script|fvo:span|logic:iterate|logic:notEmpty|logic:empty|logic:equal|logic:notEqual|bean:define)>/i;

  // D?ng JSP level-0 (kh?ng indent)


  for (const raw of lines) {
    const line = raw.trim();

    // D?ng tr?ng �� gi? nguy?n
    if (!line) {
      result.push('');
      continue;
    }

    // JSP directive / header comment / DOCTYPE �� lu?n level 0
    if (/^<%[@!]/.test(line) || /^<%--/.test(line) || /^--%>/.test(line) || /^<!DOCTYPE/i.test(line)) {
      result.push(line);
      continue;
    }

    // Closing tag �� gi?m depth TR??C khi in
    if (BLOCK_CLOSE.test(line)) {
      depth = Math.max(0, depth - 1);
    }

    result.push(TAB.repeat(depth) + line);

    // Opening tag (kh?ng ph?i self-close, kh?ng c? closing tr?n c?ng d?ng) �� t?ng depth
    if (BLOCK_OPEN.test(line) && !SELF_CLOSE.test(line) && !BLOCK_CLOSE.test(line)) {
      // N?u c?ng 1 d?ng c? c? m? v? ??ng (vd: <td>text</td>) �� kh?ng t?ng
      const tagName = line.match(/^<([\w:]+)/)?.[1] ?? '';
      const closeOnSameLine = new RegExp(`</${tagName}>`, 'i').test(line);
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
