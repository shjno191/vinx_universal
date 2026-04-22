import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { 
  projectRootPath, 
  gitTabRepoPath, 
  triggerOpenDiff, 
  currentFlowCode, 
  triggerFlowChart,
  gitBranches
} from '../store';
import type { Tab } from './useEditorTabs';

export function useEditorFeatures() {
  const selectionModal = ref<{ mode: 'branch' | 'commit', tab: Tab } | null>(null);
  const showBranchSwitcher = ref(false);

  const generateFlowChart = (code: string) => {
    currentFlowCode.value = code || '';
    triggerFlowChart.value = true;
  };

  const handleGitCompare = async (mode: 'branch' | 'local' | 'commit', tab: Tab) => {
    const repoPath = gitTabRepoPath.value || projectRootPath.value;
    if (!tab.path || !repoPath) return;

    if (mode === 'local') {
      const relativePath = tab.path.replace(repoPath, '').replace(/^[\\\/]/, '').replace(/\\/g, '/');
      try {
        const original = await invoke<string>('git_execute', { 
          args: ['show', `HEAD:${relativePath}`], 
          cwd: repoPath 
        });
        triggerOpenDiff.value = { 
          path: relativePath, 
          name: tab.name, 
          original, 
          modified: tab.content, 
          label: 'HEAD' 
        };
      } catch (e) {
        console.error('Compare local failed:', e);
      }
    } else {
      selectionModal.value = { mode, tab };
    }
  };

  const onGitSelection = async (target: string) => {
    if (!selectionModal.value) return;
    const { mode, tab } = selectionModal.value;
    selectionModal.value = null;

    const repoPath = gitTabRepoPath.value || projectRootPath.value;
    if (!tab.path || !repoPath) return;

    const relativePath = tab.path.replace(repoPath, '').replace(/^[\\\/]/, '').replace(/\\/g, '/');
    try {
      const original = await invoke<string>('git_execute', { 
        args: ['show', `${target}:${relativePath}`], 
        cwd: repoPath 
      });
      triggerOpenDiff.value = { 
        path: relativePath, 
        name: tab.name, 
        original, 
        modified: tab.content, 
        label: target.substring(0, 7) 
      };
    } catch (e) {
      console.error(`Compare ${mode} failed:`, e);
    }
  };

  const switchBranch = async (branchName: string) => {
    const repoPath = gitTabRepoPath.value || projectRootPath.value;
    if (!repoPath) return;
    
    showBranchSwitcher.value = false;
    try {
      await invoke<string>('git_execute', { 
        args: ['checkout', branchName], 
        cwd: repoPath 
      });
      const res = await invoke('git_get_branches', { path: repoPath });
      gitBranches.value = res as any;
    } catch (e: any) {
      alert('Failed to switch branch: ' + String(e));
    }
  };

  return {
    selectionModal,
    showBranchSwitcher,
    generateFlowChart,
    handleGitCompare,
    onGitSelection,
    switchBranch
  };
}
