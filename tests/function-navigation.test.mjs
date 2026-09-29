import { describe, it, expect } from 'vitest';
import { 
  extractFunctionsFromContent, 
  findFunctionUsages, 
  getCurrentFunctionAtCursor,
  findFunctionCallsOnLine,
  findFunctionDefinition,
  matchShortcut,
  getFunctionUsagesModalAction,
  cycleUsageIndex,
  getMouseNavigationAction,
  navigateCursorHistoryIndex
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

  it('matches shortcuts including shift brackets and arrow variations', () => {
    // When Shift is pressed with [, e.key is '{' and e.code is 'BracketLeft'
    const shiftBracketLeft = { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false };
    expect(matchShortcut(shiftBracketLeft, 'ctrl+shift+[')).toBe(true);

    const shiftBracketRight = { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false };
    expect(matchShortcut(shiftBracketRight, 'ctrl+shift+]')).toBe(true);

    // Ctrl+Up with ArrowUp or Up
    const ctrlArrowUp = { key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
    expect(matchShortcut(ctrlArrowUp, 'ctrl+arrowup')).toBe(true);
    expect(matchShortcut(ctrlArrowUp, 'ctrl+up')).toBe(true);

    const ctrlUpLegacy = { key: 'Up', code: 'ArrowUp', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
    expect(matchShortcut(ctrlUpLegacy, 'ctrl+arrowup')).toBe(true);
    expect(matchShortcut(ctrlUpLegacy, 'ctrl+up')).toBe(true);
  });

  describe('Usages Modal Index Cycler and Action Dispatcher', () => {
    it('cycles usage indices correctly for 2 usages (e.g. outputErrorCsv)', () => {
      // 2 usages total (index 0 and index 1)
      expect(cycleUsageIndex(0, 2, 'next')).toBe(1);
      expect(cycleUsageIndex(1, 2, 'next')).toBe(0); // wraps around
      expect(cycleUsageIndex(0, 2, 'prev')).toBe(1); // wraps around
      expect(cycleUsageIndex(1, 2, 'prev')).toBe(0);
    });

    it('cycles usage indices correctly for 3 or more usages', () => {
      expect(cycleUsageIndex(0, 3, 'next')).toBe(1);
      expect(cycleUsageIndex(1, 3, 'next')).toBe(2);
      expect(cycleUsageIndex(2, 3, 'next')).toBe(0); // wraps around
      expect(cycleUsageIndex(0, 3, 'prev')).toBe(2); // wraps around
    });

    it('handles empty or single usage edge cases in cycler', () => {
      expect(cycleUsageIndex(0, 0, 'next')).toBe(0);
      expect(cycleUsageIndex(0, 1, 'next')).toBe(0);
      expect(cycleUsageIndex(0, 1, 'prev')).toBe(0);
    });

    it('dispatches "next" action on ArrowDown and Ctrl+Down/ArrowDown', () => {
      const down = getFunctionUsagesModalAction({ key: 'ArrowDown', code: 'ArrowDown' });
      expect(down.action).toBe('next');
      expect(down.preventDefault).toBe(true);
      expect(down.stopPropagation).toBe(true);

      const ctrlDown = getFunctionUsagesModalAction({ key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true });
      expect(ctrlDown.action).toBe('next');
      expect(ctrlDown.preventDefault).toBe(true);

      const legacyDown = getFunctionUsagesModalAction({ key: 'Down' });
      expect(legacyDown.action).toBe('next');
    });

    it('dispatches "prev" action on ArrowUp and Ctrl+Up/ArrowUp', () => {
      const up = getFunctionUsagesModalAction({ key: 'ArrowUp', code: 'ArrowUp' });
      expect(up.action).toBe('prev');
      expect(up.preventDefault).toBe(true);
      expect(up.stopPropagation).toBe(true);

      const ctrlUp = getFunctionUsagesModalAction({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true });
      expect(ctrlUp.action).toBe('prev');
      expect(ctrlUp.preventDefault).toBe(true);

      const legacyUp = getFunctionUsagesModalAction({ key: 'Up' });
      expect(legacyUp.action).toBe('prev');
    });

    it('dispatches "confirm" action on Enter, NumpadEnter, Space, and Ctrl+Right', () => {
      const enter = getFunctionUsagesModalAction({ key: 'Enter', code: 'Enter' });
      expect(enter.action).toBe('confirm');
      expect(enter.preventDefault).toBe(true);

      const numpadEnter = getFunctionUsagesModalAction({ key: 'Enter', code: 'NumpadEnter' });
      expect(numpadEnter.action).toBe('confirm');

      const space = getFunctionUsagesModalAction({ key: ' ' });
      expect(space.action).toBe('confirm');

      const ctrlRight = getFunctionUsagesModalAction({ key: 'ArrowRight', code: 'ArrowRight', ctrlKey: true });
      expect(ctrlRight.action).toBe('confirm');
    });

    it('dispatches "close" action on Escape and Ctrl+Left', () => {
      const esc = getFunctionUsagesModalAction({ key: 'Escape', code: 'Escape' });
      expect(esc.action).toBe('close');
      expect(esc.preventDefault).toBe(true);
      expect(esc.stopPropagation).toBe(true);

      const ctrlLeft = getFunctionUsagesModalAction({ key: 'ArrowLeft', code: 'ArrowLeft', ctrlKey: true });
      expect(ctrlLeft.action).toBe('close');
    });

    it('blocks typing and shortcuts from leaking into background editor', () => {
      const letterA = getFunctionUsagesModalAction({ key: 'a' });
      expect(letterA.action).toBe('none');
      expect(letterA.stopPropagation).toBe(true);

      const ctrlS = getFunctionUsagesModalAction({ key: 's', ctrlKey: true });
      expect(ctrlS.action).toBe('none');
      expect(ctrlS.stopPropagation).toBe(true);
    });
  });

  describe('Mouse Navigation Actions (Buttons 3 & 4 / Mouse 4, 5, 6)', () => {
    it('maps button 3 to "back" and button 4 to "forward"', () => {
      expect(getMouseNavigationAction(3)).toBe('back');
      expect(getMouseNavigationAction(4)).toBe('forward');
    });

    it('returns "none" for left, right, middle, or unhandled mouse buttons', () => {
      expect(getMouseNavigationAction(0)).toBe('none');
      expect(getMouseNavigationAction(1)).toBe('none');
      expect(getMouseNavigationAction(2)).toBe('none');
      expect(getMouseNavigationAction(5)).toBe('none');
    });

    it('returns "none" when mouse navigation is disabled in settings', () => {
      expect(getMouseNavigationAction(3, false)).toBe('none');
      expect(getMouseNavigationAction(4, false)).toBe('none');
    });

    it('correctly calculates backwards movement in cursor history', () => {
      expect(navigateCursorHistoryIndex(2, 5, 'back')).toBe(1);
      expect(navigateCursorHistoryIndex(1, 5, 'back')).toBe(0);
      expect(navigateCursorHistoryIndex(0, 5, 'back')).toBe(-1); // At start, cannot go back further
      expect(navigateCursorHistoryIndex(-1, 5, 'back')).toBe(-1);
    });

    it('correctly calculates forwards movement in cursor history', () => {
      expect(navigateCursorHistoryIndex(0, 5, 'forward')).toBe(1);
      expect(navigateCursorHistoryIndex(3, 5, 'forward')).toBe(4);
      expect(navigateCursorHistoryIndex(4, 5, 'forward')).toBe(-1); // At end, cannot go forward further
      expect(navigateCursorHistoryIndex(-1, 5, 'forward')).toBe(-1);
    });
  });

  describe('Performance on Large Files (Anti-Freeze / Anti-Stun)', () => {
    // Generate a 3,000-line file with 150 functions
    const lines = [];
    lines.push('// Header');
    for (let i = 0; i < 150; i++) {
      lines.push(`function computeStep_${i}(alpha, beta) {`);
      lines.push(`  let temp = alpha * ${i};`);
      lines.push(`  if (temp > 100) {`);
      lines.push(`    log("step ${i}");`);
      lines.push(`  }`);
      lines.push(`  return temp;`);
      lines.push(`}`);
      lines.push(``);
    }
    const largeContent = lines.join('\n');

    it('findFunctionDefinition resolves targeted function in < 15ms on 3000-line file', () => {
      const start = performance.now();
      const def = findFunctionDefinition(largeContent, 'computeStep_120', 'boi-script');
      const duration = performance.now() - start;
      expect(def).not.toBeNull();
      expect(def?.name).toBe('computeStep_120');
      expect(duration).toBeLessThan(50);
    });

    it('getCurrentFunctionAtCursor detects definition and body in < 15ms on 3000-line file', () => {
      const targetLine = 2 + 120 * 8 + 2; // Line inside computeStep_120 (header = 1, each fn = 8 lines)
      const start = performance.now();
      const info = getCurrentFunctionAtCursor(largeContent, targetLine, 'boi-script');
      const duration = performance.now() - start;
      expect(info.fn?.name).toBe('computeStep_120');
      expect(info.isInsideBody).toBe(true);
      expect(duration).toBeLessThan(50);
    });
  });
});




