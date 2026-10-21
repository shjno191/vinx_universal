<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  parseBatchLog, 
  type BatchAnalysisResult, 
  type BatchLogLine 
} from './utils/batch-parser';
import { Icons } from '@vinx/sdk';

const props = defineProps<{
  theme?: string;
  isActive?: boolean;
  active?: boolean;
}>();

// Sample Batch Log
const SAMPLE_BATCH_LOG = `2026/10/21 12:33:36,INFO,stc.log.StcLog           ,init                ,batchLogはC:\\Users\\09204113161\\Desktop\\code\\Kaizen_Master_Maintenance\\src\\kaizen-master-maintenance\\mdw_corepkggaibuif-compmaruai-batch\\batch\\properties/stcliblog4j.propertiesで初期化に成功しました。
2026/10/21 12:33:36,INFO,commons.dao.BatchController,executeBatch        ,バッチID=GIBBXXXXXX バッチ名=ラベル発行機への納品情報出力処理　処理を開始します。
2026/10/21 12:33:36,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：ラベル発行機への納品情報出力処理を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：納品データ件数取得を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：9件抽出しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：納品データ件数取得を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：ラベル発行機用納品ワーク登録処理を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：0件のGIF_WK_LABEL_HAKKOKI_NOHINを登録しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：ラベル発行機用納品ワーク登録処理を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：CSVファイル出力処理を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：発注締分CSV出力データ取得を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：1件を抽出しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理ラベル発行機用納品データCSVを出力しました。D:\\mdware\\download\\mlc_label\\MLC_LABEL_20261021123338.csv

2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：発注締分CSV出力データ取得を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：発注修正フラグ更新処理を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：0件のGIF_WK_LABEL_HAKKOKI_NOHINを更新しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：発注修正フラグ更新処理を終了します。

2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：発注修正分対象仕入先取得を開始します。を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理[テスト仕入先A] ラベル発行機用納品データCSVを出力しました。D:\\mdware\\download\\mlc_label\\MLC_LABEL_テスト仕入先A_20261021123338.csv
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：発注修正分対象仕入先取得を終了します。を終了します。

2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：緊急発注分対象仕入先取得を開始します。を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：0件を抽出しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：0件をその他しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：緊急発注分対象仕入先取得を終了します。を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：CSVファイル出力処理を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：起動管理ワーク更新処理を開始します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：1件のGIF_WK_LABEL_HAKKOKI_NOHIN_KIDOKANRIを更新しました。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：起動管理ワーク更新処理を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchDaoInvoker,infoLog             ,GIBBXXXXXX：ラベル発行機用納品データ出力処理：ラベル発行機への納品情報出力処理を終了します。
2026/10/21 12:33:37,INFO,commons.dao.BatchController,executeBatch        ,バッチID=GIBBXXXXXX バッチ名=ラベル発行機への納品情報出力処理　処理を終了します。`;

// Start with empty input log (clean blank space by default)
const inputLog = ref('');
const isEditingRaw = ref(true); // Default to clean raw textarea when empty
const searchQuery = ref('');
const filterMode = ref<'all' | 'lifecycle' | 'db'>('all');
const toastMessage = ref('');

// Computed analysis result
const analysis = computed<BatchAnalysisResult>(() => {
  return parseBatchLog(inputLog.value.trim());
});

const showToast = (msg: string) => {
  toastMessage.value = msg;
  setTimeout(() => { toastMessage.value = ''; }, 2000);
};

const loadSample = () => {
  inputLog.value = SAMPLE_BATCH_LOG;
  isEditingRaw.value = false;
  showToast('Loaded sample log');
};

const clearLog = () => {
  inputLog.value = '';
  isEditingRaw.value = true;
  searchQuery.value = '';
  showToast('Cleared content');
};

// Color Palettes for distinct clusters (Start and End of the same cluster share the exact same color)
interface ClusterPalette {
  name: string;
  darkColor: string;
  darkBg: string;
  win95Color: string;
  win95Bg: string;
}

