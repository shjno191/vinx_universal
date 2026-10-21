/**
 * Batch Log Parser and Visualizer Helper
 * Parses Japanese enterprise batch logs (e.g. MDWare, Gaibu IF, Master, Hansoku)
 * into structured, color-coded execution clusters with Vietnamese translations.
 */

export interface BatchLogLine {
  lineNum: number;
  raw: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'FATAL' | string;
  logger: string;
  method: string;
  message: string;
  clusterId?: string;
  isStart?: boolean;
  isEnd?: boolean;
  processName?: string;
  tableName?: string;
  recordsCount?: number;
  filePath?: string;
}

export type BatchActionType = 
  | 'EXTRACT' 
  | 'DB_INSERT' 
  | 'DB_UPDATE' 
  | 'DB_DELETE' 
  | 'FILE_OUTPUT' 
  | 'INIT' 
  | 'CONTROL' 
  | 'GENERAL';

export interface BatchCluster {
  id: string;
  parentId?: string;
  title: string;
  titleVi: string;
  actionType: BatchActionType;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'IN_PROGRESS';
  startTime: string;
  endTime: string;
  durationMs: number;
  recordsCount?: number;
  targetTable?: string;
  filePath?: string;
  targetSupplier?: string;
  lines: BatchLogLine[];
  subClusters: BatchCluster[];
  depth: number;
}

export interface ImpactedTable {
  table: string;
  inserted: number;
  updated: number;
  deleted: number;
  steps: string[];
}

export interface GeneratedFile {
  path: string;
  fileName: string;
  stepTitle: string;
  supplier?: string;
}

export interface BatchAnalysisResult {
  batchId: string;
  batchName: string;
  batchNameVi: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'IN_PROGRESS';
  startTime: string;
  endTime: string;
  durationFormatted: string;
  totalLines: number;
  totalClusters: number;
  totalRecordsExtracted: number;
  totalRecordsInserted: number;
  totalRecordsUpdated: number;
  totalRecordsDeleted: number;
  totalFilesGenerated: number;
  impactedTables: ImpactedTable[];
  generatedFiles: GeneratedFile[];
  clusters: BatchCluster[];
  unclusteredLines: BatchLogLine[];
  rawLines: BatchLogLine[];
}

/**
 * Common phrase mappings for Japanese retail batch systems
 */
const PHRASE_DICTIONARY: Record<string, string> = {
  'ラベル発行機への納品情報出力処理': 'Xuất thông tin giao hàng cho máy in nhãn',
  'ラベル発行機用納品データ出力処理': 'Xuất dữ liệu giao hàng cho máy in nhãn',
  '納品データ件数取得': 'Lấy số lượng bản ghi dữ liệu giao hàng',
  'ラベル発行機用納品ワーク登録処理': 'Đăng ký bảng tạm (Work) giao hàng cho máy in nhãn',
  'CSVファイル出力処理': 'Xử lý xuất file CSV',
  '起動管理ワーク更新処理': 'Cập nhật bảng tạm quản lý khởi chạy (KIDOKANRI)',
  '納品情報出力処理': 'Xuất thông tin giao hàng',
  '納品データ': 'Dữ liệu giao hàng',
  '仕入先取得': 'Lấy nhà cung cấp',
  '起動管理ワーク': 'Bảng Work quản lý khởi chạy',
  'ワーク登録処理': 'Xử lý đăng ký bảng tạm (Work table)',
  'フラグ更新処理': 'Xử lý cập nhật cờ (Flag)',
  '件数取得': 'Lấy số lượng bản ghi',
  '取込処理': 'Xử lý nạp dữ liệu (Import)',
  '出力処理': 'Xử lý xuất dữ liệu (Export)',
  '抽出処理': 'Xử lý trích xuất dữ liệu',
  '登録処理': 'Xử lý thêm mới (Insert)',
  '更新処理': 'Xử lý cập nhật (Update)',
  '削除処理': 'Xử lý xóa (Delete)',
  '初期化': 'Khởi tạo',
};

/**
 * Keyword-based fallback translation helper
 */
