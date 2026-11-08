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

const inputLog = ref('');
const isEditingRaw = ref(false);
const searchQuery = ref('');
const filterMode = ref<'all' | 'lifecycle' | 'db'>('all');
const toastMessage = ref('');

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

const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) {
      inputLog.value = text;
      isEditingRaw.value = false;
      showToast('Pasted log from clipboard');
    }
  } catch (_) {}
};

const handlePasteEvent = (e: ClipboardEvent) => {
  if (isEditingRaw.value) return;
  const text = e.clipboardData?.getData('text/plain') || '';
  if (text && text.trim()) {
    e.preventDefault();
    inputLog.value = text;
    isEditingRaw.value = false;
    showToast('Pasted log');
  }
};

const clearLog = () => {
  inputLog.value = '';
  isEditingRaw.value = false;
  searchQuery.value = '';
  showToast('Cleared');
};

interface ClusterPalette {
  darkColor: string;
  darkBg: string;
  lightColor: string;
  lightBg: string;
  win95Color: string;
  win95Bg: string;
}

const CLUSTER_PALETTES: ClusterPalette[] = [
  {
    darkColor: '#818cf8',
    darkBg: 'rgba(129, 140, 248, 0.08)',
    lightColor: '#4f46e5',
    lightBg: 'rgba(79, 70, 229, 0.07)',
    win95Color: '#000080',
    win95Bg: '#eef2ff'
  },
  {
    darkColor: '#2dd4bf',
    darkBg: 'rgba(45, 212, 191, 0.08)',
    lightColor: '#0d9488',
    lightBg: 'rgba(13, 148, 136, 0.07)',
    win95Color: '#0f766e',
    win95Bg: '#f0fdfa'
  },
  {
    darkColor: '#38bdf8',
    darkBg: 'rgba(56, 189, 248, 0.08)',
    lightColor: '#0284c7',
    lightBg: 'rgba(2, 132, 199, 0.07)',
    win95Color: '#0369a1',
    win95Bg: '#f0f9ff'
  },
  {
    darkColor: '#a78bfa',
    darkBg: 'rgba(167, 139, 250, 0.08)',
    lightColor: '#7c3aed',
    lightBg: 'rgba(124, 58, 237, 0.07)',
    win95Color: '#6b21a8',
    win95Bg: '#faf5ff'
  },
  {
    darkColor: '#34d399',
    darkBg: 'rgba(52, 211, 153, 0.08)',
    lightColor: '#059669',
    lightBg: 'rgba(5, 150, 105, 0.07)',
    win95Color: '#15803d',
    win95Bg: '#f0fdf4'
  }
];

const getClusterColor = (idx: number | undefined) => {
  const palette = CLUSTER_PALETTES[(idx ?? 0) % CLUSTER_PALETTES.length];
  if (props.theme === '95') return palette.win95Color;
  if (props.theme === 'light') return palette.lightColor;
  return palette.darkColor;
};

const getClusterBg = (idx: number | undefined) => {
  if (idx === undefined || idx < 0) return 'transparent';
  const palette = CLUSTER_PALETTES[idx % CLUSTER_PALETTES.length];
  if (props.theme === '95') return palette.win95Bg;
  if (props.theme === 'light') return palette.lightBg;
  return palette.darkBg;
};

interface GuideTrack {
  col: number;
  type: 'start' | 'line' | 'end';
  clusterColorIdx: number;
}

interface EnrichedLine extends BatchLogLine {
  tracks: GuideTrack[];
  depth: number;
  clusterColorIdx?: number;
  cleanText: string;
}

/**
 * Strips repetitive `<BatchID>：<OuterProcess>：` prefix from intermediate lines
 * so the actual log message is easy to read at a glance.
 */
