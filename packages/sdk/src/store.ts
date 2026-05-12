import { ref, shallowRef, watch } from 'vue';
import type { 
    EditorSettings, 
    CursorPosition, 
    AiSettings, 
    GitFile, 
    GitBranch, 
    GitCompareRequest, 
    SystemControl, 
    ChillSettings, 
    ContextMenuState, 
    TabContextMenuState,
    TranslateSettings
} from './types';

export type { GitFile, GitBranch };

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


export const editorSettings = ref<EditorSettings>({
    middleClickClose: true,
    doubleClickNewTab: true,
    mouseNavHistory: true,
    indentSize: 4,
    insertSpaces: true,
    renderWhitespace: false
});




export const cursorHistory = shallowRef<CursorPosition[]>([]);
export const cursorHistoryIndex = ref(-1);
export const globalShortcuts = ref({

    open_settings: 'ctrl+shift+s',
    open_file: 'ctrl+o',
    prev_tab: 'ctrl+arrowleft',
    next_tab: 'ctrl+arrowright'
});

//  AI / Flow Chart State 



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

export const gitStatus = shallowRef<GitFile[]>([]);
export const triggerOpenDiff = ref<{ path: string; name: string; original: string; modified: string; label: string } | null>(null);

// Standalone GIT Tab state
export const gitBranches = shallowRef<GitBranch[]>([]);
export const gitTabRepoPath = ref<string>('');
export const triggerGitRefresh = ref(0);
export const triggerEditorReload = ref(0);
export const triggerCloseModals = ref(0);

export const activeContextMenu = ref<ContextMenuState | null>(null);
export const hiddenExplorerPaths = ref<string[]>([]);
export const selectedExplorerPaths = ref<Set<string>>(new Set());
export const lastSelectedPath = ref<string>('');




// Editor: compare file with git   
export const gitCompareRequest = ref<GitCompareRequest | null>(null);
export const activeTabContextMenu = ref<TabContextMenuState | null>(null);

//  Chill / Smoking Settings 

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

export const systemControlSettings = ref<SystemControl[]>([]);

export const globalDictionaryPath = ref('');
export const advancedTranslatePaths = ref<string[]>([]);

export const translateSettings = ref<TranslateSettings>({
    baseHighlightColor: '#3b82f6', // Soft Blue
    techHighlightColor: '#eab308', // Soft Yellow/Gold
    composedHighlightColor: '#10b981' // Green
});

export const loadingTheme = ref<'cute' | 'premium' | 'retro' | 'cyber' | 'nature' | 'orbit'>('cute');

// --- Sync Logic -------------------------------------------------------------
// Ensure Editor and Git tab always use the same repository path
watch(projectRootPath, (newVal) => {
    if (newVal) {
        const normalized = newVal.replace(/\\/g, '/');
        if (gitTabRepoPath.value !== normalized) {
            gitTabRepoPath.value = normalized;
        }
    }
});

watch(gitTabRepoPath, (newVal) => {
    if (newVal) {
        const normalized = newVal.replace(/\\/g, '/');
        if (projectRootPath.value !== normalized) {
            projectRootPath.value = normalized;
        }
    }
});


