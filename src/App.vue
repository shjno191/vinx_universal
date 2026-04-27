<script setup lang="ts">
import { onMounted, watch, ref as vueRef } from "vue";
import { useAppShell } from "./composables/useAppShell";
import { Icons } from "./utils/icons";
import { 
  projectRootPath, 
  gitTabRepoPath, 
  triggerCloseModals, 
  triggerFlowChart, 
  showSettingsTrigger,
  isGlobalSmoking,
  chillSettings
} from "./store";

// Components
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
import GlobalLoading from "./components/GlobalLoading.vue";

const {
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
} = useAppShell();

const settingsRef = vueRef<any>(null);

// Global Key Listeners
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    showSettingsModal.value = false;
    triggerCloseModals.value++;
    // Blur inputs
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      (activeEl as HTMLElement).blur();
    }
  }

  // Keyboard Shortcuts Check
  const shortcuts = JSON.parse(localStorage.getItem('vinx_shortcuts') || '{}'); 
  // Note: normally we'd get this from store, but for simplicity in global listener:
  
  // Settings shortcut
  if (matchShortcut(e, shortcuts.open_settings || 'ctrl+,')) {
    e.preventDefault();
    showSettingsModal.value = true;
    showSettingsTrigger.value = { category: currentTab.value === 'Translate' ? 'translate' : 'general' };
  }

  // Tab switching shortcuts
  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
  if (!isInput) {
    if (matchShortcut(e, shortcuts.prev_tab || 'ctrl+shift+[')) {
      e.preventDefault();
      const idx = allTabs.indexOf(currentTab.value);
      currentTab.value = allTabs[(idx - 1 + allTabs.length) % allTabs.length];
    }
    if (matchShortcut(e, shortcuts.next_tab || 'ctrl+shift+]')) {
      e.preventDefault();
      const idx = allTabs.indexOf(currentTab.value);
      currentTab.value = allTabs[(idx + 1) % allTabs.length];
    }
    
    // Chill smoke logic
    if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      isGlobalSmoking.value = true;
    }
  }
};

const handleGlobalKeyUp = (e: KeyboardEvent) => {
  if (e.code === 'Space') isGlobalSmoking.value = false;
};

const handleMouseUp = (e: MouseEvent) => {
  if (e.button === 3) navigateBack();
  else if (e.button === 4) navigateForward();
};

// Persistence Watchers
watch([projectRootPath, gitTabRepoPath], async ([root, git]) => {
  await saveSettings({ last_project_root: root, last_git_repo: git });
});

watch(showSettingsTrigger, (val) => {
  if (val?.category) showSettingsModal.value = true;
});

watch(triggerFlowChart, (val) => {
  if (val) {
    currentTab.value = 'FlowChart';
    triggerFlowChart.value = false;
  }
});

onMounted(() => {
  loadSettings();
  checkForUpdates();
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keyup", handleGlobalKeyUp);
  window.addEventListener("mouseup", handleMouseUp);
});
</script>

<template>
  <div class="app-shell" :class="[`theme-${currentTheme}`, { 'is-win95': currentTheme === '95' }]">
    <nav class="nav-bar glass">
      <div class="tabs-container">
        <button v-for="tab in allTabs" :key="tab" 
          @click="currentTab = tab" 
          :class="['tab-btn', { 'active': currentTab === tab }, tab.toLowerCase() + '-tab']"
        >
          {{ tab === 'ConvertUI' ? 'CONVERT' : tab }}
        </button>
      </div>
      
      <div class="nav-actions">
        <button @click="showSettingsModal = true" class="action-btn" title="Settings">
          <span v-html="Icons.Settings"></span>
        </button>
      </div>
    </nav>

    <main class="main-viewport">
      <div class="tab-content-area" :class="{ 'has-border': currentTheme === '95' }">
        <component :is="SQLHelper" v-if="initializedTabs['SQL-Helper']" v-show="currentTab === 'SQL-Helper'" :theme="currentTheme" />
        <component :is="TranslateTab" v-if="initializedTabs['Translate']" v-show="currentTab === 'Translate'" :theme="currentTheme" />
        <component :is="CompareTab" v-if="initializedTabs['Compare']" v-show="currentTab === 'Compare'" />
        <component :is="ConvertTab" v-if="initializedTabs['ConvertUI']" v-show="currentTab === 'ConvertUI'" />
        <component :is="EditorTab" v-if="initializedTabs['Editor']" v-show="currentTab === 'Editor'" />
        <component :is="GitTab" v-if="initializedTabs['Git']" v-show="currentTab === 'Git'" />
        <component :is="FlowChartTab" v-if="initializedTabs['FlowChart']" v-show="currentTab === 'FlowChart'" />
        <component :is="SmokeTab" v-if="initializedTabs['Chill']" v-show="currentTab === 'Chill'" />
      </div>
    </main>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="showSettingsModal" class="modal-backdrop" @mousedown.self="showSettingsModal = false">
          <div class="settings-modal glass" :class="{ 'win95-modal': currentTheme === '95' }">
            <header class="modal-header">
              <span class="modal-title">Settings</span>
              <div class="header-tools">
                <button @click="settingsRef?.refreshSettings()" class="tool-btn" title="Refresh"><span v-html="Icons.RefreshCw"></span></button>
                <button @click="settingsRef?.openSettingsFile()" class="tool-btn" title="Open File"><span v-html="Icons.Folder"></span></button>
                <button @click="showSettingsModal = false" class="close-btn" v-html="Icons.CloseLarge"></button>
              </div>
            </header>
            <div class="modal-body">
              <SettingsTab ref="settingsRef" @theme-changed="applyTheme" />
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <Teleport to="body">
      <div v-if="chillSettings?.enableWidget" class="chill-widget">
        <Cigarette :is-widget="true" :force-smoking="isGlobalSmoking" />
      </div>
    </Teleport>

    <GlobalLoading />
  </div>
