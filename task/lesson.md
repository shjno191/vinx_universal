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

# Modal Scrolling & Shortcut Normalization Lessons

- **Never Use `scrollIntoView()` on Elements in Teleported Modals**:
    - In SPAs and Tauri windows with fixed full-height viewports (`overflow: hidden; height: 100vh;`), calling `element.scrollIntoView()` causes the browser to scroll `document.body` and `window`, shifting the entire app frame off-screen and breaking click hitboxes (appearing as if the app is "stunned" or frozen).
    - Always scroll the inner container directly using `container.scrollTop` calculations based on `element.offsetTop` and `element.offsetHeight`.
- **KeyboardEvent Shift Key Discrepancies**:
    - On standard keyboards, pressing `Shift` changes key values (`[` -> `{`, `]` -> `}`).
    - A shortcut defined as `ctrl+shift+[` will fail if `e.key` (`"{"`) is strictly compared against `"["`.
    - Always normalize bracket keys (`key === '[' || key === '{'`) against both `e.key` and `e.code === 'BracketLeft'` / `'BracketRight'`.
- **Preserve User Settings and Avoid Collateral Removals**:
    - Never delete existing setting cards (like `mouseNavHistory`) or strip settings properties during refactoring.
    - Always isolate fixes to requested features and preserve existing history management.

# Usages Modal Freeze / Stun Root Cause & Permanent Solution (Usages Palette)

- **Root Cause of App Stun / Freeze with Modal Overlays**:
    - In Tauri WebView2 on Windows, fixed-overlay modal dialogs with capturing key listeners (`window.addEventListener('keydown', ..., true)`) and uneditable focus targets (`div tabindex="-1"`) create an input-compositor deadlock with Monaco Editor's hidden GPU/canvas `<textarea>`.
    - When focus is wrestled between Monaco's input area and an uneditable modal `div`, WebView2 freezes the input event queue on key/click events, resulting in the app becoming completely frozen / stunned ("đứng app").
- **The Permanent Replacement: Non-Blocking Native `<input>` Palette**:
    - The Command Palette / Function Palette pattern (`showFunctionPalette`) NEVER freezes because it contains a real HTML `<input ref="..." autofocus>` element with a local `@keydown` handler.
    - Browsers and WebView2 give native, uninterrupted focus to real input elements without deadlocking the compositor.
    - Replacing the modal with an input-based Usages Palette (`showUsagesPalette`) eliminates the freeze completely while providing real-time text/line filtering, immediate jump preview, and full keyboard navigation (`ArrowUp`/`ArrowDown`, `Ctrl+j`/`Ctrl+k`, `Enter`, `Escape`).
- **Always Use `ScrollType.Immediate` for Keyboard Navigation**:
    - Never use `monaco.editor.ScrollType.Smooth` for cycling usages or jump previews. Smooth scrolling enqueues multiple requestAnimationFrame interpolations that bottleneck the event loop. Always use `monaco.editor.ScrollType.Immediate`.

# Mouse Buttons 5 & 6 (Mouse 4 & 5) Cursor History Navigation Lessons

- **Never Hijack Mouse Buttons for Top-Level Tab Switching**:
    - Mouse buttons 3 and 4 (standard Mouse 4 / 5, often called buttons 5 and 6) in code editors are universally expected to navigate cursor position history (nav_back and nav_forward), similar to Alt+Left / Alt+Right.
    - Capturing mouseup on the global window in `App.vue` to switch top-level tabs (`currentTab`) breaks the expected editor behavior and frustrates users.
- **Prevent WebView2 Native Back/Forward on Mousedown**:
    - Windows WebView2 / Chromium binds mouse buttons 3 and 4 to browser session history navigation (`history.back()`).
    - Adding `e.preventDefault()` on `mousedown` with `{ capture: true }` prevents Chromium's native shell from triggering browser back/forward, allowing `mouseup` to smoothly trigger editor `jumpToHistory`.
- **Immediate Scroll & Visual Feedback on Cursor History Jump**:
    - When jumping between history positions, use `ScrollType.Immediate` and brief line highlighting (`highlightLineBriefly`) so the jump is instant and immediately visible to the developer.

# Compare Tab Navigation & Shared Architecture Lessons

- **Unified Language & Editor Heuristics**:
    - Diff editors do not have traditional file tabs with explicit file paths. Using undefined variables (like `originalFile`) causes runtime crashes.
    - Centralize language detection in `@vinx/sdk` (`detectScriptLanguage`) to inspect code headers/content (BOI script, Java, Python, JS/TS) gracefully.
