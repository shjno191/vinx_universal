import { ref, shallowRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

export function useConvert() {
  const inputText = shallowRef('');
  const resultText = shallowRef('');
  const isProcessing = ref(false);
  const showDiff = ref(false);
  const convertMode = ref<'PDA' | 'Common'>('PDA');
  const selectedEncoding = ref('Shift_JIS');
  const lastOpenedPath = ref('');
  const status = ref({ type: '', msg: '' });

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
      setTimeout(() => { 
        if (status.value.msg === 'Copied to clipboard!') status.value = { type: '', msg: '' }; 
      }, 2000);
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
      // Simulate processing time for UX
      await new Promise(r => setTimeout(r, 400));
      let result = inputText.value;

      if (convertMode.value === 'PDA') {
        result = addVersionComment(result);
        result = fixCssLinks(result);
        result = normalizeHtml(result);
        result = buildStyleBlock(result);
        result = normalizeIndent(result);
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

  const reopenWithEncoding = async () => {
    if (!lastOpenedPath.value) return;
    try {
      const content = await invoke('read_file_content', { 
        path: lastOpenedPath.value,
        encoding: selectedEncoding.value 
      });
      inputText.value = content as string;
      status.value = { type: 'success', msg: `Re-opened with ${selectedEncoding.value}` };
    } catch (e) {
      status.value = { type: 'error', msg: 'Re-open failed' };
    }
  };

  // --- Transformation Helpers ---

  const addVersionComment = (code: string): string => {
    const headerBlock = code.match(/<%--[\s\S]*?--%>/);
    if (!headerBlock) return code;

    const allVersions = [...headerBlock[0].matchAll(/-\s*Version\s+(\d+)\.(\d+)/g)];
    if (!allVersions.length) return code;

    const last = allVersions[allVersions.length - 1];
    const major = last[1];
    const minor = parseInt(last[2], 10);
    const newMinor = String(minor + 1).padStart(2, '0');
    const newLine = ` - Version ${major}.${newMinor} 2026/04/10 VINX redmine#43477_UI_Standardization`;

    const lastVersionLineRegex = /([ \t]*-\s*Version\s+\d+\.\d+[^\n]*)(\n[ \t]*--%>)/;
    if (lastVersionLineRegex.test(code)) {
      return code.replace(lastVersionLineRegex, `$1\n${newLine}$2`);
    }
    return code;
  };

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

  const normalizeHtml = (code: string): string => {
    code = code.replace(/^[ \t]*<br\s*\/?>[ \t]*\n/gm, '');
    code = code.replace(/window\.close\(\);/g, "window.open('about:blank', '_self').close();");

    code = code.replace(/<table([^>]*)>/gi, (_match, attrs) => {
      let cleanAttrs = attrs.replace(/\s+(border|cellspacing|cellpadding|width)=["'][^"']*["']/gi, '');
      return `<table${cleanAttrs} cellpadding="0" cellspacing="0" border="0" width="100%">`;
    });

    if (code.includes('<body>') && !code.includes('class="pda_list')) {
      code = code.replace(/(<body[^>]*>)\s*([\s\S]*?)\s*(<\/body>)/i, (match, bodyOpen, content, bodyClose) => {
        const formMatch = content.match(/(<html:form[^>]*>)([\s\S]*?)(<\/html:form>)/i);
        if (formMatch) {
          const [_, formOpen, formInner, formClose] = formMatch;
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

  const buildStyleBlock = (code: string): string => {
    const cssRules = [];
    const seen = new Set();

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

  return {
    inputText,
    resultText,
    isProcessing,
    showDiff,
    convertMode,
    selectedEncoding,
    lastOpenedPath,
    status,
    clearAll,
    copyResult,
    handleConvert,
    reopenWithEncoding
  };
}