</template>

<style>
@import './themes.css';

html, body {
  margin: 0; padding: 0; height: 100%; overflow: hidden;
  font-family: var(--font-family);
  background: var(--bg-color);
  color: var(--text-color);
}

#app { height: 100%; }

.app-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* Navigation */
.nav-bar {
  height: 42px; display: flex; justify-content: space-between; align-items: center;
  padding: 0 16px; flex-shrink: 0; z-index: 100;
  border-bottom: 1px solid var(--glass-border);
}

.tabs-container { display: flex; gap: 4px; height: 100%; align-items: flex-end; }

.tab-btn {
  padding: 6px 16px; border: none; background: transparent; color: var(--text-color);
  font-size: 0.75rem; font-weight: 700; cursor: pointer; opacity: 0.6;
  border-bottom: 2px solid transparent; transition: all 0.2s;
  text-transform: uppercase; letter-spacing: 0.05em;
}

.tab-btn:hover { opacity: 1; background: rgba(255,255,255,0.05); }
.tab-btn.active { opacity: 1; border-bottom-color: var(--accent-color); color: var(--accent-color); }

.git-tab.active { border-bottom-color: #10b981; color: #10b981; }
.flowchart-tab.active { border-bottom-color: #8b5cf6; color: #8b5cf6; }
.chill-tab.active { border-bottom-color: #f43f5e; color: #f43f5e; }

.nav-actions { display: flex; align-items: center; gap: 8px; }
.action-btn { background: transparent; border: none; color: var(--text-color); padding: 6px; cursor: pointer; opacity: 0.6; display: flex; border-radius: 6px; }
.action-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }

/* Viewport */
.main-viewport { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.tab-content-area { flex: 1; overflow: hidden; position: relative; }

/* Modals */
.modal-backdrop {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; justify-content: center; align-items: center; z-index: 2000;
}

.settings-modal {
  width: 60vw; height: 70vh;
  display: flex; flex-direction: column; border-radius: 16px; overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}



.modal-header {
  padding: 12px 20px; background: var(--accent-color); color: #fff;
  display: flex; justify-content: space-between; align-items: center;
}

.modal-title { font-weight: 800; font-size: 0.9rem; letter-spacing: 0.05em; }
.header-tools { display: flex; gap: 8px; }
.tool-btn, .close-btn {
  background: rgba(255,255,255,0.15); border: none; color: #fff;
  padding: 6px; border-radius: 6px; cursor: pointer; display: flex;
}
.tool-btn:hover, .close-btn:hover { background: rgba(255,255,255,0.25); }

.modal-body { flex: 1; overflow: hidden; background: var(--container-bg); }

/* Chill Widget */
.chill-widget { position: fixed; bottom: 24px; right: 24px; z-index: 9999; pointer-events: none; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4)); }

/* Win95 Theme */
.is-win95 .nav-bar { background: #c0c0c0; border: 2px outset #fff; height: 32px; padding: 2px; }
.is-win95 .tab-btn { border: 2px outset #fff; border-radius: 0; background: #c0c0c0; text-transform: none; padding: 2px 10px; }
.is-win95 .tab-btn.active { border: 2px inset #fff; background: #d0d0d0; transform: translateY(1px); }
.is-win95 .win95-modal { border: 2px outset #fff; border-radius: 0; }
.is-win95 .modal-header { background: #000080; padding: 2px 4px; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
