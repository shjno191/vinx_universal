/**
 * JavaAnalyzer.ts
 * 
 * A targeted recursive-descent parser for Java source code.
 * Generates Mermaid.js flowchart syntax from the logical control flow of Java methods.
 *
 * Supported constructs:
 *   - Class / method declarations → subgraphs / entry nodes
 *   - if / else-if / else         → decision nodes + merging
 *   - for / while / do-while      → loop nodes with back-edge
 *   - try / catch / finally       → exception flow
 *   - return / throw              → terminal nodes
 *   - method calls                → process / IO nodes
 *
 * Strategy:
 *   1. Tokenize – strip comments, produce a flat token stream
 *   2. Parse    – recursive descent, track brace depth
 *   3. Emit     – build Flowchart (nodes + edges) → toMermaid()
 */

// ── Token Types ────────────────────────────────────────────────────────────────

type TK =
    | 'KEYWORD' | 'IDENT' | 'NUMBER' | 'STRING' | 'CHAR'
    | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET'
    | 'SEMI' | 'COMMA' | 'DOT' | 'OP' | 'AT' | 'EOF';

interface Token { kind: TK; value: string }

const JAVA_KEYWORDS = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
    'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
    'finally', 'float', 'for', 'if', 'goto', 'implements', 'import', 'instanceof',
    'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected',
    'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'transient', 'try', 'var', 'void', 'volatile', 'while',
]);

// ── Tokenizer ──────────────────────────────────────────────────────────────────

function tokenize(src: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = src.length;

    while (i < len) {
        // Skip whitespace
        if (/\s/.test(src[i])) { i++; continue; }

        // Skip line comments
        if (src[i] === '/' && src[i + 1] === '/') {
            while (i < len && src[i] !== '\n') i++;
            continue;
        }

        // Skip block comments
        if (src[i] === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }

        // Annotations
        if (src[i] === '@') {
            tokens.push({ kind: 'AT', value: '@' });
            i++;
            continue;
        }

        // String literals
        if (src[i] === '"') {
            let s = '"';
            i++;
            while (i < len && src[i] !== '"') {
                if (src[i] === '\\') { s += src[i]; i++; }
                s += src[i]; i++;
            }
            s += '"'; i++;
            tokens.push({ kind: 'STRING', value: s });
            continue;
        }

        // Char literals
        if (src[i] === "'") {
            let s = "'";
            i++;
            while (i < len && src[i] !== "'") {
                if (src[i] === '\\') { s += src[i]; i++; }
                s += src[i]; i++;
            }
            s += "'"; i++;
            tokens.push({ kind: 'CHAR', value: s });
            continue;
        }

        // Numbers
        if (/[0-9]/.test(src[i])) {
            let n = '';
            while (i < len && /[0-9a-fA-FxX_.L]/.test(src[i])) n += src[i++];
            tokens.push({ kind: 'NUMBER', value: n });
            continue;
        }

        // Identifiers and keywords
        if (/[a-zA-Z_$]/.test(src[i])) {
            let id = '';
            while (i < len && /[a-zA-Z0-9_$]/.test(src[i])) id += src[i++];
            tokens.push({ kind: JAVA_KEYWORDS.has(id) ? 'KEYWORD' : 'IDENT', value: id });
            continue;
        }

        // Single-char tokens
        const ch = src[i];
        switch (ch) {
            case '(': tokens.push({ kind: 'LPAREN', value: ch }); break;
            case ')': tokens.push({ kind: 'RPAREN', value: ch }); break;
            case '{': tokens.push({ kind: 'LBRACE', value: ch }); break;
            case '}': tokens.push({ kind: 'RBRACE', value: ch }); break;
            case '[': tokens.push({ kind: 'LBRACKET', value: ch }); break;
            case ']': tokens.push({ kind: 'RBRACKET', value: ch }); break;
            case ';': tokens.push({ kind: 'SEMI', value: ch }); break;
            case ',': tokens.push({ kind: 'COMMA', value: ch }); break;
            case '.': tokens.push({ kind: 'DOT', value: ch }); break;
            default: tokens.push({ kind: 'OP', value: ch }); break;
        }
        i++;
    }

    tokens.push({ kind: 'EOF', value: '' });
    return tokens;
}

// ── Flowchart Data Model ───────────────────────────────────────────────────────

type NodeShape = 'start' | 'terminal' | 'decision' | 'process' | 'io';

