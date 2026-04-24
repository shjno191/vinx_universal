import { ref, shallowRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { gitStatus, type GitFile, type GitBranch } from '../store';

export interface GitCommit {
  hash: string;
  short: string;
  message: string;
  author: string;
  date: string;
}

export function useGit() {
  const repoPath = ref('');
  const branches = shallowRef<GitBranch[]>([]);
  const currentBranch = ref('');
  
  const changedFiles = shallowRef<GitFile[]>([]); // unstaged
  const stagedFiles = shallowRef<GitFile[]>([]);  // staged
  const commitMsg = ref('');

  const history = shallowRef<GitCommit[]>([]);
  const isSyncing = ref(false);
  const isLoading = ref(false);

  const init = async () => {
    try {
      const raw = await invoke('get_settings') as string;
      const s = JSON.parse(raw || "{}");
      if (s.project_root) {
        repoPath.value = s.project_root.replace(/\\/g, '/');
        await refresh();
      }
    } catch (e) {
      console.error('Git init failed:', e);
    }
  };

  const refresh = async () => {
    if (!repoPath.value || isSyncing.value) return;
    isSyncing.value = true;
    try {
      await Promise.all([loadStatus(), loadBranches(), loadHistory()]);
    } catch (e) {
      console.error('Git refresh failed:', e);
    } finally {
      isSyncing.value = false;
    }
  };

  const loadStatus = async () => {
    try {
      const raw = await invoke('git_execute', { 
        args: ['status', '--porcelain'], 
        cwd: repoPath.value 
      }) as string;
      
      const lines = raw.split('\n').filter(l => l.trim());
      const unstaged: GitFile[] = [];
      const staged: GitFile[] = [];

      lines.forEach(line => {
        const s1 = line[0];
        const s2 = line[1];
        const name = line.substring(3).trim().replace(/^"(.*)"$/, '$1');
        const fullPath = `${repoPath.value}/${name}`;
        
        if (s1 !== ' ' && s1 !== '?') {
          staged.push({ path: fullPath, name, status: s1 as GitFile['status'], staged: true });
        }
        if (s2 !== ' ' || s1 === '?') {
          unstaged.push({ path: fullPath, name, status: (s1 === '?' ? '??' : s2) as GitFile['status'], staged: false });
        }
      });

      changedFiles.value = unstaged;
      stagedFiles.value = staged;
      gitStatus.value = [...staged, ...unstaged];
    } catch (e) {
      console.error('Failed to load status:', e);
    }
  };

  const loadBranches = async () => {
    try {
      const raw = await invoke('git_execute', { 
        args: ['branch', '-a'], 
        cwd: repoPath.value 
      }) as string;
      
      const lines = raw.split('\n').filter(l => l.trim());
      const branchList = lines.map(line => {
        const isCurrent = line.startsWith('*');
        const name = line.substring(2).trim();
        if (isCurrent) currentBranch.value = name;
        return { name, isCurrent, isRemote: name.includes('remotes/') };
      });
      branches.value = branchList;
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  };

  const loadHistory = async () => {
    isLoading.value = true;
    try {
      const raw = await invoke('git_execute', { 
        args: ['log', '--pretty=format:%H|%h|%s|%an|%ar', '-n', '100'], 
        cwd: repoPath.value 
      }) as string;
      
      const lines = raw.split('\n').filter(l => l.trim());
      history.value = lines.map(line => {
        const [hash, short, message, author, date] = line.split('|');
        return { hash, short, message, author, date };
      });
    } catch (e) {
      console.error('Failed to load history:', e);
      history.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const checkout = async (branch: string) => {
    try {
      isSyncing.value = true;
      await invoke('git_execute', { 
        args: ['checkout', branch.replace('remotes/origin/', '')], 
        cwd: repoPath.value 
      });
      await refresh();
    } catch (e) {
      throw new Error('Checkout failed: ' + e);
    } finally {
      isSyncing.value = false;
    }
  };

  const stage = async (file?: GitFile) => {
    try {
      const args = file ? ['add', file.name] : ['add', '-A'];
      await invoke('git_execute', { args, cwd: repoPath.value });
      await loadStatus();
    } catch (e) {
      throw new Error('Stage failed: ' + e);
    }
  };

  const unstage = async (file?: GitFile) => {
    try {
      const args = file ? ['reset', 'HEAD', '--', file.name] : ['reset', 'HEAD'];
      await invoke('git_execute', { args, cwd: repoPath.value });
      await loadStatus();
    } catch (e) {
      throw new Error('Unstage failed: ' + e);
    }
  };

  const commit = async () => {
    if (!commitMsg.value.trim() || !stagedFiles.value.length) return;
    try {
      isLoading.value = true;
      await invoke('git_execute', { 
        args: ['commit', '-m', commitMsg.value.trim()], 
        cwd: repoPath.value 
      });
      commitMsg.value = '';
      await refresh();
    } catch (e) {
      throw new Error('Commit failed: ' + e);
    } finally {
      isLoading.value = false;
    }
  };

  const gitOp = async (op: 'pull' | 'push' | 'fetch' | 'stash' | 'pop') => {
    isSyncing.value = true;
    try {
      const args = op === 'pop' ? ['stash', 'pop'] : [op];
      await invoke('git_execute', { args, cwd: repoPath.value });
      await refresh();
    } catch (e) {
      throw new Error(`Git ${op} failed: ` + e);
    } finally {
      isSyncing.value = false;
    }
  };

  const getDiff = async (file: GitFile) => {
    const args = file.staged 
      ? ['diff', '--cached', '--', file.name]
      : ['diff', 'HEAD', '--', file.name];
    return await invoke('git_execute', { args, cwd: repoPath.value }) as string;
  };

  const getCommitDiff = async (hash: string) => {
    return await invoke('git_execute', { 
      args: ['show', hash, '--stat', '-p'], 
      cwd: repoPath.value 
    }) as string;
  };

  const createBranch = async (name: string) => {
    if (!name.trim()) return;
    try {
      await invoke('git_execute', { 
        args: ['checkout', '-b', name.trim()], 
        cwd: repoPath.value 
      });
      await refresh();
    } catch (e) {
      throw new Error('Failed to create branch: ' + e);
    }
  };

  const mergeBranch = async (branch: string) => {
    try {
      await invoke('git_execute', { args: ['merge', branch], cwd: repoPath.value });
      await refresh();
    } catch (e) {
      throw new Error('Merge failed: ' + e);
    }
  };

  return {
    repoPath,
    branches,
    currentBranch,
    changedFiles,
    stagedFiles,
    commitMsg,
    history,
    isSyncing,
    isLoading,
    init,
    refresh,
    checkout,
    stage,
    unstage,
    commit,
    gitOp,
    getDiff,
    getCommitDiff,
    createBranch,
    mergeBranch
  };
}
