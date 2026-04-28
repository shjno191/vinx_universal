<script setup lang="ts">
import { ref, onMounted, watch, shallowRef, computed } from 'vue';
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { activeTab, type GitFile, theme as globalTheme } from '../store';
import { Icons } from '../utils/icons';
import { useGit } from '../composables/useGit';
import { useTranslateManager } from '../composables/useTranslateManager';


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
  commit,
  gitOp,
  getCommitDiff,
  getFileOriginalAndModified,
  createBranch,
  mergeBranch,
  openRepo,
  searchRepoFiles
} = useGit();

const { startLoading, stopLoading } = useTranslateManager();

const showBranchDropdown = ref(false);

const rightPanel = ref<'history' | 'diff'>('history');
const selectedCommit = ref<string | null>(null);

const diffContent = ref('');
const diffOriginalContent = ref('');
const diffModifiedContent = ref('');
const isFileDiff = ref(false);
const diffSource = ref('');
const diffLines = shallowRef<string[]>([]);
const isTruncated = ref(false);
const MAX_DIFF_LINES = 2000;

const currentDiffFile = ref<GitFile | null>(null);
const diffCompareTarget = ref('LOCAL');
const searchFileQuery = ref('');
const repoSearchQuery = ref('');
const repoSearchResults = ref<string[]>([]);
const showMergePanel = ref(false);

watch(repoSearchQuery, async (val) => {
    repoSearchResults.value = await searchRepoFiles(val);
});

const handleSelectSearchFile = (relativePath: string) => {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const absolutePath = `${repoPath.value}/${normalizedPath}`;
    const f: GitFile = {
        path: absolutePath,
        name: normalizedPath,
        status: 'M',
        staged: false
    };
    showFileDiff(f);
    repoSearchQuery.value = '';
    repoSearchResults.value = [];
};

const filteredChangedFiles = computed(() => {
  const q = searchFileQuery.value.toLowerCase().trim();
  if (!q) return changedFiles.value;
  return changedFiles.value.filter(f => f.name.toLowerCase().includes(q));
});


const reloadFileDiff = async () => {
  if (!currentDiffFile.value) return;
  startLoading(`Reloading diff: ${currentDiffFile.value.name}...`);
  try {
    const { original, modified } = await getFileOriginalAndModified(currentDiffFile.value, diffCompareTarget.value);
    diffOriginalContent.value = original;
    diffModifiedContent.value = modified;
  } catch (e) {
    console.error('Reload diff failed:', e);
  } finally {
    stopLoading();
  }
};



watch(diffContent, (val) => {
  if (!val) {
    diffLines.value = [];
    isTruncated.value = false;
    return;
  }
  const allLines = val.split('\n');
  isTruncated.value = allLines.length > MAX_DIFF_LINES;
  diffLines.value = allLines.slice(0, MAX_DIFF_LINES);
});



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

const showFileDiff = async (file: GitFile) => {
  startLoading(`Loading diff: ${file.name}...`);
  try {
    rightPanel.value = 'diff';
    isFileDiff.value = true;
    diffSource.value = `${file.name} (${file.staged ? 'staged' : 'local'})`;
    selectedCommit.value = null;
    currentDiffFile.value = file;
    diffCompareTarget.value = 'LOCAL';
    
    const { original, modified } = await getFileOriginalAndModified(file, diffCompareTarget.value);
    diffOriginalContent.value = original;
    diffModifiedContent.value = modified;
  } catch (e) {
    console.error('Diff failed:', e);
  } finally {
    stopLoading();
  }
};


const showCommitDiff = async (hash: string) => {
  if (selectedCommit.value === hash) return;
  startLoading(`Fetching commit diff [${hash.substring(0, 7)}]...`);
  try {
    selectedCommit.value = hash;
    rightPanel.value = 'diff';
    isFileDiff.value = false;
    diffContent.value = await getCommitDiff(hash);
    diffSource.value = hash.substring(0, 7);
  } catch (e) {
    console.error('Show commit failed:', e);
  } finally {
    stopLoading();
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
  if (tab === 'Git' && !isSyncing.value) refresh();
});

</script>