interface FNode { id: string; label: string; shape: NodeShape }
interface FEdge { from: string; to: string; label?: string }

class Flowchart {
    nodes: FNode[] = [];
    private edges: FEdge[] = [];
    private counter = 0;

    newId(): string { return `J${this.counter++}`; }

    addNode(id: string, label: string, shape: NodeShape) {
        // Sanitize: remove chars that break Mermaid node syntax
        const safe = label
            .replace(/"/g, "'")          // double-quotes → single
            .replace(/[&<>]/g, ' ')      // HTML special chars → space
            .replace(/\(/g, '[')         // ( → [ (safe inside any Mermaid shape)
            .replace(/\)/g, ']')         // ) → ]
            .substring(0, 60);
        this.nodes.push({ id, label: safe, shape });
    }

    addEdge(from: string, to: string, label?: string) {
        if (from && to) this.edges.push({ from, to, label });
    }

    private render(n: FNode): string {
        const l = n.label;
        switch (n.shape) {
            case 'start': return `${n.id}[["${l}"]]`;  // double-rect = entry point
            case 'terminal': return `${n.id}[/"${l}"/]`;  // parallelogram = exit/return
            case 'decision': return `${n.id}{"${l}"}`;    // diamond = branch/tree split
            case 'io': return `${n.id}[("${l}")]`;  // cylinder = data/IO
            default: return `${n.id}["${l}"]`;    // rectangle = process
        }
    }

    toMermaid(): string {
        const lines = ['flowchart TD'];
        for (const n of this.nodes) lines.push('  ' + this.render(n));
        for (const e of this.edges) {
            const arrow = e.label ? `-->|"${e.label}"|` : '-->';
            lines.push(`  ${e.from} ${arrow} ${e.to}`);
        }
        return lines.join('\n');
    }
}

// ── Token Stream Cursor ────────────────────────────────────────────────────────

class Cursor {
    private tokens: Token[];
    private pos = 0;
    private static readonly EOF_TOKEN: Token = { kind: 'EOF', value: '' };

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        // Ensure there is always at least one EOF sentinel
        if (!tokens.length || tokens[tokens.length - 1].kind !== 'EOF') {
            this.tokens = [...tokens, { kind: 'EOF', value: '' }];
        }
    }

    peek(offset = 0): Token {
        const idx = this.pos + offset;
        return idx >= 0 && idx < this.tokens.length
            ? this.tokens[idx]
            : Cursor.EOF_TOKEN;
    }

    next(): Token {
        return this.pos < this.tokens.length
            ? this.tokens[this.pos++]
            : Cursor.EOF_TOKEN;
    }

    isEOF(): boolean { return this.peek().kind === 'EOF'; }

    expect(kind: TK): Token {
        const t = this.peek();
        if (t.kind === kind) return this.next();
        throw new Error(`Expected ${kind} but got ${t.kind}('${t.value}')`);
    }

    skipUntil(kind: TK): void {
        while (!this.isEOF() && this.peek().kind !== kind) this.next();
    }

    /** Consume tokens through a matched paren group '(...)' */
    captureParens(): string {
        if (this.peek().kind !== 'LPAREN') return '';
        this.next(); // consume (
        let depth = 1;
        let content = '';
        while (!this.isEOF() && depth > 0) {
            const t = this.next();
            if (t.kind === 'LPAREN') { depth++; content += '('; }
            else if (t.kind === 'RPAREN') { depth--; if (depth > 0) content += ')'; }
            else content += ' ' + t.value;
        }
        return content.trim();
    }

    /** Consume a balanced brace block and return the inner tokens (always ends with EOF) */
    captureBlock(): Token[] {
        if (this.peek().kind !== 'LBRACE') {
            // single statement (no braces) — gather until ; or EOF
            const stmt: Token[] = [];
            while (!this.isEOF() && this.peek().kind !== 'SEMI') stmt.push(this.next());
            if (this.peek().kind === 'SEMI') this.next();
            // Always add EOF sentinel so nested Cursor never returns undefined
            stmt.push({ kind: 'EOF', value: '' });
            return stmt;
        }
        this.next(); // consume {
        let depth = 1;
        const inner: Token[] = [];
        while (!this.isEOF() && depth > 0) {
            const t = this.next();
            if (t.kind === 'LBRACE') { depth++; inner.push(t); }
            else if (t.kind === 'RBRACE') { depth--; if (depth > 0) inner.push(t); }
            else inner.push(t);
        }
        inner.push({ kind: 'EOF', value: '' });
        return inner;
    }

