import { ref, reactive, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { 
  globalShortcuts, 
  projectRootPath, 
  gitTabRepoPath, 
  advancedTranslateGroups,
  globalDictionaryPath,
  loadingTheme,
  aiSettings,
  editorSettings,
  chillSettings,
  activeTab,
  useSettings
} from '@vinx/sdk';
import { matchShortcut } from '../utils/keyboard';

export function useAppShell() {
  const { settings } = useSettings();
  const currentTab = ref('');
  const allTabs = ref<string[]>([]);
  
  const currentTheme = ref('dark');
  const showSettingsModal = ref(false);
  
  const initializedTabs = reactive<Record<string, boolean>>({});

  // Tab History management
  const tabHistory = ref<string[]>([]);
  const tabHistoryIndex = ref(0);
  let isNavigatingHistory = false;

  watch(currentTab, (newTab) => {
    activeTab.value = newTab;
    if (isNavigatingHistory) return;

    if (tabHistoryIndex.value < tabHistory.value.length - 1) {
      tabHistory.value = tabHistory.value.slice(0, tabHistoryIndex.value + 1);
    }

    if (tabHistory.value[tabHistoryIndex.value] === newTab) return;

    tabHistory.value.push(newTab);
    tabHistoryIndex.value = tabHistory.value.length - 1;

    if (!initializedTabs[newTab]) {
      initializedTabs[newTab] = true;
    }
  }, { immediate: true });

  const navigateBack = () => {
    if (tabHistoryIndex.value > 0) {
      tabHistoryIndex.value--;
      isNavigatingHistory = true;
      currentTab.value = tabHistory.value[tabHistoryIndex.value];
      nextTick(() => { isNavigatingHistory = false; });
    }
  };

  const navigateForward = () => {
    if (tabHistoryIndex.value < tabHistory.value.length - 1) {
      tabHistoryIndex.value++;
      isNavigatingHistory = true;
      currentTab.value = tabHistory.value[tabHistoryIndex.value];
      nextTick(() => { isNavigatingHistory = false; });
    }
  };

  const applyTheme = (theme: string) => {
    currentTheme.value = theme;
    document.documentElement.classList.remove('theme-95', 'theme-light', 'theme-dark');
    if (theme === '95') document.documentElement.classList.add('theme-95');
    else if (theme === 'light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.add('theme-dark');
  };

  const loadSettings = async () => {
    try {
      const raw = await invoke('get_settings') as string;
      const s = JSON.parse(raw || '{}');
      if (!s || Object.keys(s).length === 0) return;

      // Update singleton settings
      settings.value = { ...settings.value, ...s };

      if (s.theme) applyTheme(s.theme);
      if (s.loading_theme) loadingTheme.value = s.loading_theme;
      if (s.shortcuts) {
        globalShortcuts.value = { ...globalShortcuts.value, ...s.shortcuts };
      }
      if (s.last_project_root) projectRootPath.value = s.last_project_root;
      if (s.last_git_repo) gitTabRepoPath.value = s.last_git_repo;
      if (s.dictionary_path) globalDictionaryPath.value = s.dictionary_path;
      if (s.advanced_translate_groups) advancedTranslateGroups.value = s.advanced_translate_groups;
      if (s.ai) aiSettings.value = { ...aiSettings.value, ...s.ai };
      if (s.editor) editorSettings.value = { ...editorSettings.value, ...s.editor };
      if (s.chill) chillSettings.value = { ...chillSettings.value, ...s.chill };
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const saveSettings = async (updates: any) => {
    try {
      // Merge with the latest settings from memory to avoid unnecessary disk reads 
      // when we already have the state. However, to ensure we don't overwrite 
      // settings saved by other parts of the app, we still fetch the latest.
      const raw = await invoke('get_settings') as string;
      const current = JSON.parse(raw || '{}');
      const next = { ...current, ...updates };
      
      // Update local ref first for immediate UI feedback
      settings.value = { ...settings.value, ...updates };
      
      await invoke('save_settings', { settings: JSON.stringify(next, null, 2) });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const checkForUpdates = async () => {
    try {
      const lastCheck = localStorage.getItem('last_update_check_date');
      const today = new Date().toDateString();
      if (lastCheck === today) return;

      const update = await check();
      if (update) {
        const yes = await ask(
          `A new version (${update.version}) is available.\n\nDo you want to update now?`,
          { title: 'Update Available', kind: 'info' }
        );
        if (yes) {
          await update.downloadAndInstall();
          await relaunch();
        } else {
          localStorage.setItem('last_update_check_date', today);
        }
      }
    } catch (e) {
      console.error('Update check failed:', e);
    }
  };


  return {
    currentTab,
    allTabs,
    currentTheme,
    showSettingsModal,
    initializedTabs,
    navigateBack,
    navigateForward,
    applyTheme,
    loadSettings,
    saveSettings,
    checkForUpdates,
    matchShortcut
  };
}
