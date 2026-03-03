<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import SQLHelper from "./components/SQLHelper.vue";
import TranslateTab from "./components/TranslateTab.vue";
import SettingsTab from "./components/SettingsTab.vue";

const currentTab = ref("SQL-Helper");
const currentTheme = ref("dark");
const showSettingsModal = ref(false);
const settingsRef = ref<any>(null);

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    showSettingsModal.value = false;
  }
};

const loadInitialSettings = async () => {
  try {
    const s = await invoke("get_settings") as any;
    currentTheme.value = s.theme;
    applyTheme(s.theme);
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

onMounted(() => {
  loadInitialSettings();
  checkForUpdates();
  window.addEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="app-container" :class="{ 'win95-bg': currentTheme === '95' }">
    <!-- Navbar / Header -->

    <!-- Tabs Navigation -->
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
      </div>
      <div class="nav-actions">
        <button @click="showSettingsModal = true" class="icon-btn settings-btn" title="Settings">&#9881;&#65039;</button>
      </div>
    </nav>

    <!-- Main Content Area (Scrollable) -->
    <main class="content-wrapper" :class="{ 'no-padding': currentTab === 'SQL-Helper' }">
      <div class="content-scroll-area" :class="{ 'win95-border': currentTheme === '95', 'no-padding': currentTab === 'SQL-Helper' }">
        <div v-if="currentTab === 'SQL-Helper'" class="full-height-vif">
          <SQLHelper :theme="currentTheme" />
        </div>
        <div v-if="currentTab === 'Translate'" class="full-height-vif">
          <TranslateTab />
        </div>
      </div>
    </main>

    <!-- Settings Modal -->
    <div v-if="showSettingsModal" class="modal-overlay">
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

  </div>
</template>

<style>
/* No scroll on root */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* Prevent global scroll */
}

#app {
  height: 100%;
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
  padding: 20px;
  background-color: var(--container-bg);
  border: var(--border-style);
  border-radius: var(--border-radius);
}

.content-scroll-area.no-padding {
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
  width: 700px;
  max-width: 90%;
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