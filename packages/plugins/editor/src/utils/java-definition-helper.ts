export interface JavaDefinitionLocation {
  line: number;       // 1-indexed
  col: number;        // 1-indexed
  length: number;
  matchType: 'method' | 'constructor' | 'class' | 'field';
}

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
  'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
  'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
  'volatile', 'while', 'record'
]);

/**
 * Searches for definition/declaration of a Java symbol within text.
 * Prioritizes methods, constructors, class/interface definitions, and member fields.
 * Excludes call sites, strings, and comments.
 */
export function findJavaDefinitionInText(text: string, rawSymbol: string): JavaDefinitionLocation | null {
  const symbol = rawSymbol.trim();
  if (!symbol || JAVA_KEYWORDS.has(symbol)) {
    return null;
  }

  const lines = text.split(/\r?\n/);
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. Regex for Method declaration:
  // Examples:
  // public void doSomething(int a)
  // private static <T> List<T> filter(List<T> items) throws Exception
  // default boolean isValid()
  // void process();
  const methodRegex = new RegExp(
    `^(?:[\\s@\\w<>\\[\\],.?]+?\\s+)?(?:void|[\\w<>\\[\\],.?]+(?:\\s*\\[\\s*\\])?)\\s+\\b(${escaped})\\b\\s*\\(`,
    ''
  );

  // 2. Regex for Constructor declaration:
  // Examples:
  // public OrderService(...)
  // OrderService(...)
  const constructorRegex = new RegExp(
    `^\\s*(?:(?:public|protected|private)\\s+)?\\b(${escaped})\\b\\s*\\([^;]*\\)\\s*(?:throws\\s+[\\w,\\s]+)?\\s*\\{`,
    ''
  );

  // 3. Regex for Class / Interface / Enum / Record declaration:
  // Examples:
  // public class OrderService
  // interface IOrderService
  const typeRegex = new RegExp(
    `^\\s*(?:(?:public|protected|private|static|final|abstract)\\s+)*(?:class|interface|enum|record|@interface)\\s+\\b(${escaped})\\b`,
    ''
  );

  // 4. Regex for Field / Constant declaration:
  // Examples:
  // private final OrderRepository orderRepository;
  // public static final int MAX_RETRY = 3;
  const fieldRegex = new RegExp(
    `^\\s*(?:(?:public|protected|private|static|final|volatile|transient)\\s+)+(?:[\\w<>\\[\\],.?]+)\\s+\\b(${escaped})\\b\\s*(?:=|;)`,
    ''
  );

  // Phase 1: Search for Method or Constructor declaration
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines and comment lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Check method declaration
    // Ensure line does not start with call indicators like "return ", "if (", etc.
    if (!/^\s*(?:return|if|while|for|switch|catch|throw)\b/.test(rawLine)) {
      const matchMethod = rawLine.match(methodRegex);
      if (matchMethod) {
        const col = rawLine.indexOf(symbol) + 1;
        return {
          line: i + 1,
          col,
          length: symbol.length,
          matchType: 'method'
        };
      }
    }

    // Check constructor declaration
    const matchConstructor = rawLine.match(constructorRegex);
    if (matchConstructor) {
      const col = rawLine.indexOf(symbol) + 1;
      return {
        line: i + 1,
        col,
        length: symbol.length,
        matchType: 'constructor'
      };
    }
  }

  // Phase 2: Search for Class / Interface / Record definition
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const matchType = rawLine.match(typeRegex);
    if (matchType) {
      const col = rawLine.indexOf(symbol) + 1;
      return {
        line: i + 1,
        col,
        length: symbol.length,
        matchType: 'class'
      };
    }
  }

  // Phase 3: Search for Field declaration
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const matchField = rawLine.match(fieldRegex);
    if (matchField) {
      const col = rawLine.indexOf(symbol) + 1;
      return {
        line: i + 1,
        col,
        length: symbol.length,
        matchType: 'field'
      };
    }
  }

  return null;
}