    /** Skip past annotations like @Override, @Test(...) */
    skipAnnotations(): void {
        while (this.peek().kind === 'AT') {
            this.next(); // @
            if (this.peek().kind === 'IDENT' || this.peek().kind === 'KEYWORD') this.next();
            if (this.peek().kind === 'LPAREN') this.captureParens();
        }
    }
}

// ── Noise Detection ────────────────────────────────────────────────────────────

const NOISE_CALL_METHODS = new Set([
    'log', 'warn', 'error', 'info', 'debug', 'trace', 'finest', 'finer', 'fine',
    'append', 'toString', 'hashCode', 'equals', 'length', 'size', 'isEmpty',
    'println', 'print', 'printf', 'format', 'sprintf',
    'setString', 'setInt', 'setLong', 'setObject', 'getObject', 'setBoolean',
    'close', 'flush', 'commit', 'rollback', 'setAutoCommit',
    'trim', 'toLowerCase', 'toUpperCase', 'substring', 'contains', 'startsWith', 'endsWith',
    'parseInt', 'valueOf', 'toString', 'get', 'set', 'put', 'add', 'remove',
]);

const NOISE_CALL_OBJECTS = new Set([
    'System', 'logger', 'log', 'Logger', 'LOGGER', 'LOG',
    'sql', 'sb', 'StringBuilder', 'StringBuffer',
]);

const IO_PREFIXES = [
    'dao', 'Dao', 'DAO', 'repo', 'Repo', 'repository', 'Repository',
    'service', 'Service', 'mapper', 'Mapper', 'client', 'Client',
    'invoke', 'execute', 'query', 'fetch', 'http', 'Http',
    'read', 'write', 'save', 'load', 'send', 'receive', 'call', 'request',
];

/** Returns true if this call is noise and should NOT appear in the diagram */
function isNoise(callText: string): boolean {
    const m = callText.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\.([a-zA-Z_$][a-zA-Z0-9_$]*))?/);
    if (!m) return false;
    const obj = m[1];
    const method = m[2] ?? m[1];
    if (NOISE_CALL_OBJECTS.has(obj)) return true;
    if (NOISE_CALL_METHODS.has(method)) return true;
    // Skip new SomeObject(...) — constructors are noise in this mode
    if (/^new\s+/.test(callText)) return true;
    return false;
}

function isIOCall(callText: string): boolean {
    return IO_PREFIXES.some(p => callText.includes(p));
}

// Quick scan: does this token array contain any meaningful function call?
function hasMeaningfulCall(tokens: Token[]): boolean {
    const cur = new Cursor(tokens);
    while (!cur.isEOF()) {
        const t = cur.peek();
        // Look for: IDENT/KEYWORD ( or IDENT . IDENT (
        if ((t.kind === 'IDENT' || t.kind === 'KEYWORD') && cur.peek(1).kind === 'LPAREN') {
            if (!isNoise(t.value + '(')) return true;
        }
        if (t.kind === 'IDENT' && cur.peek(1).kind === 'DOT') {
            const method = cur.peek(2).value;
            const callText = `${t.value}.${method}`;
            if (!isNoise(callText)) return true;
        }
        cur.next();
    }
    return false;
}

// ── Function-First Walker ──────────────────────────────────────────────────────
//
// Algorithm: FUNCTION-FIRST ROUTING
//   1. Walk statements but ONLY emit nodes for meaningful function calls
//   2. When a call is inside an `if`, emit a decision node with the condition
//   3. Collapse empty branches (if the then/else only has noise, skip that arrow)
//   4. try blocks are transparent — just walk the try body, ignore catch/finally
//   5. for/while loops only create a loop node if their body has meaningful calls

class FunctionFirstWalker {
    private graph: Flowchart;
    /** Names of user-defined functions in the file (used to detect cross-function calls) */
    userFunctions: Set<string> = new Set();

    constructor(graph: Flowchart) { this.graph = graph; }

    walkBlock(tokens: Token[], prevIds: string[]): string[] {
        const cur = new Cursor(tokens);
        return this.walk(cur, prevIds);
    }

