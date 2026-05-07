import { ref, shallowRef, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { gitStatus, type GitFile, type GitBranch, gitTabRepoPath, gitBranches } from '../store';

export interface GitCommit {
  hash: string;
  short: string;
  message: string;
  author: string;
  date: string;
}

export function useGit() {
  const branches = shallowRef<GitBranch[]>([]);
  const currentBranch = ref('');

  const changedFiles = shallowRef<GitFile[]>([]); // unstaged
  const stagedFiles = shallowRef<GitFile[]>([]);  // staged
  const commitMsg = ref('');

  const history = shallowRef<GitCommit[]>([]);
  const isSyncing = ref(false);
  const isLoading = ref(false);

  const init = async () => {
    if (gitTabRepoPath.value) {
      await refresh();
    }
  };




  const refresh = async () => {
    if (!gitTabRepoPath.value || isSyncing.value) return;
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
        cwd: gitTabRepoPath.value
      }) as string;

      const lines = raw.split('\n').filter(l => l.trim());
      const unstaged: GitFile[] = [];
      const staged: GitFile[] = [];

      lines.forEach(line => {
        const s1 = line[0];
        const s2 = line[1];
        const name = line.substring(3).trim().replace(/^"(.*)"$/, '$1');
        const fullPath = `${gitTabRepoPath.value}/${name}`;

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
        cwd: gitTabRepoPath.value
      }) as string;

      const lines = raw.split('\n').filter(l => l.trim());
      const branchList = lines.map(line => {
        const isCurrent = line.startsWith('*');
        const name = line.substring(2).trim();
        if (isCurrent) currentBranch.value = name;
        return { name, isCurrent, isRemote: name.includes('remotes/') };
      });
      branches.value = branchList;
      gitBranches.value = branchList as any;
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  };

  const loadHistory = async () => {
    isLoading.value = true;
    try {
      const raw = await invoke('git_execute', {
        args: ['log', '--pretty=format:%H|%h|%s|%an|%ar', '-n', '100'],
        cwd: gitTabRepoPath.value
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
        cwd: gitTabRepoPath.value
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
      await invoke('git_execute', { args, cwd: gitTabRepoPath.value });
      await loadStatus();
    } catch (e) {
      throw new Error('Stage failed: ' + e);
    }
  };

  const unstage = async (file?: GitFile) => {
    try {
      const args = file ? ['reset', 'HEAD', '--', file.name] : ['reset', 'HEAD'];
      await invoke('git_execute', { args, cwd: gitTabRepoPath.value });
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
        cwd: gitTabRepoPath.value
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
      await invoke('git_execute', { args, cwd: gitTabRepoPath.value });
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
    return await invoke('git_execute', { args, cwd: gitTabRepoPath.value }) as string;
  };

  const getCommitDiff = async (hash: string) => {
    // Use --stat only to prevent loading massive diffs that cause OOM.
    // Full patch output can be millions of characters for large commits.
    const statOutput = await invoke('git_execute', {
      args: ['show', hash, '--stat', '--format=commit %H%nAuthor: %an%nDate: %ad%n%n%s%n%n%b'],
      cwd: gitTabRepoPath.value
    }) as string;
    return statOutput;
  };


  const getFileOriginalAndModified = async (file: GitFile, target?: string): Promise<{ original: string, modified: string }> => {
    try {
      const repo = gitTabRepoPath.value;
      if (!repo || !file.name) return { original: '', modified: '' };

      // Normalize file.name to always use forward slashes for git operations
      const gitPath = file.name.replace(/\\/g, '/');

      // Original is always HEAD (or empty for new files)
      const original = await invoke('git_execute', {
        args: ['show', `HEAD:${gitPath}`],
        cwd: repo
      }).catch(() => '') as string;

      let modified = '';
      if (!target || target === 'LOCAL') {
        // Try read_file_content first. If it fails (path issues on Windows), fallback to git show working tree.
        const absolutePath = file.path.replace(/\//g, '\\'); // convert to native Windows backslash
        modified = await invoke('read_file_content', { path: absolutePath }).catch(async () => {
          // Fallback: try with original forward-slash path
          return await invoke('read_file_content', { path: file.path }).catch(() => '') as string;
        }) as string;
      } else if (target === 'INDEX') {
        modified = await invoke('git_execute', {
          args: ['show', `:0:${gitPath}`],
          cwd: repo
        }).catch(() => '') as string;
      } else {
        modified = await invoke('git_execute', {
          args: ['show', `${target}:${gitPath}`],
          cwd: repo
        }).catch(() => '') as string;
      }

      return { original, modified };
    } catch (e) {
      console.error('Failed to get diff contents:', e);
      return { original: '', modified: '' };
    }
  };

  const createBranch = async (name: string) => {
    if (!name.trim()) return;
    try {
      await invoke('git_execute', {
        args: ['checkout', '-b', name.trim()],
        cwd: gitTabRepoPath.value
      });
      await refresh();
    } catch (e) {
      throw new Error('Failed to create branch: ' + e);
    }
  };

  const mergeBranch = async (branch: string) => {
    try {
      await invoke('git_execute', { args: ['merge', branch], cwd: gitTabRepoPath.value });
      await refresh();
    } catch (e) {
      throw new Error('Merge failed: ' + e);
    }
  };

  const searchRepoFiles = async (query: string): Promise<string[]> => {
    if (!query.trim() || !gitTabRepoPath.value) return [];
    try {
      const output = await invoke('git_execute', {
        args: ['ls-files', '--cached', '--others', '--exclude-standard'],
        cwd: gitTabRepoPath.value
      }) as string;
      const allFiles = output.split('\n').filter(f => f.trim());
      const q = query.toLowerCase();
      return allFiles.filter(f => f.toLowerCase().includes(q))
        .map(f => f.replace(/^"(.*)"$/, '$1'))
        .slice(0, 50);
    } catch (e) {
      console.error('Search repo files failed:', e);
      return [];
    }
  };

  const openRepo = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
      });
      if (selected) {
        gitTabRepoPath.value = (Array.isArray(selected) ? selected[0] : selected).replace(/\\/g, '/');
        await refresh();
      }
    } catch (e) {
      console.error('Failed to open repo:', e);
    }
  };

  // Auto-refresh when repo path changes (e.g. from Editor or opening new repo)
  watch(gitTabRepoPath, (newVal) => {
    if (newVal) {
      refresh();
    }
  });



  return {
    repoPath: gitTabRepoPath,
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
    getFileOriginalAndModified,
    createBranch,
    mergeBranch,
    openRepo,
    searchRepoFiles
  };
}
