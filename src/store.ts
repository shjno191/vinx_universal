import { ref } from 'vue';

export const theme = ref<'light' | 'dark'>('dark');

export const sharedInput = ref('');
export const sharedOutput = ref('');
export const sharedTargetLang = ref<'en' | 'jp' | 'vi'>('jp');
export const triggerDictionaryFocus = ref(0);
export const triggerOpenFile = ref(0);
export const showSettingsTrigger = ref<{ category?: string } | null>(null);
export const projectRootPath = ref('');

export interface EditorSettings {
    middleClickClose: boolean;
    doubleClickNewTab: boolean;
    mouseNavHistory: boolean;
}

export const editorSettings = ref<EditorSettings>({
    middleClickClose: true,
    doubleClickNewTab: true,
    mouseNavHistory: true
});

export interface CursorPosition {
    tabId: string;
    line: number;
    column: number;
}

export const cursorHistory = ref<CursorPosition[]>([]);
export const cursorHistoryIndex = ref(-1);
export const globalShortcuts = ref({
    focus_search: 'ctrl+f',
    open_settings: 'ctrl+shift+s',
    open_file: 'ctrl+o'
});

//  AI / Flow Chart State 

export type AiProvider = 'gemini' | 'openai' | 'claude' | 'ollama';

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

export const aiSettings = ref<AiSettings>({
    provider: 'gemini',
    geminiKey: '',
    geminiModel: 'gemini-1.5-flash',
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    claudeKey: '',
    claudeModel: 'claude-3-haiku-20240307',
    ollamaUrl: 'http://localhost:11434/api/generate',
    ollamaModel: 'llama3',
});

// The code that will be analyzed for flow chart generation
export const currentFlowCode = ref('');

// Signal to auto-navigate to the Flow Chart tab
export const triggerFlowChart = ref(false);

// Flow Chart Persistence
export const mermaidCode = ref('');
export const analysisMode = ref<'code' | 'ai'>('code');
export const showRawFlowCode = ref(false);

// Git / Source Control State
export interface GitFile {
    path: string;
    name: string;
    status: 'M' | 'A' | 'D' | '??'; // Modified, Added, Deleted, Untracked
    staged: boolean;
}

export const gitStatus = ref<GitFile[]>([]);
export const triggerOpenDiff = ref<{ path: string; name: string; original: string; modified: string; label: string } | null>(null);