const CLUSTER_PALETTES: ClusterPalette[] = [
  {
    name: 'indigo',
    darkColor: '#818cf8',
    darkBg: 'rgba(99, 102, 241, 0.12)',
    win95Color: '#000080', // Navy Blue
    win95Bg: '#eff6ff'
  },
  {
    name: 'teal',
    darkColor: '#2dd4bf',
    darkBg: 'rgba(20, 184, 166, 0.12)',
    win95Color: '#0f766e', // Deep Teal
    win95Bg: '#f0fdfa'
  },
  {
    name: 'purple',
    darkColor: '#c084fc',
    darkBg: 'rgba(168, 85, 247, 0.12)',
    win95Color: '#6b21a8', // Deep Purple
    win95Bg: '#faf5ff'
  },
  {
    name: 'amber',
    darkColor: '#fbbf24',
    darkBg: 'rgba(245, 158, 11, 0.12)',
    win95Color: '#b45309', // Dark Amber
    win95Bg: '#fffbeb'
  },
  {
    name: 'emerald',
    darkColor: '#34d399',
    darkBg: 'rgba(16, 185, 129, 0.12)',
    win95Color: '#15803d', // Forest Green
    win95Bg: '#f0fdf4'
  },
  {
    name: 'rose',
    darkColor: '#fb7185',
    darkBg: 'rgba(244, 63, 94, 0.12)',
    win95Color: '#be123c', // Deep Crimson
    win95Bg: '#fff1f2'
  },
  {
    name: 'cyan',
    darkColor: '#38bdf8',
    darkBg: 'rgba(6, 182, 212, 0.12)',
    win95Color: '#0369a1', // Ocean Blue
    win95Bg: '#f0f9ff'
  }
];

const getClusterColor = (idx: number | undefined) => {
  if (idx === undefined || idx < 0) {
    return props.theme === '95' ? '#000080' : '#818cf8';
  }
  const palette = CLUSTER_PALETTES[idx % CLUSTER_PALETTES.length];
  return props.theme === '95' ? palette.win95Color : palette.darkColor;
};

const getClusterBg = (idx: number | undefined) => {
  if (idx === undefined || idx < 0) {
    return 'transparent';
  }
  const palette = CLUSTER_PALETTES[idx % CLUSTER_PALETTES.length];
  return props.theme === '95' ? palette.win95Bg : palette.darkBg;
};

// Interface for multi-level hierarchical tree tracks
interface GuideTrack {
  col: number;
  type: 'start' | 'line' | 'end' | 'empty';
  clusterColorIdx: number;
}

interface EnrichedLine extends BatchLogLine {
  tracks: GuideTrack[];
  depth: number;
  clusterColorIdx?: number;
}

