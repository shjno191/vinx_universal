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
