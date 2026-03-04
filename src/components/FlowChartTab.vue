<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import mermaid from 'mermaid';
import { currentFlowCode, aiSettings, mermaidCode, analysisMode, showRawFlowCode } from '../store';
import { analyzeCode } from './AstAnalyzer';

// ── State ─────────────────────────────────────────────────────────────────────
const isLoading = ref(false);
const error = ref('');
const diagramRef = ref<HTMLElement | null>(null);
const zoomWrapRef = ref<HTMLElement | null>(null);

// ── Zoom / Pan State ───────────────────────────────────────────────────────
const zoomScale = ref(1);
const zoomX = ref(0);
const zoomY = ref(0);
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginX = 0;
let dragOriginY = 0;

// transform-origin is always 0 0; translate compensates for zoom point
const zoomStyle = computed(() =>
  `transform: translate(${zoomX.value}px, ${zoomY.value}px) scale(${zoomScale.value}); transform-origin: 0 0;`
);

const onWheel = (e: WheelEvent) => {
  e.preventDefault();
  const el = zoomWrapRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  // Mouse position relative to viewport top-left
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const oldScale = zoomScale.value;
  const factor = e.deltaY < 0 ? 1.12 : 0.9;
  const newScale = Math.min(Math.max(oldScale * factor, 0.1), 6);
  // Zoom around mouse: adjust translation so the point under cursor stays fixed
  zoomX.value = mx - (mx - zoomX.value) * (newScale / oldScale);
  zoomY.value = my - (my - zoomY.value) * (newScale / oldScale);
  zoomScale.value = newScale;
};

const onMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOriginX = zoomX.value;
  dragOriginY = zoomY.value;
  (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
};

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging) return;
  zoomX.value = dragOriginX + (e.clientX - dragStartX);
  zoomY.value = dragOriginY + (e.clientY - dragStartY);
};

const onMouseUp = (e: MouseEvent) => {
  isDragging = false;
  (e.currentTarget as HTMLElement).style.cursor = 'grab';
};

const resetZoom = () => { zoomScale.value = 1; zoomX.value = 0; zoomY.value = 0; };

// ── Mermaid Setup ─────────────────────────────────────────────────────────────
const initMermaid = () => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
    },
  });
};

// ── Render diagram ────────────────────────────────────────────────────────────
const renderDiagram = async (code: string) => {
  if (!diagramRef.value || !code) return;
  try {
    diagramRef.value.innerHTML = '';
    diagramRef.value.removeAttribute('data-processed');
    const id = `mermaid-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);
    diagramRef.value.innerHTML = svg;

    // Add interaction logic
    await nextTick();
    const svgEl = diagramRef.value.querySelector('svg');
    if (svgEl) {
      svgEl.style.cursor = 'pointer';
      svgEl.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as SVGElement;
        const node = target.closest('.node');
        
        if (node) {
          // Identify the function (subgraph) class from our class N0 M0 etc.
          const classList = Array.from(node.classList);
          const funcClass = classList.find(c => /^M\d+$/.test(c));
          
          if (funcClass) {
            // Highlight everything with this class, dim everything else
            const allNodes = svgEl.querySelectorAll('.node');
            const allEdges = svgEl.querySelectorAll('.edgePath');
            const allClusters = svgEl.querySelectorAll('.cluster');

            // 1. Reset
            allNodes.forEach(n => n.classList.remove('func-highlight', 'func-dimmed'));
            allEdges.forEach(n => n.classList.remove('func-highlight', 'func-dimmed'));
            allClusters.forEach(n => n.classList.remove('func-highlight', 'func-dimmed'));

            // 2. Apply dimming to all
            allNodes.forEach(n => n.classList.add('func-dimmed'));
            allEdges.forEach(n => n.classList.add('func-dimmed'));
            allClusters.forEach(n => n.classList.add('func-dimmed'));

            // 3. Highlight specific function
            svgEl.querySelectorAll(`.${funcClass}`).forEach(el => {
              el.classList.remove('func-dimmed');
              el.classList.add('func-highlight');
            });
            
            // Highlight parent cluster
            const cluster = svgEl.querySelector(`#cluster_${funcClass}, [id^="cluster_${funcClass}-"]`);
            if (cluster) {
              cluster.classList.remove('func-dimmed');
              cluster.classList.add('func-highlight');
            }

            // Highlight edges connecting nodes in this function
            allEdges.forEach(edge => {
              const edgeClasses = Array.from(edge.classList);
              // Mermaid edges often have classes like "LS-N0" "LE-N1"
              // We check if it connects nodes belonging to this function
              // Or simpler: just highlight edges that have matching IDs in their metadata if available
              // Actually, Mermaid 10+ standard edges are harder to map.
              // Fallback: highlight edges that are physically close or by checking their ID prefix if we had it.
              // For now, let's look for "LS-..." and "LE-..." nodes
              const startNodeId = edgeClasses.find(c => c.startsWith('LS-'))?.substring(3);
              const endNodeId = edgeClasses.find(c => c.startsWith('LE-'))?.substring(3);
              if (startNodeId || endNodeId) {
                const startNode = svgEl.querySelector(`#${startNodeId}`);
                if (startNode?.classList.contains(funcClass)) {
                   edge.classList.remove('func-dimmed');
                   edge.classList.add('func-highlight');
                }
              }
            });
            
            e.stopPropagation();
            return;
          }
        }
        
        // Reset if click background
        svgEl.querySelectorAll('.func-highlight, .func-dimmed').forEach(el => {
          el.classList.remove('func-highlight', 'func-dimmed');
        });
      });
    }
  } catch (e: any) {
    error.value = `Mermaid render error: ${e.message}\n\nTry re-generating or check the raw code below.`;
    showRawFlowCode.value = true;
  }
};