<template>
  <div class="git-tab-premium">
    <!-- TOOLBAR -->
    <header class="git-toolbar">
      <div class="branch-selector-wrapper">
        <div class="branch-selector" @click="!repoPath ? openRepo() : (showBranchDropdown = !showBranchDropdown)">
          <span class="repo-name" title="Open Repository" @click.stop="openRepo">{{ repoPath ? repoPath.split('/').pop() : 'Open Repo...' }}</span>
          <span class="separator" v-if="repoPath">/</span>
          <span class="branch-icon" v-if="repoPath" v-html="Icons.Branch"></span>
          <span class="branch-name" v-if="repoPath">{{ currentBranch || 'master' }}</span>
          <span class="caret" v-if="repoPath" v-html="Icons.ChevronDown"></span>
        </div>
        
        <div v-if="showBranchDropdown && repoPath" class="branch-dropdown glass-effect">
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
        <button @click="openRepo" class="op-btn" title="Open Repository">
          <span v-html="Icons.FolderOpen"></span>
          OPEN
        </button>
        <div class="toolbar-divider mini"></div>
        <button @click="handleGitOp('pull')" :disabled="!repoPath || isSyncing" class="op-btn">
          <span v-html="Icons.Pull"></span>
          PULL
        </button>
        <button @click="handleGitOp('push')" :disabled="!repoPath || isSyncing" class="op-btn">
          <span v-html="Icons.Push"></span>
          PUSH
        </button>
        <button @click="handleGitOp('fetch')" :disabled="!repoPath || isSyncing" class="op-btn">
          <span v-html="Icons.Refresh"></span>
          FETCH
        </button>
        <div class="toolbar-divider mini"></div>
        <button @click="handleGitOp('stash')" :disabled="!repoPath || isSyncing" class="op-btn">
          <span v-html="Icons.Stash"></span>
          STASH
        </button>
        <button @click="handleGitOp('pop')" :disabled="!repoPath || isSyncing" class="op-btn">POP</button>
      </div>

      <div v-if="isSyncing || isLoading" class="sync-status">
        <div class="spinner"></div>
        <span>SYNCING...</span>
      </div>
    </header>

    <div class="git-body">
      <!-- LEFT PANEL: Changes -->
      <aside class="left-panel">
        <div class="search-files-box">
            <span class="search-icon" v-html="Icons.Search"></span>
            <input v-model="searchFileQuery" placeholder="Search changed files..." class="search-input" />
        </div>

        <div class="panel-section">
          <div class="section-header">
            <span>CHANGES ({{ filteredChangedFiles.length }})</span>
            <button @click="stage()" class="action-link">Stage All</button>
          </div>
          <div class="file-list">
            <div v-for="f in filteredChangedFiles" :key="f.name" 
                 class="file-row" @click="showFileDiff(f)">
              <span class="status-badge" :class="f.status">{{ f.status }}</span>
              <span class="file-path-label">{{ f.name }}</span>
              <button class="stage-btn" @click.stop="stage(f)">+</button>
            </div>
            <div v-if="filteredChangedFiles.length === 0 && searchFileQuery" class="empty-list-hint">No matches</div>
          </div>
        </div>

        <div class="panel-section merge-section">
          <div class="section-header" @click="showMergePanel = !showMergePanel">
            <span>MERGE BRANCH ({{ branches.length - 1 }})</span>
            <span class="collapsible-icon" :class="{ rotated: showMergePanel }" v-html="Icons.ChevronDown"></span>
          </div>
          <div v-if="showMergePanel" class="file-list">
            <div v-for="b in branches.filter(b => !b.isCurrent)" :key="b.name" 
                 class="file-row branch-row">
              <span class="branch-icon-small" v-html="Icons.Branch"></span>
              <span class="file-path-label">{{ b.name }}</span>
              <button class="merge-link-btn" @click.stop="handleMergeBranch(b.name)">MERGE</button>
            </div>
          </div>
        </div>

        <div class="commit-box-container">
            <div class="commit-box">
              <textarea v-model="commitMsg" placeholder="Commit message (Ctrl+Enter to commit)" 
                        @keydown.ctrl.enter="commit"></textarea>
              <button class="commit-btn" :disabled="!commitMsg.trim() || !stagedFiles.length" 
                      @click="commit">
                COMMIT CHANGES
              </button>
            </div>
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
            <div class="diff-repo-search">
                <span class="search-icon" v-html="Icons.Search"></span>
                <input v-model="repoSearchQuery" 
                       placeholder="Find file in repo..." />
                <div v-if="repoSearchResults.length > 0" class="search-results glass-effect">
                    <div v-for="res in repoSearchResults" :key="res" 
                         class="search-result-item" @click="handleSelectSearchFile(res)">
                        {{ res }}
                    </div>
                </div>
            </div>

            <div v-if="isFileDiff" class="monaco-diff-container">
              <div class="diff-compare-header">
                <div class="compare-side"><span class="label">Original:</span> {{ currentBranch }} (Current)</div>
                <div class="compare-side">
                  <span class="label">Compare with:</span>
                  <select v-model="diffCompareTarget" class="compare-select" @change="reloadFileDiff">
                    <option value="LOCAL">Local (Working Tree)</option>
                    <option value="INDEX">Index (Staged)</option>
                    <optgroup label="Local Branches">
                        <option v-for="b in branches.filter(b => !b.isRemote)" :key="b.name" :value="b.name">{{ b.name }}</option>
                    </optgroup>
                    <optgroup label="Remote Branches">
                        <option v-for="b in branches.filter(b => b.isRemote)" :key="b.name" :value="b.name">{{ b.name }}</option>
                    </optgroup>
                  </select>
                </div>
              </div>
              <VueMonacoDiffEditor
                :original="diffOriginalContent"
                :modified="diffModifiedContent"
                :theme="globalTheme === 'dark' ? 'vs-dark' : 'vs-light'"
                language="javascript"
                :options="{ readOnly: true, renderSideBySide: true, automaticLayout: true, minimap: { enabled: false } }"
                class="monaco-instance"
              />
            </div>
            <template v-else>
              <div v-if="!diffContent && !isLoading" class="empty-state">Select a file or commit to see diff.</div>
              <div class="diff-container" v-else>
                <div v-if="isTruncated" class="diff-truncated-warning">
                  ⚠️ Showing first {{ MAX_DIFF_LINES }} lines. Use a Git client to view the full diff.
                </div>
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

            </template>
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
.left-panel { width: 280px; border-right: 1px solid rgba(128,128,128,0.1); display: flex; flex-direction: column; background: rgba(0,0,0,0.05); padding:10px}
.search-files-box { padding: 12px 10px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(128,128,128,0.1); }
.search-icon { opacity: 0.3; display: flex; align-items: center; }
.search-input { flex: 1; background: transparent; border: none; color: var(--text-color); font-size: 0.72rem; outline: none; }
.search-input::placeholder { opacity: 0.3; font-style: italic; }