const stripRedundantPrefix = (msg: string): string => {
  let cleaned = msg.trim();
  // Strip leading `GIBBXXXXXX：SomeProcessName：` when followed by the actual step message
  const twoColonMatch = cleaned.match(/^[A-Za-z0-9_-]+[：:][^：:]+[：:]\s*(.+)$/);
  if (twoColonMatch && twoColonMatch[1]) {
    return twoColonMatch[1].trim();
  }
  // Strip leading `GIBBXXXXXX：SomeProcessName` when directly followed by `[Supplier]` or repeated text
  const oneColonBracketMatch = cleaned.match(/^[A-Za-z0-9_-]+[：:][^：:\[]+(\[.+\])$/);
  if (oneColonBracketMatch && oneColonBracketMatch[1]) {
    return oneColonBracketMatch[1].trim();
  }
  const oneColonMatch = cleaned.match(/^[A-Za-z0-9_-]+[：:]\s*(.+)$/);
  if (oneColonMatch && oneColonMatch[1]) {
    return oneColonMatch[1].trim();
  }
  return cleaned;
};

const enrichedLines = computed<EnrichedLine[]>(() => {
  const lines = analysis.value.rawLines;
  if (!lines || lines.length === 0) return [];

  const result: EnrichedLine[] = [];
  const activeStack: { title: string; depth: number; colorIdx: number; redundantStarts: number }[] = [];
  let clusterCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tracks: GuideTrack[] = [];

    const isDuplicateStart = Boolean(
      line.isStart &&
      activeStack.length > 0 &&
      activeStack[activeStack.length - 1].title === line.processName
    );

    if (isDuplicateStart) {
      activeStack[activeStack.length - 1].redundantStarts++;
      continue;
    }

    if (line.isEnd && activeStack.length > 0) {
      const top = activeStack[activeStack.length - 1];
      if (top.title === line.processName && top.redundantStarts > 0) {
        top.redundantStarts--;
        continue;
      }
    }

    if (line.isStart) {
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
        clusterColorIdx: colorIdx,
        cleanText: line.processName || stripRedundantPrefix(line.message)
      });
    } else if (line.isEnd) {
      let matchIdx = -1;
      for (let s = activeStack.length - 1; s >= 0; s--) {
        if (activeStack[s].title === line.processName) {
          matchIdx = s;
          break;
        }
      }

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
        clusterColorIdx: colorIdx,
        cleanText: line.processName || stripRedundantPrefix(line.message)
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
        clusterColorIdx: currentColorIdx,
        cleanText: stripRedundantPrefix(line.message)
      });
    }
  }

  return result;
});

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
           l.cleanText.toLowerCase().includes(query) ||
           (l.processName && l.processName.toLowerCase().includes(query)) ||
           (l.tableName && l.tableName.toLowerCase().includes(query)) ||
           (l.filePath && l.filePath.toLowerCase().includes(query));
  });
});

