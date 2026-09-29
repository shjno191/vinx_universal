import { describe, it, expect } from 'vitest';
import { 
  extractFunctionsFromContent, 
  findFunctionUsages, 
  getCurrentFunctionAtCursor,
  findFunctionCallsOnLine,
  findFunctionDefinition,
  matchShortcut
} from '../packages/sdk/src/index.ts';

describe('Function Navigation Utility', () => {
  const sampleBoiScript = `
// Header comments
function initSystem(mode)
  $status = 1
  log("Starting system")
  return $status
endfunction

function calculateTax(price, rate) {
  $tax = price * rate
  return $tax
}

function main()
  initSystem(1)
  $result = calculateTax(100, 0.1)
  $otherTax = calculateTax(200, 0.08)
  return 0
endfunction
`.trim();

  it('extracts all functions with start and end lines', () => {
    const fns = extractFunctionsFromContent(sampleBoiScript, 'boi-script');
    expect(fns.length).toBe(3);

    expect(fns[0].name).toBe('initSystem');
    expect(fns[0].line).toBe(2);
    expect(fns[0].endLine).toBeGreaterThanOrEqual(6);

    expect(fns[1].name).toBe('calculateTax');
    expect(fns[1].line).toBe(8);
    expect(fns[1].endLine).toBeGreaterThanOrEqual(11);

    expect(fns[2].name).toBe('main');
    expect(fns[2].line).toBe(13);
  });

  it('detects when cursor is inside function body (Case 2.1)', () => {
    // Line 4 is inside initSystem body
    const atBody = getCurrentFunctionAtCursor(sampleBoiScript, 4, 'boi-script');
    expect(atBody.fn?.name).toBe('initSystem');
    expect(atBody.isInsideBody).toBe(true);
    expect(atBody.isAtDefinition).toBe(false);
  });

  it('detects when cursor is on function definition line (Case 2.2)', () => {
    // Line 8 is the definition of calculateTax
    const atDef = getCurrentFunctionAtCursor(sampleBoiScript, 8, 'boi-script');
    expect(atDef.fn?.name).toBe('calculateTax');
    expect(atDef.isAtDefinition).toBe(true);
    expect(atDef.isInsideBody).toBe(false);
  });

  it('finds usages of a function excluding definition and comments', () => {
    const usages = findFunctionUsages(sampleBoiScript, 'calculateTax', 8);
    // calculateTax is called twice in main(): lines 15 and 16
    expect(usages.length).toBe(2);
    expect(usages[0].line).toBe(15);
    expect(usages[1].line).toBe(16);
    expect(usages[0].name).toBe('calculateTax');
  });

  it('finds single usage of initSystem', () => {
    const usages = findFunctionUsages(sampleBoiScript, 'initSystem', 2);
    // initSystem is called once in main(): line 14
    expect(usages.length).toBe(1);
    expect(usages[0].line).toBe(14);
  });

  it('matches both ctrl+arrowup and ctrl+up in matchShortcut', () => {
    const fakeEvent = {
      key: 'ArrowUp',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    };

    expect(matchShortcut(fakeEvent, 'ctrl+arrowup')).toBe(true);
    expect(matchShortcut(fakeEvent, 'ctrl+up')).toBe(true);
    expect(matchShortcut(fakeEvent, 'ctrl+down')).toBe(false);
  });

  it('correctly handles Java methods with throws clause (user example)', () => {
    const javaCode = [
      'public class TestService {',
      '   private void outputErrorCsv(DaoInvokerIf invoker, List<String> errorList) throws Exception {',
      '        File outputDir = new File(OUTPUT_DIR_PATH);',
      '        if (!outputDir.exists()) {',
      '            outputDir.mkdirs();',
      '        }',
      '        List<String> orginalCsv = new ArrayList<String>();',
      '   }',
      '',
      '   public void process() {',
      '        outputErrorCsv(invoker, list1);',
      '        outputErrorCsv(invoker, list2);',
      '   }',
      '}'
    ].join('\n');

    const fns = extractFunctionsFromContent(javaCode, 'java');
    expect(fns.length).toBe(2);
    expect(fns[0].name).toBe('outputErrorCsv');
    expect(fns[0].line).toBe(2);
    expect(fns[0].column).toBe(17);
    expect(fns[0].endLine).toBe(8);

    // Cursor at line 7 (List<String> orginalCsv) -> must detect inside body of outputErrorCsv
    const atBody = getCurrentFunctionAtCursor(javaCode, 7, 'java');
    expect(atBody.fn?.name).toBe('outputErrorCsv');
    expect(atBody.isInsideBody).toBe(true);
    expect(atBody.isAtDefinition).toBe(false);

    // Cursor at line 2 (definition) -> must detect at definition
    const atDef = getCurrentFunctionAtCursor(javaCode, 2, 'java');
    expect(atDef.fn?.name).toBe('outputErrorCsv');
    expect(atDef.isAtDefinition).toBe(true);
    expect(atDef.isInsideBody).toBe(false);

    // Find usages of outputErrorCsv -> must find line 11 and line 12
    const usages = findFunctionUsages(javaCode, 'outputErrorCsv', 2);
    expect(usages.length).toBe(2);
    expect(usages[0].line).toBe(11);
    expect(usages[1].line).toBe(12);
  });

  it('correctly handles multiline Java method signatures', () => {
    const multilineJava = [
      'public class TestService {',
      '   private void outputErrorCsv(',
      '       DaoInvokerIf invoker,',
      '       List<String> errorList',
      '   ) throws Exception {',
      '        File outputDir = new File(OUTPUT_DIR_PATH);',
      '   }',
      '}'
    ].join('\n');

    const fns = extractFunctionsFromContent(multilineJava, 'java');
    expect(fns.length).toBe(1);
    expect(fns[0].name).toBe('outputErrorCsv');
    expect(fns[0].line).toBe(2);
    expect(fns[0].endLine).toBe(7);

    const atDef = getCurrentFunctionAtCursor(multilineJava, 2, 'java');
    expect(atDef.isAtDefinition).toBe(true);
    expect(atDef.fn?.name).toBe('outputErrorCsv');
  });

  it('safely handles empty usages and edge cases in findFunctionUsages without hanging', () => {
    expect(findFunctionUsages('', 'test', 1)).toEqual([]);
    expect(findFunctionUsages('some code', '', 1)).toEqual([]);
    expect(findFunctionUsages('some code', '   ', 1)).toEqual([]);
    expect(findFunctionUsages('function test() {}', 'test', 1)).toEqual([]);
    expect(findFunctionUsages('// test() comment\n/* test() */\n* test()', 'test', 5)).toEqual([]);
  });

  it('finds and sorts function calls on a line by proximity to cursorColumn', () => {
    const line = '  const result = helper.calc(x) + service.process(y);';
    // calc is at col 25, process is at col 43
    // Cursor at col 20 (closer to calc)
    const callsNearCalc = findFunctionCallsOnLine(line, 20);
    expect(callsNearCalc.length).toBe(2);
    expect(callsNearCalc[0].name).toBe('calc');
    expect(callsNearCalc[1].name).toBe('process');

    // Cursor at col 45 (closer to process)
    const callsNearProcess = findFunctionCallsOnLine(line, 45);
    expect(callsNearProcess[0].name).toBe('process');
    expect(callsNearProcess[1].name).toBe('calc');
  });

  it('ignores language keywords when finding function calls on line', () => {
    const line = '  if (isValid(x)) { while (hasMore(y)) { return done(); } }';
    const calls = findFunctionCallsOnLine(line, 1);
    const names = calls.map(c => c.name);
    expect(names).toContain('isValid');
    expect(names).toContain('hasMore');
    expect(names).toContain('done');
    expect(names).not.toContain('if');
    expect(names).not.toContain('while');
    expect(names).not.toContain('return');
  });

  it('returns empty array when line has no function calls', () => {
    expect(findFunctionCallsOnLine('int x = 100;', 5)).toEqual([]);
    expect(findFunctionCallsOnLine('', 1)).toEqual([]);
  });

  it('finds function definition by name', () => {
    const code = `
      function first() {}
      function targetMethod(a, b) { return a + b; }
      function last() {}
    `;
    const found = findFunctionDefinition(code, 'targetMethod', 'javascript');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('targetMethod');
    expect(found?.line).toBe(3);

    expect(findFunctionDefinition(code, 'nonExistent', 'javascript')).toBeNull();
  });
});

