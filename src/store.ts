import { ref } from 'vue';

export const sharedInput = ref('');
export const sharedOutput = ref('');
export const sharedTargetLang = ref<'en' | 'jp' | 'vi'>('jp');
