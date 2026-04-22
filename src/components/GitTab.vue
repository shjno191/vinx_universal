<script setup lang="ts">
import { ref, computed, onMounted, watch, shallowRef } from 'vue';
import { activeTab } from '../store';
import { Icons } from '../utils/icons';
import { useGit, type GitFile } from '../composables/useGit';

// == Logic ===================================================
const {
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
} = useGit();

const showBranchDropdown = ref(false);
const rightPanel = ref<'history' | 'diff'>('history');
const selectedCommit = ref<string | null>(null);

const diffContent = ref('');
const diffSource = ref('');
const diffLines = shallowRef<string[]>([]);

watch(diffContent, (val) => {
  diffLines.value = val ? val.split('\n') : [];
});

const handleRefresh = async () => {
  await refresh();
};

const handleCheckout = async (branch: string) => {
  try {
    await checkout(branch);
    showBranchDropdown.value = false;
  } catch (e) {
    alert(e);
  }
};

const handleGitOp = async (op: 'pull' | 'push' | 'fetch' | 'stash' | 'pop') => {
  try {
    await gitOp(op);
  } catch (e) {
    alert(e);
  }
};

const handleCommit = async () => {
  try {
    await commit();
  } catch (e) {
    alert(e);
  }
};

const showFileDiff = async (file: GitFile) => {
  rightPanel.value = 'diff';
  try {
    diffContent.value = await getDiff(file);
    diffSource.value = `${file.name} (${file.staged ? 'staged' : 'local'})`;
    selectedCommit.value = null;
  } catch (e) {
    console.error('Diff failed:', e);
  }
};

const showCommitDiff = async (hash: string) => {
  selectedCommit.value = hash;
  rightPanel.value = 'diff';
  try {
    diffContent.value = await getCommitDiff(hash);
    diffSource.value = hash.substring(0, 7);
  } catch (e) {
    console.error('Show commit failed:', e);
  }
};

const newBranchName = ref('');
const handleCreateBranch = async () => {
  if (!newBranchName.value.trim()) return;
  try {
    await createBranch(newBranchName.value);
    newBranchName.value = '';
    showBranchDropdown.value = false;
  } catch (e) {
    alert(e);
  }
};

const handleMergeBranch = async (branch: string) => {
  try {
    await mergeBranch(branch);
  } catch (e) {
    alert(e);
  }
};

onMounted(() => {
  init();
});

watch(activeTab, (tab) => {
  if (tab === 'Git') refresh();
});
</script>

