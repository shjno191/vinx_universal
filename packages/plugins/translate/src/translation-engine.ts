

export interface DictionaryEntry {
  jp: string;
  en: string;
  vi: string;
}

/**
 * Builds a translation regex from a lookup map, sorted by key length descending
 * to ensure longest matches are processed first.
 */
export function buildTranslationRegex(lookup: Map<string, string>): RegExp | null {
  if (lookup.size === 0) return null;
  
  try {
    const sortedKeys = Array.from(lookup.keys()).sort((a, b) => b.length - a.length);
    const pattern = sortedKeys
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    return new RegExp(`(${pattern})`, 'gi');
  } catch (e) {
    console.error('Failed to create translation regex:', e);
    return null;
  }
}

/**
 * Performs quick translation using the regex and lookup map.
 */
export function translateText(input: string, regex: RegExp | null, lookup: Map<string, string>): string {
  if (!input) return '';
  if (!regex) return input;
  
  // Case insensitive lookup
  return input.replace(regex, (match) => {
    const lowerMatch = match.toLowerCase();
    for (const [key, val] of lookup.entries()) {
      if (key.toLowerCase() === lowerMatch) return val;
    }
    return match;
  });
}

/**
 * Normalizes a string (trimming).
 */
export function normalize(val: string): string {
  return val ? val.trim() : '';
}
