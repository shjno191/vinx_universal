<script setup lang="ts">
import { ref } from 'vue';

// ÑüÑüÑü State ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const inputText = ref('');
const resultText = ref('');
const isProcessing = ref(false);
const status = ref<{ type: 'idle' | 'success' | 'error' | 'warn'; msg: string }>({
  type: 'idle',
  msg: '',
});

const leftBox = ref<HTMLTextAreaElement | null>(null);
const rightBox = ref<HTMLTextAreaElement | null>(null);

// ÑüÑüÑü Sync scroll ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const syncScroll = (side: 'left' | 'right') => {
  if (side === 'left' && leftBox.value && rightBox.value) {
    rightBox.value.scrollTop = leftBox.value.scrollTop;
  } else if (side === 'right' && leftBox.value && rightBox.value) {
    leftBox.value.scrollTop = rightBox.value.scrollTop;
  }
};

// ÑüÑüÑü Copy ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const copyResult = async () => {
  if (!resultText.value) return;
  await navigator.clipboard.writeText(resultText.value);
  status.value = { type: 'success', msg: '?? copy k?t qu? v?o clipboard.' };
};

const clearAll = () => {
  inputText.value = '';
  resultText.value = '';
  status.value = { type: 'idle', msg: '' };
};

// ÑüÑüÑü Main convert ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const handleConvert = () => {
  if (!inputText.value.trim()) {
    resultText.value = '';
    status.value = { type: 'idle', msg: '' };
    return;
  }

  isProcessing.value = true;
  status.value = { type: 'idle', msg: '' };

  try {
    let code = inputText.value;

    // STEP 1 ? Th?m version
    code = addVersion(code);

    // STEP 2 ? Fix CSS links
    code = fixCssLinks(code);

    // STEP 3 ? Chu?n h?a HTML structure
    code = normalizeHtml(code);

    // STEP 4 ? Inject <style> block t? inline styles
    code = buildStyleBlock(code);

    // STEP 5 ? Chu?n h?a tab indent to?n b?
    code = normalizeIndent(code);

    resultText.value = code;
    status.value = { type: 'success', msg: 'Convert th?nh c?ng ? 5 b??c ho?n t?t.' };
  } catch (e) {
    resultText.value = `/* ERROR: ${e instanceof Error ? e.message : String(e)} */`;
    status.value = { type: 'error', msg: `L?i: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    isProcessing.value = false;
  }
};

// ÑüÑüÑü STEP 1: Th?m version ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const addVersion = (code: string): string => {
  // T?m d?ng version cu?i c?ng trong comment header
  const versionRegex = /([ \t]*-\s*Version\s+(\d+)\.(\d+)\s+[\d/]+.*?)(\s*\n)([ \t]*--%>)/;
  const match = code.match(/(-\s*Version\s+(\d+)\.0*(\d+)\s+[\d/]+[^\n]*)/g);

  if (!match) return code;

  const lastVersion = match[match.length - 1];
  const verNumMatch = lastVersion.match(/-\s*Version\s+(\d+)\.0*(\d+)/);
  if (!verNumMatch) return code;

  const major = parseInt(verNumMatch[1]);
  const minor = parseInt(verNumMatch[2]);
  const newMinor = String(minor + 1).padStart(2, '0');
  const newVersionLine = ` - Version ${major}.${newMinor} 2026/04/10 VINX redmine#43477_UIâ¸ëPëŒâû`;

  // Ch?n sau d?ng version cu?i c?ng, tr??c --%>
  return code.replace(
    /( - Version \d+\.\d+[^\n]*\n)(\s*--%>)/,
    `$1${newVersionLine}\n$2`
  );
};

// ÑüÑüÑü STEP 2: Fix CSS links ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const fixCssLinks = (code: string): string => {
  // 2a: ??i common.css Å® common_pda.css
  code = code.replace(
    /href=["']css\/common\.css["']/g,
    'href="css/common_pda.css"'
  );

  // 2b: X?a link default_*.css (to?n b? d?ng)
  code = code.replace(/[ \t]*<link[^>]+href=["'][^"']*default_[^"']*["'][^>]*>\n?/g, '');

  // 2c: X?a HTML comment wrapper trong <script>
  code = code.replace(
    /(<script[^>]*>)\s*\n\s*<!--\s*\n([\s\S]*?)\n\s*\/\/-->\s*\n(\s*<\/script>)/g,
    (_, open, inner, close) => {
      // B? indent 4-space th?a t? old format
      const cleaned = inner.replace(/^    /gm, '');
      return `${open}\n${cleaned}\n${close}`;
    }
  );

  return code;
};

// ÑüÑüÑü STEP 3: Chu?n h?a HTML structure ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const normalizeHtml = (code: string): string => {
  // 3a: X?a <br> v? <br /> d?ng l?m spacing (kh?ng trong n?i dung text)
  code = code.replace(/[ \t]*<br\s*\/?>\s*\n/g, '\n');

  // 3b: window.close() Å® window.open().close()
  code = code.replace(/window\.close\(\);/g, "window.open('about:blank', '_self').close();");

  // 3c: B?c html:form body b?ng outer table n?u ch?a c?
  // Ph?t hi?n pattern: html:form Å® jsp:include PDAheader n?m tr?c ti?p (kh?ng c? table b?c)
  const hasOuterTable = /<html:form[^>]*>\s*\n\s*<table[^>]*width=["']100%["']/.test(code);
  if (!hasOuterTable) {
    code = wrapFormContent(code);
  }

  // 3d: B?c c?c bare table th?nh div.pda_listN + table.pda_listN_xxx
  code = wrapBareTables(code);

  // 3e: X?a inline style tr?n c?c tag (tr? display:none)
  code = stripInlineStyles(code);

  return code;
};

const wrapFormContent = (code: string): string => {
  // T?m html:form v? b?c n?i dung c?a n?
  return code.replace(
    /(<html:form[^>]*>)([\s\S]*?)(<\/html:form>)/,
    (_, open, content, close) => {
      // Ki?m tra ?? c? PDAheader ch?a ? n?u c? th? b?c outer table
      if (content.includes('PDAheader.jsp')) {
        // T?ch ph?n header jsp include ra
        const headerMatch = content.match(/([\s\S]*?<\/jsp:include>)([\s\S]*)/);
        if (headerMatch) {
          const headerPart = headerMatch[1].trim();
          const bodyPart = headerMatch[2].trim();
          const paramMatch = headerPart.match(/value=["']([^"']*)["']/);
          const paramValue = paramMatch ? paramMatch[1] : '';

          return `${open}
\t<table cellpadding="0" cellspacing="0" border="0" width="100%">
\t\t<tr>
\t\t\t<td>
\t\t\t\t<jsp:include page="PDAheader.jsp">
\t\t\t\t\t<jsp:param name="PARAM" value="${paramValue}"/>
\t\t\t\t</jsp:include>
\t\t\t</td>
\t\t</tr>
\t\t<tr>
\t\t\t<td align="center">
${bodyPart.split('\n').map(l => '\t\t\t\t' + l).join('\n')}
\t\t\t</td>
\t\t</tr>
\t</table>
${close}`;
        }
      }
      return `${open}${content}${close}`;
    }
  );
};

// ??m s? table bare (kh?ng c? div.pda_list wrapper) v? b?c ch?ng
const wrapBareTables = (code: string): string => {
  let listIndex = 1;

  // Pattern: table kh?ng n?m trong div.pda_list, kh?ng ph?i outer table width=100%
  // T?m c?c <table> tr?c ti?p con c?a <td align="center"> ho?c n?m float
  code = code.replace(
    /(\n[ \t]*)(<table(?![^>]*pda_list)[^>]*(?:class=["'][^"']*pda_list[^"']*["'])?[^>]*>[\s\S]*?<\/table>)(?=\s*\n\s*(?:<br|<table|<fvo:button|<fvo:span|$))/g,
    (match, ws, tableBlock) => {
      // B? qua outer table v? paging table
      if (tableBlock.includes('width="100%"') || tableBlock.includes("width='100%'")) return match;
      if (tableBlock.includes('class="pda_list')) return match;

      // ?o?n t?n class t? n?i dung
      let suffix = 'content';
      if (tableBlock.includes('alarm')) suffix = 'alarm';
      else if (tableBlock.includes('message') || tableBlock.includes('fvo:span') && listIndex === 1) suffix = 'msg_area';
      else if (tableBlock.includes('fvo:button') || tableBlock.includes('button')) suffix = 'button_ok';
      else if (tableBlock.includes('logic:iterate')) suffix = 'result';

      const divClass = `pda_list${listIndex}`;
      const tableClass = `pda_list${listIndex}_${suffix}`;
      listIndex++;

      // Th?m class v?o table tag
      const wrappedTable = tableBlock.replace(
        /^(\s*<table)([^>]*)>/,
        `$1$2 class="${tableClass}">`
      );

      return `${ws}<div class="${divClass}">\n${ws}\t${wrappedTable.trim()}\n${ws}</div>`;
    }
  );

  // B?c fvo:button ??ng ri?ng v?o div.pda_listN + table
  code = code.replace(
    /(\n[ \t]*)(<fvo:button[^/]*(\/?)>)(?!\s*<\/table)/g,
    (match, ws, btn) => {
      const divClass = `pda_list${listIndex}`;
      const tableClass = `pda_list${listIndex}_button_ok`;
      listIndex++;
      return `${ws}<div class="${divClass}">\n${ws}\t<table border="0" cellspacing="1" cellpadding="5" class="${tableClass}">\n${ws}\t\t<tr>\n${ws}\t\t\t<td align="center">\n${ws}\t\t\t\t${btn.trim()}\n${ws}\t\t\t</td>\n${ws}\t\t</tr>\n${ws}\t</table>\n${ws}</div>`;
    }
  );

  return code;
};

const stripInlineStyles = (code: string): string => {
  // X?a style inline tr?n table, th, td, tr ? ch? gi? l?i display:none
  return code.replace(
    /(\s)style=["'](?!display:\s*none)([^"']*)["']/g,
    (match, ws, styleVal) => {
      if (styleVal.includes('display') && styleVal.includes('none')) return match;
      return '';
    }
  );
};

// ÑüÑüÑü STEP 4: Build <style> block ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const buildStyleBlock = (code: string): string => {
  // Thu th?p t?t c? inline style c?n s?t (?? b? x?a ? b??c 3 tr? display:none)
  // Thay v?o ??: qu?t t? original input ?? t?o CSS rules
  const original = inputText.value;
  const cssRules: string[] = [];
  const seen = new Set<string>();

  // Qu?t pattern: element c? class v? style inline trong original
  const inlinePattern = /<(table|th|td|tr|div|span|input)\s([^>]*?)style=["']([^"']+)["']([^>]*)>/g;
  let m;

  while ((m = inlinePattern.exec(original)) !== null) {
    const tag = m[1];
    const before = m[2];
    const styleVal = m[3].trim();
    const after = m[4];

    if (styleVal === 'display: none;' || styleVal === 'display:none;') continue;

    // T?m class
    const classMatch = (before + after).match(/class=["']([^"']+)["']/);
    // T?m id (property c?a fvo)
    const propMatch = (before + after).match(/property=["']([^"']+)["']/);
    // T?m id tr?c ti?p
    const idMatch = (before + after).match(/\bid=["']([^"']+)["']/);

    let selector = '';
    if (classMatch) {
      const cls = classMatch[1].trim().split(/\s+/)[0];
      selector = `${tag}.${cls}`;
    } else if (idMatch) {
      selector = `${tag}#${idMatch[1]}`;
    } else if (propMatch) {
      // fvo:span property Å® span#propName
      const propId = propMatch[1].replace(/[[\].]/g, '_');
      selector = `span#${propId}`;
    }

    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    // Format CSS properties
    const props = styleVal
      .split(';')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `\t\t${p};`)
      .join('\n');

    cssRules.push(`\t${selector} {\n${props}\n\t}`);
  }

  // Th?m div/table wrapper rules chu?n
  const hasListWrapper = code.includes('class="pda_list');
  if (hasListWrapper) {
    if (!seen.has('div[class^="pda_list"]')) {
      cssRules.unshift(`\ttable[class^="pda_list"] {\n\t\twidth: 240px;\n\t}`);
      cssRules.unshift(`\tdiv[class^="pda_list"] {\n\t\twidth: 240px;\n\t\tpadding-top: 10px;\n\t}`);
    }
  }

  if (cssRules.length === 0) return code;

  const styleBlock = `<style type="text/css">\n${cssRules.join('\n\n')}\n</style>`;

  // X?a style block c? n?u c?
  code = code.replace(/<style[^>]*>[\s\S]*?<\/style>\s*\n?/g, '');

  // Ch?n tr??c </head>
  code = code.replace(/(\s*<\/head>)/, `\n${styleBlock}\n$1`);

  return code;
};

// ÑüÑüÑü STEP 5: Normalize indent ÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑüÑü
const normalizeIndent = (code: string): string => {
  const lines = code.split('\n');
  const result: string[] = [];

  let depth = 0;
  const INDENT = '\t';

  // Tags t?ng depth khi m?
  const openTags = /^<(?!\/|!--|%)(html:html|html:form|head|body|table|tr|td|th|div|ul|li|select|option|style|script|fvo:span|logic:iterate|jsp:include)/i;
  // Tags t? ??ng kh?ng t?ng depth
  const selfClosing = /\/>$|^<(meta|link|input|br|hr|fvo:text|fvo:submit|fvo:checkbox|fvo:button|jsp:param)/i;
  // Tags gi?m depth khi ??ng
  const closeTags = /^<\/(html:html|html:form|head|body|table|tr|td|th|div|ul|li|select|option|style|script|fvo:span|logic:iterate)/i;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) { result.push(''); continue; }

    // JSP directive / comment ? level 0
    if (line.startsWith('<%') || line.startsWith('--%>') || line.startsWith('<!DOCTYPE')) {
      result.push(line);
      continue;
    }

    // ??ng tag tr??c Å® gi?m depth
    if (closeTags.test(line)) depth = Math.max(0, depth - 1);

    result.push(INDENT.repeat(depth) + line);

    // M? tag kh?ng self-closing Å® t?ng depth
    if (openTags.test(line) && !selfClosing.test(line) && !line.includes('</')) {
      depth++;
    }
  }

  return result.join('\n');
};
</script>

<template>
  <div class="pda-convert">

    <!-- ÑüÑü Toolbar ÑüÑü -->
    <header class="toolbar">
      <div class="toolbar-left">
        <span class="brand-dot"></span>
        <span class="brand-label">PDA JSP Converter</span>
        <span class="brand-sub">5-step auto convert</span>
      </div>

      <div class="toolbar-right">
        <button class="btn-icon" title="Clear all" @click="clearAll">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <div class="sep"></div>
        <button class="btn-copy" @click="copyResult" :disabled="!resultText">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1"/>
          </svg>
          Copy k?t qu?
        </button>
        <button class="btn-convert" @click="handleConvert" :class="{ loading: isProcessing }">
          <svg v-if="!isProcessing" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          {{ isProcessing ? '?ang x? l?...' : 'Convert' }}
        </button>
      </div>
    </header>

    <!-- ÑüÑü Step badges ÑüÑü -->
    <div class="steps-bar">
      <div class="step-badge" v-for="(s, i) in steps" :key="i">
        <span class="step-num">{{ i + 1 }}</span>
        <span class="step-text">{{ s }}</span>
      </div>
    </div>

    <!-- ÑüÑü Status bar ÑüÑü -->
    <div class="status-bar" :class="status.type" v-if="status.msg">
      <svg v-if="status.type === 'success'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <svg v-else-if="status.type === 'error'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <svg v-else-if="status.type === 'warn'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      {{ status.msg }}
    </div>

    <!-- ÑüÑü Editor panes ÑüÑü -->
    <main class="editor-area">
      <div class="pane">
        <div class="pane-header">
          <span class="pane-label">CODE C? (JSP / input)</span>
          <span class="char-count">{{ inputText.length.toLocaleString() }} k? t?</span>
        </div>
        <textarea
          ref="leftBox"
          v-model="inputText"
          @scroll="syncScroll('left')"
          placeholder="Paste n?i dung file .jsp c? v?o ??y..."
          spellcheck="false"
        ></textarea>
      </div>

      <div class="pane-divider">
        <div class="arrow-flow">
          <div class="flow-line"></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="5 3 19 12 5 21 5 3"/>
          </svg>
          <div class="flow-line"></div>
        </div>
      </div>

      <div class="pane" :class="{ 'has-result': !!resultText }">
        <div class="pane-header">
          <span class="pane-label">K?T QU? (output)</span>
          <span class="char-count">{{ resultText.length.toLocaleString() }} k? t?</span>
        </div>
        <textarea
          ref="rightBox"
          v-model="resultText"
          @scroll="syncScroll('right')"
          placeholder="K?t qu? sau khi convert s? hi?n th? ? ??y..."
          spellcheck="false"
          readonly
        ></textarea>
      </div>
    </main>

  </div>
</template>

<script lang="ts">
// Steps label for display
export default {
  data() {
    return {
      steps: [
        'Th?m version',
        'Fix CSS link',
        'Chu?n h?a HTML',
        'Build <style>',
        'Fix indent',
      ],
    };
  },
};
</script>

<style scoped>
/* ÑüÑü Variables ÑüÑü */
.pda-convert {
  --accent: #2563eb;
  --accent-light: #3b82f6;
  --accent-dim: rgba(37, 99, 235, 0.12);
  --green: #16a34a;
  --green-bg: rgba(22, 163, 74, 0.1);
  --red: #dc2626;
  --red-bg: rgba(220, 38, 38, 0.1);
  --amber: #d97706;
  --amber-bg: rgba(217, 119, 6, 0.1);
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.14);
  --surface: #ffffff;
  --surface-2: #f8f9fb;
  --surface-3: #f1f3f7;
  --text: #111827;
  --text-2: #6b7280;
  --text-3: #9ca3af;
  --mono: 'Consolas', 'JetBrains Mono', 'Fira Code', monospace;

  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px;
  gap: 10px;
  background: var(--container-bg, var(--surface-2));
  box-sizing: border-box;
  overflow: hidden;
}

/* ÑüÑü Toolbar ÑüÑü */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 52px;
  background: var(--surface, #fff);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.brand-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text, #111827);
  letter-spacing: 0.01em;
}

.brand-sub {
  font-size: 0.72rem;
  color: var(--text-3, #9ca3af);
  padding: 2px 7px;
  background: var(--surface-3, #f1f3f7);
  border-radius: 20px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sep {
  width: 1px;
  height: 20px;
  background: var(--border-strong);
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: transparent;
  color: var(--text-2, #6b7280);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-icon:hover {
  background: var(--red-bg);
  color: var(--red);
  border-color: rgba(220, 38, 38, 0.25);
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: var(--surface-3, #f1f3f7);
  color: var(--text-2, #6b7280);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-copy:not(:disabled):hover {
  background: var(--surface, #fff);
  color: var(--text, #111827);
}

.btn-convert {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 18px;
  border: none;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.01em;
}

.btn-convert:hover {
  background: var(--accent-light);
}

.btn-convert.loading {
  opacity: 0.75;
  cursor: wait;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ÑüÑü Steps bar ÑüÑü */
.steps-bar {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.step-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--surface, #fff);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 0.72rem;
}

.step-num {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-text {
  color: var(--text-2, #6b7280);
  white-space: nowrap;
}

/* ÑüÑü Status bar ÑüÑü */
.status-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  flex-shrink: 0;
}

.status-bar.success { background: var(--green-bg); color: var(--green); }
.status-bar.error   { background: var(--red-bg);   color: var(--red); }
.status-bar.warn    { background: var(--amber-bg);  color: var(--amber); }

/* ÑüÑü Editor area ÑüÑü */
.editor-area {
  flex: 1;
  display: flex;
  gap: 0;
  min-height: 0;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--surface, #fff);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.pane.has-result {
  border-color: rgba(37, 99, 235, 0.3);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 32px;
  background: var(--surface-3, #f1f3f7);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.pane-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-3, #9ca3af);
  text-transform: uppercase;
}

.char-count {
  font-size: 0.65rem;
  color: var(--text-3, #9ca3af);
  font-family: var(--mono);
}

textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text, #111827);
  padding: 14px;
  font-family: var(--mono);
  font-size: 0.82rem;
  line-height: 1.65;
  resize: none;
  outline: none;
  tab-size: 2;
}

textarea::placeholder {
  color: var(--text-3, #9ca3af);
}

/* ÑüÑü Pane divider with arrow ÑüÑü */
.pane-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  flex-shrink: 0;
}

.arrow-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-3, #9ca3af);
}

.flow-line {
  width: 1px;
  flex: 1;
  background: var(--border);
}

/* ÑüÑü Dark theme support ÑüÑü */
:root.theme-dark .pda-convert,
.dark .pda-convert {
  --border: rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.12);
  --surface: rgba(255,255,255,0.04);
  --surface-2: rgba(255,255,255,0.02);
  --surface-3: rgba(255,255,255,0.06);
  --text: #f1f5f9;
  --text-2: #94a3b8;
  --text-3: #475569;
  --accent-dim: rgba(59, 130, 246, 0.2);
}
</style>