# SQL Helper Logic Fix Lessons

- **Problem**: SQL extraction only looked at the current line or previous lines in reverse, which failed if `sql=` and `params=` were on different lines or if the `params=` format was complex `[TYPE:INDEX:VALUE]`.
- **Solution**:
    - Scanned all lines for the given ID to find both `sql=` and `params=` segments.
    - Used regex `match(/\[?([^\]\[]+)\]?/g)` to split complex parameter blocks.
    - Extracted only the "VALUE" part from the `TYPE:INDEX:VALUE` colon-delimited format.
    - Correctly replaced `?` placeholders sequentially.
- **Interaction**: Ensure clicking a triggered item (like an ID) replaces existing entries in the result list if they exist, rather than appending or ignoring. This provides a "refresh" experience and keeps the UI clean.
- **Japanese Encoding**: Japanese logs are often Shift-JIS or UTF-16 with BOM on Windows. 
    - Always check for BOM (UTF-8, UTF-16LE/BE).
    - fallback to Shift-JIS if UTF-8 decoding has errors.
    - `encoding_rs` is excellent for this.

# CSV Formatting & Monaco Highlighting Lessons

- **East Asian Character Monospace Width**:
    - `string.length` counts UTF-16 code units (1 per character), whereas East Asian full-width characters (Kanji, Hiragana, Fullwidth Katakana) occupy 2 visual columns in monospace fonts.
    - Padding based on `str.length` causes severe vertical misalignment for Japanese/CJK text.
    - Always calculate visual width using Unicode East Asian Width standards (`getStringVisualWidth`) and pad with visual width difference (`padVisualEnd`).
- **Monaco Decoration CSS in Vue**:
    - Monaco Editor dynamically injects decoration spans directly into the document DOM without Vue's scoped `[data-v-xxxx]` attributes.
    - Placing `.csv-col-x` inside `<style scoped>` causes the styles to never match Monaco elements.
    - Always place Monaco inline decoration styles in an unscoped `<style>` block.
- **External File Drag-and-Drop in Tauri v2**:
    - Tauri intercepts native window file drops from Windows Explorer.
    - Must listen to `getCurrentWebviewWindow().onDragDropEvent` to receive `event.payload.paths` when files are dropped from outside the window, alongside HTML5 drop fallback.
