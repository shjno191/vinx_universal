<script setup lang="ts">
import { ref, reactive, onMounted, watch, nextTick } from "vue";

import { globalShortcuts, showSettingsTrigger, triggerDictionaryFocus, triggerFlowChart, projectRootPath, gitTabRepoPath, triggerCloseModals, chillSettings, triggerFlick, globalSearchQuery } from "./store";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import SQLHelper from "./components/SQLHelper.vue";
import TranslateTab from "./components/TranslateTab.vue";
import CompareTab from "./components/CompareTab.vue";
import EditorTab from "./components/EditorTab.vue";
import SettingsTab from "./components/SettingsTab.vue";
import FlowChartTab from "./components/FlowChartTab.vue";
import GitTab from "./components/GitTab.vue";
import ConvertTab from "./components/ConvertTab.vue";
import SmokeTab from "./components/SmokeTab.vue";
import Cigarette from "./components/Cigarette.vue";
import { isGlobalSmoking } from "./store";

const currentTab = ref("SQL-Helper");
const allTabs = ["SQL-Helper", "Translate", "ConvertUI", "Compare", "Editor", "Git", "FlowChart", "Chill"];
const currentTheme = ref("dark");
const showSettingsModal = ref(false);
const settingsRef = ref<any>(null);
const globalSearchInputRef = ref<HTMLInputElement | null>(null);
let lastCtrlFTime = 0;

// Lazy loading tabs: using reactive object for better stability than Set patching
const initializedTabs = reactive<Record<string, boolean>>({
  "SQL-Helper": true
});

watch(currentTab, (newTab) => {
  if (!initializedTabs[newTab]) {
    initializedTabs[newTab] = true;
  }
}, { immediate: true });

const chillWidgetRef = ref<any>(null);

const handleChillShortcuts = (e: KeyboardEvent, isDown: boolean) => {
  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
  if (isInput) return;

  // Flick Ash: Ctrl + Space
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    if (isDown) {
      triggerFlick.value++;
    }
    return;
  }

  // Smoke: Space (Hold)
  if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    if (isDown) {
      isGlobalSmoking.value = true;
    } else {
      isGlobalSmoking.value = false;
    }
  }
};

// Tab History for Mouse 4/5
const tabHistory = ref<string[]>(["SQL-Helper"]);
const tabHistoryIndex = ref(0);
let isNavigatingHistory = false;

watch(currentTab, (newTab) => {
  if (isNavigatingHistory) return;
  
  // If we were in the middle of history and clicked a new tab, truncate forward history
  if (tabHistoryIndex.value < tabHistory.value.length - 1) {
    tabHistory.value = tabHistory.value.slice(0, tabHistoryIndex.value + 1);
  }
  
  // Don't add if it's the same as current (redundant)
  if (tabHistory.value[tabHistoryIndex.value] === newTab) return;
  
  tabHistory.value.push(newTab);
  tabHistoryIndex.value = tabHistory.value.length - 1;
});

const handleMouseUp = (e: MouseEvent) => {
  // Mouse buttons: 3 = Back, 4 = Forward
  if (e.button === 3) {
    // Back
    if (tabHistoryIndex.value > 0) {
      tabHistoryIndex.value--;
      isNavigatingHistory = true;
      currentTab.value = tabHistory.value[tabHistoryIndex.value];
      nextTick(() => { isNavigatingHistory = false; });
    }
  } else if (e.button === 4) {
    // Forward
    if (tabHistoryIndex.value < tabHistory.value.length - 1) {
      tabHistoryIndex.value++;
      isNavigatingHistory = true;
      currentTab.value = tabHistory.value[tabHistoryIndex.value];
      nextTick(() => { isNavigatingHistory = false; });
    }
  }
};

