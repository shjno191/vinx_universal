<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, shallowRef, nextTick } from 'vue';
import { open, message, ask } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { gitBranches, gitTabRepoPath, type GitBranch, triggerGitRefresh, triggerEditorReload, type GitFile, triggerCloseModals, theme as globalTheme, projectRootPath } from '../store';




const highlightSearch = (text: string) => {
  return text;
};

// ─── State ────────────────────────────────────────────────────────────
const isLoading       = ref(false);
const statusMessage   = ref('');
const stagedFiles     = ref<GitFile[]>([]);
const unstagedFiles   = ref<GitFile[]>([]);
const commitMessage   = ref('');

// Branch click ↁEshow history in right panel
const selectedBranch  = ref<GitBranch | null>(null);
const isLoadingLogs   = ref(false);
const showAllHistory  = ref(false);

interface GraphCommit {
  hash: string;
  parents: string[];
  msg: string;
  author: string;
  initials: string;
  date: string;
  decorHtml: string;
  lane: number;
  color: string;
}
interface GraphPath {
  d: string;
  color: string;
}

const graphCommits    = ref<GraphCommit[]>([]);
const graphPaths      = ref<GraphPath[]>([]);
const maxLanes        = ref(1);

// Context menu (Commit)
const commitMenu      = ref<{ x: number, y: number, commit: GraphCommit } | null>(null);

// Context menu (Branch)
const ctxMenu         = ref<{ x: number; y: number; branch: GitBranch } | null>(null);
const fileCtxMenu    = ref<{ x: number, y: number, file: GitFile } | null>(null);
// Create branch modal
const createModal     = ref<{ fromBranch: string } | null>(null);
const newBranchName   = ref('');
// File diff modal
const diffModal       = ref<{ file: GitFile; original: string; modified: string } | null>(null);
const lastDiffEditor  = shallowRef<any>(null);
// Inspect commit modal
const inspectModal    = ref<{ hash: string; message: string; author: string; date: string; files: { path: string, status: string }[] } | null>(null);

// ─── Computed ─────────────────────────────────────────────────────────
const localBranches  = computed(() => gitBranches.value.filter(b => !b.isRemote));
const remoteBranches = computed(() => gitBranches.value.filter(b => b.isRemote));
const currentBranch  = computed(() => gitBranches.value.find(b => b.isCurrent)?.name || '');
const changesCount   = computed(() => stagedFiles.value.length + unstagedFiles.value.length);

// ─── Helpers ──────────────────────────────────────────────────────────
const git = (args: string[]) => invoke<string>('git_execute', { args, cwd: gitTabRepoPath.value });
const expandedSections = ref(new Set(['changes', 'branches']));
const toggleSection = (s: string) => {
  if (expandedSections.value.has(s)) expandedSections.value.delete(s);
  else expandedSections.value.add(s);
};

const setStatus = (msg: string, ms = 3000) => {
  statusMessage.value = msg;
  if (ms > 0) setTimeout(() => { if (statusMessage.value === msg) statusMessage.value = ''; }, ms);
};

const handleDiffMount = (editor: any) => {
  lastDiffEditor.value = editor;
  
  const original = editor.getOriginalEditor();
  const modified = editor.getModifiedEditor();
  
  original.onDidChangeModelContent(() => nextTick(() => updateDiffSearchHighlights()));
  modified.onDidChangeModelContent(() => nextTick(() => updateDiffSearchHighlights()));
  
  updateDiffSearchHighlights();
};



const updateDiffSearchHighlights = () => {
    // Feature removed
};




const prevDiff = () => {
  if (lastDiffEditor.value) {
    lastDiffEditor.value.goToDiff('previous');
  }
};

const nextDiff = () => {
  if (lastDiffEditor.value) {
    lastDiffEditor.value.goToDiff('next');
  }
};

const IconUp = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
const IconDown = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

const parseGraphData = (raw: string) => {
  const rawLines = raw.split('\n').filter(l => l.trim());
  const ROW_H = 36;
  const LANE_W = 16;
  const PALETTE = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#38bdf8', '#c084fc', '#f87171'];
  
  let colorCounter = 0;
  const getColor = () => PALETTE[colorCounter++ % PALETTE.length];

  const activeBranches: Array<{ hash: string, color: string } | null> = [];
  const _commits: GraphCommit[] = [];
  const _paths: GraphPath[] = [];
  let _maxLanes = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const parts = rawLines[i].split('|');
    const hash = parts[0];
    const parents = parts[1] ? parts[1].split(' ') : [];
    const msg = parts[2] || '';
    const author = parts[3] || 'Unknown';
    const date = parts[4] || '';
    const decor = parts[5] || '';

    let laneIdx = activeBranches.findIndex(b => b?.hash === hash);
    if (laneIdx === -1) laneIdx = activeBranches.findIndex(b => b === null);
    if (laneIdx === -1) laneIdx = activeBranches.length;

    _maxLanes = Math.max(_maxLanes, activeBranches.length, laneIdx + 1);

    const nodeColor = activeBranches[laneIdx]?.color || getColor();

    const ty = i * ROW_H;
    const my = i * ROW_H + ROW_H / 2;
    const nx = laneIdx * LANE_W + LANE_W / 2;

    activeBranches.forEach((b, L) => {
      if (!b) return;
      const tx = L * LANE_W + LANE_W / 2;
      if (b.hash === hash) {
        _paths.push({ d: `M ${tx} ${ty} C ${tx} ${(ty+my)/2}, ${nx} ${(ty+my)/2}, ${nx} ${my}`, color: b.color });
      } else {
        _paths.push({ d: `M ${tx} ${ty} L ${tx} ${ty + ROW_H}`, color: b.color });
      }
    });

    const nextBranches = [...activeBranches];
    nextBranches.forEach((b, L) => {
      if (b && b.hash === hash && L !== laneIdx) nextBranches[L] = null;
    });

    const by = (i + 1) * ROW_H;

    if (parents.length > 0) {
      nextBranches[laneIdx] = { hash: parents[0], color: nodeColor };
      const bx = laneIdx * LANE_W + LANE_W / 2;
      _paths.push({ d: `M ${nx} ${my} L ${bx} ${by}`, color: nodeColor });

      for (let p = 1; p < parents.length; p++) {
        const parentHash = parents[p];
        let pLane = nextBranches.findIndex(b => b === null);
        if (pLane === -1) pLane = nextBranches.length;
        
        const pColor = getColor();
        nextBranches[pLane] = { hash: parentHash, color: pColor };
        const pbx = pLane * LANE_W + LANE_W / 2;
        _paths.push({ d: `M ${nx} ${my} C ${nx} ${(my+by)/2}, ${pbx} ${(my+by)/2}, ${pbx} ${by}`, color: pColor });
      }
    } else {
      nextBranches[laneIdx] = null;
    }

    while (nextBranches.length > 0 && nextBranches[nextBranches.length - 1] === null) {
      nextBranches.pop();
    }

    activeBranches.length = 0;
    activeBranches.push(...nextBranches);
    _maxLanes = Math.max(_maxLanes, activeBranches.length);

    let decorHtml = '';
    if (decor) {
      const cleanDecor = decor.replace(/[()]/g, '');
      const bits = cleanDecor.split(', ');
      decorHtml = bits.map(bit => {
        let cls = 'd-pill';
        if (bit.includes('HEAD ->')) { cls += ' head'; bit = bit.replace('HEAD -> ', ''); }
        else if (bit.includes('origin/')) { cls += ' remote'; }
        else if (bit.includes('tag: ')) { cls += ' tag'; bit = bit.replace('tag: ', ''); }
        return `<span class="${cls}">${bit}</span>`;
      }).join('');
    }

    const names = author.trim().split(/\s+/);
    const initials = names.length > 1 
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : (names[0].substring(0, 2).toUpperCase() || 'U');

    _commits.push({ hash, parents, msg, author, initials, date, decorHtml, lane: laneIdx, color: nodeColor });
  }

  graphPaths.value = _paths;
  graphCommits.value = _commits;
  maxLanes.value = _maxLanes || 1;
};

