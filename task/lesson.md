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
