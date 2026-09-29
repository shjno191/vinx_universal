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
    - **Multi-Tab Drop Listener Isolation**:
        - Global window-level drag-drop listeners fire on all mounted tabs.
        - Never rely solely on global reactive strings (such as `activeTab.value`) across separate package bundles, as module instances or out-of-sync states can cause checks to fail and drop events to be ignored.
        - Instead, combine three layers:
            1. Explicit props passed from the host tab container (`:is-active="currentTab === plugin.name"`).
            2. DOM visibility check (`el.checkVisibility()` or `offsetWidth > 0 || offsetParent !== null`) using the component root ref, which accurately reflects `v-show`.
            3. Overlay pointer-events: ensure full-screen drop overlays use `pointer-events: none` and inner zones use `pointer-events: auto` to prevent dragleave flickering and event swallowing.

# Function Navigation & Global Keydown Lessons

- **Never Use Unbounded Regex Loops for Line Matching**:
    - When searching for function usages across lines, a `while ((match = regex.exec(line)) !== null)` without a guarantee of advancing `lastIndex` can turn into an infinite loop if `regex` matches 0 characters or encounters edge-case boundaries.
    - Since we only need one usage item per line, execute a single bounded match (`const match = wordPattern.exec(checkLine)`) without `while`, completely eliminating infinite loop risks.
- **Bypass Lines Lacking Braces in Scope Parsers**:
    - In brace-counting scope detection (`findFunctionEndLine`), 90%+ lines in any codebase contain neither `{` nor `}`.
    - Skipping these lines (`if (!line.includes('{') && !line.includes('}')) continue;`) avoids running heavy comment/string sanitization regexes, accelerating parsing by 10x-20x on large files.
- **Isolate Global Keydown Capture Handlers Across Tabs**:
    - When multiple tabs or modals register `window.addEventListener('keydown', handler, true)`, the listeners run in the capture phase for all events globally.
    - Every plugin tab must verify `if (!isTabActive()) return;` at the very start of its keydown handler; otherwise a background tab will intercept shortcuts, call `e.stopPropagation()`, and prevent the active tab from responding.
- **Prevent Action Conflicts When Usages Modal is Open**:
    - When the usages modal is already active, pressing `Ctrl + Up` again or `ArrowUp`/`ArrowDown` should smoothly cycle to the next/previous usage inside the modal instead of re-triggering definition detection on the temporarily previewed cursor position.