// ─── Core operations ──────────────────────────────────────────────────
const openRepo = async () => {
  const selected = await open({ directory: true, multiple: false, title: 'Select Git Repository' });
  if (selected && typeof selected === 'string') {
    try {
      const toplevelRaw = await invoke<string>('git_execute', { 
        args: ['rev-parse', '--show-toplevel'], 
        cwd: selected 
      });
      const toplevel = toplevelRaw.trim();
      
      const normalize = (p: string) => p.replace(/^[a-zA-Z]:/, (m) => m.toLowerCase()).replace(/[\\\/]+$/, '').replace(/\\/g, '/');
      const nSelected = normalize(selected);
      const nToplevel = normalize(toplevel);

      if (nSelected !== nToplevel) {
         await message('Please select the root folder of the Git repository.', { title: 'Invalid Folder', kind: 'error' });
         return;
      }

      gitTabRepoPath.value = selected;
      selectedBranch.value = null;
      setStatus('✁ERepository opened', 3000);
      await refresh();
    } catch (e) {
      await message('The selected folder is not a valid Git repository root.', { title: 'Git Error', kind: 'error' });
      console.error('Git validation failed:', e);
    }
  }
};

const refresh = async () => {
  if (!gitTabRepoPath.value) {
    resetGitState();
    return;
  }
  isLoading.value = true;
  try { await Promise.all([loadBranches(), loadStatus()]); }
  finally { isLoading.value = false; }
};

const resetGitState = () => {
  stagedFiles.value = [];
  unstagedFiles.value = [];
  gitBranches.value = [];
  graphCommits.value = [];
  graphPaths.value = [];
  selectedBranch.value = null;
  statusMessage.value = '';
};

const loadBranches = async () => {
  if (!gitTabRepoPath.value) return;
  console.log('[GitTab] Loading branches for path:', gitTabRepoPath.value);
  try {
    let raw = '';
    // Level 1: Rich metadata
    try {
      raw = await git(['for-each-ref', '--format=%(refname:short)~~%(upstream:short)~~%(upstream:track)~~%(objectname:short)', 'refs/heads', 'refs/remotes']);
      console.log('[GitTab] for-each-ref success');
    } catch (e1) {
      console.warn('[GitTab] Level 1 (for-each-ref) failed:', e1);
      // Level 2: Basic metadata with format
      try {
        raw = await git(['branch', '-a', '--format=%(refname:short)~~~~']);
        console.log('[GitTab] Level 2 (branch --format) success');
      } catch (e2) {
        console.warn('[GitTab] Level 2 (branch --format) failed:', e2);
        // Level 3: Super fallback (no format, just raw text)
        try {
          const basic = await git(['branch', '-a']);
          console.log('[GitTab] Level 3 (basic branch -a) success');
          // Process basic output: lines starting with * are current, others are names
          raw = basic.split('\n').map(line => {
             const clean = line.replace('*', '').trim();
             return `${clean}~~~~`; // append markers for the split below
          }).join('\n');
        } catch (e3) {
          throw new Error('All branch loading levels failed: ' + e3);
        }
      }
    }
    
    if (!raw.trim()) {
      console.warn('[GitTab] No branches found in output.');
    }

    gitBranches.value = raw.split('\n').filter(l => l.trim()).map(line => {
      try {
        const [ref, upstream, track, _hash] = line.split('~~');
        const isRemote = ref.startsWith('origin/') || ref.startsWith('remotes/origin/') || ref.startsWith('remotes/');
        
        let ahead = 0, behind = 0;
        if (track) {
          const aMatch = track.match(/ahead (\d+)/);
          const bMatch = track.match(/behind (\d+)/);
          if (aMatch) ahead = parseInt(aMatch[1]);
          if (bMatch) behind = parseInt(bMatch[1]);
        }

        return { 
          name: ref,
          isCurrent: false,
          isRemote, 
          upstream: upstream || undefined, 
          ahead, 
          behind 
        };
      } catch (pe) {
        console.error('[GitTab] Error parsing branch line:', line, pe);
        return null;
      }
    }).filter(b => b !== null) as GitBranch[];

    // Determine current branch
    try {
      const current = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      gitBranches.value.forEach(b => {
        if (b.name === current || (b.isCurrent === false && current === 'HEAD')) { 
           // detached? we'll see
        }
        if (b.name === current) b.isCurrent = true;
      });
    } catch (e) {
      console.warn('[GitTab] rev-parse HEAD failed:', e);
    }

    // Auto-select current branch
    if (!selectedBranch.value) {
      const cur = gitBranches.value.find(b => b.isCurrent);
      if (cur) { 
        selectedBranch.value = cur; 
        loadBranchHistory(cur); 
      }
    }
  } catch (e) { 
    console.error('[GitTab] Load branches FATAL error:', e);
    gitBranches.value = []; 
    setStatus('✁EError loading branches', 5000); 
  }
};

const loadStatus = async () => {
  try {
    const raw = await git(['status', '--porcelain', '-u']);
    const files: GitFile[] = [];
    for (const line of raw.split('\n').filter(l => l.length >= 3)) {
      const x = line[0]; const y = line[1];
      const rawPath = line.substring(3).split(' -> ').pop()!.trim();
      const name = rawPath.replace(/\\/g, '/').split('/').pop() || rawPath;
      if (x !== ' ' && x !== '?') files.push({ path: rawPath, name, status: x as any, staged: true });
      if (y !== ' ') files.push({ path: rawPath, name, status: y === '?' ? '??' : y as any, staged: false });
    }
    stagedFiles.value   = files.filter(f => f.staged);
    unstagedFiles.value = files.filter(f => !f.staged);
  } catch { stagedFiles.value = []; unstagedFiles.value = []; }
};

const loadBranchHistory = async (branch?: GitBranch) => {
  if (!gitTabRepoPath.value) return;
  isLoadingLogs.value = true;
  graphCommits.value = [];
  graphPaths.value = [];
  maxLanes.value = 1;

  if (branch) selectedBranch.value = branch;
  const targetBranch = selectedBranch.value;

  try {
    const args = ['log', '--format=%h|%p|%s|%an|%cr|%D', '-n', '2000'];
    if (showAllHistory.value) {
      args.push('--all');
    } else if (targetBranch) {
      args.push(targetBranch.isCurrent ? 'HEAD' : targetBranch.name);
    } else {
      args.push('HEAD');
    }

    const raw = await git(args);
    parseGraphData(raw);
  } catch (e) {
    console.warn(`Failed history load, trying generic log...`);
    try {
      const rawHead = await git(['log', '--format=%h|%p|%s|%an|%cr|%D', '-n', '2000']);
      parseGraphData(rawHead);
    } catch {
      graphCommits.value = [];
      setStatus('✁EError loading history', 4000);
    }
  } finally {
    isLoadingLogs.value = false;
  }
};

