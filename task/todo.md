# SQL Helper Improvements

- [x] Update SQL Helper UI to 50/50 split <!-- id: 1 -->
- [x] Improve SQL extraction logic to handle multiple lines and `[TYPE:INDEX:VALUE]` params <!-- id: 2 -->
- [x] Fix Japanese character loading issue in `read_file_content` <!-- id: 5 -->
- [x] Update ID click logic to remove old extraction if it already exists <!-- id: 6 -->
- [x] Verify changes with a build and manual test data <!-- id: 3 -->
- [x] Document lessons learned in `task/lesson.md` <!-- id: 4 -->

## Code Review & Quality Assessment (May 12, 2026)

- [x] Review `packages/plugins/sql-helper/src/SQLHelperTab.vue` <!-- id: 10 -->
- [x] Review `packages/plugins/sql-helper/src/useSQLHelper.ts` <!-- id: 11 -->
- [x] Analyze integration between `core` and `plugins` <!-- id: 12 -->
- [x] Evaluate against 5-axis framework <!-- id: 13 -->
- [x] Generate final review report <!-- id: 14 -->

## Font & Language Adjustments (May 12, 2026)

- [x] Fix corrupted Vietnamese characters in `SettingsTab.vue` <!-- id: 15 -->
- [x] Convert category names to English in `useSettings.ts` <!-- id: 16 -->
- [x] Convert `GlobalLoading.vue` to English <!-- id: 17 -->

## Build & Compilation Fixes (May 12, 2026)

- [x] Fix TypeScript errors in `sdk/store.ts` (export missing types) <!-- id: 18 -->
- [x] Verify build success via `npm run build` <!-- id: 19 -->

## Code Review & Quality Assessment (May 15, 2026)

- [x] Review Core architecture and App.vue lifecycle <!-- id: 20 -->
- [x] Evaluate global state management in `sdk/store.ts` <!-- id: 21 -->
- [x] Analyze performance and logic in `useTranslateManager.ts` <!-- id: 22 -->
- [x] Audit `java-analyzer.ts` for correctness and security <!-- id: 23 -->
- [x] Implement recommended fixes (Memory leaks, Error handling) <!-- id: 24 -->
- [x] Setup Vitest for core utility testing <!-- id: 25 -->

## Project Cleanup & Git Improvement (May 15, 2026)

- [x] Remove Flowchart plugin and related SDK utilities <!-- id: 26 -->
- [x] Improve Git tab to handle non-git folders gracefully <!-- id: 27 -->
- [x] Verify build and functionality after cleanup <!-- id: 28 -->

## CSV Editor Formatting & Rainbow Highlighting (Sep 18, 2026)

- [x] Create CSV parser, column alignment, and delimiter detection utility in `csv-helper.ts` <!-- id: 29 -->
- [x] Implement Monaco Rainbow CSV column decorations and styling (Dark/Light themes) <!-- id: 30 -->
- [x] Add "Format CSV" action button beside standard format button in left and right editor panes <!-- id: 31 -->
- [x] Support live re-coloring on content paste / edits when CSV mode is active <!-- id: 32 -->
- [x] Map `.csv` extension in `getFileLanguage` and enable quick format shortcut <!-- id: 33 -->
- [x] Verify functionality with various CSV/TSV data and ensure build passes <!-- id: 34 -->

## TDD: Japanese East-Asian Character Alignment, Unscoped Monaco CSS & Drag-and-Drop Auto-Format

- [x] Write failing test for visual column alignment with user Japanese CSV sample <!-- id: 35 -->
- [x] Implement East Asian Width calculation (`getStringVisualWidth`) in `csv-helper.ts` <!-- id: 36 -->
- [x] Move Monaco Rainbow CSS out of scoped styles so `.monaco-editor` elements are colored <!-- id: 37 -->
- [x] Add external file drag-and-drop listener (Tauri v2 and HTML5) with auto CSV formatting <!-- id: 38 -->
- [x] Auto-format and highlight CSV on file open when `.csv` file is detected <!-- id: 39 -->
- [x] Verify with tests and build verification <!-- id: 40 -->
