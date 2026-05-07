<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { activeTabContextMenu } from '@vinx/sdk';

const emit = defineEmits<{
    (e: 'compare', mode: 'branch' | 'local' | 'commit', tab: any): void;
}>();

const closeMenu = () => {
    activeTabContextMenu.value = null;
};

const handleCompareLocal = () => {
    if (activeTabContextMenu.value) {
        emit('compare', 'local', activeTabContextMenu.value.tab);
        closeMenu();
    }
};

const handleCompareBranch = () => {
    if (activeTabContextMenu.value) {
        emit('compare', 'branch', activeTabContextMenu.value.tab);
        closeMenu();
    }
};

const handleCompareCommit = () => {
    if (activeTabContextMenu.value) {
        emit('compare', 'commit', activeTabContextMenu.value.tab);
        closeMenu();
    }
};

// Global click listeners to close menu
const onGlobalClick = (e: MouseEvent) => {
    if (!activeTabContextMenu.value) return;
    
    const el = document.querySelector('.tab-context-menu');
    if (el && !el.contains(e.target as Node)) {
        // Only close if the click isn't the right-click that opened it
        // Or just let the component handle its own opening state
        closeMenu();
    }
};

// Use a separate handler for opening to avoid immediate close
onMounted(() => {
    // We only need mousedown/click to close. contextmenu on the same element shouldn't close it instantly.
    window.addEventListener('mousedown', onGlobalClick);
});

onUnmounted(() => {
    window.removeEventListener('mousedown', onGlobalClick);
});
</script>

<template>
    <teleport to="body">
        <div
            v-if="activeTabContextMenu"
            class="tab-context-menu"
            :style="{ top: activeTabContextMenu.y + 'px', left: activeTabContextMenu.x + 'px' }"
        >
            <div class="menu-header">Git Compare</div>
            
            <button class="ctx-item" @click="handleCompareLocal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Compare with Local (HEAD)
            </button>
            <button class="ctx-item" @click="handleCompareBranch">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                Compare with Branch...
            </button>
            <button class="ctx-item" @click="handleCompareCommit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
                Compare with Commit...
            </button>
        </div>
    </teleport>
</template>

<style scoped>
.tab-context-menu {
    position: fixed;
    z-index: 15000;
    background: #1e1e2e;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 6px;
    min-width: 220px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    backdrop-filter: blur(10px);
}

.menu-header {
    font-size: 0.65rem;
    font-weight: 800;
    opacity: 0.5;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 4px 10px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 4px;
}

.ctx-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.85);
    font-size: 0.85rem;
    padding: 8px 10px;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
}

.ctx-item:hover { background: rgba(255,255,255,0.1); }

:root.theme-light .tab-context-menu { background: #fff; border-color: rgba(0,0,0,0.15); }
:root.theme-light .ctx-item { color: #1e1e2e; }
:root.theme-light .ctx-item:hover { background: rgba(0,0,0,0.07); }
:root.theme-light .menu-header { color: #1e1e2e; border-color: rgba(0,0,0,0.05); }
</style>
