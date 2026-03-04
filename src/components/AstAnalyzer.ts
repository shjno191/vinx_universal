/**
 * AstAnalyzer.ts
 * 
 * AST-based Flow Chart generator for JavaScript/TypeScript.
 * Uses @babel/parser to parse source → AST, then walks the tree
 * with a visitor pattern to emit Mermaid.js nodes and edges.
 * 
 * Architecture based on the 4-stage pipeline:
 *   1. Parse  → @babel/parser  
 *   2. Filter → noise removal (variable decls, trivial calls)
 *   3. Visit  → recursive AST walker with previousNodeId cursor
 *   4. Merge  → dangling end-of-branch resolution
 */

import * as babelParser from '@babel/parser';
import { analyzeJava, looksLikeJava } from './JavaAnalyzer';

// ── Data Structures ────────────────────────────────────────────────────────────

type NodeType = 'process' | 'decision' | 'io' | 'terminal' | 'start';

interface MermaidNode {
    id: string;
    label: string;
    type: NodeType;
}

interface MermaidEdge {
    from: string;
    to: string;
    label?: string;
}

class Flowchart {
    private nodes: MermaidNode[] = [];
    private edges: MermaidEdge[] = [];
    private counter = 0;

    newId(): string {
        return `N${this.counter++}`;
    }

    addNode(id: string, label: string, type: NodeType): void {
        // Sanitize label: remove special chars that break Mermaid 
        const safe = label
            .replace(/\(/g, '[').replace(/\)/g, ']')
            .replace(/"/g, "'")
            .replace(/[&<>]/g, ' ')
            .substring(0, 60);
        this.nodes.push({ id, label: safe, type });
    }

    addEdge(from: string, to: string, label?: string): void {
        this.edges.push({ from, to, label });
    }

    private shape(node: MermaidNode): string {
        const l = node.label;
        switch (node.type) {
            case 'start': return `${node.id}([${l}])`;
            case 'terminal': return `${node.id}([${l}])`;
            case 'decision': return `${node.id}{"${l}"}`;
            case 'io': return `${node.id}[(${l})]`;
            default: return `${node.id}["${l}"]`;
        }
    }

    toMermaid(): string {
        const lines: string[] = ['flowchart TD'];
        for (const n of this.nodes) {
            lines.push(`  ${this.shape(n)}`);
        }
        for (const e of this.edges) {
            const arrow = e.label ? `-->|"${e.label}"|` : '-->';
            lines.push(`  ${e.from} ${arrow} ${e.to}`);
        }
        return lines.join('\n');
    }
}

// ── Noise Filter ───────────────────────────────────────────────────────────────

const TRIVIAL_METHODS = new Set([
    'log', 'warn', 'error', 'info', 'debug', 'trace',
    'append', 'prepend', 'push', 'pop', 'shift', 'unshift',
    'setString', 'setInt', 'setLong', 'setFloat', 'setDouble', 'setBoolean',
    'print', 'println', 'write', 'flush', 'close',
    'toString', 'valueOf', 'hasOwnProperty',
]);

function isTrivialCall(node: any): boolean {
    if (node.type !== 'CallExpression') return false;
    const callee = node.callee;
    if (callee.type === 'MemberExpression') {
        const prop = callee.property?.name ?? '';
        return TRIVIAL_METHODS.has(prop);
    }
    return false;
}

function isNoise(node: any): boolean {
    if (!node) return true;
    switch (node.type) {
        case 'VariableDeclaration':
            // Keep if it's a function (arrow/function expression)
            return !node.declarations?.some((d: any) =>
                d.init?.type === 'ArrowFunctionExpression' ||
                d.init?.type === 'FunctionExpression'
            );
        case 'ImportDeclaration':
        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration':
        case 'EmptyStatement':
            return true;
        case 'ExpressionStatement':
            return isTrivialCall(node.expression);
        default:
            return false;
    }
}

// ── Visitor (Walk) ─────────────────────────────────────────────────────────────


class AstWalker {
    private graph: Flowchart;

    constructor(graph: Flowchart) {
        this.graph = graph;
    }

    /** Walk a list of statements. Returns the set of "dangling" end node IDs. */
    walkBlock(stmts: any[], prevIds: string[]): string[] {
        let danglers = prevIds;

        for (const stmt of stmts) {
            if (isNoise(stmt)) continue;
            danglers = this.walkNode(stmt, danglers);
        }

        return danglers;
    }

