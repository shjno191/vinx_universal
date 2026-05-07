import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS.
 * Allows only specific white-listed tags such as <mark> and <span> used for highlighting.
 */
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['mark', 'span', 'b', 'i', 'strong', 'em'],
    ALLOWED_ATTR: ['class', 'data-word', 'style', 'title'],
  });
}

/**
 * Escape raw text for use in HTML, then wrap highlighting logic.
 */
export function escapeAndHighlight(text: string, highlightRegex: RegExp | null, className: string): string {
  if (!text) return '';
  
  // Escape the text first to be safe
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  if (!highlightRegex) return escaped;

  // Perform highlighting replacement
  const highlighted = escaped.replace(highlightRegex, (match) => {
    const attrMatch = match.replace(/"/g, '&quot;');
    return `<mark class="${className}" data-word="${attrMatch}">${match}</mark>`;
  });

  // Final sanitize just in case
  return sanitize(highlighted);
}
