import { ref } from 'vue';

export const sharedInput = ref('');
export const sharedOutput = ref('');
export const sharedTargetLang = ref<'en' | 'jp' | 'vi'>('jp');
export const triggerDictionaryFocus = ref(0);
export const showSettingsTrigger = ref<{ category?: string } | null>(null);
export const globalShortcuts = ref({
    focus_search: 'ctrl+f',
    open_settings: 'ctrl+shift+s'
});