.panel-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-bottom: 1px solid rgba(128,128,128,0.1); }
.section-header { padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; font-weight: 950; opacity: 0.4; letter-spacing: 0.05em; }
.action-link { background: transparent; border: none; font-size: 0.6rem; color: var(--accent-color); cursor: pointer; padding: 0; opacity: 0.8; font-weight: 800; }
.action-link:hover { text-decoration: underline; opacity: 1; }
.file-list { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
.empty-list-hint { padding: 20px; text-align: center; opacity: 0.2; font-size: 0.65rem; font-style: italic; }
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

.commit-box-container { padding: 15px; background: rgba(0,0,0,0.1); border-top: 1px solid rgba(128,128,128,0.1); }
.commit-box { display: flex; flex-direction: column; gap: 10px; }
.commit-box textarea { width: 100%; height: 70px; background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.2); border-radius: 8px; color: var(--text-color); font-size: 0.75rem; resize: none; outline: none; }
.commit-box textarea:focus { border-color: var(--accent-color); }
.commit-btn { width: 100%; padding: 10px; background: var(--accent-color); color: #fff; border: none; border-radius: 8px; font-size: 0.65rem; font-weight: 950; cursor: pointer; transition: 0.2s; }
.commit-btn:disabled { opacity: 0.4; cursor: default; }

/* MERGE SECTION */
.merge-section .section-header { cursor: pointer; user-select: none; }
.branch-row { gap: 8px; }
.branch-icon-small { opacity: 0.4; font-size: 0.7rem; color: var(--accent-color); }
.merge-link-btn { font-size: 0.55rem; padding: 2px 6px; background: rgba(99,102,241,0.1); color: var(--accent-color); border: 1px solid var(--accent-color); border-radius: 4px; font-weight: 900; cursor: pointer; opacity: 0; transition: 0.2s; }
.branch-row:hover .merge-link-btn { opacity: 1; }
.collapsible-icon { font-size: 0.6rem; transition: 0.3s; opacity: 0.4; }
.collapsible-icon.rotated { transform: rotate(-180deg); opacity: 1; }

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
.diff-view { flex: 1; overflow-y: auto; background: #0c0d11; color: #d1d5db; position: relative; display: flex; flex-direction: column; }
.monaco-diff-container { flex: 1; position: relative; display: flex; flex-direction: column; }
.monaco-instance { flex: 1; position: relative; }
.diff-compare-header { display: flex; box-sizing: border-box; height: 36px; background: #1a1b1e; border-bottom: 1px solid rgba(128,128,128,0.1); width: 100%; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.6); }
.compare-side { flex: 1; display: flex; align-items: center; padding: 0 15px; border-right: 1px solid rgba(128,128,128,0.1); gap: 10px; }
.compare-side .label { opacity: 0.4; font-weight: 400; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.6rem; }
.compare-side:last-child { border-right: none; background: rgba(255,255,255,0.02); }
.compare-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--accent-color); border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; font-weight: 800; outline: none; cursor: pointer; transition: 0.2s; width: 180px; }
.compare-select:hover, .compare-select:focus { border-color: var(--accent-color); background: rgba(255,255,255,0.08); }

/* REPO SEARCH IN DIFF */
.diff-repo-search { padding: 10px 15px; border-bottom: 1px solid rgba(128,128,128,0.1); display: flex; align-items: center; gap: 8px; position: relative; background: #1a1b1e; z-index: 100; }
.diff-repo-search input { flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.2); border-radius: 8px; padding: 8px 12px; color: var(--text-color); font-size: 0.75rem; outline: none; }
.diff-repo-search input:focus { border-color: var(--accent-color); background: rgba(255,255,255,0.08); }
.search-results { position: absolute; top: calc(100% - 2px); left: 15px; right: 15px; max-height: 200px; overflow-y: auto; z-index: 50; border: 1px solid var(--accent-color); border-top: none; border-radius: 0 0 10px 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.search-result-item { padding: 8px 15px; font-size: 0.75rem; cursor: pointer; border-bottom: 1px solid rgba(128,128,128,0.1); transition: 0.2s; }
.search-result-item:hover { background: rgba(99, 102, 241, 0.1); color: var(--accent-color); }
.search-result-item:last-child { border-bottom: none; }
.diff-container { padding: 15px; font-family: 'Consolas', monospace; font-size: 0.78rem; line-height: 1.5; }
.diff-line { display: flex; min-height: 1.2rem; }
.line-no { width: 40px; text-align: right; margin-right: 15px; opacity: 0.2; user-select: none; }
.line-text { white-space: pre-wrap; word-break: break-all; flex: 1; }

.diff-add { color: #34d399; background: rgba(52, 211, 153, 0.08); }
.diff-del { color: #f87171; background: rgba(248, 113, 113, 0.08); }
.diff-header { color: #60a5fa; font-weight: bold; }
.diff-chunk { color: #818cf8; opacity: 0.8; }

.diff-truncated-warning {
  padding: 10px 14px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.3);
  border-radius: 8px; color: #fbbf24; font-size: 0.75rem; font-weight: 800;
  margin-bottom: 12px; letter-spacing: 0.03em;
}

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; opacity: 0.3; font-style: italic; font-size: 0.8rem; height: 100%; }


.glass-effect { backdrop-filter: blur(20px); background: rgba(20, 21, 26, 0.9); }
</style>