const matchShortcut = (e: KeyboardEvent, shortcutStr: string) => {
  if (!shortcutStr) return false;
  const parts = shortcutStr.toLowerCase().split('+');
  const key = parts.pop();
  const ctrl = parts.includes('ctrl');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const meta = parts.includes('meta');
  
  return e.key.toLowerCase() === key &&
         e.ctrlKey === ctrl &&
         e.shiftKey === shift &&
         e.altKey === alt &&
         e.metaKey === meta;
};

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    showSettingsModal.value = false;
    triggerCloseModals.value++;
  }
  
  if (matchShortcut(e, globalShortcuts.value.focus_search)) {
    e.preventDefault();
    triggerDictionaryFocus.value++;
  }

  if (matchShortcut(e, globalShortcuts.value.open_settings)) {
    e.preventDefault();
    // Context aware category
    let cat = 'general';
    if (currentTab.value === 'Translate') cat = 'translate';
    
    showSettingsModal.value = true;
    showSettingsTrigger.value = { category: cat };
  }

  // Tab switching (only if not in input)
  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
  if (!isInput) {
    if (matchShortcut(e, globalShortcuts.value.prev_tab)) {
      e.preventDefault();
      const idx = allTabs.indexOf(currentTab.value);
      const nextIdx = (idx - 1 + allTabs.length) % allTabs.length;
      currentTab.value = allTabs[nextIdx];
    }
    if (matchShortcut(e, globalShortcuts.value.next_tab)) {
      e.preventDefault();
      const idx = allTabs.indexOf(currentTab.value);
      const nextIdx = (idx + 1) % allTabs.length;
      currentTab.value = allTabs[nextIdx];
    }
  }

  handleChillShortcuts(e, true);

  // Ctrl+F+F logic
  if (e.ctrlKey && e.key.toLowerCase() === 'f') {
    e.preventDefault(); // Block browser search always when Ctrl+F is pressed
    const now = Date.now();
    if (now - lastCtrlFTime < 500) {
      // Double tap detected
      globalSearchInputRef.value?.focus();
      globalSearchInputRef.value?.select();
      lastCtrlFTime = 0; 
    } else {
      // First tap: trigger nothing yet, just mark time
      lastCtrlFTime = now;
    }
    return; // Don't proceed to chill shortcuts etc for this key
  } else {
    // Escape to clear global search or blur focused input
    if (e.key === 'Escape') {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      
      if (isInput) {
        (activeEl as HTMLElement).blur();
      }

      if (globalSearchQuery.value) {
        globalSearchQuery.value = '';
      }
    }
    // Any other key reset the timer
    lastCtrlFTime = 0;
  }
};

const handleKeyUpGlobal = (e: KeyboardEvent) => {
  handleChillShortcuts(e, false);
};



watch(showSettingsTrigger, (val) => {
  if (val && val.category) {
    showSettingsModal.value = true;
  }
});

// Watch for Flow Chart trigger from EditorTab
watch(triggerFlowChart, (val) => {
  if (val) {
    currentTab.value = 'FlowChart';
    triggerFlowChart.value = false; // reset
  }
});

const loadInitialSettings = async () => {
  try {
    const raw = await invoke("get_settings") as string;
    const s = JSON.parse(raw || "{}");
    currentTheme.value = s.theme || 'dark';
    if (s.shortcuts) {
      globalShortcuts.value = { ...globalShortcuts.value, ...s.shortcuts };
    }
    if (s.last_project_root) projectRootPath.value = s.last_project_root;
    if (s.last_git_repo) gitTabRepoPath.value = s.last_git_repo;
    applyTheme(s.theme || 'dark');
  } catch (e) {
    console.error("Failed to load initial settings", e);
  }
};

const applyTheme = (theme: string) => {
  currentTheme.value = theme;
  // Remove existing theme classes
  document.documentElement.classList.remove("theme-95", "theme-light", "theme-dark");
  // Add the new one
  if (theme === "95") document.documentElement.classList.add("theme-95");
  else if (theme === "light") document.documentElement.classList.add("theme-light");
  else document.documentElement.classList.add("theme-dark"); // Default/Dark
};

const handleThemeChanged = (newTheme: string) => {
  applyTheme(newTheme);
};

const checkForUpdates = async () => {
  try {
    // 1. Check daily cooldown
    const lastCheck = localStorage.getItem("last_update_check_date");
    const today = new Date().toDateString();
    
    if (lastCheck === today) {
      console.log("Update check skipped: already checked today.");
      return;
    }

    // 2. Check for update
    const update = await check();
    if (update) {
      const yes = await ask(
        `A new version (${update.version}) is available. Release notes: ${update.body}\n\nDo you want to update now?`,
        { title: "Update Available", kind: "info" }
      );

      if (yes) {
        await update.downloadAndInstall();
        await relaunch();
      } else {
        // User declined, save the date to avoid prompting again today
        localStorage.setItem("last_update_check_date", today);
      }
    }
  } catch (e) {
    console.error("Failed to check for updates:", e);
  }
};

// Global persistence for paths
watch([projectRootPath, gitTabRepoPath], async ([newRoot, newGit]) => {
  try {
    const raw = await invoke("get_settings") as string;
    const s = JSON.parse(raw || "{}");
    
    // Only save if something actually changed to avoid redundant writes
    if (s.last_project_root === newRoot && s.last_git_repo === newGit) return;
    
    const newSettings = { 
      ...s, 
      last_project_root: newRoot,
      last_git_repo: newGit 
    };
    await invoke("save_settings", { settings: JSON.stringify(newSettings, null, 2) });
  } catch (e) {
    console.error("Failed to auto-save paths:", e);
  }
}, { flush: 'post' });