export function translateJapaneseBatchText(text: string): string {
  if (!text) return '';
  const clean = text.trim();
  
  if (PHRASE_DICTIONARY[clean]) {
    return PHRASE_DICTIONARY[clean];
  }

  for (const [key, val] of Object.entries(PHRASE_DICTIONARY)) {
    if (clean.includes(key)) {
      let replaced = clean;
      for (const [k, v] of Object.entries(PHRASE_DICTIONARY)) {
        if (replaced.includes(k)) {
          replaced = replaced.split(k).join(` ${v} `);
        }
      }
      return replaced.replace(/\s+/g, ' ').trim();
    }
  }

  // Common vocabulary replacements
  let translated = clean;
  const vocab: [RegExp, string][] = [
    [/処理を開始します/g, 'Bắt đầu xử lý'],
    [/処理を終了します/g, 'Kết thúc xử lý'],
    [/を開始します/g, ' - Bắt đầu'],
    [/を終了します/g, ' - Kết thúc'],
    [/を開始します。/g, ' - Bắt đầu'],
    [/を終了します。/g, ' - Kết thúc'],
    [/件抽出しました/g, ' bản ghi đã trích xuất'],
    [/件を抽出しました/g, ' bản ghi đã trích xuất'],
    [/件をその他しました/g, ' bản ghi phân loại khác'],
    [/を出力しました/g, ' đã được xuất ra'],
    [/を登録しました/g, ' đã được thêm mới (Insert)'],
    [/を更新しました/g, ' đã được cập nhật (Update)'],
    [/を削除しました/g, ' đã được xóa (Delete)'],
    [/バッチID=/g, 'Batch ID = '],
    [/バッチ名=/g, 'Tên Batch = '],
    [/納品/g, 'Giao hàng'],
    [/発注/g, 'Đặt hàng'],
    [/仕入先/g, 'Nhà cung cấp'],
    [/ワーク/g, 'Bảng Work'],
    [/管理/g, 'Quản lý'],
    [/起動/g, 'Khởi chạy'],
    [/修正/g, 'Chỉnh sửa'],
    [/緊急/g, 'Khẩn cấp'],
    [/締分/g, 'Đã chốt'],
    [/件/g, ' bản ghi']
  ];

  for (const [regex, replacement] of vocab) {
    translated = translated.replace(regex, replacement);
  }

  return translated.trim();
}

/**
 * Determine action type for visual badge and color scheme
 */
export function determineActionType(message: string): BatchActionType {
  if (/登録しました|INSERT|登録処理/i.test(message)) return 'DB_INSERT';
  if (/更新しました|UPDATE|更新処理|フラグ更新/i.test(message)) return 'DB_UPDATE';
  if (/削除しました|DELETE|削除処理|TRUNCATE/i.test(message)) return 'DB_DELETE';
  if (/CSV|ファイル出力|出力しました|\.csv|\.tsv/i.test(message)) return 'FILE_OUTPUT';
  if (/抽出しました|件数取得|SELECT|抽出処理/i.test(message)) return 'EXTRACT';
  if (/init|初期化|properties/i.test(message)) return 'INIT';
  if (/executeBatch|BatchController|起動管理/i.test(message)) return 'CONTROL';
  return 'GENERAL';
}

/**
 * Parses a single raw log line into structured parts
 */