const IGNORED_WORDS = new Set(['INFO', 'WARN', 'ERROR', 'DEBUG', 'FATAL', 'TRUE', 'FALSE', 'NULL', 'CSV', 'HTTP', 'JSON']);

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
      parts.push({ text: match[1], type: 'file' });
    } else if (match[2]) {
      if (IGNORED_WORDS.has(match[2])) {
        parts.push({ text: match[2], type: 'text' });
      } else {
        parts.push({ text: match[2], type: 'table' });
      }
    } else if (match[3]) {
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
  <div 
    class="batch-tab-root" 
    :class="[`theme-${props.theme || 'dark'}`, { 'is-win95': props.theme === '95' }]"
    tabindex="0"
    @paste="handlePasteEvent"
  >
    <!-- Clean Toolbar -->
    <header class="batch-toolbar glass">
      <div class="toolbar-left">
        <span class="toolbar-title">BATCH</span>

        <div v-if="inputLog.trim() && analysis.batchId && analysis.batchId !== 'BATCH_JOB'" class="batch-meta-badge">
          <span class="meta-id">{{ analysis.batchId }}</span>
          <span class="meta-divider" v-if="analysis.batchName">·</span>
          <span class="meta-name" v-if="analysis.batchName">{{ analysis.batchName }}</span>
        </div>
      </div>

      <div class="toolbar-center" v-if="!isEditingRaw && inputLog.trim()">
        <div class="filter-group">
          <button 
            class="filter-btn" 
            :class="{ active: filterMode === 'all' }" 
            @click="filterMode = 'all'"
          >
            All ({{ enrichedLines.length }})
          </button>
          <button 
            class="filter-btn" 
            :class="{ active: filterMode === 'lifecycle' }" 
            @click="filterMode = 'lifecycle'"
          >
            Steps
          </button>
          <button 
            class="filter-btn" 
            :class="{ active: filterMode === 'db' }" 
            @click="filterMode = 'db'"
          >
            DB / Files
          </button>
        </div>

        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Filter log..." 
          class="search-input"
        />
      </div>

      <div class="toolbar-right">
        <button class="tool-btn" @click="pasteFromClipboard" title="Paste from Clipboard (Ctrl+V)">
          <span class="btn-icon" v-html="Icons.Copy"></span>
          <span>Paste</span>
        </button>
        <button class="tool-btn" @click="loadSample" title="Load Sample Log">
          <span>Sample</span>
        </button>
        <button 
          v-if="inputLog.trim()"
          class="tool-btn" 
          :class="{ active: isEditingRaw }"
          @click="isEditingRaw = !isEditingRaw" 
          :title="isEditingRaw ? 'Switch to Formatted View' : 'View / Edit Raw Text'"
        >
          <span>{{ isEditingRaw ? 'Formatted' : 'Raw' }}</span>
        </button>
        <button v-if="inputLog.trim()" class="tool-btn danger" @click="clearLog" title="Clear Log">
          <span class="btn-icon" v-html="Icons.Trash2"></span>
        </button>
      </div>
    </header>

    <!-- Toast Notification -->
    <transition name="fade">
      <div v-if="toastMessage" class="toast-box">
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- Main Content -->
    <main class="batch-main-viewer glass">
      <!-- Formatted Log Stream -->
      <div v-if="!isEditingRaw && inputLog.trim()" class="log-stream-scroll">
        <div v-if="filteredLines.length === 0" class="empty-filter-state">
          No matching lines found.
        </div>

        <div v-else class="log-stream-list">
          <div 
            v-for="line in filteredLines" 
            :key="line.lineNum"
            class="log-row"
            :class="{
              'is-start': line.isStart,
              'is-end': line.isEnd,
              'is-error': line.level === 'ERROR' || line.level === 'FATAL',
              'is-warn': line.level === 'WARN'
            }"
            :style="{
              background: (line.isStart || line.isEnd) ? getClusterBg(line.clusterColorIdx) : undefined
            }"
            :title="line.raw"
          >
            <!-- 1. Aligned Line Number -->
            <span class="col-line-num">{{ line.lineNum }}</span>

            <!-- 2. Aligned Timestamp -->
            <span class="col-time">{{ line.timestamp ? (line.timestamp.split(' ')[1] || line.timestamp) : '' }}</span>

            <!-- 3. Tree Hierarchy Guides -->
            <div class="col-guides" v-if="line.tracks && line.tracks.length > 0">
              <span 
                v-for="track in line.tracks" 
                :key="track.col" 
                class="track-slot"
                :style="{ color: getClusterColor(track.clusterColorIdx) }"
              >
                <svg v-if="track.type === 'start'" width="16" height="100%" viewBox="0 0 16 24" preserveAspectRatio="none">
                  <path d="M8 24 V12 H15" fill="none" stroke="currentColor" stroke-width="1.75" vector-effect="non-scaling-stroke"/>
                </svg>
                <svg v-else-if="track.type === 'end'" width="16" height="100%" viewBox="0 0 16 24" preserveAspectRatio="none">
                  <path d="M8 0 V12 H15" fill="none" stroke="currentColor" stroke-width="1.75" vector-effect="non-scaling-stroke"/>
                </svg>
                <svg v-else-if="track.type === 'line'" width="16" height="100%" viewBox="0 0 16 24" preserveAspectRatio="none">
                  <line x1="8" y1="0" x2="8" y2="24" stroke="currentColor" stroke-width="1.75" vector-effect="non-scaling-stroke"/>
                </svg>
              </span>
            </div>

            <!-- 4. Clean Message Content -->
            <div class="col-content">
              <template v-if="line.isStart || line.isEnd">
                <span 
                  class="lifecycle-tag"
                  :class="line.isStart ? 'tag-start' : 'tag-end'"
                  :style="{ borderColor: getClusterColor(line.clusterColorIdx), color: getClusterColor(line.clusterColorIdx) }"
                >
                  {{ line.isStart ? 'START' : 'END' }}
                </span>
                <span 
                  class="step-title"
                  :style="{ color: getClusterColor(line.clusterColorIdx) }"
                >
                  {{ line.cleanText }}
                </span>
              </template>

              <template v-else>
                <span 
                  v-for="(token, tIdx) in formatMessageTokens(line.cleanText)" 
                  :key="tIdx"
                  :class="'token-' + token.type"
                >{{ token.text }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Raw Editor Mode -->
      <div v-else-if="isEditingRaw" class="raw-edit-view">
        <textarea 
          v-model="inputLog" 
          placeholder="Paste batch log content here (Ctrl+V)..." 
          class="raw-textarea" 
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Clean Empty State (Click or Ctrl+V to Paste Immediately) -->
      <div v-else class="empty-dropzone" @click="pasteFromClipboard">
        <div class="empty-card">
          <div class="empty-icon" v-html="Icons.Batch"></div>
          <div class="empty-title">Paste Batch Log (Ctrl + V)</div>
          <div class="empty-subtitle">Click here to paste from clipboard, or click <b>Sample</b> to preview</div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.batch-tab-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 12px;
  gap: 10px;
  background: var(--container-bg, #1e1e2e);
  color: var(--text-color, #cdd6f4);
  font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  overflow: hidden;
  box-sizing: border-box;
  outline: none;
}

.glass {
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--glass-border, rgba(128, 128, 128, 0.15));
  border-radius: 12px;
}

/* Toolbar */
.batch-toolbar {
  height: 46px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 14px;
  flex-shrink: 0;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.toolbar-title {
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: var(--accent-color, #818cf8);
}

.batch-meta-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(128, 128, 128, 0.1);
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  min-width: 0;
}

.meta-id {
  font-family: Consolas, monospace;
  font-weight: 700;
  color: var(--accent-color, #818cf8);
  flex-shrink: 0;
}

.meta-divider {
  opacity: 0.4;
}

.meta-name {
  opacity: 0.85;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 480px;
}

.filter-group {
  display: flex;
  gap: 2px;
  background: rgba(128, 128, 128, 0.08);
  padding: 3px;
  border-radius: 8px;
}

.filter-btn {
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-color);
  opacity: 0.65;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.filter-btn:hover {
  opacity: 1;
}

.filter-btn.active {
  opacity: 1;
  background: var(--accent-color, #6366f1);
  color: #ffffff;
}

.search-input {
  flex: 1;
  background: rgba(128, 128, 128, 0.08);
  border: 1px solid rgba(128, 128, 128, 0.18);
  color: var(--text-color);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 7px;
  outline: none;
  min-width: 120px;
}

.search-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 7px;
  cursor: pointer;
  background: rgba(128, 128, 128, 0.08);
  border: 1px solid rgba(128, 128, 128, 0.15);
  color: var(--text-color);
  transition: all 0.15s;
}

.tool-btn:hover {
  background: rgba(128, 128, 128, 0.16);
}

.tool-btn.active {
  background: var(--accent-color, #6366f1);
  color: #ffffff;
  border-color: var(--accent-color, #6366f1);
}

.tool-btn.danger:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  width: 14px;
  height: 14px;
}

.btn-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

/* Toast */
.toast-box {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #10b981;
  color: #ffffff;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

/* Main Viewer */
.batch-main-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-stream-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
}

.empty-filter-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  opacity: 0.5;
  font-size: 13px;
}

.log-stream-list {
  display: flex;
  flex-direction: column;
}

/* Clean Aligned Log Row */
.log-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 0 10px;
  border-radius: 4px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 24px;
  min-height: 24px;
}

.log-row:hover {
  background: rgba(128, 128, 128, 0.08) !important;
}

.log-row.is-error {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #fca5a5;
}

.col-line-num {
  width: 32px;
  flex-shrink: 0;
  text-align: right;
  font-size: 11px;
  opacity: 0.4;
  user-select: none;
}

.col-time {
  width: 64px;
  flex-shrink: 0;
  font-size: 11px;
  opacity: 0.55;
  white-space: nowrap;
  user-select: none;
}

.col-guides {
  display: inline-flex;
  align-items: stretch;
  flex-shrink: 0;
}

.track-slot {
  width: 16px;
  min-width: 16px;
  display: inline-flex;
  align-items: stretch;
  justify-content: center;
}

.col-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  word-break: break-all;
}

.lifecycle-tag {
  font-size: 9.5px;
  font-weight: 800;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 3px;
  border: 1px solid currentColor;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.step-title {
  font-weight: 700;
  font-size: 12.5px;
}

/* Highlighted Tokens */
.token-table {
  font-weight: 800;
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.3);
  padding: 0 5px;
  margin: 0 2px;
  border-radius: 3px;
  line-height: 1.3;
}

.token-number {
  font-weight: 800;
  color: #fbbf24;
  margin: 0 1px;
}

.token-file {
  color: #38bdf8;
  text-decoration: underline;
  margin: 0 2px;
}

/* Raw Edit View */
.raw-edit-view {
  flex: 1;
  display: flex;
  padding: 10px;
}

.raw-textarea {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-color);
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.5;
  padding: 6px;
  outline: none;
  resize: none;
}