const undoCommit = async () => {
  const ok = await ask('This will reset the last commit but keep your changes. Continue?', { title: 'Undo Commit', kind: 'warning' });
  if (!ok) return;
  isLoading.value = true;
  try {
    await git(['reset', '--soft', 'HEAD~1']);
    setStatus('✁ELast commit undone');
    await refresh();
    if (selectedBranch.value) await loadBranchHistory(selectedBranch.value);
  } catch (e) {
    await message(String(e), { title: 'Undo Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const gitFetch = async () => {
  isLoading.value = true;
  // Reset labels immediately for feedback
  gitBranches.value.forEach(b => {
    b.ahead = 0;
    b.behind = 0;
  });
  
  try {
    await git(['fetch', '--all', '--prune']);
    setStatus('✁EFetched all remotes');
    await refresh();
    if (showAllHistory.value || selectedBranch.value) {
      await loadBranchHistory();
    }
  } catch (e) {
    await message(String(e), { title: 'Fetch Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const gitStash = async () => {
  isLoading.value = true;
  try {
    await git(['stash', 'push', '-u']);
    setStatus('✁EStashed changes');
    await refresh();
  } catch (e) {
    await message(String(e), { title: 'Stash Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const gitPop = async () => {
  isLoading.value = true;
  try {
    await git(['stash', 'pop']);
    setStatus('✁EPopped latest stash');
    await refresh();
  } catch (e) {
    await message(String(e), { title: 'Pop Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const smartGitOp = async (opName: string, opFn: () => Promise<void>) => {
  const doOp = async (useStash = false) => {
    isLoading.value = true;
    try {
      if (useStash) {
        const stashMsg = `Auto-stash before ${opName}`;
        setStatus('⟳ Stashing changes…');
        await git(['stash', 'push', '-u', '-m', stashMsg]);
      }
      
      await opFn();
      
      if (useStash) {
        setStatus('⟳ Popping stash…');
        try { await git(['stash', 'pop']); } catch (e) { 
          console.warn('Pop failure (might be conflict):', e); 
          setStatus('✁EStash pop conflict' + String(e), 5000);
        }
      }
      
      triggerEditorReload.value++; 
      await refresh();
    } catch(e) {
      await message(String(e), { title: `${opName} Failed`, kind: 'error' });
    } finally {
      isLoading.value = false;
    }
  };

  if (changesCount.value > 0) {
    const ok = await ask(
      `You have ${changesCount.value} uncommitted changes. \n\nWould you like to stash them automatically, perform "${opName}", and then pop the stash?`,
      { title: 'Uncommitted Changes', kind: 'warning', okLabel: 'Stash & Continue', cancelLabel: 'Cancel' }
    );
    if (ok) await doOp(true);
  } else {
    await doOp(false);
  }
};

const checkoutCommit = async (hash: string) => {
  await smartGitOp(`Checkout ${hash.substring(0, 7)}`, async () => {
    await git(['checkout', hash]);
    setStatus('✁EChecked out ' + hash);
  });
};

const openCommitMenu = (e: MouseEvent, c: GraphCommit) => {
  commitMenu.value = { x: e.clientX, y: e.clientY, commit: c };
};

const closeMenus = () => {
  commitMenu.value = null;
  ctxMenu.value = null;
  fileCtxMenu.value = null;
};

const cmCheckout = () => {
  if (commitMenu.value) checkoutCommit(commitMenu.value.commit.hash);
  commitMenu.value = null;
};

const cmCreateBranch = async () => {
  if (!commitMenu.value) return;
  const hash = commitMenu.value.commit.hash;
  commitMenu.value = null;
  const bName = window.prompt("Enter new branch name:");
  if (!bName) return;
  isLoading.value = true;
  try {
    await git(['checkout', '-b', bName, hash]);
    setStatus('✁ECreated branch ' + bName);
    await refresh();
  } catch(e) {
    await message(String(e), { title: 'Branch Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const cmCopyHash = async () => {
  if (!commitMenu.value) return;
  const hash = commitMenu.value.commit.hash;
  commitMenu.value = null;
  try {
    await navigator.clipboard.writeText(hash);
    setStatus('✁ECopied hash: ' + hash);
  } catch(e) {
    console.error(e);
  }
};

onMounted(() => {
  window.addEventListener('click', closeMenus);
});
onUnmounted(() => {
  window.removeEventListener('click', closeMenus);
});


const inspectCommit = async (hash: string) => {
  isLoading.value = true;
  try {
    const showRaw = await git(['show', '--name-status', '--format=%h|%s|%an|%cr', hash]);
    const lines = showRaw.split('\n');
    const meta = lines[0].split('|');
    const files: { path: string, status: string }[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const [status, path] = line.split(/\s+/);
      if (status && path) files.push({ path, status });
    }

    inspectModal.value = {
      hash: meta[0],
      message: meta[1],
      author: meta[2],
      date: meta[3],
      files
    };
  } catch (e) {
    await message(String(e), { title: 'Inspect Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const openCommitFileDiff = async (f: { path: string, status: string }) => {
  if (!inspectModal.value) return;
  const hash = inspectModal.value.hash;
  isLoading.value = true;
  try {
    const [original, modified] = await Promise.all([
      git(['show', `${hash}^:${f.path}`]).catch(() => ''), // might be new file
      git(['show', `${hash}:${f.path}`])
    ]);
    diffModal.value = {
      file: { path: f.path, name: f.path.split('/').pop() || f.path, status: f.status as any, staged: false },
      original,
      modified
    };
  } catch (e) {
    await message(String(e), { title: 'Diff Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

// ─── Branch click ──────────────────────────────────────────────────────
const onBranchClick = async (branch: GitBranch) => {
  selectedBranch.value = branch;
  await loadBranchHistory(branch);
};

// ─── Toolbar ──────────────────────────────────────────────────────────
const doCommit = async () => {
  if (!commitMessage.value.trim()) return;
  if (stagedFiles.value.length === 0) {
    setStatus('✁ENo files staged for commit', 5000);
    return;
  }
  isLoading.value = true;
  try {
    await git(['commit', '-m', commitMessage.value]);
    commitMessage.value = ''; setStatus('✁ECommitted'); await refresh();
  } catch (e) { setStatus('✁ECommit: ' + e, 6000); } finally { isLoading.value = false; }
};

// ─── Stage / Unstage ──────────────────────────────────────────────────
const stageFile   = async (f: GitFile) => { try { await git(['add', f.path]); await loadStatus(); } catch (e) { setStatus(''+e,5000); } };
const unstageFile = async (f: GitFile) => { try { await git(['reset', 'HEAD', f.path]); await loadStatus(); } catch (e) { setStatus(''+e,5000); } };
const stageAll    = async () => { try { await git(['add', '.']); await loadStatus(); setStatus('✁EStaged all'); } catch (e) { setStatus(''+e,5000); } };
const unstageAll  = async () => { try { await git(['reset', 'HEAD', '.']); await loadStatus(); setStatus('✁EUnstaged all'); } catch (e) { setStatus(''+e,5000); } };

const revertFile = async (f: GitFile) => {
  const ok = await ask(`Are you sure you want to discard changes in "${f.name}"? This cannot be undone.`, {
    title: 'Discard Changes',
    kind: 'warning'
  });
  if (!ok) return;
  
  isLoading.value = true;
  try {
    await git(['checkout', '--', f.path]);
    setStatus('✁EReverted ' + f.name);
    triggerEditorReload.value++;
    await loadStatus();
  } catch (e) {
    await message(String(e), { title: 'Revert Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

const openFileCtxMenu = (e: MouseEvent, file: GitFile) => {
  e.preventDefault(); e.stopPropagation();
  let x = e.clientX;
  let y = e.clientY;
  const menuW = 180;
  const menuH = 120;
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
  fileCtxMenu.value = { x, y, file };
};

// ─── Switch branch ─────────────────────────────────────────────────────
const switchBranch = async (branch: GitBranch) => {
  if (branch.isCurrent) return;
  if (!gitTabRepoPath.value) return;

  await smartGitOp(`Switch to ${branch.name}`, async () => {
    if (branch.isRemote) {
      const localName = branch.name.replace(/^origin\//, '');
      const exists = gitBranches.value.some(b => !b.isRemote && b.name === localName);
      if (exists) {
        await git(['checkout', localName]);
      } else {
        await git(['checkout', '-b', localName, '--track', branch.name]);
      }
    } else {
      await git(['checkout', branch.name]);
    }
    setStatus('✁ESwitched to ' + branch.name);
  });
};

// ─── File diff modal ───────────────────────────────────────────────────
const openFileDiff = async (file: GitFile) => {
  try {
    let original = '', modified = '';
    if (file.staged) {
      try { original = await git(['show', 'HEAD:' + file.path]); } catch { original = ''; }
      modified = await git(['show', ':' + file.path]);
    } else {
      try { original = await git(['show', ':' + file.path]); } catch { original = ''; }
      modified = await invoke<string>('read_file_content', { path: gitTabRepoPath.value + '/' + file.path });
    }
    diffModal.value = { file, original, modified };
  } catch (e) { setStatus('Cannot diff: ' + e, 5000); }
};

// ─── Context menu (Create branch only) ────────────────────────────────
const openCtxMenu = (e: MouseEvent, branch: GitBranch) => {
  e.preventDefault(); e.stopPropagation();
  let x = e.clientX;
  let y = e.clientY;
  
  // Viewport collision detection (approx menu size: 220x150)
  const menuW = 220;
  const menuH = 150;
  
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
  if (x < 10) x = 10;
  if (y < 10) y = 10;

  ctxMenu.value = { x, y, branch };
};
const closeCtxMenu = () => { ctxMenu.value = null; };
const ctxCreateBranch = () => {
  if (!ctxMenu.value) return;
  createModal.value = { fromBranch: ctxMenu.value.branch.name };
  newBranchName.value = ''; closeCtxMenu();
};
const doCreateBranch = async () => {
  if (!createModal.value || !newBranchName.value.trim()) return;
  const { fromBranch } = createModal.value; const name = newBranchName.value.trim();
  createModal.value = null; isLoading.value = true;
  try { await git(['checkout', '-b', name, fromBranch]); setStatus('✁ECreated "' + name + '"'); await loadBranches(); }
  catch (e) { await message(String(e), { title: 'Create Branch Failed', kind: 'error' }); } finally { isLoading.value = false; }
};

const ctxCheckoutBranch = async () => {
  if (!ctxMenu.value) return;
  const branch = ctxMenu.value.branch;
  closeCtxMenu();
  await switchBranch(branch);
};

const ctxDeleteBranch = async () => {
  if (!ctxMenu.value) return;
  const branch = ctxMenu.value.branch;
  if (branch.isCurrent) return;
  
  const ok = await ask(`Are you sure you want to delete branch "${branch.name}"?`, {
    title: 'Delete Branch',
    kind: 'warning'
  });
  if (!ok) return;

  closeCtxMenu();
  isLoading.value = true;
  try {
    // If remote, delete remote ref, else delete local
    if (branch.isRemote) {
      const [remote, ...rest] = branch.name.split('/');
      await git(['push', remote, '--delete', rest.join('/')]);
    } else {
      await git(['branch', '-D', branch.name]);
    }
    setStatus('✁EDeleted ' + branch.name);
    await refresh();
  } catch (e) {
    await message(String(e), { title: 'Delete Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};




const pushCurrentBranch = async () => {
  if (!currentBranch.value) return;
  isLoading.value = true;
  try {
    await git(['push']);
    setStatus('✁EPushed to remote');
    await refresh();
  } catch (e) {
    await message(String(e), { title: 'Push Failed', kind: 'error' });
  } finally {
    isLoading.value = false;
  }
};

// ─── Lifecycle ─────────────────────────────────────────────────────────
onMounted(async () => {
  // Fallback to projectRootPath if available
  if (!gitTabRepoPath.value && projectRootPath.value) {
    try {
      await invoke('git_execute', { args: ['rev-parse', '--is-inside-work-tree'], cwd: projectRootPath.value });
      gitTabRepoPath.value = projectRootPath.value;
    } catch (_) { /* ignore */ }
  }
  if (gitTabRepoPath.value) refresh();
});
watch(gitTabRepoPath, (v) => { 
  if (v) refresh(); 
  else resetGitState();
});
watch(triggerGitRefresh, () => {
  if (gitTabRepoPath.value) {
    refresh();
  }
});
watch(triggerCloseModals, closeMenus);
const closeOnClickOutside = () => { if (ctxMenu.value) ctxMenu.value = null; };
onMounted(() => document.addEventListener('click', closeOnClickOutside));
onUnmounted(() => document.removeEventListener('click', closeOnClickOutside));

// ─── Icons ────────────────────────────────────────────────────────────
const IconFolder  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const IconRefresh = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
const IconPlus    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const IconMinus   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const IconBranch  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>`;
const IconClose   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const IconCommit  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="1.05" y1="12" x2="7" y2="12"></line><line x1="17.01" y1="12" x2="22.96" y2="12"></line></svg>`;
const ChevronRight = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

const IconUndo    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>`;
const IconRedo    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>`;
const IconFetch   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
const IconPushUp  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;
const IconStash   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8H3"></path><path d="M10 12H14"></path><path d="M19 8V18A2 2 0 0 1 17 20H7A2 2 0 0 1 5 18V8"></path></svg>`;
const IconPop     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.89V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.11"></path><polyline points="12 11 17 6 7 6 12 11"></polyline></svg>`;
</script>

<template>
  <div class="git-tab">

    
    <div class="git-left">
      
      <div class="repo-bar" :class="{ empty: !gitTabRepoPath }" @click="!gitTabRepoPath && openRepo()">
        <template v-if="gitTabRepoPath">
          <span class="icon-green" v-html="IconFolder"></span>
          <span class="repo-name" :title="gitTabRepoPath">{{ gitTabRepoPath.split(/[/\\]/).pop() }}</span>
          <button class="icon-btn-tiny" @click.stop="refresh" title="Refresh State" v-html="IconRefresh"></button>
        </template>
        <template v-else>
          <span class="icon-green" v-html="IconFolder"></span>
          <span class="open-hint">Click to open a git repository…</span>
        </template>
      </div>

      <div class="sidebar-scroll">
        <div v-if="!gitTabRepoPath" class="no-repo-hint">
            <p>No repository selected</p>
            <button class="open-repo-btn" @click="openRepo">Open Repository</button>
        </div>
        <template v-else>
          
          <div class="sidebar-sec">
            <div class="sec-hdr" @click="toggleSection('changes')">
              <span class="chevron" :class="{ open: expandedSections.has('changes') }" v-html="ChevronRight"></span>
              <span class="sec-title">SOURCE CONTROL</span>
              <span class="sec-badge" v-if="changesCount > 0">{{ changesCount }}</span>
            </div>
            <div v-if="expandedSections.has('changes')" class="sec-content">
              
              <div v-if="stagedFiles.length > 0" class="fgroup-sidebar">
                <div class="fgroup-hdr-sb">
                  STAGED ({{ stagedFiles.length }})
                  <button class="stage-all-sb" @click="unstageAll" title="Unstage All" style="transform: rotate(180deg)">
                    <span v-html="IconPlus"></span>
                  </button>
                </div>
                <div v-for="f in stagedFiles" :key="'s'+f.path" class="file-row-sb" @click="openFileDiff(f)" @contextmenu.prevent="openFileCtxMenu($event, f)" :title="f.path">
                  <span class="fbadge" :class="f.status">{{ f.status }}</span>
                  <span class="fname" v-html="highlightSearch(f.name)"></span>
                  <button class="fact-sb" @click.stop="unstageFile(f)" title="Unstage" v-html="IconMinus"></button>
                </div>
              </div>
              
              <div v-if="unstagedFiles.length > 0" class="fgroup-sidebar">
                <div class="fgroup-hdr-sb">
                  CHANGES ({{ unstagedFiles.length }})
                  <button class="stage-all-sb" @click="stageAll" v-html="IconPlus" title="Stage All"></button>
                </div>
                <div v-for="f in unstagedFiles" :key="'u'+f.path" class="file-row-sb" @click="openFileDiff(f)" @contextmenu.prevent="openFileCtxMenu($event, f)" :title="f.path">
                  <span class="fbadge" :class="f.status">{{ f.status }}</span>
                  <span class="fname" v-html="highlightSearch(f.name)"></span>
                  <button class="fact-sb" @click.stop="stageFile(f)" title="Stage" v-html="IconPlus"></button>
                </div>
              </div>
              <div v-if="changesCount === 0" class="empty-hint-sb">No changes detected</div>
              
              
              <div class="commit-sidebar">
                <textarea v-model="commitMessage" placeholder="Message… (Ctrl+Enter)" @keydown.ctrl.enter="doCommit" class="commit-ta-sb"></textarea>
                <button class="commit-btn-sb" @click="doCommit" :disabled="!commitMessage.trim() || isLoading">
                  <span v-html="IconCommit"></span>
                </button>
              </div>
            </div>
          </div>

          
          <div class="sidebar-sec">
            <div class="sec-hdr" @click="toggleSection('branches')">
              <span class="chevron" :class="{ open: expandedSections.has('branches') }" v-html="ChevronRight"></span>
              <span class="sec-title">BRANCHES</span>
              <span class="sec-badge">{{ gitBranches.length }}</span>
            </div>
            <div v-if="expandedSections.has('branches')" class="sec-content">
              
              <div class="sec-label-sb">LOCAL</div>
              <div
                v-for="branch in localBranches" :key="branch.name"
                class="branch-row-sb"
                :class="{ current: branch.isCurrent, selected: selectedBranch?.name === branch.name }"
                @click="onBranchClick(branch)"
                @dblclick="switchBranch(branch)"
                @contextmenu.prevent="openCtxMenu($event, branch)"
              >
                <span class="b-dot" :class="{ on: branch.isCurrent }"></span>
                <span class="b-icon" v-html="IconBranch"></span>
                <span class="b-name" :title="branch.name" v-html="highlightSearch(branch.name)"></span>
                <span class="b-status" v-if="branch.ahead || branch.behind">
                  <span v-if="branch.ahead" class="ahead">↑{{ branch.ahead }}</span>
                  <span v-if="branch.behind" class="behind">↓{{ branch.behind }}</span>
                </span>
              </div>
              
              <div class="sec-label-sb" style="margin-top: 8px;">REMOTE (origin)</div>
              <div
                v-for="branch in remoteBranches" :key="branch.name"
                class="branch-row-sb remote"
                :class="{ selected: selectedBranch?.name === branch.name }"
                @click="onBranchClick(branch)"
                @contextmenu.prevent="openCtxMenu($event, branch)"
              >
                <span class="b-dot"></span>
                <span class="b-icon" v-html="IconBranch"></span>
                <span class="b-name" :title="branch.name" v-html="highlightSearch(branch.name.replace(/^origin\//,''))"></span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    
    <div class="git-right">

      
      <div class="git-toolbar">
        <div class="t-title">Commit History</div>
        <div class="t-spacer"></div>
        <span class="status-pill" :class="{ err: statusMessage.includes('Error') || statusMessage.includes('ERR') || statusMessage.includes('Failed') }">
          {{ statusMessage || (isLoading ? 'Updating...' : 'Ready') }}
          <span v-if="isLoading" class="spin"></span>
        </span>
      </div>

      
      <div class="git-ops-bar">
        <button class="op-btn" @click="undoCommit" :disabled="isLoading" title="Undo Last Commit">
          <span class="op-icon" v-html="IconUndo"></span>
          <span class="op-label">Undo</span>
        </button>
        <button class="op-btn disabled" title="Redo (Not implemented)">
          <span class="op-icon" v-html="IconRedo"></span>
          <span class="op-label">Redo</span>
        </button>
        <div class="op-sep"></div>
        <button class="op-btn" @click="gitFetch" :disabled="isLoading" title="Fetch All Remotes">
          <span class="op-icon" v-html="IconFetch"></span>
          <span class="op-label">Fetch</span>
        </button>
        <button class="op-btn" @click="pushCurrentBranch" :disabled="isLoading || !currentBranch" title="Push Current Branch">
          <span class="op-icon" v-html="IconPushUp"></span>
          <span class="op-label">Push</span>
        </button>
        <div class="op-sep"></div>
        <button class="op-btn" @click="ctxMenu = { x: 400, y: 300, branch: { name: currentBranch, isRemote: false, isCurrent: true } }" :disabled="!currentBranch" title="Branch Management">
          <span class="op-icon" v-html="IconBranch"></span>
          <span class="op-label">Branch</span>
        </button>
        <div class="op-sep"></div>
        <button class="op-btn" @click="gitStash" :disabled="isLoading" title="Stash Changes">
          <span class="op-icon" v-html="IconStash"></span>
          <span class="op-label">Stash</span>
        </button>
        <button class="op-btn" @click="gitPop" :disabled="isLoading" title="Pop Latest Stash">
          <span class="op-icon" v-html="IconPop"></span>
          <span class="op-label">Pop</span>
        </button>
      </div>

      
      <div class="panel-body">
        <div class="history-context-bar">
            <div style="display:flex; align-items:center; gap:8px;">
              <span v-html="IconCommit"></span>
              <b v-if="showAllHistory">All Branches</b>
              <b v-else-if="selectedBranch">{{ selectedBranch.name }}</b>
              <b v-else>History</b>
            </div>
            <span class="h-spacer"></span>
            <label class="all-history-toggle">
              <input type="checkbox" v-model="showAllHistory" @change="loadBranchHistory()" />
              <span>Show All Branches</span>
            </label>
        </div>
        
        <div v-if="isLoadingLogs" class="panel-loading">
          <span class="spin"></span> Loading history…
        </div>
        <div v-else-if="!selectedBranch" class="panel-hint">
          Click a branch to view its commit history
        </div>
        <div v-else-if="graphCommits.length === 0" class="panel-hint">No commits found</div>
        <div v-else class="git-svg-container" @click="closeMenus">
          <svg class="graph-svg" :style="{ width: (maxLanes * 16 + 20) + 'px', height: (graphCommits.length * 36) + 'px' }">
            <path v-for="(p, i) in graphPaths" :key="i" :d="p.d" :stroke="p.color" fill="none" stroke-width="2" />
          </svg>
          <div class="commit-rows-overlay">
            <div v-for="c in graphCommits" :key="c.hash" 
                 class="commit-row-v" 
                 :style="{ height: '36px', '--row-color': c.color + '1a' }"
                 @click.stop="inspectCommit(c.hash)"
                 @dblclick.stop="checkoutCommit(c.hash)"
                 @contextmenu.prevent.stop="openCommitMenu($event, c)">
               
               <div class="g-node-abs" :style="{ left: (16 + c.lane * 16 + 8) + 'px', background: c.color }" :data-initials="c.initials"></div>
               
               <div class="log-details-single" :style="{ paddingLeft: (maxLanes * 16 + 40) + 'px' }">
                 <span v-html="c.decorHtml"></span>
                 <span class="c-msg">{{ c.msg }}</span>
                 <span class="c-hash">{{ c.hash.substring(0, 7) }}</span>
                 <span class="c-date">{{ c.date }}</span>
                 <span class="c-author">{{ c.author }}</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    
    <Teleport to="body">
      <div v-if="commitMenu" class="ctx-menu" :style="{ top: commitMenu.y+'px', left: commitMenu.x+'px' }" @click.stop>
        <div class="ctx-label">{{ commitMenu.commit.hash.substring(0, 7) }}</div>
        <div class="ctx-div"></div>
        <div class="ctx-item" @click="cmCheckout">
          <span v-html="IconCommit"></span> Checkout Commit
        </div>
        <div class="ctx-item" @click="cmCreateBranch">
          <span v-html="IconBranch"></span> Create Branch Here
        </div>
        <div class="ctx-item" @click="cmCopyHash">
          <span v-html="IconCommit"></span> Copy Commit Hash
        </div>
      </div>

      <div v-if="ctxMenu" class="ctx-menu" :style="{ top: ctxMenu.y+'px', left: ctxMenu.x+'px' }" @click.stop>
        <div class="ctx-label">{{ ctxMenu.branch.name }}</div>
        <div class="ctx-div"></div>
        <div class="ctx-item" @click="ctxCheckoutBranch" v-if="!ctxMenu.branch.isCurrent">
          <span v-html="IconBranch"></span> Checkout Branch
        </div>
        <div class="ctx-item" @click="ctxCreateBranch">
          <span v-html="IconPlus"></span> New Branch From Here
        </div>
        <div class="ctx-div"></div>
        <div class="ctx-item ctx-danger" @click="ctxDeleteBranch" v-if="!ctxMenu.branch.isCurrent">
          <span v-html="IconMinus"></span> Delete Branch
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="createModal" class="modal-bg" @click.self="createModal = null">
        <div class="modal-box">
          <div class="modal-hdr">
            Create branch from <b>{{ createModal.fromBranch }}</b>
            <button class="modal-close" @click="createModal = null" v-html="IconClose"></button>
          </div>
          <div class="modal-body">
            <label class="modal-lbl">New branch name</label>
            <input v-model="newBranchName" placeholder="feature/my-branch" class="modal-input" @keydown.enter="doCreateBranch" autofocus />
            <div class="modal-acts">
              <button class="btn-cancel" @click="createModal = null">Cancel</button>
              <button class="btn-ok" @click="doCreateBranch" :disabled="!newBranchName.trim()">Create & Switch</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="fileCtxMenu" class="ctx-menu" :style="{ top: fileCtxMenu.y + 'px', left: fileCtxMenu.x + 'px' }" @click.stop>
        <div class="ctx-label">{{ fileCtxMenu.file.name }}</div>
        <div class="ctx-div"></div>
        
        <div v-if="!fileCtxMenu.file.staged" class="ctx-item" @click="stageFile(fileCtxMenu.file); fileCtxMenu = null">
          <span v-html="IconPlus"></span> Stage File
        </div>
        <div v-if="fileCtxMenu.file.staged" class="ctx-item" @click="unstageFile(fileCtxMenu.file); fileCtxMenu = null">
          <span v-html="IconMinus"></span> Unstage File
        </div>
        
        <div v-if="!fileCtxMenu.file.staged" class="ctx-item ctx-danger" @click="revertFile(fileCtxMenu.file); fileCtxMenu = null">
          <span v-html="IconUndo"></span> Discard Changes (Revert)
        </div>
        
        <div class="ctx-div"></div>
        <div class="ctx-item" @click="openFileDiff(fileCtxMenu.file); fileCtxMenu = null">
          <span v-html="IconCommit"></span> View Changes (Diff)
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="diffModal" class="modal-bg diff-bg" @click.self="diffModal = null">
        <div class="modal-box diff-box">
          <div class="modal-hdr">
            <span>Diff: {{ diffModal.file.path }}</span>
            <div class="diff-nav-acts">
              <button class="diff-nav-btn" @click.stop="prevDiff" title="Previous Change" v-html="IconUp"></button>
              <button class="diff-nav-btn" @click.stop="nextDiff" title="Next Change" v-html="IconDown"></button>
            </div>
            <button class="modal-close" @click="diffModal = null" v-html="IconClose"></button>
          </div>
          <div class="diff-wrap">
            <VueMonacoDiffEditor
              class="diff-inst"
              :theme="globalTheme === 'light' ? 'vs' : 'vs-dark'"
              :original="diffModal.original"
              :modified="diffModal.modified"
              :options="{ readOnly: true, renderSideBySide: true, fontSize: 13 }"
              @mount="handleDiffMount"
            />
          </div>
        </div>
      </div>
    </Teleport>

    
    <Teleport to="body">
      <div v-if="inspectModal" class="modal-bg" @click.self="inspectModal = null">
        <div class="modal-box inspect-box">
          <div class="modal-hdr">
            <div class="inspect-hdr-info">
              <span class="inspect-hash">{{ inspectModal.hash }}</span>
              <span class="inspect-msg">{{ inspectModal.message }}</span>
            </div>
            <button class="modal-close" @click="inspectModal = null" v-html="IconClose"></button>
          </div>
          <div class="inspect-sub-hdr">
             <span class="inspect-author">{{ inspectModal.author }}</span>
             <span class="inspect-date">{{ inspectModal.date }}</span>
          </div>
          <div class="modal-body inspect-body">
            <div class="inspect-files-lbl">CHANGED FILES ({{ inspectModal.files.length }})</div>
            <div class="inspect-files-list">
              <div v-for="f in inspectModal.files" :key="f.path" class="inspect-file-row" @click="openCommitFileDiff(f)">
                <span class="fbadge" :class="f.status">{{ f.status }}</span>
                <span class="inspect-file-path">{{ f.path }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.git-tab { display:flex; height:100%; background:var(--container-bg); color:var(--text-color); overflow:hidden; font-size:0.82rem; }

/* ─ Left ─────────────────────────────────────────────────────────────── */
.git-left { width:260px; flex-shrink:0; display:flex; flex-direction:column; border-right:var(--border-style); background:rgba(0,0,0,0.12); }
.panel-header { display:flex; align-items:center; justify-content:space-between; padding:0 12px; height:40px; border-bottom:var(--border-style); flex-shrink:0; }
.header-title { display:flex; align-items:center; gap:7px; font-size:0.65rem; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; opacity:.85; }
.hdr-acts { display:flex; gap:3px; }
.icon-btn { background:transparent; border:none; cursor:pointer; color:var(--text-color); opacity:.5; width:26px; height:26px; border-radius:4px; display:flex; align-items:center; justify-content:center; }
.icon-btn:hover { opacity:1; background:rgba(255,255,255,.08); }
.icon-btn:disabled { opacity:.2; cursor:not-allowed; }

.repo-bar { display:flex; align-items:center; gap:8px; padding:7px 12px; border-bottom:var(--border-style); min-height:36px; flex-shrink:0; }
.repo-bar.empty { cursor:pointer; opacity:.5; }
.repo-bar.empty:hover { opacity:1; background:rgba(255,255,255,.04); }
.repo-name { flex:1; font-size:.78rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.open-hint { font-size:.75rem; font-style:italic; }
.branch-badge { display:flex; align-items:center; gap:3px; background:rgba(52,211,153,.15); color:#34d399; border-radius:10px; padding:2px 8px; font-size:.68rem; font-weight:600; flex-shrink:0; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.branch-scroll, .sidebar-scroll { flex:1; overflow-y:auto; padding-bottom:20px; }
.no-repo, .no-repo-hint { padding:40px 20px; text-align:center; opacity:.5; font-size:.78rem; }
.open-repo-btn { margin-top:12px; background:var(--accent-color); color:#fff; border:none; padding:6px 16px; border-radius:4px; cursor:pointer; font-weight:600; font-size:.7rem; }

/* ─ Sidebar Sections ─────────────────────────────────────────────────── */
.sidebar-sec { border-bottom:1px solid rgba(255,255,255,.05); }
.sec-hdr { display:flex; align-items:center; gap:6px; padding:8px 12px; cursor:pointer; background:rgba(255,255,255,.02); transition:background .15s; }
.sec-hdr:hover { background:rgba(255,255,255,.05); }
.sec-title { font-size:.68rem; font-weight:800; opacity:.6; letter-spacing:.8px; flex:1; }
.sec-badge { font-size:.62rem; font-weight:800; background:rgba(255,255,255,.1); padding:1px 6px; border-radius:10px; opacity:.7; }
.chevron { opacity:.4; transition:transform .2s; display:flex; align-items:center; }
.chevron.open { transform:rotate(90deg); }
.sec-content { padding-bottom:8px; }

.sec-label-sb { font-size:.6rem; font-weight:900; opacity:.3; padding:10px 14px 4px; letter-spacing:1px; }

/* Changes in Sidebar */
.fgroup-sidebar { margin-bottom:10px; }
.fgroup-hdr-sb { font-size:.62rem; font-weight:700; opacity:.4; padding:8px 14px 4px; display:flex; justify-content:space-between; align-items:center; }
.file-row-sb { display:flex; align-items:center; gap:8px; padding:4px 14px; cursor:pointer; transition:background .1s; }
.file-row-sb:hover { background:rgba(255,255,255,.06); }
.fact-sb { display:none; background:transparent; border:none; color:var(--text-color); opacity:.5; cursor:pointer; padding:2px; border-radius:4px; }
.file-row-sb:hover .fact-sb { display:flex; }
.fact-sb:hover { opacity:1; background:rgba(255,255,255,.1); }
.stage-all-sb { background:transparent; border:none; color:var(--accent-color); cursor:pointer; opacity:.8; font-size:.8rem; display:flex; align-items:center; }
.stage-all-sb:hover { opacity:1; }
.empty-hint-sb { padding:10px 14px; font-size:.72rem; opacity:.3; font-style:italic; }

/* Branches in Sidebar */
.branch-row-sb { display:flex; align-items:center; gap:8px; padding:6px 14px; cursor:pointer; transition:background .1s; position:relative; }
.branch-row-sb:hover { background:rgba(255,255,255,.06); }
.branch-row-sb.current { 
  background:rgba(52,211,153,.1); 
  border-left:3px solid #34d399;
  padding-left:11px;
}
.branch-row-sb.current .b-name { color:#34d399; font-weight:700; }
.branch-row-sb.selected { background:rgba(255,255,255,.1); }

/* Commit Sidebar */
.commit-sidebar { padding:10px 14px; display:flex; gap:6px; margin-top:5px; border-top:1px solid rgba(255,255,255,.03); }
.commit-ta-sb { flex:1; background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.08); border-radius:4px; color:var(--text-color); padding:6px 8px; font-size:.74rem; resize:none; min-height:40px; outline:none; font-family:inherit; }
.commit-ta-sb:focus { border-color:var(--accent-color); }
.commit-btn-sb { background:var(--accent-color); color:#fff; border:none; border-radius:4px; width:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:opacity .2s; flex-shrink:0; }
.commit-btn-sb:hover { opacity:.9; }
.commit-btn-sb:disabled { opacity:.3; cursor:not-allowed; }

/* ─ Right ────────────────────────────────────────────────────────────── */
.git-right { flex:1; display:flex; flex-direction:column; min-width:0; }

.git-toolbar { display:flex; align-items:center; gap:12px; padding:0 12px; height:38px; border-bottom:var(--border-style); background:rgba(0,0,0,.15); flex-shrink:0; }
.t-title { font-size:.72rem; font-weight:700; opacity:.6; letter-spacing:.5px; text-transform:uppercase; }
.tbtn { display:flex; align-items:center; gap:4px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.09); color:var(--text-color); padding:4px 10px; border-radius:5px; cursor:pointer; font-size:.73rem; font-weight:500; transition:background .15s; white-space:nowrap; }
.tbtn:hover { background:rgba(255,255,255,.12); }
.tbtn:disabled { opacity:.3; cursor:not-allowed; }
.tbtn.danger { color:#f87171; }
.tbtn.danger:hover { background:rgba(248,113,113,.12); }
.t-sep { width:1px; height:18px; background:rgba(255,255,255,.1); margin:0 2px; }
.t-spacer { flex:1; }

.view-actions-standalone { display:flex; gap:8px; align-items:center; }
.vbtn { display:flex; align-items:center; gap:6px; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:.72rem; font-weight:700; border:1px solid transparent; transition:all .2s; }
.sync-btn-small { background:rgba(52,211,153,.15); color:#34d399; border-color:rgba(52,211,153,.2); padding:3px 10px; }
.sync-btn-small:hover { background:rgba(52,211,153,.25); }
.push-btn-small { background:rgba(255,255,255,.1); color:var(--text-color); border-color:rgba(255,255,255,.15); padding:3px 10px; }
.push-btn-small:hover { background:rgba(255,255,255,.2); }
.vbtn:disabled { opacity:.4; cursor:not-allowed; }

.history-context-bar { display:flex; align-items:center; gap:8px; padding:8px 14px; background:rgba(255,255,255,.03); border-bottom:1px solid rgba(255,255,255,.05); font-size:.76rem; }
.all-history-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s; font-size: 0.72rem; }
.all-history-toggle:hover { opacity: 1; }
.all-history-toggle input { cursor: pointer; margin: 0; }
.h-spacer { flex:1; }

.status-pill { font-size:.7rem; opacity:.5; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.status-pill.err { color:#f87171; opacity:1; }

.spin { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent-color); animation:pulse .8s ease-in-out infinite; margin-left:4px; }
@keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)} }

.panel-body { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
.panel-hint { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; opacity:.35; font-size:.78rem; gap:8px; }
.panel-loading { display:flex; align-items:center; gap:10px; padding:20px; opacity:.5; font-size:.78rem; }

/* Log list */
.log-list { display:flex; flex-direction:column; padding:0; user-select:none; }
.log-line { 
  display: flex;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; 
  font-size: 0.78rem; 
  padding: 0;
  opacity: 0.9;
  line-height: 1.4;
  border-bottom: 1px solid rgba(255,255,255,.02);
}
.log-line:hover { background: rgba(255,255,255,0.04); opacity: 1; }

.log-row { display: flex; width: 100%; transition: background .1s; }
.log-graph { 
  white-space: pre; 
  padding: 4px 14px; 
  background: rgba(0,0,0,.1); 
  border-right: 1px solid rgba(255,255,255,.05);
  min-width: 80px;
}
.git-svg-container {
  position: relative;
  width: 100%;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.graph-svg {
  position: absolute;
  top: 0;
  left: 16px;
  z-index: 1;
}
.commit-rows-overlay {
  position: relative;
  z-index: 2;
  width: 100%;
}
.g-node-abs {
  position: absolute;
  top: 50%;
  transform: translateY(-50%) translateX(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 6px rgba(0,0,0,.4);
  border: 2px solid rgba(255,255,255,0.1);
  pointer-events: none;
}
.g-node-abs::after {
  content: attr(data-initials);
}
.commit-row-v {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  cursor: pointer; 
  border-bottom: 1px solid rgba(255,255,255,.015); 
  background: var(--row-color);
  transition: background .1s;
}
.commit-row-v:hover { background: rgba(255,255,255,0.08); }

.log-details-single { 
  flex: 1; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  overflow: hidden;
  white-space: nowrap;
  height: 100%;
}

.c-hash { 
  color: var(--accent-color); 
  font-weight: 700; 
  opacity: .3;
  font-size: .65rem;
  font-family: monospace;
}
.c-msg { 
  flex: 1; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  white-space: nowrap; 
  font-weight: 500;
  color: var(--text-color);
  font-size: .84rem;
}
.c-date, .c-author { 
  font-size: .62rem; 
  opacity: .2;
  white-space: nowrap;
}
.c-author { font-weight: 600; }

/* Decorations (Pills) */
.d-pill { 
  font-size: 0.65rem; 
  padding: 1px 6px; 
  border-radius: 4px; 
  font-weight: 700; 
  white-space: nowrap;
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,.8);
  border: 1px solid rgba(255,255,255,0.15);
}
.d-pill.head { background: #34d39922; color: #34d399; border-color: #34d39944; }
.d-pill.remote { background: #f472b622; color: #f472b6; border-color: #f472b644; }
.d-pill.tag { background: #fbbf2422; color: #fbbf24; border-color: #fbbf2444; }

/* Ops Bar */
.git-ops-bar { 
  display: flex; 
  align-items: center; 
  gap: 4px; 
  padding: 6px 12px; 
  background: rgba(0,0,0,.15); 
  border-bottom: 1px solid rgba(255,255,255,.05); 
}
.op-btn { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 3px; 
  padding: 6px 10px; 
  background: transparent; 
  border: none; 
  cursor: pointer; 
  border-radius: 6px; 
  color: var(--text-color); 
  opacity: .7; 
  transition: all .15s; 
  min-width: 50px;
}
.op-btn:hover:not(:disabled) { background: rgba(255,255,255,.08); opacity: 1; transform: translateY(-1px); }
.op-btn:active:not(:disabled) { transform: translateY(0); }
.op-btn:disabled { opacity: .2; cursor: default; }
.op-icon { display: flex; align-items: center; justify-content: center; }
.op-label { font-size: 0.62rem; font-weight: 600; opacity: .8; letter-spacing: 0.3px; }
.op-sep { width: 1px; height: 18px; background: rgba(255,255,255,.1); margin: 0 4px; }
.op-btn.disabled { opacity: .2; pointer-events: none; }

/* Changes */
.fgroup { margin-bottom:4px; }
.fgroup-hdr { display:flex; align-items:center; justify-content:space-between; padding:7px 14px 3px; }
.fgroup-lbl { font-size:.57rem; font-weight:900; letter-spacing:1.2px; opacity:.4; }
.stage-all { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text-color); padding:2px 8px; border-radius:4px; cursor:pointer; font-size:.65rem; opacity:.7; }
.stage-all:hover { opacity:1; }
.file-row { display:flex; align-items:center; gap:7px; padding:4px 14px; height:28px; cursor:pointer; transition:background .1s; }
.file-row:hover { background:rgba(255,255,255,.06); }
.fbadge { width:15px; height:15px; display:flex; align-items:center; justify-content:center; font-size:.6rem; font-weight:800; border-radius:3px; flex-shrink:0; }
.fbadge.M{color:#e2c08d}.fbadge.A{color:#81b88b}.fbadge.D{color:#c74e39}.fbadge.\?\?{color:#73c991}
.fname { font-size:.79rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:0; max-width:180px; }
.fpath { flex:1; font-size:.67rem; opacity:.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fact { display:none; background:transparent; border:none; cursor:pointer; color:var(--text-color); opacity:.6; padding:2px; border-radius:4px; align-items:center; justify-content:center; }
.file-row:hover .fact { display:flex; }
.fact:hover { opacity:1; background:rgba(255,255,255,.1); }

.commit-row { display:flex; gap:8px; padding:10px 14px; border-top:var(--border-style); background:rgba(0,0,0,.08); flex-shrink:0; }
.commit-ta { flex:1; background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.1); border-radius:6px; color:var(--text-color); padding:7px 10px; font-size:.79rem; resize:none; min-height:52px; outline:none; font-family:inherit; }
.commit-ta:focus { border-color:var(--accent-color); }
.commit-btn { display:flex; align-items:center; gap:5px; background:var(--accent-color); color:#fff; border:none; border-radius:6px; padding:0 14px; font-size:.76rem; font-weight:600; cursor:pointer; align-self:flex-end; height:34px; white-space:nowrap; }
.commit-btn:hover { opacity:.9; }
.commit-btn:disabled { opacity:.35; cursor:not-allowed; }

/* ─ Context menu ────────────────────────────────────────────────────── */
.ctx-menu { position:fixed; background:var(--container-bg); border:var(--border-style); border-radius:8px; box-shadow:0 8px 28px rgba(0,0,0,.45); z-index:9999; min-width:200px; padding:4px 0; animation:fadeIn .12s ease; }
@keyframes fadeIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:none}}
.ctx-label { padding:6px 14px; font-size:.68rem; font-weight:700; opacity:.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ctx-div { height:1px; background:rgba(255,255,255,.08); margin:3px 0; }
.ctx-item { display:flex; align-items:center; gap:8px; padding:8px 14px; cursor:pointer; font-size:.8rem; transition:background .1s; }
.ctx-item:hover { background:rgba(255,255,255,.08); }
.ctx-item.ctx-danger { color:#f87171; }
.ctx-item.ctx-danger:hover { background:rgba(248,113,113,.1); }

/* ─ Modals ──────────────────────────────────────────────────────────── */
.modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; z-index:8000; }
.diff-bg { align-items:stretch; padding:20px; }
.modal-box { background:var(--container-bg); border:var(--border-style); border-radius:10px; box-shadow:0 16px 48px rgba(0,0,0,.6); display:flex; flex-direction:column; min-width:320px; max-width:460px; overflow:hidden; }
.diff-box { flex:1; max-width:100%; border-radius:8px; }
.modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:11px 16px; background:rgba(0,0,0,.15); border-bottom:var(--border-style); font-size:.82rem; font-weight:600; }
.diff-nav-acts { display:flex; gap:6px; margin-right:12px; margin-left:auto; }
.diff-nav-btn { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:var(--text-color); width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:.7; transition:all .2s; }
.diff-nav-btn:hover { opacity:1; background:rgba(255,255,255,.1); border-color:var(--accent-color); }
.modal-close { background:transparent; border:none; cursor:pointer; color:var(--text-color); opacity:.5; display:flex; align-items:center; padding:2px; border-radius:4px; }
.modal-close:hover { opacity:1; }
.modal-body { padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
.inspect-box { min-width:500px; max-width:700px; }
.inspect-hdr-info { display:flex; flex-direction:column; gap:2px; }
.inspect-hash { font-family:monospace; font-size:.68rem; background:rgba(255,255,255,.1); padding:1px 4px; border-radius:3px; align-self:flex-start; opacity:.6; }
.inspect-msg { font-size:.85rem; font-weight:700; }
.inspect-sub-hdr { padding:8px 16px; font-size:.7rem; opacity:.5; display:flex; gap:10px; border-bottom:1px solid rgba(255,255,255,.05); }
.inspect-body { padding:0; height:400px; overflow-y:auto; }
.inspect-files-lbl { font-size:.65rem; font-weight:900; opacity:.3; padding:12px 16px 6px; letter-spacing:1px; }
.inspect-file-row { display:flex; align-items:center; gap:10px; padding:8px 16px; cursor:pointer; transition:background .1s; }
.inspect-file-row:hover { background:rgba(255,255,255,.06); }
.inspect-file-path { font-size:.78rem; opacity:.8; }
.modal-lbl { font-size:.73rem; opacity:.55; }
.modal-input { width:100%; padding:8px 12px; background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.1); border-radius:6px; color:var(--text-color); font-size:.8rem; outline:none; box-sizing:border-box; }
.modal-input:focus { border-color:var(--accent-color); }
.modal-acts { display:flex; gap:8px; justify-content:flex-end; }
.btn-cancel { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text-color); padding:7px 14px; border-radius:6px; cursor:pointer; font-size:.77rem; }
.btn-ok { background:#34d399; border:none; color:#0f2018; padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:700; font-size:.77rem; }
.btn-ok:hover { background:#6ee7b7; }
.btn-ok:disabled { opacity:.35; cursor:not-allowed; }

.diff-wrap { flex:1; display:flex; min-height:0; }
.diff-inst { flex:1; }

/* utility */
.icon-green { color:#34d399; display:flex; align-items:center; }
:root.theme-light .git-left { background:rgba(0,0,0,.04); }
:root.theme-light .commit-ta { background:rgba(0,0,0,.05); border-color:rgba(0,0,0,.12); }
</style>
