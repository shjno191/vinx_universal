<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { activeTabContextMenu, Icons } from '@vinx/sdk';

const emit = defineEmits<{
    (e: 'close-all'): void;
    (e: 'move-left', tabId: string): void;
    (e: 'move-right', tabId: string): void;
}>();

const closeMenu = () => {
    activeTabContextMenu.value = null;
};

const handleCloseAll = () => {
    emit('close-all');
    closeMenu();
};

const handleMoveLeft = () => {
    if (activeTabContextMenu.value) {
        emit('move-left', activeTabContextMenu.value.tab.id);
        closeMenu();
    }
};

const handleMoveRight = () => {
    if (activeTabContextMenu.value) {
        emit('move-right', activeTabContextMenu.value.tab.id);
        closeMenu();
    }
};

// Global click listeners to close menu
const onGlobalClick = (e: MouseEvent) => {
    if (!activeTabContextMenu.value) return;
    
    const el = document.querySelector('.tab-context-menu');
    if (el && !el.contains(e.target as Node)) {
        closeMenu();
    }
};

onMounted(() => {
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
            <div class="menu-header">Tab Actions</div>
            
            <button class="ctx-item" @click="handleMoveLeft">
                <span v-html="Icons.ArrowLeft"></span>
                Move to Left Split
            </button>
            <button class="ctx-item" @click="handleMoveRight">
                <span v-html="Icons.ArrowRight"></span>
                Move to Right Split
            </button>
            <div class="ctx-divider"></div>
            <button class="ctx-item danger" @click="handleCloseAll">
                <span v-html="Icons.Close"></span>
                Close All Tabs
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

.ctx-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
    margin: 4px 0;
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
.ctx-item.danger:hover { background: rgba(244, 63, 94, 0.2); color: #f43f5e; }

:root.theme-light .tab-context-menu { background: #fff; border-color: rgba(0,0,0,0.15); }
:root.theme-light .ctx-item { color: #1e1e2e; }
:root.theme-light .ctx-item:hover { background: rgba(0,0,0,0.07); }
:root.theme-light .menu-header { color: #1e1e2e; border-color: rgba(0,0,0,0.05); }
:root.theme-light .ctx-divider { background: rgba(0,0,0,0.05); }
</style>