// ── System Prompt ─────────────────────────────────────────────────────────────
const buildPrompt = (code: string) =>
  `# CONTEXT & ROLE
You are a Senior Software Architect and an Expert in Reverse Engineering. Your task is to analyze the provided source code and translate its underlying logic into a highly accurate Control Flow Graph (CFG) using Mermaid.js.

# OBJECTIVE
Generate a structured, easy-to-understand flowchart that maps out the core business logic, ignoring boilerplate syntax. 

# PROCESSING RULES
1. Main Execution Flow (Luồng chính):
   - Identify significant logical blocks (e.g., functions, test suites, classes).
   - For files with multiple entry points, use Mermaid 'subgraph' syntax to group related operations.
   - Clearly delineate the "Happy Path" within each significant block.

2. Decision & Branching Nodes (Các điểm rẽ nhánh):
   - Map all control structures (if/else, switch/case, try/catch, while/for).
   - For each decision node, explicitly state the exact condition causing the branch (e.g., "is valid?", "count > 0?", "has error?").

3. Intra-Branch Operations (Xử lý đặc biệt trong nhánh):
   - DO NOT transcribe line-by-line code. 
   - ONLY highlight critical operations: State mutations, I/O (API/DB/File), and Exception handling.

4. Visual Formatting (Định dạng hiển thị):
   - Use 'flowchart TD'.
   - Use standard shapes: ([Start/End]) for entries/exits, {Decision} for conditions, [Process] for actions, [(Database/IO)] for external calls.
   - If the code is a test suite, map the sequence of tests and their internal assertions.

# INPUT CODE:
${code}

# OUTPUT FORMAT
Return ONLY the Mermaid.js code block. No conversational filler.`;

// ── AI API Wrapper ─────────────────────────────────────────────────────────────
const extractMermaidCode = (text: string): string => {
  // Try to extract from ```mermaid ... ``` block
  const match = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  // Fallback: return raw text if it starts with graph
  const trimmed = text.trim();
  if (trimmed.startsWith('graph') || trimmed.startsWith('flowchart')) return trimmed;
  // last resort: strip any code fence
  return text.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
};