// Compute lines with tree hierarchical guide lines & consistent start/end colors per cluster
const enrichedLines = computed<EnrichedLine[]>(() => {
  const lines = analysis.value.rawLines;
  if (!lines || lines.length === 0) return [];

  const result: EnrichedLine[] = [];
  const activeStack: { title: string; depth: number; colorIdx: number; redundantStarts: number }[] = [];
  let clusterCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tracks: GuideTrack[] = [];

    // Check if this line is an exact duplicate start of the already active top cluster
    const isDuplicateStart = Boolean(line.isStart && 
      activeStack.length > 0 && 
      activeStack[activeStack.length - 1].title === line.processName);

    if (isDuplicateStart) {
      activeStack[activeStack.length - 1].redundantStarts++;
    }

    // Check if this line is an internal end corresponding to a recorded redundant start
    let isDuplicateEnd = false;
    if (line.isEnd && activeStack.length > 0) {
      const top = activeStack[activeStack.length - 1];
      if (top.title === line.processName && top.redundantStarts > 0) {
        top.redundantStarts--;
        isDuplicateEnd = true;
      }
    }

    if (line.isStart && !isDuplicateStart) {
      const curDepth = activeStack.length;
      const colorIdx = clusterCounter % CLUSTER_PALETTES.length;
      clusterCounter++;

      for (let c = 0; c < curDepth; c++) {
        tracks.push({ col: c, type: 'line', clusterColorIdx: activeStack[c].colorIdx });
      }
      tracks.push({ col: curDepth, type: 'start', clusterColorIdx: colorIdx });
      activeStack.push({ title: line.processName || '', depth: curDepth, colorIdx, redundantStarts: 0 });

      result.push({
        ...line,
        tracks,
        depth: curDepth,
        clusterColorIdx: colorIdx
      });
    } else if (line.isEnd && !isDuplicateEnd) {
      // Find matching item in stack (usually top, or ancestor if inner steps omitted an end)
      let matchIdx = -1;
      for (let s = activeStack.length - 1; s >= 0; s--) {
        if (activeStack[s].title === line.processName) {
          matchIdx = s;
          break;
        }
      }

      // Pop unclosed children if any
      if (matchIdx >= 0) {
        while (activeStack.length > matchIdx + 1) {
          activeStack.pop();
        }
      }

      const curDepth = Math.max(0, activeStack.length - 1);
      const popped = activeStack.pop();
      const colorIdx = popped ? popped.colorIdx : 0;

      for (let c = 0; c < curDepth; c++) {
        tracks.push({ col: c, type: 'line', clusterColorIdx: activeStack[c].colorIdx });
      }
      tracks.push({ col: curDepth, type: 'end', clusterColorIdx: colorIdx });

      result.push({
        ...line,
        tracks,
        depth: curDepth,
        clusterColorIdx: colorIdx
      });
    } else {
      const curDepth = activeStack.length;
      const currentColorIdx = activeStack.length > 0 ? activeStack[activeStack.length - 1].colorIdx : undefined;

      for (let c = 0; c < curDepth; c++) {
        tracks.push({ col: c, type: 'line', clusterColorIdx: activeStack[c].colorIdx });
      }

      result.push({
        ...line,
        isStart: false,
        isEnd: false,
        tracks,
        depth: curDepth,
        clusterColorIdx: currentColorIdx
      });
    }
  }

  return result;
});

// Filter lines based on filterMode and searchQuery
const filteredLines = computed<EnrichedLine[]>(() => {
  let lines = enrichedLines.value;

  if (filterMode.value === 'lifecycle') {
    lines = lines.filter(l => l.isStart || l.isEnd);
  } else if (filterMode.value === 'db') {
    lines = lines.filter(l => l.tableName || l.filePath || l.recordsCount !== undefined);
  }

  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return lines;

  return lines.filter(l => {
    return l.message.toLowerCase().includes(query) ||
           (l.processName && l.processName.toLowerCase().includes(query)) ||
           (l.tableName && l.tableName.toLowerCase().includes(query)) ||
           (l.filePath && l.filePath.toLowerCase().includes(query));
  });
});

const IGNORED_WORDS = new Set(['INFO', 'WARN', 'ERROR', 'DEBUG', 'FATAL', 'TRUE', 'FALSE', 'NULL', 'CSV', 'HTTP', 'JSON']);

// Clean tokenizer for message highlight: Table name and record numbers only
const formatMessageTokens = (msg: string) => {
  const regex = /([A-Za-z]:\\[^\s,]+\.(?:csv|tsv|txt|dat)|[A-Za-z0-9_]+\.csv)|(\b[A-Z][A-Z0-9_]{3,}\b)|(\d+\s*件)/g;
  const parts: { text: string; type: 'text' | 'table' | 'number' | 'file' }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(msg)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: msg.substring(lastIndex, match.index), type: 'text' });
    }
    if (match[1]) {
      // File path
      parts.push({ text: match[1], type: 'file' });
    } else if (match[2]) {
      // Table name
      if (IGNORED_WORDS.has(match[2])) {
        parts.push({ text: match[2], type: 'text' });
      } else {
        parts.push({ text: match[2], type: 'table' });
      }
    } else if (match[3]) {
      // Record number like "9件", "0件", "1件"
      parts.push({ text: match[3], type: 'number' });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < msg.length) {
    parts.push({ text: msg.substring(lastIndex), type: 'text' });
  }

  return parts.length > 0 ? parts : [{ text: msg, type: 'text' as const }];
};
</script>

