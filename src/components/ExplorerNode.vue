<script setup lang="ts">
import { computed } from 'vue';

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
}>();

const emit = defineEmits<{
  (e: 'open', node: FileNode): void;
  (e: 'toggle', node: FileNode): void;
}>();

const isExpanded = () => props.expandedPaths.has(props.node.path);

const handleClick = () => {
  if (props.node.is_dir) emit('toggle', props.node);
  else emit('open', props.node);
};

// Icons (Premium SVGs)
const ChevronRight = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
const ChevronDown = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
const FolderIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>';
const FolderOpenIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"></path></svg>';
const FileIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
const FileCodeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14.5 2 14.5 7.5 20 7.5"></polyline><polyline points="8 13 10 15 8 17"></polyline><line x1="13" y1="13" x2="15" y2="17"></line></svg>';

// Check if this node or any of its children match the search query
const matchesSearch = computed(() => {
  if (!props.searchQuery) return true;
  const query = props.searchQuery.toLowerCase();
  
  const selfMatch = props.node.name.toLowerCase().includes(query);
  if (selfMatch) return true;

  if (props.node.is_dir && props.node.children) {
    return props.node.children.some(child => {
      const childMatch = child.name.toLowerCase().includes(query);
      if (childMatch) return true;
      if (child.is_dir) {
        return false; 
      }
      return false;
    });
  }
  return false;
});

// A more robust recursive check for search matches
const shouldRender = computed(() => {
  if (!props.searchQuery) return true;
  const query = props.searchQuery.toLowerCase();
  
  const checkMatch = (n: FileNode): boolean => {
    if (n.name.toLowerCase().includes(query)) return true;
    if (n.is_dir && n.children) {
      return n.children.some(c => checkMatch(c));
    }
    return false;
  };
  
  return checkMatch(props.node);
});

const getIcon = () => {
  if (props.node.is_dir) return isExpanded() ? FolderOpenIcon : FolderIcon;
  const ext = props.node.extension.toLowerCase();
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'vue', 'rs', 'py', 'java', 'go', 'sql', 'html', 'css', 'scss', 'xml'];
  if (codeExts.includes(ext)) return FileCodeIcon;
  return FileIcon;
};
</script>

<template>
  <div v-if="shouldRender" class="explorer-node">
    <div
      class="explorer-item"
      :class="{ 
        'is-dir': node.is_dir, 
        'is-file': !node.is_dir,
        'has-query': searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase())
      }"
      :style="{ paddingLeft: (depth * 14 + 10) + 'px' }"
      @click="handleClick"
      :title="node.path"
    >
      <span v-if="node.is_dir" class="folder-arrow" v-html="isExpanded() ? ChevronDown : ChevronRight"></span>
      <span v-else class="file-spacer"></span>
      <span class="node-icon" :class="node.is_dir ? 'icon-folder' : 'icon-file'" v-html="getIcon()"></span>
      <span class="node-name">{{ node.name }}</span>
    </div>
    <div v-if="node.is_dir && (isExpanded() || searchQuery)" class="explorer-children">
      <ExplorerNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :expanded-paths="expandedPaths"
        :depth="depth + 1"
        :search-query="searchQuery"
        @open="emit('open', $event)"
        @toggle="emit('toggle', $event)"
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

.explorer-item:hover { 
  background: rgba(255,255,255,0.06); 
}

.explorer-item.has-query {
  color: var(--accent-color);
  font-weight: 600;
}

.explorer-item.is-dir {
  font-weight: 500;
  color: var(--text-color);
}

.explorer-item.is-file {
  opacity: 0.85;
}

.explorer-item.is-file:hover {
  opacity: 1;
  color: var(--accent-color);
}

.folder-arrow { 
  font-size: 0.6rem; 
  width: 12px; 
  display: flex; 
  justify-content: center; 
  opacity: 0.4; 
  transition: transform 0.2s ease;
}

.explorer-item:hover .folder-arrow {
  opacity: 0.8;
}

.file-spacer { width: 12px; }

.node-icon { 
  font-size: 0.95rem; 
  flex-shrink: 0; 
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.explorer-item:hover .node-icon {
  transform: scale(1.1);
}

.icon-folder {
  color: #fbbf24; /* Amber/Yellow for folders */
}

.icon-file {
  color: #60a5fa; /* Blue for files */
  opacity: 0.7;
}

.node-name { 
  overflow: hidden; 
  text-overflow: ellipsis; 
  padding-right: 8px;
  letter-spacing: 0.3px;
}

.explorer-children {
  display: flex;
  flex-direction: column;
}

:root.theme-light .explorer-item:hover { background: rgba(0,0,0,0.05); }
:root.theme-light .icon-folder { color: #d97706; }
:root.theme-light .icon-file { color: #2563eb; }
</style>