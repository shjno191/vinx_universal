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
        // We can't easily recurse here without a helper or props, 
        // but for a shallow check it works. 
        // Better: let the parent handle the visibility of this component.
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
  if (props.node.is_dir) return isExpanded() ? '' : '';
  const m: Record<string, string> = {
    ts: '', tsx: '', js: '', jsx: '', vue: '',
    rs: '', py: '', java: '', go: '',
    json: '', md: '', css: '', scss: '', html: '',
    sql: '', txt: '', sh: '', xml: '',
  };
  return m[props.node.extension.toLowerCase()] || '';
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
      <span v-if="node.is_dir" class="folder-arrow">{{ isExpanded() ? '' : '' }}</span>
      <span v-else class="file-spacer"></span>
      <span class="node-icon">{{ getIcon() }}</span>
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
  background: rgba(255,255,255,0.08); 
}

.explorer-item.has-query {
  color: var(--accent-color);
  font-weight: 600;
}

.explorer-item.is-dir {
  font-weight: 500;
  opacity: 0.95;
}

.explorer-item.is-file {
  opacity: 0.8;
}

.explorer-item.is-file:hover {
  opacity: 1;
  color: var(--accent-color);
}

.folder-arrow { font-size: 0.6rem; width: 12px; display: flex; justify-content: center; opacity: 0.5; }
.file-spacer { width: 12px; }
.node-icon { font-size: 0.95rem; flex-shrink: 0; }
.node-name { 
  overflow: hidden; 
  text-overflow: ellipsis; 
  padding-right: 8px;
}

.explorer-children {
  display: flex;
  flex-direction: column;
}

:root.theme-light .explorer-item:hover { background: rgba(0,0,0,0.05); }
</style>