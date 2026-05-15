import { describe, it, expect } from 'vitest';
import { analyzeJava, looksLikeJava } from './java-analyzer';

describe('java-analyzer', () => {
  describe('looksLikeJava', () => {
    it('should detect Java code with class declaration', () => {
      const code = 'public class Test { }';
      expect(looksLikeJava(code)).toBe(true);
    });

    it('should detect Java code with System.out', () => {
      const code = 'System.out.println("Hello");';
      expect(looksLikeJava(code)).toBe(true);
    });

    it('should return false for random text', () => {
      const code = 'const x = 5;';
      expect(looksLikeJava(code)).toBe(false);
    });
  });

  describe('analyzeJava', () => {
    it('should generate Mermaid for a simple method', () => {
      const code = `
        public class Calculator {
          public int add(int a, int b) {
            return a + b;
          }
        }
      `;
      const result = analyzeJava(code);
      expect(result.mermaid).toContain('flowchart TD');
      expect(result.mermaid).toContain('add[]');
      expect(result.mermaid).toContain('return a + b');
    });

    it('should handle if-else statements', () => {
      const code = `
        public class Logic {
          public void check(int x) {
            if (x > 0) {
              doSomething();
            } else {
              doOther();
            }
          }
        }
      `;
      const result = analyzeJava(code);
      expect(result.mermaid).toContain('x   0');
      expect(result.mermaid).toContain('doSomething [ ]');
      expect(result.mermaid).toContain('doOther [ ]');
    });

    it('should return error if no methods found', () => {
      const code = 'public class Empty {}';
      const result = analyzeJava(code);
      expect(result.error).toBeDefined();
    });
  });
});