<template>
  <div class="git-tab-premium">
    <!-- TOOLBAR -->
    <header class="git-toolbar">
      <div class="branch-selector-wrapper">
        <div class="branch-selector" @click="showBranchDropdown = !showBranchDropdown">
          <span class="repo-name">{{ repoPath.split('/').pop() || 'No Repo' }}</span>
          <span class="separator">/</span>
          <span class="branch-icon" v-html="Icons.Branch"></span>
          <span class="branch-name">{{ currentBranch || 'master' }}</span>
          <span class="caret" v-html="Icons.ChevronDown"></span>
        </div>
        
        <div v-if="showBranchDropdown" class="branch-dropdown glass-effect">
          <div class="dropdown-header">SWITCH BRANCH</div>
          <div class="branch-list">
            <div v-for="b in branches" :key="b.name" 
                 @click.stop="handleCheckout(b.name)"
                 class="branch-item" :class="{ active: b.isCurrent }">
              <span class="b-name">{{ b.name }}</span>
              <button v-if="!b.isCurrent" class="merge-btn" @click.stop="handleMergeBranch(b.name)">MERGE</button>
            </div>
          </div>
          <div class="new-branch-box">
            <input v-model="newBranchName" placeholder="New branch name..." 
                   @keyup.enter="handleCreateBranch" />
          </div>
        </div>
      </div>

      <div class="toolbar-divider"></div>
      
      <div class="git-ops">
        <button @click="handleGitOp('pull')" :disabled="isSyncing" class="op-btn">
          <span v-html="Icons.Pull"></span>
          PULL
        </button>
        <button @click="handleGitOp('push')" :disabled="isSyncing" class="op-btn">
          <span v-html="Icons.Push"></span>
          PUSH
        </button>
        <button @click="handleGitOp('fetch')" :disabled="isSyncing" class="op-btn">
          <span v-html="Icons.Refresh"></span>
          FETCH
        </button>
        <div class="toolbar-divider mini"></div>
        <button @click="handleGitOp('stash')" :disabled="isSyncing" class="op-btn">
          <span v-html="Icons.Stash"></span>
          STASH
        </button>
        <button @click="handleGitOp('pop')" :disabled="isSyncing" class="op-btn">POP</button>
      </div>

      <div v-if="isSyncing || isLoading" class="sync-status">
        <div class="spinner"></div>
        <span>SYNCING...</span>
      </div>
    </header>

    <div class="git-body">
      <!-- LEFT PANEL: Changes -->
      <aside class="left-panel">
        <div class="panel-section">
          <div class="section-header">
            <span>CHANGES ({{ changedFiles.length }})</span>
            <button @click="stage()" class="action-link">Stage All</button>
          </div>
          <div class="file-list">
            <div v-for="f in changedFiles" :key="f.name" 
                 class="file-row" @click="showFileDiff(f)">
              <span class="status-badge" :class="f.status">{{ f.status }}</span>
              <span class="file-path-label">{{ f.name }}</span>
              <button class="stage-btn" @click.stop="stage(f)">+</button>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <div class="section-header">
            <span>STAGED ({{ stagedFiles.length }})</span>
            <button @click="unstage()" class="action-link">Unstage All</button>
          </div>
          <div class="file-list">
            <div v-for="f in stagedFiles" :key="f.name" 
                 class="file-row staged" @click="showFileDiff(f)">
              <span class="status-badge" :class="f.status">{{ f.status }}</span>
              <span class="file-path-label">{{ f.name }}</span>
              <button class="stage-btn unstage" @click.stop="unstage(f)">-</button>
            </div>
          </div>
        </div>

        <div class="commit-box">
          <textarea v-model="commitMsg" placeholder="Commit message (Ctrl+Enter to commit)" 
                    @keydown.ctrl.enter="commit"></textarea>
          <button class="commit-btn" :disabled="!commitMsg.trim() || !stagedFiles.length" 
                  @click="commit">
            COMMIT CHANGES
          </button>
        </div>
      </aside>

      <!-- RIGHT PANEL: History/Diff -->
      <main class="right-panel">
        <nav class="panel-tabs">
          <button :class="{ active: rightPanel === 'history' }" @click="rightPanel = 'history'">
            HISTORY
          </button>
          <button :class="{ active: rightPanel === 'diff' }" @click="rightPanel = 'diff'">
            DIFF <span v-if="diffSource" class="diff-tag">{{ diffSource }}</span>
          </button>
        </nav>

        <div class="panel-content">
          <!-- HISTORY LIST -->
          <div v-if="rightPanel === 'history'" class="history-view">
            <div v-if="history.length === 0 && !isLoading" class="empty-state">No history found.</div>
            <div v-for="c in history" :key="c.hash" 
                 class="commit-row" :class="{ selected: selectedCommit === c.hash }"
                 @click="showCommitDiff(c.hash)">
              <span class="commit-hash">{{ c.short }}</span>
              <div class="commit-info">
                <div class="commit-message">{{ c.message }}</div>
                <div class="commit-meta">
                  <span class="author">@{{ c.author }}</span>
                  <span class="dot">.</span>
                  <span class="date">{{ c.date }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- DIFF VIEWER -->
          <div v-if="rightPanel === 'diff'" class="diff-view">
            <div v-if="!diffContent && !isLoading" class="empty-state">Select a file or commit to see diff.</div>
            <div class="diff-container">
              <div v-for="(line, i) in diffLines" :key="i" 
                   class="diff-line" 
                   :class="{ 
                     'diff-add': line.startsWith('+') && !line.startsWith('+++'), 
                     'diff-del': line.startsWith('-') && !line.startsWith('---'),
                     'diff-header': line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++'),
                     'diff-chunk': line.startsWith('@@')
                   }">
                <span class="line-no">{{ i + 1 }}</span>
                <span class="line-text">{{ line }}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.git-tab-premium { display: flex; flex-direction: column; height: 100%; background: var(--container-bg); color: var(--text-color); overflow: hidden; }

