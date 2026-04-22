import { ref, shallowRef } from 'vue';

export const theme = ref<'light' | 'dark' | '95'>('dark');

export const sharedInput = ref('');
export const sharedOutput = ref('');
export const translateInput = ref('');
export const translateOutput = ref('');
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

export const cursorHistory = shallowRef<CursorPosition[]>([]);
export const cursorHistoryIndex = ref(-1);
export const globalShortcuts = ref({

    open_settings: 'ctrl+shift+s',
    open_file: 'ctrl+o',
    prev_tab: 'ctrl+arrowleft',
    next_tab: 'ctrl+arrowright'
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

export interface GitBranch {
    name: string;
    isCurrent: boolean;
    isRemote: boolean;
    upstream?: string;
    ahead?: number;
    behind?: number;
}

export const gitStatus = shallowRef<GitFile[]>([]);
export const triggerOpenDiff = ref<{ path: string; name: string; original: string; modified: string; label: string } | null>(null);

// Standalone GIT Tab state
export const gitBranches = shallowRef<GitBranch[]>([]);
export const gitTabRepoPath = ref<string>('');
export const triggerGitRefresh = ref(0);
export const triggerEditorReload = ref(0);
export const triggerCloseModals = ref(0);

export interface ContextMenuState {
    x: number;
    y: number;
    node: any;
}
export const activeContextMenu = ref<ContextMenuState | null>(null);


// Editor: compare file with git   
export interface GitCompareRequest {
    filePath: string;
    fileName: string;
    mode: 'branch' | 'local' | 'commit';
    target?: string; // branch name or commit hash
}
export const gitCompareRequest = ref<GitCompareRequest | null>(null);
export interface TabContextMenuState {
    x: number;
    y: number;
    tab: any;
}
export const activeTabContextMenu = ref<TabContextMenuState | null>(null);

//  Chill / Smoking Settings 
export interface ChillSettings {
    shortcutSmoke: string;
    shortcutFlick: string;
    burnTimeMinutes: number;
    enableWidget: boolean;
}

export const chillSettings = ref<ChillSettings>({
    shortcutSmoke: 'ctrl+space',
    shortcutFlick: 'ctrl+space+space',
    burnTimeMinutes: 5,
    enableWidget: false
});

export const isGlobalSmoking = ref(false);
export const triggerFlick = ref(0);
export const smokedCount = ref(0);
export const triggerSettingsRefresh = ref(0);
export const activeTab = ref('SQL-Helper');

// System Control State
export interface SystemControl {
    controlKey: string;
    section: string;
    controlValue: string | null;
    description: string | null;
}

export const systemControlSettings = ref<SystemControl[]>([]);

export const globalDictionaryPath = ref('');
export const advancedTranslatePaths = ref<string[]>([]);