onMounted(() => {
  loadInitialSettings();
  checkForUpdates();
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keyup", handleKeyUpGlobal);
  window.addEventListener("mouseup", handleMouseUp);
});
</script>

<template>
  <div class="app-container" :class="{ 'win95-bg': currentTheme === '95' }">
    <nav class="tabs-nav" :class="{ 'win95-tabs': currentTheme === '95' }">
      <div class="tabs-list">
        <button 
          @click="currentTab = 'SQL-Helper'" 
          :class="{ 'active': currentTab === 'SQL-Helper', 'win95-button': currentTheme === '95' }"
        >
          SQL-Helper
        </button>
        <button 
          @click="currentTab = 'Translate'" 
          :class="{ 'active': currentTab === 'Translate', 'win95-button': currentTheme === '95' }"
        >
          Translate
        </button>
        <button 
          @click="currentTab = 'ConvertUI'" 
          :class="{ 'active': currentTab === 'ConvertUI', 'win95-button': currentTheme === '95' }"
        >
          CONVERT UI
        </button>
        <button 
          @click="currentTab = 'Compare'" 
          :class="{ 'active': currentTab === 'Compare', 'win95-button': currentTheme === '95' }"
        >
          Compare
        </button>
        <button 
          @click="currentTab = 'Editor'" 
          :class="{ 'active': currentTab === 'Editor', 'win95-button': currentTheme === '95' }"
        >
          Editor
        </button>
        <button 
          @click="currentTab = 'Git'" 
          :class="{ 'active': currentTab === 'Git', 'win95-button': currentTheme === '95', 'git-tab-btn': true }"
        >
          GIT
        </button>
        <button 
          @click="currentTab = 'FlowChart'" 
          :class="{ 'active': currentTab === 'FlowChart', 'win95-button': currentTheme === '95', 'flow-tab': true }"
        >
          Flow Chart
        </button>
        <button 
          @click="currentTab = 'Chill'" 
          :class="{ 'active': currentTab === 'Chill', 'win95-button': currentTheme === '95', 'chill-tab': true }"
        >
          Chill
        </button>
      </div>
      <div class="nav-actions">
        <div class="global-search-wrapper">
          <input 
            ref="globalSearchInputRef"
            v-model="globalSearchQuery" 
            placeholder="Global search (Ctrl+F+F)" 
            class="global-search-input"
          />
          <button 
            v-if="globalSearchQuery" 
            class="clear-search-btn" 
            @click="globalSearchQuery = ''"
          >
            &times;
          </button>
        </div>
        <button @click="showSettingsModal = true" class="icon-btn settings-btn" title="Settings">&#9881;&#65039;</button>
      </div>
    </nav>

    <main class="content-wrapper full-bleed">
      <div class="content-scroll-area full-bleed" :class="{ 'win95-border': currentTheme === '95' }">
        <div v-if="initializedTabs['SQL-Helper']" v-show="currentTab === 'SQL-Helper'" key="tab-sql" class="full-height-vif">
          <SQLHelper :theme="currentTheme" />
        </div>
        <div v-if="initializedTabs['Translate']" v-show="currentTab === 'Translate'" key="tab-translate" class="full-height-vif">
          <TranslateTab />
        </div>
        <div v-if="initializedTabs['ConvertUI']" v-show="currentTab === 'ConvertUI'" key="tab-convert" class="full-height-vif">
          <ConvertTab />
        </div>
        <div v-if="initializedTabs['Compare']" v-show="currentTab === 'Compare'" key="tab-compare" class="full-height-vif">
          <CompareTab />
        </div>
        <div v-if="initializedTabs['Editor']" v-show="currentTab === 'Editor'" key="tab-editor" class="full-height-vif">
          <EditorTab />
        </div>
        <div v-if="initializedTabs['Git']" v-show="currentTab === 'Git'" key="tab-git" class="full-height-vif">
          <GitTab />
        </div>
        <div v-if="initializedTabs['FlowChart']" v-show="currentTab === 'FlowChart'" key="tab-flow" class="full-height-vif">
          <FlowChartTab />
        </div>
        <div v-if="initializedTabs['Chill']" v-show="currentTab === 'Chill'" key="tab-chill" class="full-height-vif">
          <SmokeTab />
        </div>
      </div>
    </main>

    <Teleport to="body">
      <div v-if="showSettingsModal" class="modal-overlay" @mousedown.self="showSettingsModal = false">
        <div class="modal-content settings-modal-content" :class="{ 'win95-border': currentTheme === '95' }">
          <div class="modal-header">
            <span>Settings</span>
            <div class="header-tools">
              <button @click="settingsRef?.refreshSettings()" class="tool-btn" title="Refresh Settings">&#128260;</button>
              <button @click="settingsRef?.openSettingsFile()" class="tool-btn" title="Open Config File">&#128194;</button>
              <button @click="showSettingsModal = false" class="close-btn">&times;</button>
            </div>
          </div>
          <div class="modal-body settings-modal-body">
            <SettingsTab ref="settingsRef" @theme-changed="handleThemeChanged" />
          </div>
        </div>
      </div>
    </Teleport>

        <Teleport to="body">
      <div v-if="chillSettings && chillSettings.enableWidget" class="chill-widget-container">
        <Cigarette ref="chillWidgetRef" :is-widget="true" :force-smoking="isGlobalSmoking" />
      </div>
    </Teleport>

  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* Prevent global scroll */
}

