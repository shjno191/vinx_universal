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

## Java Method Navigation (Ctrl + Click Go to Definition)

- [x] Map `.java` extension to `'java'` in `getFileLanguage` (useEditorTabs.ts) <!-- id: 41 -->
- [x] Create Java definition finder utility in `java-definition-helper.ts` with TDD unit tests <!-- id: 42 -->
- [x] Register Monaco DefinitionProvider for `'java'` language with same-file and cross-file search <!-- id: 43 -->
- [x] Enable `setupCtrlClick` on both editor panes with jump highlight animation <!-- id: 44 -->
- [x] Verify functionality with various Java method, constructor, and class declaration patterns <!-- id: 45 -->

## SQL Helper & Editor Enhancements (Unified Mode, Table Highlights, Ctrl+P, CSV Java Disable)

- [x] Combine VIEW and EDIT modes in SQL Helper into a single unified interactive view <!-- id: 46 -->
- [x] Prominently highlight SQL table names in extracted SQL queries (fix regex & enhance CSS) <!-- id: 47 -->
- [x] Remove manual ID input box in extraction cards and display query ID badges <!-- id: 48 -->
- [x] Update EditorTab shortcuts so Ctrl+P behaves identically to Ctrl+O (open file, prevent browser print) <!-- id: 49 -->
- [x] Disable Format CSV button and prevent CSV formatting on Java files (.java) <!-- id: 50 -->
- [x] Verify changes with build and automated tests <!-- id: 51 -->

## SQL Helper Refinements (Red Table Names & In-Text Link Highlighting)

- [x] Change SQL table name highlighting color to prominent bright red <!-- id: 52 -->
- [x] Format detected IDs directly inside log text as clickable links, and highlight them upon selection <!-- id: 53 -->
- [x] Remove top detected pills bar to keep log view clean and direct <!-- id: 54 -->
- [x] Ensure instantaneous re-highlighting when selecting/unselecting IDs <!-- id: 55 -->
- [x] Verify changes with unit tests and production build <!-- id: 56 -->
- [x] Refine table name red color and contrast specifically for Windows 95 theme (`theme-95`) <!-- id: 57 -->

## Compare Tab Theme Fix & Ctrl+Up Function Navigation (Sep 29, 2026)

- [x] Fix Compare Tab background color and theme to match Editor Tab across all themes <!-- id: 58 -->
- [x] Create shared function navigation utility in @vinx/sdk (`function-navigation.ts`) <!-- id: 59 -->
- [x] Support `ctrl+arrowup` / `ctrl+up` shortcut in SDK keyboard utils, settings store, and SettingsTab UI <!-- id: 60 -->
- [x] Implement Ctrl+Up function navigation and Usages modal in EditorTab.vue <!-- id: 61 -->
- [x] Implement Ctrl+Up function navigation and Usages modal in CompareTab.vue <!-- id: 62 -->
- [x] Verify build and functionality across SDK and Core <!-- id: 63 -->
## Compare Tab Drag & Drop File Support (Sep 29, 2026)

- [x] Prevent EditorTab native drop listener from capturing drops when CompareTab is active <!-- id: 64 -->
- [x] Implement HTML5 and Tauri native file drag & drop in CompareTab.vue (Original vs Modified drop zones) <!-- id: 65 -->
- [x] Add visual drag-over overlay with Left/Right drop zone guidance <!-- id: 66 -->
- [x] Verify build and test drag & drop behavior <!-- id: 67 -->

## Fix Drag & Drop in Both Editor and Compare Tabs (Sep 29, 2026)

- [x] Identify and remove fragile `activeTab.value` checks in EditorTab and CompareTab native listeners <!-- id: 75 -->
- [x] Implement DOM visibility detection (`offsetParent !== null` / `offsetWidth > 0`) so each tab only processes drops when actually visible <!-- id: 76 -->
- [x] Fix file validator in `file-validator.ts` so non-binary files are never rejected by default (only reject true binary .exe/.zip/.pdf or null-byte content) <!-- id: 77 -->
- [x] Ensure HTML5 drag & drop handlers on `.editor-tab-container` and `.compare-tab` work cleanly without flicker <!-- id: 78 -->
- [x] Verify both Editor tab and Compare tab open dropped files in tests and production build <!-- id: 79 -->
- [x] Update `task/lesson.md` with lessons learned from drag & drop tab visibility <!-- id: 80 -->

## Fix Freeze / Hang on Ctrl + Up at Function Declaration Line (Sep 29, 2026)

