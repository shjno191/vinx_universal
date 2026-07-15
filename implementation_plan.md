# Refresh Base and Quick Add Context Menu

This plan outlines the implementation of a new "Refresh Base" action that cleans up the Base Dictionary Excel file, alongside a context menu in the Quick Translate panes to quickly add selected words to the dictionary.

## User Review Required

> [!WARNING]
> Removing all styling (colors, fonts, borders, links) from the Base Dictionary Excel file will completely overwrite the original file's formatting. Please confirm that you are okay with losing all visual styles in your Base Dictionary file.

## Open Questions

> [!IMPORTANT]
> - Should the "Refresh Base" button be placed next to the Quick Translate tab pill, or on the far right side of the header?
> - For the duplicate removal: if two rows have the exact same English AND Japanese text, but different Vietnamese text, should they still be considered duplicates and one of them removed?

## Proposed Changes

### `packages/plugins/translate/src/TranslateTab.vue`

- **UI Updates**:
  - Add a "REFRESH BASE" button to the main header, visible when in the `quick-translate` sub-tab.
  - Implement a Context Menu component (or custom absolute div) that appears on right-click within the `TranslationPane`.
- **Logic**:
  - Bind the "REFRESH BASE" button to a new function in `useTranslateManager` that triggers the deduplication and format-stripping logic.
  - Handle the right-click selection event emitted from `TranslationPane`. Detect whether the selected text contains Japanese characters (using a regex like `[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]`) to intelligently pre-fill either the JP or EN field in the `editBuffer`.
  - Open the existing "Add Entry" modal with the pre-filled data.

---

### `packages/plugins/translate/src/useTranslateManager.ts`

- **New Function `cleanBaseDictionaryFile`**:
  - Load the Base Dictionary file path from the settings.
  - Iterate through the current `dictionaryData`.
  - **Deduplication**: Use a `Set` or `Map` tracking `(JP + EN)` composites to filter out identical rows.
  - Save the cleaned data back to the file using a new method in the Tauri Rust backend or via the existing `saveDictionaryFile`.
  
---

### `packages/plugins/translate/src/translate/TranslationPane.vue`

- **Selection Handling**:
  - Add `@contextmenu.prevent` to the `inputTextarea` and `resultTextarea`.
  - On right-click, get the user's current text selection using `window.getSelection()?.toString()`.
  - Emit an event like `@contextMenuAdd(selectedText, mouseEvent)` to the parent `TranslateTab` to render the context menu exactly where the mouse clicked.

---

### `packages/core/src-tauri/src/commands/excel_utils.rs` (or equivalent file handling Excel saves)

- **Style Stripping**:
  - Update or create a function `save_clean_dictionary_file` (if not already existing) using `umya-spreadsheet` to write the data.
  - Ensure that when we write the new file, we do not copy the old spreadsheet styles. We will just create a fresh worksheet, insert the deduplicated data (JP, EN, VI), and save it. This inherently strips all colors, borders, and hyperlinks, leaving pure text.

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. **Refresh Base Button**:
   - Click the "Refresh Base" button.
   - Verify that a success toast appears showing how many duplicates were removed.
   - Open the actual Excel file to verify that all colors/formatting have been removed and it contains only pure text.
2. **Context Menu**:
   - Highlight an English word in the input or output pane, right-click, and select "Add to Base". Verify the modal opens with the English field pre-filled.
   - Highlight a Japanese word, right-click, and select "Add to Base". Verify the modal opens with the Japanese field pre-filled.