#app {
  height: 100%;
}
/* Chill Widget Styles */
.chill-widget-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  pointer-events: none; /* Let clicks pass through if not interacting directly */
  filter: drop-shadow(0 10px 15px rgba(0,0,0,0.5));
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-color);
}


.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}


.icon-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.icon-btn:hover {
  background-color: var(--button-hover);
}

.tabs-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  background-color: var(--bg-color);
  flex-shrink: 0;
  height: 35px;
  border-bottom: var(--border-style);
}

.tabs-list {
  display: flex;
  gap: 5px;
}

.nav-actions {
  display: flex;
  align-items: center;
}

.tabs-nav button {
  padding: 6px 15px;
  cursor: pointer;
  background: transparent;
  color: var(--text-color);
  border: none;
  border-bottom: 2px solid transparent;
  font-weight: bold;
}

.tabs-nav button.active {
  border-bottom: 2px solid var(--accent-color);
  color: var(--accent-color);
}

.tabs-nav .flow-tab {
  color: #a78bfa;
}

.tabs-nav .flow-tab.active {
  border-bottom-color: #a78bfa;
  color: #a78bfa;
}

.tabs-nav .git-tab-btn {
  color: #34d399;
}

.tabs-nav .git-tab-btn.active {
  border-bottom-color: #34d399;
  color: #34d399;
}

.tabs-nav .chill-tab {
  color: #f43f5e;
}

.tabs-nav .chill-tab.active {
  border-bottom-color: #f43f5e;
  color: #f43f5e;
}

.content-wrapper {
  flex: 1;
  overflow: hidden; 
  padding: 10px 15px;
  display: flex;
  flex-direction: column;
}

.content-wrapper.no-padding {
  padding: 0;
}

.content-scroll-area {
  flex: 1;
  overflow-y: auto; 
  padding: 5px;
  background-color: var(--container-bg);
  border: var(--border-style);
  border-radius: var(--border-radius);
}

.content-scroll-area.full-bleed {
  padding: 0;
  overflow: hidden;
  border: none;
  height: 100%;
}

.full-height-vif {
  height: 100%;
  position: relative; /* Essential for absolute-positioned children like SQLHelper */
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}

.modal-content {
  background: var(--container-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.settings-modal-content {
  width: 850px;
  max-width: 95%;
  max-height: 90vh;
}

.modal-header {
  padding: 10px 15px;
  background: var(--accent-color);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, background 0.2s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.settings-modal-body {
  padding: 0;
  overflow: hidden;
}


.theme-button {
  background-color: var(--button-bg);
  color: var(--text-color);
  border: var(--border-style);
  border-radius: var(--border-radius);
  padding: 8px 16px;
  cursor: pointer;
}

/* Win95 Variations */
.win95-bg {
  /* No special padding needed without taskbar */
}

.win95-tabs button {
  border: 2px solid;
  border-top-color: #fff;
  border-left-color: #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  background: #c0c0c0;
  color: #000;
  border-radius: 0;
}

.win95-tabs button.active {
  border-top-color: #808080;
  border-left-color: #808080;
  border-right-color: #fff;
  border-bottom-color: transparent;
  background: #c0c0c0;
  transform: translateY(2px);
}


:root.theme-95 .modal-content {
  background: #c0c0c0;
  color: #000;
  border-radius: 0;
}

:root.theme-95 .modal-header {
  background: #000080;
}

:root.theme-95 .theme-button {
  border: 2px solid;
  border-top-color: #fff;
  border-left-color: #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  background: #c0c0c0;
  color: #000;
  border-radius: 0;
}
</style>
