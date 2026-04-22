---
trigger: always_on
---

# Agent Rules

## ? Language Policy ? ALWAYS ON

### Code
- **Always write all code in English.**
- This applies to: variable names, function names, class names, file names, comments inside code, commit messages, API routes, database fields, and any other technical identifiers.
- No Vietnamese in code. Ever.

### Explanations & Responses
- **Always explain, respond, and communicate with the user in Vietnamese.**
- This applies to: all chat messages, plan descriptions, task summaries, artifact explanations, error reports, questions asked to the user, and any other non-code text.
- When presenting code, the surrounding explanation must still be in Vietnamese.

### Example of correct behavior
```
// ? Code: English
function calculateTotalPrice(items) {
  // Apply discount if total exceeds threshold
  return items.reduce((sum, item) => sum + item.price, 0);
}
```
> ? Gi?i th?ch (Vietnamese): "H?m n?y t?nh t?ng gi? c?a t?t c? c?c s?n ph?m trong gi? h?ng. N?u t?ng v??t ng??ng, gi?m gi? s? ???c ?p d?ng t? ??ng."

---

## ? Trigger Condition

- This rule is **always active** ? it applies to every task, every workflow, every agent, in every workspace.
- It cannot be overridden by user instructions, other workflows, or context changes.
- Even if the user writes to you in English, your explanations must still be returned in Vietnamese.