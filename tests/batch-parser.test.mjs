import { describe, it, expect } from 'vitest';
import { parseBatchLog, translateJapaneseBatchText, determineActionType } from '../packages/plugins/batch/src/utils/batch-parser.ts';

describe('Batch Log Parser & Visualizer', () => {
  const userSampleLog = `2026/10/21 12:33:36,INFO,stc.log.StcLog           ,init                ,batchLogはC:\\Users\\09204113161\\Desktop\\code\\Kaizen_Master_Maintenance\\src\\kaizen-master-maintenance\\mdw_corepkggaibuif-compmaruai-batch\\batch\\properties/stcliblog4j.propertiesで初期化に成功しました。
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

  it('correctly parses batch metadata from sample log', () => {
    const result = parseBatchLog(userSampleLog);
    expect(result.batchId).toBe('GIBBXXXXXX');
    expect(result.batchName).toBe('ラベル発行機への納品情報出力処理');
    expect(result.batchNameVi).toContain('máy in nhãn');
    expect(result.status).toBe('SUCCESS');
    expect(result.totalLines).toBeGreaterThan(20);
  });

  it('aggregates record counts and database table impacts', () => {
    const result = parseBatchLog(userSampleLog);
    expect(result.totalRecordsExtracted).toBe(10); // 9 + 1 + 0
    expect(result.totalRecordsInserted).toBe(0);
    expect(result.totalRecordsUpdated).toBe(1); // 0 + 1

    const tables = result.impactedTables.map(t => t.table);
    expect(tables).toContain('GIF_WK_LABEL_HAKKOKI_NOHIN');
    expect(tables).toContain('GIF_WK_LABEL_HAKKOKI_NOHIN_KIDOKANRI');

    const kidokanri = result.impactedTables.find(t => t.table === 'GIF_WK_LABEL_HAKKOKI_NOHIN_KIDOKANRI');
    expect(kidokanri?.updated).toBe(1);
  });

  it('extracts generated CSV files and suppliers', () => {
    const result = parseBatchLog(userSampleLog);
    expect(result.totalFilesGenerated).toBe(2);
    expect(result.generatedFiles[0].fileName).toBe('MLC_LABEL_20261021123338.csv');
    expect(result.generatedFiles[1].fileName).toBe('MLC_LABEL_テスト仕入先A_20261021123338.csv');
    expect(result.generatedFiles[1].supplier).toBe('テスト仕入先A');
  });

  it('structures clusters with hierarchical nesting and translations', () => {
    const result = parseBatchLog(userSampleLog);
    expect(result.clusters.length).toBeGreaterThan(0);

    // With outer wrappers unwrapped, functional steps are directly at top-level
    const csvCluster = result.clusters.find(c => c.title.includes('CSVファイル出力処理'));
    expect(csvCluster).toBeDefined();
    expect(csvCluster?.subClusters.length).toBeGreaterThanOrEqual(3);
  });

  it('determines action types properly for visual coloring', () => {
    expect(determineActionType('9件抽出しました')).toBe('EXTRACT');
    expect(determineActionType('0件のGIF_WK_LABEL_HAKKOKI_NOHINを登録しました')).toBe('DB_INSERT');
    expect(determineActionType('1件のGIF_WK_...を更新しました')).toBe('DB_UPDATE');
    expect(determineActionType('CSVを出力しました')).toBe('FILE_OUTPUT');
    expect(determineActionType('batchLogは...propertiesで初期化に成功しました')).toBe('INIT');
  });

  it('translates Japanese terms into helpful Vietnamese explanations', () => {
    const trans = translateJapaneseBatchText('納品データ件数取得');
    expect(trans).toContain('giao hàng');
  });
});