export function parseLogLine(raw: string, lineNum: number): BatchLogLine {
  // Pattern 1: CSV-style: Timestamp,Level,Logger,Method,Message
  const csvMatch = raw.match(/^(\d{4}[/-]\d{2}[/-]\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*,\s*([A-Z]+)\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*(.*)$/);
  if (csvMatch) {
    return {
      lineNum,
      raw,
      timestamp: csvMatch[1].trim(),
      level: csvMatch[2].trim(),
      logger: csvMatch[3].trim(),
      method: csvMatch[4].trim(),
      message: csvMatch[5].trim()
    };
  }

  // Pattern 2: Space / Bracket style: Timestamp [Level] Logger - Message
  const spaceMatch = raw.match(/^(\d{4}[/-]\d{2}[/-]\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\[?([A-Z]+)\]?\s+([^-\s]+)?\s*[-:]?\s*(.*)$/);
  if (spaceMatch) {
    return {
      lineNum,
      raw,
      timestamp: spaceMatch[1].trim(),
      level: spaceMatch[2].trim(),
      logger: (spaceMatch[3] || '').trim(),
      method: '',
      message: spaceMatch[4].trim()
    };
  }

  // Fallback
  return {
    lineNum,
    raw,
    timestamp: '',
    level: raw.includes('ERROR') ? 'ERROR' : raw.includes('WARN') ? 'WARN' : 'INFO',
    logger: '',
    method: '',
    message: raw.trim()
  };
}

/**
 * Formats duration between two timestamps or milliseconds into readable string
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.floor(durationMs / 1000);
  const ms = durationMs % 1000;
  if (seconds < 60) {
    return ms > 0 ? `${seconds}.${Math.floor(ms / 100)}s` : `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  return `${minutes}m ${remainingSec}s`;
}

/**
 * Calculates duration in milliseconds between two date strings
 */
export function calculateDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  try {
    const start = new Date(startTime.replace(/-/g, '/')).getTime();
    const end = new Date(endTime.replace(/-/g, '/')).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return end - start;
    }
  } catch {
    // fallback
  }
  return 0;
}

/**
 * Core Parser: Groups raw log content into structured execution clusters
 */