const callGemini = async (prompt: string): Promise<string> => {
  const key = aiSettings.value.geminiKey.trim();
  if (!key) throw new Error('Gemini API Key is not configured. Go to Settings → AI.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiSettings.value.geminiModel}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
};

const callOpenAI = async (prompt: string): Promise<string> => {
  const key = aiSettings.value.openaiKey.trim();
  if (!key) throw new Error('OpenAI API Key is not configured. Go to Settings → AI.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: aiSettings.value.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
};

const callClaude = async (prompt: string): Promise<string> => {
  const key = aiSettings.value.claudeKey.trim();
  if (!key) throw new Error('Claude API Key is not configured. Go to Settings → AI.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiSettings.value.claudeModel,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
};

const callOllama = async (prompt: string): Promise<string> => {
  const url = aiSettings.value.ollamaUrl.trim() || 'http://localhost:11434/api/generate';
  const model = aiSettings.value.ollamaModel.trim() || 'llama3';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.response ?? '';
};

const callAI = async (prompt: string): Promise<string> => {
  switch (aiSettings.value.provider) {
    case 'openai': return callOpenAI(prompt);
    case 'claude': return callClaude(prompt);
    case 'ollama': return callOllama(prompt);
    default: return callGemini(prompt);
  }
};

// ── Generate Flow ──────────────────────────────────────────────────────────────
const generate = async () => {
  const code = currentFlowCode.value.trim();
  if (!code) {
    error.value = 'No code to analyze. Please type some code in the Editor tab first.';
    return;
  }
  isLoading.value = true;
  error.value = '';
  mermaidCode.value = '';
  if (diagramRef.value) diagramRef.value.innerHTML = '';

  try {
    if (analysisMode.value === 'ai') {
      const prompt = buildPrompt(code);
      const raw = await callAI(prompt);
      const extracted = extractMermaidCode(raw);
      mermaidCode.value = extracted;
    } else {
      // STATIC CODE ANALYSIS via AST
      const result = analyzeCode(code);
      if (result.error) {
        throw new Error(`AST Parse Error: ${result.error}\n\nNote: Only JavaScript/TypeScript is supported in CODE mode. Use AI mode for other languages.`);
      }
      mermaidCode.value = result.mermaid;
    }
    
    // Critical fix: set isLoading to false BEFORE rendering to ensure diagramRef is mounted
    isLoading.value = false;
    await nextTick();
    
    if (mermaidCode.value) {
      await renderDiagram(mermaidCode.value);
    }
  } catch (e: any) {
    isLoading.value = false;
    error.value = e.message ?? 'An unknown error occurred.';
  }
};

const copyCode = async () => {
  if (!mermaidCode.value) return;
  await navigator.clipboard.writeText(mermaidCode.value);
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  initMermaid();
  if (mermaidCode.value) {
    await renderDiagram(mermaidCode.value);
  } else if (currentFlowCode.value) {
    await generate();
  }
});
</script>

<template>
  <div class="flowchart-container">
    <!-- Header Bar -->
    <header class="flowchart-header glass">
      <div class="header-left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="6" height="4" rx="1"/>
          <rect x="9" y="10" width="6" height="4" rx="1"/>
          <rect x="16" y="17" width="6" height="4" rx="1"/>
          <line x1="5" y1="7" x2="12" y2="10"/>
          <line x1="15" y1="14" x2="19" y2="17"/>
        </svg>
        <span class="header-title">FLOW CHART</span>
        
        <div class="mode-switcher glass-mini">
          <button 
            class="mode-btn" 
            :class="{ active: analysisMode === 'code' }"
            @click="setMode('code')"
          >CODE</button>
          <button 
            class="mode-btn" 
            :class="{ active: analysisMode === 'ai' }"
            @click="setMode('ai')"
          >AI</button>
        </div>

        <span v-if="analysisMode === 'ai'" class="provider-badge">{{ aiSettings.provider.toUpperCase() }}</span>
      </div>
      <div class="header-right">
        <!-- Zoom controls -->
        <span v-if="mermaidCode" class="zoom-badge">{{ Math.round(zoomScale * 100) }}%</span>
        <button
          v-if="mermaidCode"
          class="icon-btn"
          @click="resetZoom"
          title="Reset Zoom (100%)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
        </button>
        <button
          class="icon-btn"
          :class="{ active: showRawFlowCode }"
          @click="toggleRawCode()"
          title="Toggle Raw Mermaid Code"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z"/>
          </svg>
        </button>
        <button
          class="icon-btn"
          @click="copyCode"
          title="Copy Mermaid Code"
          :disabled="!mermaidCode"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h-1v1H2V6h1V5H2z"/>
          </svg>
        </button>
        <button
          class="regen-btn"
          @click="generate"
          :disabled="isLoading"
          title="Re-generate"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" :class="{ spin: isLoading }">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
          {{ isLoading ? 'Generating...' : 'Re-generate' }}
        </button>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">
        {{ analysisMode === 'ai' ? 'Analyzing code with ' : 'Performing static analysis...' }}
        <strong v-if="analysisMode === 'ai'">{{ aiSettings.provider }}</strong>
      </p>
      <p class="loading-sub">This may take a few seconds</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-panel glass">
      <svg width="24" height="24" viewBox="0 0 16 16" fill="#f87171">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>
      <p class="error-title">Error</p>
      <pre class="error-body">{{ error }}</pre>
      <button class="regen-btn" @click="generate">Try Again</button>
    </div>

    <!-- Main Area -->
    <div v-else class="main-area">
      <!-- Diagram View -->
      <div class="diagram-panel glass" :class="{ 'half-width': showRawFlowCode && mermaidCode }">
        <div v-if="!mermaidCode" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <rect x="2" y="3" width="6" height="4" rx="1"/>
            <rect x="9" y="10" width="6" height="4" rx="1"/>
            <rect x="16" y="17" width="6" height="4" rx="1"/>
            <line x1="5" y1="7" x2="12" y2="10"/>
            <line x1="15" y1="14" x2="19" y2="17"/>
          </svg>
          <p>Click <strong>Re-generate</strong> to analyze your code</p>
          <p class="hint">Or go to the Editor tab, write code, and click the ? Flow button</p>
        </div>
        <div
          ref="zoomWrapRef"
          class="zoom-viewport"
          @wheel.prevent="onWheel"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
        >
          <div ref="diagramRef" class="mermaid-output" :style="zoomStyle"></div>
        </div>
      </div>

      <!-- Raw Code Panel -->
      <div v-if="showRawFlowCode && mermaidCode" class="raw-panel glass">
        <div class="raw-header">RAW MERMAID</div>
        <pre class="raw-code">{{ mermaidCode }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flowchart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  color: var(--text-color);
  overflow: hidden;
}

/* Header */
.flowchart-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-radius: 0;
  border-bottom: var(--border-style);
  flex-shrink: 0;
  background: var(--container-bg);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent-color);
}