<template>
  <div class="batch-tab-root" :class="[`theme-${props.theme || 'dark'}`, { 'is-win95': props.theme === '95' }]">
    <!-- Streamlined Header Bar -->
    <header class="batch-header-bar">
      <div class="header-left">
        <div class="header-icon" v-html="Icons.Batch"></div>
        <span class="app-title">Batch Viewer</span>

        <div v-if="analysis.batchId && analysis.batchId !== 'BATCH_JOB'" class="batch-meta-tag">
          <span class="meta-id">{{ analysis.batchId }}</span>
          <span class="meta-name" v-if="analysis.batchName">{{ analysis.batchName }}</span>
        </div>
      </div>

      <div class="header-center">
        <!-- Filter Pills (Only visible when viewing formatted log) -->
        <div class="filter-pills" v-if="!isEditingRaw && inputLog.trim()">
          <button 
            class="pill-btn" 
            :class="{ active: filterMode === 'all' }" 
            @click="filterMode = 'all'"
          >
            All ({{ analysis.totalLines }})
          </button>
          <button 
            class="pill-btn" 
            :class="{ active: filterMode === 'lifecycle' }" 
            @click="filterMode = 'lifecycle'"
          >
            Start & End
          </button>
          <button 
            class="pill-btn" 
            :class="{ active: filterMode === 'db' }" 
            @click="filterMode = 'db'"
          >
            Tables & Files
          </button>
        </div>

        <input 
          v-if="!isEditingRaw && inputLog.trim()"
          v-model="searchQuery" 
          type="text" 
          placeholder="Filter lines, process, table..." 
          class="header-search-input"
        />
      </div>

      <div class="header-right">
        <button class="win-btn" @click="loadSample" title="Load sample log">
          <span>📑 Sample</span>
        </button>
        <button 
          class="win-btn" 
          :class="{ primary: isEditingRaw && inputLog.trim(), active: !isEditingRaw }"
          @click="isEditingRaw = !isEditingRaw" 
          :disabled="!inputLog.trim() && isEditingRaw"
          :title="isEditingRaw ? 'View Formatted Log' : 'Edit Raw Log'"
        >
          <span>{{ isEditingRaw ? '👁️ View Log' : '✏️ Raw Text' }}</span>
        </button>
        <button class="win-btn" @click="clearLog" title="Clear log content">
          <span>🗑️ Clear</span>
        </button>
      </div>
    </header>

    <!-- Toast Notification -->
    <transition name="fade">
      <div v-if="toastMessage" class="toast-box">
        <span>✓ {{ toastMessage }}</span>
      </div>
    </transition>

    <!-- Main Full-Width Single Slide Viewer -->
    <main class="batch-main-viewer">
      <!-- Mode 1: Log Stream List with Tree Guide Lines -->
      <div v-if="!isEditingRaw && inputLog.trim()" class="log-stream-scroll">
        <div v-if="filteredLines.length === 0" class="empty-log-state">
          <p v-if="searchQuery">No matching lines found for "{{ searchQuery }}".</p>
          <p v-else>No log content.</p>
        </div>

        <div v-else class="log-stream-list">
          <template v-for="(line, idx) in filteredLines" :key="line.lineNum">
            <div 
              class="log-row"
              :class="{
                'is-start': line.isStart,
                'is-end': line.isEnd,
                'is-intermediate': !line.isStart && !line.isEnd,
                'has-table': !!line.tableName
              }"
              :style="{
                background: (line.isStart || line.isEnd) ? getClusterBg(line.clusterColorIdx) : undefined
              }"
            >
              <!-- Line Number -->
              <span class="line-num">#{{ line.lineNum }}</span>

              <!-- Tree Hierarchical Guide Lines (SVG Tracks) -->
              <div class="guide-tracks-container" v-if="line.tracks && line.tracks.length > 0">
                <span 
                  v-for="track in line.tracks" 
                  :key="track.col" 
                  class="track-slot"
                  :class="['track-' + track.type, { 'is-root-track': track.col === 0 }]"
                  :style="{ color: getClusterColor(track.clusterColorIdx) }"
                >
                  <!-- START: Corner down-right ┌ -->
                  <svg v-if="track.type === 'start'" width="18" height="100%" viewBox="0 0 18 24" preserveAspectRatio="none">
                    <path d="M9 24 V12 H18" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>
                  </svg>
                  <!-- END: Corner up-right └ -->
                  <svg v-else-if="track.type === 'end'" width="18" height="100%" viewBox="0 0 18 24" preserveAspectRatio="none">
                    <path d="M9 0 V12 H18" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>
                  </svg>
                  <!-- LINE: Vertical continuous line │ -->
                  <svg v-else-if="track.type === 'line'" width="18" height="100%" viewBox="0 0 18 24" preserveAspectRatio="none">
                    <line x1="9" y1="0" x2="9" y2="24" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>
                  </svg>
                </span>
              </div>

              <!-- START Line Presentation -->
              <template v-if="line.isStart">
                <span 
                  class="badge-lifecycle" 
                  :style="{ background: getClusterColor(line.clusterColorIdx), color: '#ffffff' }"
                >
                  START
                </span>
                <span 
                  class="process-title-note" 
                  v-if="line.processName"
                  :style="{ color: getClusterColor(line.clusterColorIdx) }"
                >
                  Process: <strong>{{ line.processName }}</strong>
                </span>
                <span class="line-time" v-if="line.timestamp">{{ line.timestamp.split(' ')[1] || line.timestamp }}</span>
                <span class="message-inline">{{ line.message }}</span>
              </template>

              <!-- END Line Presentation (SAME COLOR AS START FOR THIS CLUSTER) -->
              <template v-else-if="line.isEnd">
                <span 
                  class="badge-lifecycle" 
                  :style="{ background: getClusterColor(line.clusterColorIdx), color: '#ffffff' }"
                >
                  END
                </span>
                <span 
                  class="process-title-note" 
                  v-if="line.processName"
                  :style="{ color: getClusterColor(line.clusterColorIdx) }"
                >
                  Process: <strong>{{ line.processName }}</strong>
                </span>
                <span class="line-time" v-if="line.timestamp">{{ line.timestamp.split(' ')[1] || line.timestamp }}</span>
                <span class="message-inline">{{ line.message }}</span>
              </template>

              <!-- Intermediate Execution Lines (Clean, Highlighted Tables & Numbers) -->
              <template v-else>
                <span class="line-time" v-if="line.timestamp">{{ line.timestamp.split(' ')[1] || line.timestamp }}</span>
                
                <div class="line-message-content">
                  <span 
                    v-for="(token, tIdx) in formatMessageTokens(line.message)" 
                    :key="tIdx"
                    :class="[
                      'token-' + token.type,
                      { 'token-table': token.type === 'table' },
                      { 'token-number': token.type === 'number' },
                      { 'token-file': token.type === 'file' }
                    ]"
                  >
                    {{ token.text }}
                  </span>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>

      <!-- Mode 2: Clean Raw Textarea (Default clean white space when empty or cleared) -->
      <div v-else class="raw-edit-view">
        <textarea 
          v-model="inputLog" 
          placeholder="Paste batch log content here (Ctrl+V)..." 
          class="raw-textarea" 
          spellcheck="false"
        ></textarea>

        <div class="edit-footer" v-if="inputLog.trim()">
          <button class="win-btn primary" @click="isEditingRaw = false">
            👁️ View Log
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Root Container */
.batch-tab-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--container-bg, #1e1e2e);
  color: var(--text-color, #cdd6f4);
  font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  overflow: hidden;
  box-sizing: border-box;
}

