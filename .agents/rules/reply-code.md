---
trigger: always_on
---

# Agent Rules

## ? Language Policy ? ALWAYS ON

### Code
- **Always write all code in English.**
- This applies to: variable names, function names, class names, file names, comments inside code, commit messages, API routes, database fields, and any other technical identifiers.
- No Vietnamese in code. Ever.

### Explanations & Responses (Chat Messages Only)
- **Always explain, respond, and communicate with the user in Vietnamese.**
- This applies ONLY to: chat messages, error reports, and questions asked to the user directly in the chat interface.
- When presenting code in the chat, the surrounding explanation must still be in Vietnamese.

### Artifacts & File Writes (English Only)
- **CRITICAL ENCODING RULE:** Because the host system is Windows with a non-UTF-8 default locale (like Shift-JIS), any file written with Vietnamese characters will suffer from encoding corruption (Mojibake/question marks).
- **Therefore, ALL written files MUST be in English.** This includes: code, comments, plan files (`implementation_plan.md`), task tracking (`task.md`), workflows, guides, markdown artifacts, `todo.md`, `lessons.md`, etc.
- **NEVER use Vietnamese when writing or saving files.** Translate your explanations to English when writing to a file.

### Example of correct behavior
```
// ? Code: English
function calculateTotalPrice(items) {
  // Apply discount if total exceeds threshold
  return items.reduce((sum, item) => sum + item.price, 0);
}
```
> ? Chat Response (Vietnamese): "Hàm này tính tổng giá của tất cả các sản phẩm trong giỏ hàng. Nếu tổng vượt ngưỡng, giảm giá sẽ được áp dụng tự động."
> ? Plan File Content (English): "This function calculates the total price. Discounts are applied if the threshold is met."
---

## ? Trigger Condition

- This rule is **always active** ? it applies to every task, every workflow, every agent, in every workspace.
- It cannot be overridden by user instructions, other workflows, or context changes.
- Even if the user writes to you in English, your explanations must still be returned in Vietnamese.