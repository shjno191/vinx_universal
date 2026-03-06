<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { activeContextMenu } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

const emit = defineEmits<{
  (e: 'open', node: any): void;
}>();

const closeMenu = () => {
  activeContextMenu.value = null;
};

const handleOpen = () => {
  if (activeContextMenu.value) {
    emit('open', activeContextMenu.value.node);
    closeMenu();
  }
};

const handleCopyPath = async () => {
  if (activeContextMenu.value) {
    try {
      await writeText(activeContextMenu.value.node.path);
    } catch (e) { console.error(e); }
    closeMenu();
  }
};

const handleReveal = async () => {
  if (activeContextMenu.value) {
    try {
      await invoke('open_file_path', { path: activeContextMenu.value.node.path });
    } catch (e) { console.error(e); }
    closeMenu();
  }
};

// Global click listeners to close menu
const onGlobalClick = (e: MouseEvent) => {
  if (activeContextMenu.value) {
    // Check if clicked outside
    const el = document.querySelector('.context-menu');
    if (el && !el.contains(e.target as Node)) {
      closeMenu();
    }
  }
};

onMounted(() => {
  window.addEventListener('mousedown', onGlobalClick);
  window.addEventListener('contextmenu', onGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', onGlobalClick);
  window.removeEventListener('contextmenu', onGlobalClick);
});
</script>

<template>
  <teleport to="body">
    <div
      v-if="activeContextMenu"
      class="context-menu"
      :style="{ top: activeContextMenu.y + 'px', left: activeContextMenu.x + 'px' }"
    >
      <button class="ctx-item" @click="handleOpen">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        {{ activeContextMenu.node.is_dir ? 'Expand / Collapse' : 'Open File' }}
      </button>
      <button class="ctx-item" @click="handleCopyPath">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy Path
      </button>
      <div class="ctx-divider"></div>
      <button class="ctx-item" @click="handleReveal">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Reveal in Explorer
      </button>
    </div>
  </teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: #1e1e2e;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 4px;
  min-width: 180px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.85);
  font-size: 0.8rem;
  padding: 7px 10px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.ctx-item:hover { background: rgba(255,255,255,0.1); }

.ctx-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0; }

:root.theme-light .context-menu { background: #fff; border-color: rgba(0,0,0,0.15); }
:root.theme-light .ctx-item { color: #1e1e2e; }
:root.theme-light .ctx-item:hover { background: rgba(0,0,0,0.07); }
</style>
