import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { projectRootPath, gitTabRepoPath } from '@vinx/sdk';

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
  extension: string;
}

export function useExplorer() {
  const projectRoot = ref<FileNode | null>(null);
  const expandedPaths = ref<Set<string>>(new Set());
  const showExplorer = ref(true);
  const sidebarWidth = ref(260);
  const isResizing = ref(false);

  const refreshTree = async () => {
    if (!projectRootPath.value) {
      projectRoot.value = null;
      return;
    }
    try {
      projectRoot.value = await invoke('read_dir_tree', { 
        path: projectRootPath.value, 
        depth: 8 
      }) as FileNode;
      
      if (projectRoot.value && !expandedPaths.value.has(projectRoot.value.path)) {
        expandedPaths.value.add(projectRoot.value.path);
        expandedPaths.value = new Set(expandedPaths.value);
      }
    } catch (e) {
      console.error('[Explorer] Failed to refresh tree:', e);
    }
  };

  const toggleFolder = (node: FileNode) => {
    if (expandedPaths.value.has(node.path)) {
      expandedPaths.value.delete(node.path);
    } else {
      expandedPaths.value.add(node.path);
    }
    expandedPaths.value = new Set(expandedPaths.value);
  };

  const closeProject = () => {
    projectRootPath.value = '';
    gitTabRepoPath.value = '';
    projectRoot.value = null;
  };

  // Resize logic
  const handleSidebarResize = (e: MouseEvent) => {
    isResizing.value = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth.value;

    const doResize = (moveEvent: MouseEvent) => {
      if (!isResizing.value) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = startWidth + delta;
      if (newWidth > 150 && newWidth < 600) {
        sidebarWidth.value = newWidth;
      }
    };

    const stopResize = () => {
      isResizing.value = false;
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
  };

  // Watchers
  watch(projectRootPath, (newVal) => {
    if (newVal) refreshTree();
  }, { immediate: true });

  return {
    projectRoot,
    expandedPaths,
    showExplorer,
    sidebarWidth,
    refreshTree,
    toggleFolder,
    closeProject,
    handleSidebarResize
  };
}