/* TOOLBAR */
.git-toolbar { height: 48px; border-bottom: 1px solid rgba(128,128,128,0.1); display: flex; align-items: center; padding: 0 15px; gap: 12px; background: rgba(0,0,0,0.1); z-index: 100; }
.branch-selector-wrapper { position: relative; }
.branch-selector { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); transition: 0.2s; }
.branch-selector:hover { background: rgba(255,255,255,0.08); border-color: var(--accent-color); }
.repo-name { font-size: 0.7rem; font-weight: 900; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }
.separator { opacity: 0.2; }
.branch-icon { color: var(--accent-color); font-size: 0.8rem; }
.branch-name { font-size: 0.75rem; font-weight: 800; color: var(--text-color); }
.caret { font-size: 0.6rem; opacity: 0.5; }

.branch-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 280px; background: var(--container-bg); border: 1px solid var(--accent-color); border-radius: 12px; padding: 10px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); z-index: 1000; }
.dropdown-header { font-size: 0.6rem; font-weight: 950; opacity: 0.4; padding: 5px 10px; text-transform: uppercase; letter-spacing: 0.1em; }
.branch-list { max-height: 300px; overflow-y: auto; margin: 8px 0; }
.branch-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; }
.branch-item:hover { background: rgba(99, 102, 241, 0.1); color: var(--accent-color); }
.branch-item.active { background: rgba(99, 102, 241, 0.2); font-weight: 800; color: var(--accent-color); }
.merge-btn { font-size: 0.55rem; padding: 2px 6px; background: rgba(99,102,241,0.1); color: var(--accent-color); border: 1px solid var(--accent-color); border-radius: 4px; opacity: 0; transition: 0.2s; font-weight: 900; }
.branch-item:hover .merge-btn { opacity: 1; }
.new-branch-box { border-top: 1px solid rgba(128,128,128,0.1); padding-top: 10px; margin-top: 5px; }
.new-branch-box input { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.3); border-radius: 6px; padding: 6px 10px; color: var(--text-color); font-size: 0.75rem; outline: none; }
.new-branch-box input:focus { border-color: var(--accent-color); }

.toolbar-divider { width: 1px; height: 20px; background: rgba(128,128,128,0.2); }
.toolbar-divider.mini { height: 12px; }
.git-ops { display: flex; gap: 6px; }
.op-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: 1px solid rgba(128,128,128,0.2); color: var(--text-color); padding: 5px 10px; border-radius: 6px; font-size: 0.62rem; font-weight: 900; cursor: pointer; transition: 0.2s; }
.op-btn:hover:not(:disabled) { background: rgba(255,255,255,0.05); border-color: var(--accent-color); color: var(--accent-color); }
.op-btn:disabled { opacity: 0.3; cursor: default; }

