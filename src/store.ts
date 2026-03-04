import { ref } from 'vue';

export const sharedInput = ref('');
export const sharedOutput = ref('');
export const sharedTargetLang = ref<'en' | 'jp' | 'vi'>('jp');
export const triggerDictionaryFocus = ref(0);
export const triggerOpenFile = ref(0);
export const showSettingsTrigger = ref<{ category?: string } | null>(null);

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
