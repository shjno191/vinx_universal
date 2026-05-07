import { Component } from 'vue';

export type Theme = 'light' | 'dark' | '95';

export interface PluginManifest {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  version: string;
  author?: string;
}

export interface VinxPlugin {
  manifest: PluginManifest;
  component: Component;
  setup?: (api: VinxApi) => void;
}

export interface VinxApi {
  theme: {
    current: string;
    set: (theme: Theme) => void;
  };
  notifications: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
  storage: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
  };
}

// Re-export common types from the existing store
export interface EditorSettings {
    middleClickClose: boolean;
    doubleClickNewTab: boolean;
    mouseNavHistory: boolean;
    indentSize: number;
    insertSpaces: boolean;
    renderWhitespace: boolean;
}

export interface CursorPosition {
    tabId: string;
    line: number;
    column: number;
}

export interface AiSettings {
    provider: AiProvider;
    geminiKey: string;
    geminiModel: string;
    openaiKey: string;
    openaiModel: string;
    claudeKey: string;
    claudeModel: string;
    ollamaUrl: string;
    ollamaModel: string;
}

export type AiProvider = 'gemini' | 'openai' | 'claude' | 'ollama';

export interface GitFile {
    path: string;
    name: string;
    status: 'M' | 'A' | 'D' | '??';
    staged: boolean;
}

export interface GitBranch {
    name: string;
    isCurrent: boolean;
    isRemote: boolean;
    upstream?: string;
    ahead?: number;
    behind?: number;
}

export interface GitCompareRequest {
    filePath: string;
    fileName: string;
    mode: 'branch' | 'local' | 'commit';
    target?: string;
}

export interface SystemControl {
    key: string;
    section: string;
    value: string | null;
    description: string | null;
}

export interface ChillSettings {
    shortcutSmoke: string;
    shortcutFlick: string;
    burnTimeMinutes: number;
    enableWidget: boolean;
}

export interface ContextMenuState {
    x: number;
    y: number;
    node: any;
}

export interface TabContextMenuState {
    x: number;
    y: number;
    tab: any;
}