/* Empty Dropzone */
.empty-dropzone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: pointer;
  user-select: none;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 48px;
  border: 2px dashed rgba(128, 128, 128, 0.25);
  border-radius: 12px;
  opacity: 0.65;
  transition: all 0.2s;
  text-align: center;
}

.empty-card:hover {
  opacity: 1;
  border-color: var(--accent-color, #6366f1);
  background: rgba(99, 102, 241, 0.04);
}

.empty-icon {
  color: var(--accent-color, #818cf8);
  margin-bottom: 4px;
}

.empty-title {
  font-size: 14px;
  font-weight: 700;
}

.empty-subtitle {
  font-size: 12px;
  opacity: 0.7;
}

/* Light Theme Adjustments */
.theme-light .token-table {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.3);
}

.theme-light .token-number {
  color: #d97706;
}

.theme-light .token-file {
  color: #0284c7;
}

/* Windows 95 Theme */
.is-win95 {
  background: #c0c0c0 !important;
  color: #000000 !important;
  font-family: 'MS Sans Serif', Tahoma, sans-serif !important;
}

.is-win95 .glass {
  background: #c0c0c0 !important;
  border: 2px outset #ffffff !important;
  border-radius: 0 !important;
}

.is-win95 .batch-main-viewer {
  background: #ffffff !important;
  border: 2px inset #808080 !important;
}

.is-win95 .tool-btn,
.is-win95 .filter-btn {
  background: #c0c0c0 !important;
  color: #000000 !important;
  border: 2px outset #ffffff !important;
  border-radius: 0 !important;
  opacity: 1 !important;
}

.is-win95 .tool-btn.active,
.is-win95 .filter-btn.active {
  background: #000080 !important;
  color: #ffffff !important;
  border: 2px inset #808080 !important;
}

.is-win95 .search-input {
  background: #ffffff !important;
  color: #000000 !important;
  border: 2px inset #808080 !important;
  border-radius: 0 !important;
}

.is-win95 .token-table {
  color: #cc0000 !important;
  background: #ffe5e5 !important;
  border: 1px solid #cc0000 !important;
  border-radius: 0 !important;
}

.is-win95 .token-number {
  color: #b45309 !important;
}

.is-win95 .token-file {
  color: #0000cc !important;
}
</style>