/* Header Bar */
.batch-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  display: flex;
  align-items: center;
  color: #818cf8;
}

.app-title {
  font-size: 14px;
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.2px;
}

.batch-meta-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.meta-id {
  font-family: Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  color: #c7d2fe;
}

.meta-name {
  font-size: 12px;
  color: #94a3b8;
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 500px;
}

.filter-pills {
  display: flex;
  gap: 4px;
}

.pill-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  cursor: pointer;
  white-space: nowrap;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.pill-btn.active {
  background: #4f46e5;
  color: #ffffff;
  border-color: #6366f1;
}

.header-search-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  font-size: 11.5px;
  padding: 4px 8px;
  border-radius: 4px;
  outline: none;
}

.header-search-input:focus {
  border-color: #6366f1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Buttons */
.win-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-color, #e2e8f0);
  transition: all 0.15s;
}

.win-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}

.win-btn.primary {
  background: #15803d;
  color: #ffffff;
  border-color: #22c55e;
}

.win-btn.active {
  background: #4f46e5;
  color: #ffffff;
  border-color: #6366f1;
}

/* Toast */
.toast-box {
  position: absolute;
  top: 48px;
  right: 20px;
  background: #15803d;
  color: #ffffff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

/* Main Viewer (Single View) */
.batch-main-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--container-bg, #1e1e2e);
}