    /** Walk a single AST node. Returns new set of dangling end IDs. */
    walkNode(node: any, prevIds: string[]): string[] {
        if (!node) return prevIds;

        switch (node.type) {

            // ── Function / Arrow Function ───────────────────────────────────────────
            case 'FunctionDeclaration':
            case 'FunctionExpression': {
                const fname = node.id?.name ?? 'anonymous';
                const startId = this.graph.newId();
                const endId = this.graph.newId();
                this.graph.addNode(startId, `${fname}()`, 'start');
                this.graph.addNode(endId, `end ${fname}`, 'terminal');

                for (const p of prevIds) this.graph.addEdge(p, startId);

                const bodyDanglers = this.walkBlock(node.body?.body ?? [], [startId]);
                for (const d of bodyDanglers) this.graph.addEdge(d, endId);

                return [endId];
            }

            // ── Arrow Function Expression ───────────────────────────────────────────
            case 'ArrowFunctionExpression': {
                const body = node.body;
                if (body.type === 'BlockStatement') {
                    return this.walkBlock(body.body, prevIds);
                }
                // Implicit return expression — treat as a process
                const id = this.graph.newId();
                this.graph.addNode(id, 'return ' + srcLabel(body), 'terminal');
                for (const p of prevIds) this.graph.addEdge(p, id);
                return [id];
            }

            // ── Variable declaration that holds a function ──────────────────────────
            case 'VariableDeclaration': {
                let danglers = prevIds;
                for (const decl of node.declarations) {
                    if (
                        decl.init?.type === 'ArrowFunctionExpression' ||
                        decl.init?.type === 'FunctionExpression'
                    ) {
                        const fname = decl.id?.name ?? 'fn';
                        const startId = this.graph.newId();
                        const endId = this.graph.newId();
                        this.graph.addNode(startId, `${fname}()`, 'start');
                        this.graph.addNode(endId, `end ${fname}`, 'terminal');
                        for (const p of danglers) this.graph.addEdge(p, startId);
                        const bodyStmts = decl.init.body?.body ?? [];
                        const bodyDanglers = this.walkBlock(bodyStmts, [startId]);
                        for (const d of bodyDanglers) this.graph.addEdge(d, endId);
                        danglers = [endId];
                    }
                }
                return danglers;
            }

            // ── If / Else ───────────────────────────────────────────────────────────
            case 'IfStatement': {
                const condLabel = srcLabel(node.test);
                const ifId = this.graph.newId();
                this.graph.addNode(ifId, condLabel, 'decision');
                for (const p of prevIds) this.graph.addEdge(p, ifId);

                // Then branch
                const thenStmts = node.consequent?.type === 'BlockStatement'
                    ? node.consequent.body
                    : [node.consequent];
                const thenEnd = this.walkBlock(thenStmts, []);
                const thenId = this.graph.newId();
                this.graph.addNode(thenId, 'true', 'process');
                this.graph.addEdge(ifId, thenId, 'Yes');
                const thenFinal = this.walkBlock(thenStmts, [thenId]);

                // Else branch
                let elseFinal: string[] = [];
                const elseId = this.graph.newId();
                if (node.alternate) {
                    this.graph.addNode(elseId, 'false', 'process');
                    this.graph.addEdge(ifId, elseId, 'No');
                    const elseStmts = node.alternate?.type === 'BlockStatement'
                        ? node.alternate.body
                        : [node.alternate];
                    elseFinal = this.walkBlock(elseStmts, [elseId]);
                } else {
                    // No else: ifId itself is a dangler via the No branch
                    elseFinal = [ifId];
                }

                // Merge: all danglers from both branches pass through to next
                void thenEnd; // suppress unused warning
                return [...thenFinal, ...elseFinal];
            }

            // ── Switch / Case ───────────────────────────────────────────────────────
            case 'SwitchStatement': {
                const switchId = this.graph.newId();
                this.graph.addNode(switchId, `switch(${srcLabel(node.discriminant)})`, 'decision');
                for (const p of prevIds) this.graph.addEdge(p, switchId);

                const allEnds: string[] = [];
                for (const cas of node.cases) {
                    const caseLabel = cas.test ? `case ${srcLabel(cas.test)}` : 'default';
                    const caseId = this.graph.newId();
                    this.graph.addNode(caseId, caseLabel, 'process');
                    this.graph.addEdge(switchId, caseId, caseLabel);
                    const caseEnd = this.walkBlock(cas.consequent, [caseId]);
                    allEnds.push(...caseEnd);
                }
                return allEnds;
            }

            // ── For / While ─────────────────────────────────────────────────────────
            case 'ForStatement':
            case 'ForInStatement':
            case 'ForOfStatement':
            case 'WhileStatement':
            case 'DoWhileStatement': {
                const loopCond = node.test ? srcLabel(node.test) :
                    node.left ? `${srcLabel(node.left)} in ${srcLabel(node.right)}` :
                        'loop';
                const loopId = this.graph.newId();
                this.graph.addNode(loopId, loopCond, 'decision');
                for (const p of prevIds) this.graph.addEdge(p, loopId);

                const body = node.body?.type === 'BlockStatement' ? node.body.body : [node.body];
                const bodyEnd = this.walkBlock(body, [loopId]);

                // Back edge: body end → loop condition
                for (const b of bodyEnd) this.graph.addEdge(b, loopId, 'repeat');

                // Loop exit
                const exitId = this.graph.newId();
                this.graph.addNode(exitId, 'exit loop', 'process');
                this.graph.addEdge(loopId, exitId, 'No');
                return [exitId];
            }

            // ── Try / Catch / Finally ───────────────────────────────────────────────
            case 'TryStatement': {
                const tryId = this.graph.newId();
                this.graph.addNode(tryId, 'try block', 'process');
                for (const p of prevIds) this.graph.addEdge(p, tryId);

                const tryEnd = this.walkBlock(node.block?.body ?? [], [tryId]);

                const catchEnds: string[] = [];
                if (node.handler) {
                    const catchId = this.graph.newId();
                    const errName = node.handler.param?.name ?? 'error';
                    this.graph.addNode(catchId, `catch(${errName})`, 'decision');
                    for (const t of tryEnd) this.graph.addEdge(t, catchId, 'error');
                    const ce = this.walkBlock(node.handler.body?.body ?? [], [catchId]);
                    catchEnds.push(...ce);
                }

                const finalEnd: string[] = [];
                if (node.finalizer) {
                    const finId = this.graph.newId();
                    this.graph.addNode(finId, 'finally', 'process');
                    for (const e of [...tryEnd, ...catchEnds]) this.graph.addEdge(e, finId);
                    const fe = this.walkBlock(node.finalizer?.body ?? [], [finId]);
                    finalEnd.push(...fe);
                }

                return finalEnd.length ? finalEnd : [...tryEnd, ...catchEnds];
            }

            // ── Return Statement ────────────────────────────────────────────────────
            case 'ReturnStatement': {
                const retId = this.graph.newId();
                const label = node.argument ? `return ${srcLabel(node.argument)}` : 'return';
                this.graph.addNode(retId, label, 'terminal');
                for (const p of prevIds) this.graph.addEdge(p, retId);
                return []; // Terminal: no outgoing danglers
            }

            // ── Throw Statement ─────────────────────────────────────────────────────
            case 'ThrowStatement': {
                const throwId = this.graph.newId();
                this.graph.addNode(throwId, `throw ${srcLabel(node.argument)}`, 'terminal');
                for (const p of prevIds) this.graph.addEdge(p, throwId);
                return [];
            }

            // ── Expression Statement (function calls etc.) ──────────────────────────
            case 'ExpressionStatement': {
                const expr = node.expression;
                if (isTrivialCall(expr)) return prevIds;
                const callId = this.graph.newId();
                let label = 'expression';

                if (expr.type === 'CallExpression') {
                    label = callLabel(expr);
                } else if (expr.type === 'AssignmentExpression') {
                    label = `${srcLabel(expr.left)} = ${srcLabel(expr.right)}`;
                } else if (expr.type === 'AwaitExpression' && expr.argument?.type === 'CallExpression') {
                    label = `await ${callLabel(expr.argument)}`;
                }

                label = label.substring(0, 60);
                this.graph.addNode(callId, label, isIOCall(expr) ? 'io' : 'process');
                for (const p of prevIds) this.graph.addEdge(p, callId);
                return [callId];
            }

            // ── Block Statement ─────────────────────────────────────────────────────
            case 'BlockStatement':
                return this.walkBlock(node.body, prevIds);

            default:
                return prevIds;
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function srcLabel(node: any): string {
    if (!node) return '';
    switch (node.type) {
        case 'Identifier': return node.name;
        case 'StringLiteral': return `"${node.value?.substring(0, 30)}"`;
        case 'NumericLiteral': return String(node.value);
        case 'BooleanLiteral': return String(node.value);
        case 'NullLiteral': return 'null';
        case 'TemplateLiteral': return '`...`';
        case 'BinaryExpression': return `${srcLabel(node.left)} ${node.operator} ${srcLabel(node.right)}`;
        case 'LogicalExpression': return `${srcLabel(node.left)} ${node.operator} ${srcLabel(node.right)}`;
        case 'UnaryExpression': return `${node.operator}${srcLabel(node.argument)}`;
        case 'MemberExpression': return `${srcLabel(node.object)}.${srcLabel(node.property)}`;
        case 'CallExpression': return callLabel(node);
        case 'AssignmentExpression': return `${srcLabel(node.left)} ${node.operator} ${srcLabel(node.right)}`;
        default: return node.type ?? '';
    }
}

function callLabel(call: any): string {
    const callee = call.callee;
    let name = '';
    if (callee.type === 'Identifier') name = callee.name;
    else if (callee.type === 'MemberExpression') name = `${srcLabel(callee.object)}.${srcLabel(callee.property)}`;
    else name = srcLabel(callee);
    const args = (call.arguments ?? []).slice(0, 2).map(srcLabel).join(', ');
    return `${name}(${args})`;
}

const IO_PREFIXES = ['fetch', 'axios', 'http', 'request', 'db', 'dao', 'sql',
    'invoke', 'read', 'write', 'open', 'close', 'send', 'receive', 'load', 'save'];

function isIOCall(expr: any): boolean {
    const label = callLabel(expr).toLowerCase();
    return IO_PREFIXES.some(p => label.startsWith(p));
}

// ── Top-level test/describe detection ─────────────────────────────────────────

function getTestBlocks(ast: any): Array<{ name: string; callback: any }> {
    const blocks: Array<{ name: string; callback: any }> = [];
    for (const node of ast.program?.body ?? []) {
        if (node.type !== 'ExpressionStatement') continue;
        const expr = node.expression;
        if (expr.type !== 'CallExpression') continue;
        const fname = srcLabel(expr.callee);
        if (['test', 'it', 'describe'].includes(fname)) {
            const nameArg = expr.arguments?.[0];
            const cbArg = expr.arguments?.[1];
            if (nameArg && cbArg) {
                blocks.push({ name: srcLabel(nameArg), callback: cbArg });
            }
        }
    }
    return blocks;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface AnalysisResult {
    mermaid: string;
    error?: string;
}

export function analyzeCode(source: string): AnalysisResult {
    // ── Route Java code to the dedicated Java parser ───────────────────────────
    if (looksLikeJava(source)) {
        const javaResult = analyzeJava(source);
        return { mermaid: javaResult.mermaid, error: javaResult.error };
    }

    const BASE_OPTS = {
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        errorRecovery: false,
        plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'] as any[],
    };

    // Try multiple sourceType strategies: module → script → unambiguous
    let ast: any = null;
    let lastError = '';
    for (const sourceType of ['module', 'script', 'unambiguous'] as const) {
        try {
            ast = babelParser.parse(source, { ...BASE_OPTS, sourceType });
            break;
        } catch (e: any) {
            lastError = e.message ?? String(e);
        }
    }

    // Final fallback: strip 'use strict' header and retry as script
    if (!ast) {
        const stripped = source.replace(/^['"]use strict['"];?\s*\n?/, '');
        try {
            ast = babelParser.parse(stripped, { ...BASE_OPTS, sourceType: 'script' });
        } catch (e: any) {
            return { mermaid: '', error: lastError };
        }
    }

    const graph = new Flowchart();
    const walker = new AstWalker(graph);

    // Check if it's a test-suite file (tape, mocha, jest)
    const testBlocks = getTestBlocks(ast);

    if (testBlocks.length > 0) {
        // Each test() block becomes its own subgraph
        const lines: string[] = ['flowchart TD'];

        for (let ti = 0; ti < testBlocks.length; ti++) {
            const block = testBlocks[ti];
            const subGraph = new Flowchart();
            const subWalker = new AstWalker(subGraph);

            const startId = subGraph.newId();
            subGraph.addNode(startId, `test: ${block.name.substring(0, 40)}`, 'start');

            const bodyStmts = block.callback.body?.body ?? [];
            const ends = subWalker.walkBlock(bodyStmts, [startId]);

            const endId = subGraph.newId();
            subGraph.addNode(endId, 't.end', 'terminal');
            for (const e of ends) subGraph.addEdge(e, endId);

            // Emit as subgraph
            const subId = `SG${ti}`;
            const safeName = block.name.replace(/"/g, "'").replace(/[^a-zA-Z0-9 _\-\.]/g, '').substring(0, 50);
            const sub = subGraph.toMermaid()
                .split('\n')
                .slice(1) // remove 'flowchart TD' header
                .map(l => '    ' + l)
                .join('\n');
            lines.push(`  subgraph ${subId} ["${safeName}"]`);
            lines.push(sub);
            lines.push('  end');
        }

        return { mermaid: lines.join('\n') };
    }

    // Normal file: walk top-level declarations
    const startId = graph.newId();
    graph.addNode(startId, 'start', 'start');
    walker.walkBlock(ast.program?.body ?? [], [startId]);

    return { mermaid: graph.toMermaid() };
}