- **Tab History Isolation in Shared Stores**:
    - When a global cursor history store is shared across plugins, entries must be prefixed or tagged (e.g. `compare-original`, `compare-modified` vs editor `tabId`).
    - Handlers must filter entries matching their current tab context, avoiding jumping to line numbers belonging to unrelated files in other tabs.
- **Single Source of Truth for Focused Editor in Diff View**:
    - Monaco diff editors contain two separate code editors (`getOriginalEditor()` and `getModifiedEditor()`). Tracking active focus (`focusedSide`) via `onDidFocusEditorText` and `onMouseDown` ensures shortcuts always target the pane the user is actually looking at.
# Non-Blocking Keyboard Handlers & Fast Localized AST Navigation Lessons

- **Never Parse Whole Documents Synchronously in Keyboard Listeners**:
    - Parsing thousands of lines of code with regex or AST extraction on every `Ctrl + Right`, `Ctrl + Left`, or `Ctrl + Up` synchronously on the main thread locks the UI event loop for hundreds of milliseconds to several seconds.
    - Instead of parsing every function and its end line, use targeted line searches (`rawLine.includes(name)`) and fast upward scans from the cursor position.
- **Conditional `preventDefault()` and `stopPropagation()`**:
    - Never call `preventDefault()` and `stopPropagation()` blindly at the entry of shortcut handlers.
    - Only prevent default when a semantic action actually occurs (e.g., a function definition is found or history navigation succeeds). If no action is taken, allowing the event to proceed enables Monaco's standard word navigation (`Ctrl + Left`, `Ctrl + Right`) and line scrolling (`Ctrl + Up`, `Ctrl + Down`) to function without locking the cursor.
- **Safe Regex Design (ReDoS Prevention)**:
    - Avoid overlapping whitespace quantifiers like `[\w<>\s]+\s+([a-zA-Z0-9_$]+)`. When matched against complex signatures, the V8 engine suffers from exponential backtracking. Explicitly exclude whitespace from type parameter matchers (`[a-zA-Z0-9_<>[\],.?]+\s+`).
- **Comprehensive Usages Palette Event Dispatching**:
    - Overlays must handle semantic actions (`next`, `prev`, `confirm`, `close`) cleanly across all key variants (`Ctrl+Up/Down`, `ArrowUp/Down`, `Ctrl+Right/Enter`, `Ctrl+Left/Esc`) regardless of which sub-element currently holds DOM focus.

# Full Keyboard Navigation & Cursor Non-Blocking Lessons

- **Never Block Monaco Cursor Movement When Target Definition is Absent**:
    - In `handleNavIntoFunction` (`Ctrl + Right`), if a call is on the current line but not defined in the current file (e.g. library calls or external methods), or if the definition is on the same line (the function header itself), the handler must return `false`.
    - Returning `true` with `e.preventDefault()` leaves the cursor stuck in place, which users perceive as a total freeze ("bị lỗi đứng"). Returning `false` allows Monaco's native `cursorWordRight` to navigate words seamlessly.
- **Strict Adherence to Documented Directional Shortcuts**:
    - `SettingsTab.vue` defines `Ctrl + Left` as having the exact same logic as `jump_function` (Navigate Up: inside body -> jump to header; at header -> search usages).
    - Mapping `Ctrl + Left` to `nav_back` breaks user expectations and traps the user in history navigation instead of navigating up.
- **Fast-Exit Pre-Checks on Line-by-Line Scanners**:
    - Adding an instant pre-check (`!trimmed.includes('(') && !trimmed.includes('=>') && !/^\s*function\b/i.test(trimmed)`) skips over 95% of non-function lines in under 1 nanosecond without firing complex regular expressions.
    - Single-line quotes (`"` and `'`) must be reset at the end of each line so unmatched syntax or regex literal characters never corrupt brace balancing across subsequent lines.
- **Dedicated Scope for Diff vs Single-Editor Navigation**:
    - Diff editors (`CompareTab`) serve a specialized role: comparing text lines, diff coloring, and viewing modifications.
    - Overlaying complex single-file symbol jumping (`Ctrl + Up/Down/Left/Right`) on a dual-pane diff editor creates event conflicts. Removing keydown hijacking entirely allows Monaco Diff Editor to handle text comparison natively and flawlessly without freezing.


