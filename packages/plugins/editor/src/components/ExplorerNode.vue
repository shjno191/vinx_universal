<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue';
import { Icons, activeContextMenu, selectedExplorerPaths } from '@vinx/sdk';


interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
  extension: string;
}

const props = defineProps<{
  node: FileNode;
  expandedPaths: Set<string>;
  depth: number;
  searchQuery: string;
  activePath?: string;
}>();

const emit = defineEmits<{
  (e: 'open', node: FileNode, isTemp?: boolean): void;
  (e: 'toggle', node: FileNode): void;
  (e: 'select', node: FileNode, event: MouseEvent): void;
}>();


const isExpanded = () => props.expandedPaths.has(props.node.path);
const isActive = computed(() => !props.node.is_dir && props.activePath === props.node.path);
const isSelected = computed(() => selectedExplorerPaths.value.has(props.node.path));

const explorerItemRef = ref<HTMLElement | null>(null);

const scrollToCenter = () => {
  if (explorerItemRef.value) {
    explorerItemRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

onMounted(() => {
  if (isActive.value) {
    setTimeout(() => {
      scrollToCenter();
    }, 100);
  }
});

watch(isActive, (val) => {
  if (val) {
    nextTick(() => {
      scrollToCenter();
    });
  }
});


const handleClick = (e: MouseEvent) => {
  emit('select', props.node, e);
  if (e.ctrlKey || e.metaKey || e.shiftKey) return; // Don't open if multi-selecting
  
  if (props.node.is_dir) emit('toggle', props.node);
  else emit('open', props.node, true);
};

const handleDblClick = (e: MouseEvent) => {
  if (props.node.is_dir) return; 
  emit('open', props.node, false);
};


const handleRightClick = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // Set global context menu state
  activeContextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    node: props.node
  };
};

const shouldRender = computed(() => {
  if (!props.searchQuery) return true;
  const query = props.searchQuery.toLowerCase();
  const checkMatch = (n: FileNode): boolean => {
    if (n.name.toLowerCase().includes(query)) return true;
    if (n.is_dir && n.children) return n.children.some((c: FileNode) => checkMatch(c));
    return false;
  };
  return checkMatch(props.node);
});

const getIcon = () => {
  if (props.node.is_dir) return isExpanded() ? Icons.FolderOpen : Icons.Folder;
  const ext = props.node.extension.toLowerCase();
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'vue', 'rs', 'py', 'java', 'go', 'sql', 'html', 'css', 'scss', 'xml'];
  if (codeExts.includes(ext)) return Icons.File; // Could add more specific ones later
  return Icons.File;
};
</script>

<template>
  <div v-if="shouldRender" class="explorer-node">
    <div
      ref="explorerItemRef"
      class="explorer-item"
      :class="{ 
        'is-dir': node.is_dir, 
        'is-file': !node.is_dir,
        'has-query': searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase()),
        'is-active': isActive,
        'is-selected': isSelected
      }"
      :style="{ paddingLeft: (depth * 14 + 10) + 'px' }"
      @click="handleClick($event)"
      @dblclick="handleDblClick($event)"
      @contextmenu="handleRightClick"

      :title="node.path"
    >
      <span v-if="node.is_dir" class="folder-arrow" v-html="isExpanded() ? Icons.ChevronDown : Icons.ChevronRight" :title="isExpanded() ? 'Collapse' : 'Expand'"></span>
      <span v-else class="file-spacer"></span>
      <span class="node-icon" :class="node.is_dir ? 'icon-folder' : 'icon-file'" v-html="getIcon()" :title="node.is_dir ? 'Directory' : 'File'"></span>
      <span class="node-name" :title="node.name">{{ node.name }}</span>
    </div>

    <div v-if="node.is_dir && (isExpanded() || searchQuery)" class="explorer-children">
      <ExplorerNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :expanded-paths="expandedPaths"
        :depth="depth + 1"
        :search-query="searchQuery"
        :active-path="activePath"
        @open="(node, isTemp) => emit('open', node, isTemp)"
        @toggle="emit('toggle', $event)"
        @select="(n, ev) => emit('select', n, ev)"
      />

    </div>
  </div>
</template>

<style scoped>
.explorer-node { display: flex; flex-direction: column; }

.explorer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
  transition: background 0.1s, color 0.1s;
  border-radius: 4px;
  margin: 1px 4px;
}

.explorer-item:hover { background: rgba(255,255,255,0.06); }

.explorer-item.is-active {
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.18);
  color: var(--accent-color);
  font-weight: 600;
}

.explorer-item.is-active .icon-file { color: var(--accent-color); opacity: 1; }

.explorer-item.is-selected {
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.25);
  box-shadow: inset 2px 0 0 var(--accent-color);
}


.explorer-item.has-query {
  color: var(--accent-color);
  font-weight: 600;
}

.explorer-item.is-dir { font-weight: 500; color: var(--text-color); }
.explorer-item.is-file { opacity: 0.85; }
.explorer-item.is-file:hover { opacity: 1; color: var(--accent-color); }

.folder-arrow { 
  font-size: 0.6rem; width: 12px; display: flex; justify-content: center; 
  opacity: 0.4; transition: transform 0.2s ease;
}
.explorer-item:hover .folder-arrow { opacity: 0.8; }

.file-spacer { width: 12px; }

.node-icon { 
  font-size: 0.95rem; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.explorer-item:hover .node-icon { transform: scale(1.1); }

.icon-folder { color: #fbbf24; }
.icon-file { color: #60a5fa; opacity: 0.7; }

.node-name { overflow: hidden; text-overflow: ellipsis; padding-right: 8px; letter-spacing: 0.3px; }

.explorer-children { display: flex; flex-direction: column; }

:root.theme-light .explorer-item:hover { background: rgba(0,0,0,0.05); }
:root.theme-light .icon-folder { color: #d97706; }
:root.theme-light .icon-file { color: #2563eb; }
</style>