/* Log Stream Scroll Area */
.log-stream-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.empty-log-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: #64748b;
  font-size: 13px;
}

.log-stream-list {
  display: flex;
  flex-direction: column;
}

/* Individual Log Row */
.log-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 0 8px;
  border-radius: 2px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11.5px;
  line-height: 1.45;
  background: transparent;
  transition: background 0.1s;
  min-height: 24px;
}

.log-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Tree Hierarchical Guide Lines (SVG Tracks) */
.guide-tracks-container {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
}

.track-slot {
  width: 18px;
  min-width: 18px;
  display: inline-flex;
  align-items: stretch;
  justify-content: center;
  color: #818cf8;
}

.track-slot.is-root-track {
  color: #a5b4fc;
}



.line-num {
  font-size: 10px;
  color: #64748b;
  min-width: 28px;
  user-select: none;
}

/* Lifecycle Badges (START / END) */
.badge-lifecycle {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.4px;
  flex-shrink: 0;
  color: #ffffff;
}

/* Process Title Note */
.process-title-note {
  font-size: 11.5px;
  white-space: nowrap;
}

.process-title-note strong {
  font-weight: 700;
}

.line-time {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

.message-inline {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.line-message-content {
  flex: 1;
  word-break: break-all;
  color: #e2e8f0;
}

/* Highlighted Tokens */
.token-table {
  font-weight: 800;
  color: #c084fc;
  border-bottom: 1px dotted rgba(192, 132, 252, 0.6);
}

.token-number {
  font-weight: 800;
  color: #fbbf24;
}

.token-file {
  color: #38bdf8;
  text-decoration: underline;
}

/* Raw Edit View (Default clean white space when empty) */
.raw-edit-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  position: relative;
  overflow: hidden;
}

.raw-textarea {
  flex: 1;
  width: 100%;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.45;
  padding: 12px;
  border-radius: 6px;
  outline: none;
  resize: none;
  box-sizing: border-box;
}

.raw-textarea:focus {
  border-color: #6366f1;
}

.edit-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* ========================================================= */
/* 🌟 WINDOWS 95 THEME (CLEAN, HIGH CONTRAST, DISTINCT)      */
/* ========================================================= */
.is-win95 {
  background: #c0c0c0 !important;
  color: #000000 !important;
  font-family: 'MS Sans Serif', Tahoma, sans-serif !important;
}

.is-win95 .batch-header-bar {
  background: #c0c0c0 !important;
  border-bottom: 2px solid #808080 !important;
}

.is-win95 .app-title {
  color: #000000 !important;
  font-weight: 900 !important;
}

.is-win95 .header-icon {
  color: #000080 !important;
}

.is-win95 .batch-meta-tag {
  background: #ffffff !important;
  border: 1px solid #808080 !important;
}

.is-win95 .meta-id {
  color: #000080 !important;
}

.is-win95 .meta-name {
  color: #000000 !important;
  font-weight: bold !important;
}

.is-win95 .pill-btn {
  background: #c0c0c0 !important;
  color: #000000 !important;
  border: 2px solid !important;
  border-color: #ffffff #808080 #808080 #ffffff !important;
  border-radius: 0 !important;
  font-weight: bold !important;
}

.is-win95 .pill-btn.active {
  background: #000080 !important;
  color: #ffffff !important;
  border-color: #808080 #ffffff #ffffff #808080 !important;
}

.is-win95 .header-search-input {
  background: #ffffff !important;
  color: #000000 !important;
  border: 2px solid !important;
  border-color: #808080 #ffffff #ffffff #808080 !important;
  border-radius: 0 !important;
}

.is-win95 .win-btn {
  background: #c0c0c0 !important;
  color: #000000 !important;
  border: 2px solid !important;
  border-color: #ffffff #808080 #808080 #ffffff !important;
  border-radius: 0 !important;
  font-weight: bold !important;
  box-shadow: none !important;
}

.is-win95 .win-btn:active {
  border-color: #808080 #ffffff #ffffff #808080 !important;
  padding-top: 5px !important;
  padding-left: 11px !important;
}

.is-win95 .win-btn.active {
  background: #000080 !important;
  color: #ffffff !important;
  border-color: #808080 #ffffff #ffffff #808080 !important;
}

/* Win95 Log Container */
.is-win95 .batch-main-viewer {
  background: #c0c0c0 !important;
}

.is-win95 .log-stream-scroll {
  background: #ffffff !important;
  border: 2px solid !important;
  border-color: #808080 #ffffff #ffffff #808080 !important;
  margin: 6px;
  border-radius: 0 !important;
}

.is-win95 .log-row {
  color: #000000 !important;
}

.is-win95 .log-row:hover {
  background: #f1f5f9 !important;
}

/* Win95 Guide Line Tracks */
.is-win95 .track-slot {
  color: #1e3a8a !important;
}

.is-win95 .track-slot.is-root-track {
  color: #000080 !important;
}

.is-win95 .badge-lifecycle {
  border-radius: 0 !important;
  font-weight: 900 !important;
}

.is-win95 .process-title-note {
  font-weight: bold !important;
}

.is-win95 .line-num {
  color: #000080 !important;
  font-weight: bold !important;
}

.is-win95 .line-time {
  color: #555555 !important;
}



.is-win95 .line-message-content {
  color: #000000 !important;
}

.is-win95 .token-table {
  color: #000080 !important;
  font-weight: 900 !important;
  border-bottom: 1px solid #000080 !important;
}

.is-win95 .token-number {
  color: #b45309 !important;
  font-weight: 900 !important;
}

.is-win95 .token-file {
  color: #0284c7 !important;
  text-decoration: underline !important;
}

.is-win95 .raw-textarea {
  background: #ffffff !important;
  color: #000000 !important;
  border: 2px solid !important;
  border-color: #808080 #ffffff #ffffff #808080 !important;
  border-radius: 0 !important;
  font-weight: 500 !important;
}
</style>