.sync-status { display: flex; align-items: center; gap: 8px; margin-left: auto; font-size: 0.6rem; font-weight: 950; opacity: 0.5; color: var(--accent-color); }
.spinner { width: 12px; height: 12px; border: 2px solid var(--accent-color); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* BODY */
.git-body { flex: 1; display: flex; overflow: hidden; }

/* LEFT PANEL */
.left-panel { width: 280px; border-right: 1px solid rgba(128,128,128,0.1); display: flex; flex-direction: column; background: rgba(0,0,0,0.05); }
.panel-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-bottom: 1px solid rgba(128,128,128,0.1); }
.section-header { padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; font-weight: 950; opacity: 0.4; letter-spacing: 0.05em; }
.action-link { background: transparent; border: none; font-size: 0.6rem; color: var(--accent-color); cursor: pointer; padding: 0; opacity: 0.8; font-weight: 800; }
.action-link:hover { text-decoration: underline; opacity: 1; }
.file-list { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
.file-row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: 0.2s; margin-bottom: 2px; }
.file-row:hover { background: rgba(255,255,255,0.04); }
.file-row.staged { background: rgba(52, 211, 153, 0.03); }
.status-badge { width: 20px; text-align: center; font-size: 0.6rem; font-weight: 950; padding: 2px 0; border-radius: 4px; }
.status-badge.M { color: #fbbf24; background: rgba(251,191,36,0.1); }
.status-badge.A { color: #34d399; background: rgba(52,211,153,0.1); }
.status-badge.D { color: #f87171; background: rgba(248,113,113,0.1); }
.status-badge.\?\? { color: #a1a1aa; background: rgba(161,161,170,0.1); }
.file-path-label { flex: 1; font-size: 0.72rem; color: var(--text-color); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stage-btn { background: transparent; border: none; color: var(--accent-color); font-size: 1rem; cursor: pointer; opacity: 0.3; transition: 0.2s; padding: 0 5px; }
.file-row:hover .stage-btn { opacity: 1; }
.stage-btn.unstage { color: #f87171; }

.commit-box { padding: 15px; background: rgba(0,0,0,0.1); border-top: 1px solid rgba(128,128,128,0.1); }
.commit-box textarea { width: 100%; height: 60px; background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.2); border-radius: 8px; color: var(--text-color); font-size: 0.75rem; padding: 8px; resize: none; margin-bottom: 10px; outline: none; }
.commit-box textarea:focus { border-color: var(--accent-color); }
.commit-btn { width: 100%; padding: 10px; background: var(--accent-color); color: #fff; border: none; border-radius: 8px; font-size: 0.65rem; font-weight: 950; cursor: pointer; transition: 0.2s; }
.commit-btn:disabled { opacity: 0.4; cursor: default; }

/* RIGHT PANEL */
.right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.panel-tabs { display: flex; height: 40px; border-bottom: 1px solid rgba(128,128,128,0.1); background: rgba(0,0,0,0.05); align-items: center; padding: 0 15px; gap: 20px; }
.panel-tabs button { background: transparent; border: none; font-size: 0.65rem; font-weight: 950; color: var(--text-color); opacity: 0.4; cursor: pointer; position: relative; height: 100%; transition: 0.2s; }
.panel-tabs button.active { opacity: 1; color: var(--accent-color); }
.panel-tabs button.active::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background: var(--accent-color); }
.diff-tag { font-size: 0.55rem; background: rgba(99,102,241,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 5px; opacity: 0.6; }

.panel-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* HISTORY VIEW */
.history-view { flex: 1; overflow-y: auto; padding: 10px; }
.commit-row { display: flex; align-items: flex-start; gap: 15px; padding: 10px 15px; border-radius: 10px; cursor: pointer; transition: 0.2s; margin-bottom: 2px; }
.commit-row:hover { background: rgba(255,255,255,0.04); }
.commit-row.selected { background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); }
.commit-hash { font-family: 'Consolas', monospace; font-size: 0.65rem; color: var(--accent-color); background: rgba(99,102,241,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 800; }
.commit-info { flex: 1; }
.commit-message { font-size: 0.8rem; font-weight: 600; color: var(--text-color); margin-bottom: 4px; }
.commit-meta { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; opacity: 0.4; }
.dot { font-weight: bold; }

/* DIFF VIEW */
.diff-view { flex: 1; overflow-y: auto; background: #0c0d11; color: #d1d5db; position: relative; }
.diff-container { padding: 15px; font-family: 'Consolas', monospace; font-size: 0.78rem; line-height: 1.5; }
.diff-line { display: flex; min-height: 1.2rem; }
.line-no { width: 40px; text-align: right; margin-right: 15px; opacity: 0.2; user-select: none; }
.line-text { white-space: pre-wrap; word-break: break-all; flex: 1; }

.diff-add { color: #34d399; background: rgba(52, 211, 153, 0.08); }
.diff-del { color: #f87171; background: rgba(248, 113, 113, 0.08); }
.diff-header { color: #60a5fa; font-weight: bold; }
.diff-chunk { color: #818cf8; opacity: 0.8; }

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; opacity: 0.3; font-style: italic; font-size: 0.8rem; height: 100%; }

.glass-effect { backdrop-filter: blur(20px); background: rgba(20, 21, 26, 0.9); }
</style>