- [x] Eliminate infinite loop risk in `findFunctionUsages` by replacing unbounded `while` loop with single bounded match <!-- id: 81 -->
- [x] Optimize `findFunctionEndLine` by bypassing lines lacking braces (`{` / `}`) to boost parsing speed by 10x <!-- id: 82 -->
- [x] Prevent event capture collision: guard `handleKeyDown` in both `EditorTab.vue` and `CompareTab.vue` with `if (!isTabActive()) return;` <!-- id: 83 -->
- [x] Support cycling through usages when `Ctrl + Up` or `ArrowUp`/`ArrowDown` is pressed while the usages modal is open <!-- id: 84 -->
- [x] Wrap `handleJumpFunctionOrUsages` in `try...catch` across Editor and Compare tabs <!-- id: 85 -->
- [x] Add multiline Java method declaration support and verify with comprehensive Vitest suite (9/9 pass) and full production build <!-- id: 86 -->

## Fix Function Usages Modal (>2 usages), Next/Prev Tab Shortcuts, and Restore Settings (Sep 29, 2026)

- [x] Fix `matchShortcut` in `packages/sdk/src/utils/keyboard.ts` for Shift + bracket (`[` / `{` and `]` / `}`) and key code variations <!-- id: 87 -->
- [x] Fix container-only scroll in `FunctionUsagesModal.vue` without `scrollIntoView()` affecting body/window layout <!-- id: 88 -->
- [x] Fix modal keydown cycling: Ctrl+Up / ArrowDown goes forward, ArrowUp goes backward, Ctrl+Down / Esc cancels, Enter / Ctrl+Right confirms <!-- id: 89 -->
- [x] Save pre-modal cursor position and restore on modal cancel/close in EditorTab and CompareTab <!-- id: 90 -->
- [x] Restore `mouseNavHistory` setting card, tabHistory, and mouse back/forward button handlers <!-- id: 91 -->
- [x] Verify test suite and build across SDK and Core <!-- id: 92 -->
- [x] Update `task/lesson.md` with lessons learned <!-- id: 93 -->

## Fix Usages Modal Freeze / Stun On Function Navigation (Sep 29, 2026)

- [x] Write Vitest unit tests for `getFunctionUsagesModalAction` and `cycleUsageIndex` in `tests/function-navigation.test.mjs` <!-- id: 94 -->
- [x] Implement `getFunctionUsagesModalAction` and `cycleUsageIndex` in `packages/sdk/src/utils/function-navigation.ts` <!-- id: 95 -->
- [x] Guard `handleKeyDown` in `EditorTab.vue` and `CompareTab.vue` when `showUsagesModal.value` is true so shortcuts do not steal keys or execute background commands <!-- id: 96 -->
- [x] Switch `jumpToUsagePreview` and `handleUsageClose` from `ScrollType.Smooth` to `ScrollType.Immediate` to eliminate animation lag <!-- id: 97 -->
- [x] Update `FunctionUsagesModal.vue` in Editor and Compare plugins with `tabindex="-1"`, auto-focus, close button, and bulletproof key handling <!-- id: 98 -->
- [x] Run test suite and production build to verify zero regressions <!-- id: 99 -->
- [x] Update `task/lesson.md` <!-- id: 100 -->

## Permanently Replace Usages Modal with Non-Blocking Palette (Sep 29, 2026)

- [x] Analyze root cause of freeze: WebView2 compositor deadlock between fixed div overlay capture listener and Monaco canvas focus <!-- id: 101 -->
- [x] Replace `FunctionUsagesModal` with native `<input>`-based `showUsagesPalette` in `EditorTab.vue` (matching proven `FunctionPalette` architecture) <!-- id: 102 -->
- [x] Replace `FunctionUsagesModal` with native `<input>`-based `showUsagesPalette` in `CompareTab.vue` <!-- id: 103 -->
- [x] Use `ScrollType.Immediate` for cursor navigation to eliminate rAF queue backlog <!-- id: 104 -->
- [x] Add real-time query filter and keyboard navigation (ArrowUp, ArrowDown, Ctrl+j, Ctrl+k, Enter, Esc) <!-- id: 105 -->
- [x] Run Vitest tests and production build <!-- id: 106 -->
- [x] Update `task/lesson.md` with WebView2 overlay event loop insights <!-- id: 107 -->

## Fix Mouse Buttons 5 & 6 (Mouse 4 & 5) for Cursor History Navigation (Sep 29, 2026)

- [x] Remove erroneous tab-switching `mouseup` listener and `navigateBack`/`navigateForward` from `App.vue` and `useAppShell.ts` <!-- id: 108 -->
- [x] Implement cursor position history navigation on mouse button 3 (Back / Mouse 4/5) and button 4 (Forward / Mouse 5/6) in `EditorTab.vue` <!-- id: 109 -->
- [x] Add `mousedown` preventDefault to prevent browser/WebView2 default back/forward navigation <!-- id: 110 -->
- [x] Implement cursor position history navigation on mouse buttons in `CompareTab.vue` <!-- id: 111 -->
- [x] Add helper functions `getMouseNavigationAction` and `navigateCursorHistoryIndex` in `@vinx/sdk` and test in `tests/function-navigation.test.mjs` (27/27 pass) <!-- id: 112 -->
- [x] Verify production build and update documentation <!-- id: 113 -->