    private walk(cur: Cursor, prevIds: string[]): string[] {
        let danglers = [...prevIds];

        while (!cur.isEOF()) {
            cur.skipAnnotations();
            const t = cur.peek();
            if (t.kind === 'EOF') break;
            if (t.kind === 'RBRACE') { cur.next(); break; }

            // ── if / else-if ────────────────────────────────────────────────────
            if (t.kind === 'KEYWORD' && t.value === 'if') {
                cur.next();
                const cond = cur.captureParens();
                const thenTokens = cur.captureBlock();

                const hasThen = hasMeaningfulCall(thenTokens);
                let hasElse = false;
                let elseTokens: Token[] = [];
                if (cur.peek().kind === 'KEYWORD' && cur.peek().value === 'else') {
                    cur.next();
                    elseTokens = cur.captureBlock();
                    hasElse = hasMeaningfulCall(elseTokens);
                }

                if (!hasThen && !hasElse) {
                    // Both branches are pure noise → skip the whole if block
                    continue;
                }

                if (!hasThen) {
                    // Only else has meaningful calls → negate condition, draw single branch
                    const ifId = this.graph.newId();
                    this.graph.addNode(ifId, `NOT [${cond}]`.substring(0, 55), 'decision');
                    for (const p of danglers) this.graph.addEdge(p, ifId);
                    const elseEnd = this.walk(new Cursor(elseTokens), [ifId]);
                    danglers = elseEnd;
                    continue;
                }

                // Create the condition decision node
                const ifId = this.graph.newId();
                this.graph.addNode(ifId, cond.substring(0, 55) || 'condition', 'decision');
                for (const p of danglers) this.graph.addEdge(p, ifId);

                // Walk then-branch: condId acts as the starting point (Yes edge)
                const thenDanglers = this.walk(new Cursor(thenTokens), [ifId]);

                if (!hasElse) {
                    // Collapse empty else: No branch falls through to next statement
                    danglers = [...thenDanglers, ifId];
                } else {
                    // Walk else-branch: also starts from ifId (No edge)
                    const elseDanglers = this.walk(new Cursor(elseTokens), [ifId]);
                    danglers = [...thenDanglers, ...elseDanglers];
                }
                continue;
            }

            // ── for / while / do-while ──────────────────────────────────────────
            if (t.kind === 'KEYWORD' && (t.value === 'for' || t.value === 'while' || t.value === 'do')) {
                cur.next();
                let cond = '';
                if (t.value !== 'do') cond = cur.captureParens();
                const bodyTokens = cur.captureBlock();
                if (t.value === 'do') {
                    if (cur.peek().kind === 'KEYWORD' && cur.peek().value === 'while') {
                        cur.next(); cond = cur.captureParens();
                        if (cur.peek().kind === 'SEMI') cur.next();
                    }
                }

                if (!hasMeaningfulCall(bodyTokens)) continue; // prune empty loops

                const loopId = this.graph.newId();
                this.graph.addNode(loopId, `loop: ${cond}`.substring(0, 50) || 'loop', 'decision');
                for (const p of danglers) this.graph.addEdge(p, loopId);

                // Walk body with loopId as start — back-edge added on results
                const bodyEnd = this.walk(new Cursor(bodyTokens), [loopId]);
                for (const b of bodyEnd) this.graph.addEdge(b, loopId, 'repeat');
                danglers = [loopId]; // exit arrow from loop
                continue;
            }

            // ── switch ──────────────────────────────────────────────────────────
            if (t.kind === 'KEYWORD' && t.value === 'switch') {
                cur.next();
                const expr = cur.captureParens();
                const switchId = this.graph.newId();
                this.graph.addNode(switchId, `switch [${expr}]`.substring(0, 50), 'decision');
                for (const p of danglers) this.graph.addEdge(p, switchId);
                const allEnds: string[] = [];

                if (cur.peek().kind === 'LBRACE') cur.next();
                let caseDanglers: string[] = [switchId];
                while (!cur.isEOF() && cur.peek().kind !== 'RBRACE') {
                    cur.skipAnnotations();
                    const st = cur.peek();
                    if (st.kind === 'KEYWORD' && (st.value === 'case' || st.value === 'default')) {
                        cur.next();
                        let caseLabel = '';
                        if (st.value === 'case') {
                            let cv = '';
                            while (!cur.isEOF() && cur.peek().kind !== 'OP') cv += cur.next().value;
                            cur.next(); caseLabel = cv.trim();
                        } else { if (cur.peek().kind === 'OP') cur.next(); caseLabel = 'default'; }
                        caseDanglers = [switchId]; // reset so each case branches from switch
                        const caseId = this.graph.newId();
                        this.graph.addNode(caseId, `case: ${caseLabel}`.substring(0, 40), 'process');
                        this.graph.addEdge(switchId, caseId, caseLabel || 'default');
                        caseDanglers = [caseId];
                    } else if (st.kind === 'KEYWORD' && st.value === 'break') {
                        cur.next();
                        if (cur.peek().kind === 'SEMI') cur.next();
                        allEnds.push(...caseDanglers);
                        caseDanglers = [];
                    } else {
                        caseDanglers = this.walkOneCallStatement(cur, caseDanglers);
                    }
                }
                if (cur.peek().kind === 'RBRACE') cur.next();
                danglers = allEnds.length ? allEnds : caseDanglers;
                continue;
            }

            // ── try → transparent (walk try body only, skip catch/finally) ──────
            if (t.kind === 'KEYWORD' && t.value === 'try') {
                cur.next();
                if (cur.peek().kind === 'LPAREN') cur.captureParens(); // try-with-resources
                const tryTokens = cur.captureBlock();

                // Walk inside try transparently
                danglers = this.walk(new Cursor(tryTokens), danglers);

                // Consume catch/finally — only draw if they have meaningful calls
                while (cur.peek().kind === 'KEYWORD' && cur.peek().value === 'catch') {
                    cur.next();
                    const errType = cur.captureParens();
                    const catchTokens = cur.captureBlock();
                    if (hasMeaningfulCall(catchTokens)) {
                        const catchId = this.graph.newId();
                        this.graph.addNode(catchId, `catch [${errType}]`.substring(0, 50), 'decision');
                        // Catch is an error branch — connect from try's last danglers
                        for (const p of danglers) this.graph.addEdge(p, catchId, 'error');
                        const catchEnd = this.walk(new Cursor(catchTokens), [catchId]);
                        danglers.push(...catchEnd);
                    }
                }
                if (cur.peek().kind === 'KEYWORD' && cur.peek().value === 'finally') {
                    cur.next();
                    const finallyTokens = cur.captureBlock();
                    if (hasMeaningfulCall(finallyTokens)) {
                        const finId = this.graph.newId();
                        this.graph.addNode(finId, 'finally', 'process');
                        for (const p of danglers) this.graph.addEdge(p, finId);
                        danglers = this.walk(new Cursor(finallyTokens), [finId]);
                    }
                }
                continue;
            }

            // ── return ──────────────────────────────────────────────────────────
            if (t.kind === 'KEYWORD' && t.value === 'return') {
                cur.next();
                let expr = '';
                while (!cur.isEOF() && cur.peek().kind !== 'SEMI') expr += cur.next().value + ' ';
                if (cur.peek().kind === 'SEMI') cur.next();
                const exprTrim = expr.trim();
                // Only draw return node if it returns something meaningful (not just a variable)
                if (exprTrim && !/^[a-z_][a-zA-Z0-9_]*$/.test(exprTrim)) {
                    const retId = this.graph.newId();
                    this.graph.addNode(retId, `return ${exprTrim}`.substring(0, 50), 'terminal');
                    for (const p of danglers) this.graph.addEdge(p, retId);
                    danglers = [];
                }
                continue;
            }

            // ── throw ───────────────────────────────────────────────────────────
            if (t.kind === 'KEYWORD' && t.value === 'throw') {
                cur.next();
                let expr = '';
                while (!cur.isEOF() && cur.peek().kind !== 'SEMI') expr += cur.next().value + ' ';
                if (cur.peek().kind === 'SEMI') cur.next();
                const throwId = this.graph.newId();
                this.graph.addNode(throwId, `throw ${expr.trim()}`.substring(0, 50), 'terminal');
                for (const p of danglers) this.graph.addEdge(p, throwId);
                danglers = [];
                continue;
            }

            // ── skip: break / continue ──────────────────────────────────────────
            if (t.kind === 'KEYWORD' && (t.value === 'break' || t.value === 'continue')) {
                cur.next(); cur.skipUntil('SEMI'); cur.next();
                continue;
            }

            // ── expression / method call ────────────────────────────────────────
            danglers = this.walkOneCallStatement(cur, danglers);
        }

        return danglers;
    }