export function parseBatchLog(logContent: string): BatchAnalysisResult {
  const lines = logContent.split(/\r?\n/);
  const rawLines: BatchLogLine[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    rawLines.push(parseLogLine(lines[i], i + 1));
  }

  let batchId = '';
  let batchName = '';
  let overallStatus: 'SUCCESS' | 'WARNING' | 'ERROR' | 'IN_PROGRESS' = 'SUCCESS';
  let overallStartTime = '';
  let overallEndTime = '';

  const clusters: BatchCluster[] = [];
  const unclusteredLines: BatchLogLine[] = [];
  const clusterStack: BatchCluster[] = [];

  const tableStatsMap = new Map<string, { inserted: number; updated: number; deleted: number; steps: Set<string> }>();
  const generatedFiles: GeneratedFile[] = [];

  let totalRecordsExtracted = 0;
  let totalRecordsInserted = 0;
  let totalRecordsUpdated = 0;
  let totalRecordsDeleted = 0;

  for (const line of rawLines) {
    if (!overallStartTime && line.timestamp) {
      overallStartTime = line.timestamp;
    }
    if (line.timestamp) {
      overallEndTime = line.timestamp;
    }

    if (line.level === 'ERROR' || line.level === 'FATAL') {
      overallStatus = 'ERROR';
    } else if (line.level === 'WARN' && overallStatus !== 'ERROR') {
      overallStatus = 'WARNING';
    }

    const msg = line.message;

    // Detect Batch ID and Name
    const batchIdMatch = msg.match(/バッチID=([A-Za-z0-9_]+)/i) || msg.match(/(?:GIBB|MSTB|MSTO|HSKB)[A-Za-z0-9_]+/i);
    if (batchIdMatch && !batchId) {
      batchId = batchIdMatch[1] || batchIdMatch[0];
    }

    const batchNameMatch = msg.match(/バッチ名=([^ 　\t\r\n,]+)/i);
    if (batchNameMatch && !batchName) {
      batchName = batchNameMatch[1].trim();
    }

    // Detect DB Table Operations
    // e.g. "0件のGIF_WK_LABEL_HAKKOKI_NOHINを登録しました"
    const dbActionMatch = msg.match(/(\d+)\s*件[の\s]*([A-Za-z0-9_]{3,})\s*(?:を|に)?\s*(登録|更新|削除)しました/i);
    if (dbActionMatch) {
      const count = parseInt(dbActionMatch[1], 10);
      const table = dbActionMatch[2].toUpperCase();
      const action = dbActionMatch[3];

      line.tableName = table;
      line.recordsCount = count;

      if (!tableStatsMap.has(table)) {
        tableStatsMap.set(table, { inserted: 0, updated: 0, deleted: 0, steps: new Set() });
      }
      const stat = tableStatsMap.get(table)!;

      const currentStepTitle = clusterStack.length > 0 
        ? clusterStack[clusterStack.length - 1].title 
        : 'Top Level';
      stat.steps.add(currentStepTitle);

      if (action === '登録') {
        stat.inserted += count;
        totalRecordsInserted += count;
      } else if (action === '更新') {
        stat.updated += count;
        totalRecordsUpdated += count;
      } else if (action === '削除') {
        stat.deleted += count;
        totalRecordsDeleted += count;
      }
    }

    // Detect Extraction Records
    // e.g. "9件抽出しました。" or "1件を抽出しました。"
    const extractMatch = msg.match(/(\d+)\s*件[を]?\s*抽出しました/i);
    if (extractMatch) {
      const count = parseInt(extractMatch[1], 10);
      line.recordsCount = count;
      totalRecordsExtracted += count;
    }

    // Detect CSV or File Outputs
    // e.g. "...CSVを出力しました。D:\mdware\download\mlc_label\MLC_LABEL_20261021123338.csv"
    const fileMatch = msg.match(/([A-Za-z]:\\[^\s\r\n]+\.(?:csv|tsv|txt|dat))/i) 
      || msg.match(/([^\s\r\n:]+\.csv)/i);
    if (fileMatch) {
      const fullPath = fileMatch[1].trim();
      const fileName = fullPath.split(/[\/\\]/).pop() || fullPath;
      const supplierMatch = msg.match(/\[([^\]]+)\]/);
      const supplier = supplierMatch ? supplierMatch[1] : undefined;
      line.filePath = fullPath;
      const currentStepTitle = clusterStack.length > 0 
        ? clusterStack[clusterStack.length - 1].title 
        : 'File Output';

      if (!generatedFiles.some(f => f.path === fullPath)) {
        generatedFiles.push({
          path: fullPath,
          fileName,
          stepTitle: currentStepTitle,
          supplier
        });
      }
    }

    // Cluster Detection Logic
    // Step Start detection
    const isStart = msg.includes('を開始します') || msg.includes('処理を開始します');
    const isEnd = msg.includes('を終了します') || msg.includes('処理を終了します');

    if (isStart) {
      let title = msg;
      if (msg.includes('バッチID=')) {
        title = batchName || 'Batch Execution';
      } else {
        const parts = msg.split(/[：:]/);
        title = parts[parts.length - 1].replace(/を開始します.*$/, '').trim();
        if (!title && parts.length > 1) {
          title = parts[parts.length - 2].replace(/を開始します.*$/, '').trim();
        }
      }

      line.isStart = true;
      line.processName = title;

      const newCluster: BatchCluster = {
        id: `cluster-${clusters.length + clusterStack.length + 1}-${Date.now()}`,
        parentId: clusterStack.length > 0 ? clusterStack[clusterStack.length - 1].id : undefined,
        title,
        titleVi: 'Quy trình ' + title,
        actionType: determineActionType(msg),
        status: 'IN_PROGRESS',
        startTime: line.timestamp,
        endTime: '',
        durationMs: 0,
        lines: [line],
        subClusters: [],
        depth: clusterStack.length
      };

      line.clusterId = newCluster.id;

      if (clusterStack.length === 0) {
        clusters.push(newCluster);
      } else {
        clusterStack[clusterStack.length - 1].subClusters.push(newCluster);
      }
      clusterStack.push(newCluster);
      continue;
    }

    if (isEnd) {
      if (clusterStack.length > 0) {
        const currentCluster = clusterStack.pop()!;
        currentCluster.endTime = line.timestamp;
        currentCluster.durationMs = calculateDuration(currentCluster.startTime, currentCluster.endTime);
        currentCluster.status = currentCluster.lines.some(l => l.level === 'ERROR' || l.level === 'FATAL') 
          ? 'ERROR' 
          : 'SUCCESS';
        currentCluster.lines.push(line);
        line.clusterId = currentCluster.id;
        line.isEnd = true;
        line.processName = currentCluster.title;
        
        // Scan cluster lines for key facts (records, tables, file paths)
        for (const cl of currentCluster.lines) {
          const ext = cl.message.match(/(\d+)\s*件[を]?\s*抽出しました/i);
          if (ext) currentCluster.recordsCount = parseInt(ext[1], 10);

          const tbl = cl.message.match(/(\d+)\s*件[の\s]*([A-Za-z0-9_]{3,})\s*(?:を|に)?\s*(登録|更新|削除)しました/i);
          if (tbl) {
            currentCluster.targetTable = tbl[2].toUpperCase();
            currentCluster.recordsCount = parseInt(tbl[1], 10);
          }

          const fl = cl.message.match(/([A-Za-z]:\\[^\s\r\n]+\.(?:csv|tsv|txt|dat))/i) || cl.message.match(/([^\s\r\n:]+\.csv)/i);
          if (fl) currentCluster.filePath = fl[1].trim();

          const sup = cl.message.match(/\[([^\]]+)\]/);
          if (sup) currentCluster.targetSupplier = sup[1];
        }
        continue;
      }
    }

    // Normal line inside an active cluster
    if (clusterStack.length > 0) {
      const top = clusterStack[clusterStack.length - 1];
      top.lines.push(line);
      line.clusterId = top.id;
      line.processName = top.title;
      if (line.level === 'ERROR' || line.level === 'FATAL') {
        top.status = 'ERROR';
      }
    } else {
      line.processName = batchName || '';
      unclusteredLines.push(line);
    }
  }

  // Close any unclosed clusters
  while (clusterStack.length > 0) {
    const unclosed = clusterStack.pop()!;
    unclosed.endTime = overallEndTime;
    unclosed.durationMs = calculateDuration(unclosed.startTime, unclosed.endTime);
    if (unclosed.status === 'IN_PROGRESS') {
      unclosed.status = 'SUCCESS';
    }
  }

  // Compile impacted tables array
  const impactedTables: ImpactedTable[] = Array.from(tableStatsMap.entries()).map(([table, stat]) => ({
    table,
    inserted: stat.inserted,
    updated: stat.updated,
    deleted: stat.deleted,
    steps: Array.from(stat.steps)
  }));

  // Unwrap redundant outer lifecycle containers (e.g. executeBatch / BatchDaoInvoker)
  // so meaningful functional steps appear at the top-level
  let meaningfulClusters = clusters;
  while (
    meaningfulClusters.length === 1 && 
    meaningfulClusters[0].subClusters.length > 0 &&
    (
      meaningfulClusters[0].title === batchName || 
      meaningfulClusters[0].actionType === 'CONTROL' || 
      meaningfulClusters[0].lines[0]?.message.includes('executeBatch') ||
      meaningfulClusters[0].lines[0]?.message.includes('バッチID=') ||
      (meaningfulClusters[0].lines[0]?.logger.includes('BatchDaoInvoker') && meaningfulClusters[0].title === batchName)
    )
  ) {
    meaningfulClusters = meaningfulClusters[0].subClusters;
  }

  const normalizeDepth = (cls: BatchCluster[], currentDepth = 0) => {
    for (const c of cls) {
      c.depth = currentDepth;
      if (c.subClusters && c.subClusters.length > 0) {
        normalizeDepth(c.subClusters, currentDepth + 1);
      }
    }
  };
  normalizeDepth(meaningfulClusters, 0);

  const totalClustersCount = meaningfulClusters.reduce((acc, c) => acc + 1 + countSubClusters(c), 0);

  const durationMs = calculateDuration(overallStartTime, overallEndTime);

  return {
    batchId: batchId || 'BATCH_JOB',
    batchName: batchName || 'Batch Processing',
    batchNameVi: translateJapaneseBatchText(batchName) || 'Xử lý Batch',
    status: overallStatus,
    startTime: overallStartTime,
    endTime: overallEndTime,
    durationFormatted: formatDuration(durationMs),
    totalLines: rawLines.length,
    totalClusters: totalClustersCount,
    totalRecordsExtracted,
    totalRecordsInserted,
    totalRecordsUpdated,
    totalRecordsDeleted,
    totalFilesGenerated: generatedFiles.length,
    impactedTables,
    generatedFiles,
    clusters: meaningfulClusters,
    unclusteredLines,
    rawLines
  };
}

function countSubClusters(cluster: BatchCluster): number {
  if (!cluster.subClusters || cluster.subClusters.length === 0) return 0;
  return cluster.subClusters.reduce((acc, c) => acc + 1 + countSubClusters(c), 0);
}