.header-title {
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.provider-badge {
  background: var(--accent-color);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 10px;
  letter-spacing: 0.06em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Mode Switcher */
.mode-switcher {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: rgba(0,0,0,0.15);
  margin-left: 10px;
}

.mode-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s;
}

.mode-btn:hover { opacity: 0.8; }
.mode-btn.active {
  background: var(--accent-color);
  color: #fff;
  opacity: 1;
}

.glass-mini {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.07); }
.icon-btn.active { opacity: 1; color: var(--accent-color); background: rgba(99,102,241,0.15); }
.icon-btn:disabled { opacity: 0.2; cursor: default; }

.regen-btn {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.72rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99,102,241,0.25);
}

.regen-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.regen-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Glass utility */
.glass {
  background: rgba(22, 27, 34, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.06);
}

:root.theme-light .glass {
  background: rgba(255,255,255,0.8);
  border-color: rgba(0,0,0,0.1);
}

/* Loading */
.loading-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  font-size: 0.9rem;
  opacity: 0.9;
  margin: 0;
}

.loading-sub {
  font-size: 0.75rem;
  opacity: 0.4;
  margin: 0;
}

.spin { animation: spin 0.8s linear infinite; }

/* Error */
.error-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  margin: 15px;
  border-radius: 12px;
  text-align: center;
}

.error-title { font-weight: 800; font-size: 1rem; color: #f87171; margin: 0; }

.error-body {
  font-size: 0.72rem;
  font-family: 'Consolas', monospace;
  color: #f87171;
  opacity: 0.8;
  white-space: pre-wrap;
  max-width: 600px;
  background: rgba(239,68,68,0.05);
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid rgba(239,68,68,0.2);
  margin: 0;
}

/* Main Area */
.main-area {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  min-height: 0;
  overflow: hidden;
}

.diagram-panel {
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
  transition: all 0.3s;
  position: relative;
}

.diagram-panel.half-width { flex: 1.2; }

/* Zoom viewport: fixed size container, clips overflow, grab cursor */
.zoom-viewport {
  flex: 1;
  width: 100%;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  position: relative;  /* mermaid-output is positioned relative to this */
}

/* Mermaid SVG output — absolutely positioned so transform doesn't affect parent layout */
.mermaid-output {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
  min-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  will-change: transform;
  transition: none;
}

.mermaid-output :deep(svg) {
  display: block;
  max-width: none;
  height: auto;
}

/* Zoom scale badge */
.zoom-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-color);
  opacity: 0.5;
  min-width: 36px;
  text-align: center;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  opacity: 0.5;
  height: 100%;
  min-height: 300px;
}

.empty-state p { margin: 0; font-size: 0.85rem; }
.empty-state .hint { font-size: 0.72rem; opacity: 0.7; }

/* Raw Code Panel */
.raw-panel {
  width: 340px;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.raw-header {
  padding: 10px 14px;
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.03);
}

.raw-code {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  font-size: 0.72rem;
  font-family: 'Consolas', 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  line-height: 1.6;
  color: #a5f3fc;
}

/* Scrollbar */
.diagram-panel::-webkit-scrollbar,
.raw-code::-webkit-scrollbar { width: 5px; height: 5px; }
.diagram-panel::-webkit-scrollbar-track,
.raw-code::-webkit-scrollbar-track { background: transparent; }
.diagram-panel::-webkit-scrollbar-thumb,
.raw-code::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

/* Interactive Function Highlighting */
.mermaid-output :deep(.func-highlight) rect,
.mermaid-output :deep(.func-highlight) polygon,
.mermaid-output :deep(.func-highlight) .label-container,
.mermaid-output :deep(.func-highlight) .cluster-rect {
  stroke: #60a5fa !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 4px rgba(96, 165, 250, 0.5));
  transition: all 0.2s ease;
}

.mermaid-output :deep(.func-highlight) path {
  stroke: #60a5fa !important;
  stroke-width: 4px !important;
  transition: all 0.2s ease;
}

.mermaid-output :deep(.func-highlight) .edgeLabel {
  color: #60a5fa !important;
  font-weight: bold;
}

.mermaid-output :deep(.func-dimmed) {
  opacity: 0.15 !important;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.mermaid-output :deep(.node),
.mermaid-output :deep(.edgePath),
.mermaid-output :deep(.cluster) {
  transition: opacity 0.3s ease, stroke 0.2s ease;
}
</style>