    /**
     * Walk one expression statement. Only create a node if it's a meaningful call.
     * Skip var decls, assignments, new SomeObject(), log calls, etc.
     */
    private walkOneCallStatement(cur: Cursor, prevIds: string[]): string[] {
        const parts: string[] = [];
        let depth = 0;
        while (!cur.isEOF()) {
            const tk = cur.peek();
            if (tk.kind === 'LBRACE' && depth === 0) { cur.captureBlock(); break; }
            if ((tk.kind === 'SEMI' || tk.kind === 'EOF') && depth === 0) {
                if (tk.kind === 'SEMI') cur.next();
                break;
            }
            if (tk.kind === 'LPAREN') depth++;
            if (tk.kind === 'RPAREN') depth--;
            parts.push(cur.next().value);
        }

        const raw = parts.join(' ').trim();
        if (!raw) return prevIds;

        // Detect a call pattern: word( or word.word(
        const callMatch = raw.match(/([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*\(/);
        if (callMatch) {
            const callName = callMatch[1];
            if (!isNoise(callName)) {
                const nodeId = this.graph.newId();
                const label = raw.replace(/\s+/g, ' ').substring(0, 55);
                const shape: NodeShape = isIOCall(callName) ? 'io' : 'process';
                this.graph.addNode(nodeId, label, shape);
                for (const p of prevIds) this.graph.addEdge(p, nodeId);
                return [nodeId];
            }
        }
        return prevIds;
    }

}


// ── Method / Class Extraction ──────────────────────────────────────────────────

interface JavaMethod { name: string; tokens: Token[] }

function extractMethods(tokens: Token[], depth = 0): JavaMethod[] {
    const methods: JavaMethod[] = [];
    const cur = new Cursor(tokens);

    const MODIFIERS = new Set([
        'public', 'private', 'protected', 'static', 'final', 'abstract',
        'synchronized', 'native', 'strictfp', 'default', 'transient', 'volatile', 'override',
    ]);

    // Primitive + void return types that are keywords but valid as method return types
    const RETURN_TYPE_KEYWORDS = new Set([
        'void', 'int', 'long', 'double', 'float', 'boolean', 'byte', 'short', 'char', 'String',
    ]);

    while (!cur.isEOF()) {
        cur.skipAnnotations();
        const t = cur.peek();

        if (t.kind === 'EOF') break;

        // ── class / interface / enum declaration → recurse into body ──────────
        if (t.kind === 'KEYWORD' && (t.value === 'class' || t.value === 'interface' || t.value === 'enum')) {
            cur.next(); // consume class/interface/enum
            // skip class name + extends/implements clause until {
            while (!cur.isEOF() && cur.peek().kind !== 'LBRACE' && cur.peek().kind !== 'EOF') cur.next();
            if (cur.peek().kind === 'LBRACE') {
                const classBodyTokens = cur.captureBlock();
                const inner = extractMethods(classBodyTokens, depth + 1);
                methods.push(...inner);
            }
            continue;
        }

        // ── Skip modifier keywords ────────────────────────────────────────────
        if (t.kind === 'KEYWORD' && MODIFIERS.has(t.value)) { cur.next(); continue; }

        // ── Skip package / import statements ──────────────────────────────────
        if (t.kind === 'KEYWORD' && (t.value === 'package' || t.value === 'import')) {
            cur.skipUntil('SEMI'); cur.next(); continue;
        }

        // ── Method declaration pattern: ReturnType methodName ( params ) [throws ...] { body }
        // ReturnType can be: IDENT | void | int | long | double | float | boolean | byte | short | char
        const isReturnType = (tk: Token) =>
            (tk.kind === 'IDENT' && !JAVA_KEYWORDS.has(tk.value)) ||
            (tk.kind === 'KEYWORD' && RETURN_TYPE_KEYWORDS.has(tk.value));

        if (isReturnType(t)) {
            cur.next(); // consume return type

            // Handle generic return type: ReturnType<X, Y>
            if (cur.peek().kind === 'OP' && cur.peek().value === '<') {
                let anglDepth = 1;
                cur.next(); // consume <
                while (!cur.isEOF() && anglDepth > 0) {
                    const v = cur.next().value;
                    if (v === '<') anglDepth++;
                    else if (v === '>') anglDepth--;
                }
            }
            // Handle array return type: ReturnType[]
            while (cur.peek().kind === 'LBRACKET') {
                cur.next();
                if (cur.peek().kind === 'RBRACKET') cur.next();
            }

            // Next must be an IDENT (method name)
            const nameToken = cur.peek();
            if (nameToken.kind === 'IDENT' && !JAVA_KEYWORDS.has(nameToken.value)) {
                const methodName = cur.next().value;

                if (cur.peek().kind === 'LPAREN') {
                    // Confirmed method! Skip parameters
                    cur.captureParens();

                    // Skip throws clause
                    if (cur.peek().kind === 'KEYWORD' && cur.peek().value === 'throws') {
                        cur.next();
                        while (!cur.isEOF() && cur.peek().kind !== 'LBRACE' && cur.peek().kind !== 'SEMI') cur.next();
                    }

                    // Abstract method / interface method — no body
                    if (cur.peek().kind === 'SEMI') { cur.next(); continue; }

                    // Concrete method with body
                    if (cur.peek().kind === 'LBRACE') {
                        const bodyTokens = cur.captureBlock();
                        methods.push({ name: `${methodName}()`, tokens: bodyTokens });
                        continue;
                    }
                } else if (cur.peek().kind === 'LBRACE') {
                    // Could be a constructor for the class name
                    const bodyTokens = cur.captureBlock();
                    methods.push({ name: `${methodName}()`, tokens: bodyTokens });
                    continue;
                } else {
                    // Field declaration — skip to ;
                    cur.skipUntil('SEMI');
                    if (!cur.isEOF()) cur.next();
                    continue;
                }
            } else if (nameToken.kind === 'LBRACE') {
                // Static initializer block { ... }
                cur.captureBlock();
                continue;
            } else {
                // Something unexpected — skip to next ;
                cur.skipUntil('SEMI');
                if (!cur.isEOF()) cur.next();
            }
            continue;
        }

        // Skip everything else (stray tokens at class level)
        cur.next();
    }

    return methods;
}


// ── Public API ─────────────────────────────────────────────────────────────────

export interface JavaAnalysisResult {
    mermaid: string;
    error?: string;
}

export function analyzeJava(source: string): JavaAnalysisResult {
    let tokens: Token[];
    try {
        tokens = tokenize(source);
    } catch (e: any) {
        return { mermaid: '', error: `Tokenize error: ${e.message}` };
    }

    const methods = extractMethods(tokens);

    if (methods.length === 0) {
        // Fallback: treat entire file body heuristically
        return {
            mermaid: `flowchart TD\n  S([Start]) --> N0["No Java methods detected"]\n  N0 --> E([End])`,
            error: 'No method declarations found. Ensure the code is valid Java.',
        };
    }

    // Each method becomes a vertically-stacked subgraph
    const lines: string[] = ['flowchart TD'];
    const subIds: string[] = [];

    for (let mi = 0; mi < methods.length; mi++) {
        const method = methods[mi];
        const graph = new Flowchart();
        const walker = new FunctionFirstWalker(graph);

        const startId = graph.newId();
        graph.addNode(startId, method.name, 'start');

        const ends = walker.walkBlock(method.tokens, [startId]);

        const endId = graph.newId();
        graph.addNode(endId, `end ${method.name}`, 'terminal');
        for (const e of ends) graph.addEdge(e, endId);

        const subId = `M${mi}`;
        subIds.push(subId);
        const safeName = method.name.replace(/"/g, "'").replace(/[^a-zA-Z0-9 _()>.\-]/g, '').substring(0, 50);
        const sub = graph.toMermaid()
            .split('\n')
            .slice(1)
            .map(l => '    ' + l)
            .join('\n');
        lines.push(`  subgraph ${subId} ["${safeName}"]`);
        lines.push('    direction TB');  // force vertical layout inside subgraph
        lines.push(sub);
        // Assign class to all nodes in this subgraph for interactive highlighting
        graph.nodes.forEach(n => {
            lines.push(`    class ${n.id} ${subId}`);
        });
        lines.push('  end');
    }

    // Chain subgraphs top→bottom with invisible links so Mermaid stacks them vertically
    for (let i = 0; i < subIds.length - 1; i++) {
        lines.push(`  ${subIds[i]} ~~~ ${subIds[i + 1]}`);
    }

    return { mermaid: lines.join('\n') };
}

/** Detect if source code looks like Java */
export function looksLikeJava(source: string): boolean {
    return /\b(public|private|protected)\s+(static\s+)?(void|class|interface|enum)\b/.test(source)
        || /\bSystem\.out\b/.test(source)
        || /\bnew\s+[A-Z]\w*\s*\(/.test(source)
        || /\bimport\s+[a-z][\w.]+;/.test(source);
}
