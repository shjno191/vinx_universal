<script setup lang="ts">
import { ref } from 'vue';

export interface GitFile {
  path: string;
  name: string;
  status: 'M' | 'A' | 'D' | '??';
  staged: boolean;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

defineProps<{
  branches: GitBranch[];
  stagedFiles: GitFile[];
  unstagedFiles: GitFile[];
  repoPath: string;
  selectedBranchName?: string;
  isSyncing: boolean;
}>();

const emit = defineEmits<{
  (e: 'checkout', name: string): void;
  (e: 'stage', file: GitFile): void;
  (e: 'unstage', file: GitFile): void;
  (e: 'diff', file: GitFile): void;
  (e: 'refresh'): void;
}>();

const IconFolder = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const IconRefresh = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
const IconPlus = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const IconMinus = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const IconBranch = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>`;
const ChevronRight = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

const showBranches = ref(true);
const showStaged = ref(true);
const showUnstaged = ref(true);

const getStatusColor = (s: string) => {
  if (s === 'M') return '#fbbf24';
  if (s === 'A' || s === '??') return '#34d399';
  if (s === 'D') return '#f87171';
  return '#94a3b8';
};
</script>

<template>
  <div class="sidebar-v">
    <div class="repo-header-v">
      <div class="repo-path-v">
        <span class="icon-green" v-html="IconFolder"></span>
        <span class="path-txt">{{ repoPath.split(/[/\\]/).pop() || 'No Repo' }}</span>
        <button class="refresh-btn-v" :class="{ spinning: isSyncing }" @click="emit('refresh')" v-html="IconRefresh"></button>
      </div>
    </div>

    <div class="sidebar-scroll">
      <!-- Unstaged -->
      <div class="v-section">
        <div class="v-section-head" @click="showUnstaged = !showUnstaged">
          <span class="chevron" :class="{ open: showUnstaged }" v-html="ChevronRight"></span>
          <span>CHANGES</span>
          <span class="v-badge">{{ unstagedFiles.length }}</span>
        </div>
        <div v-if="showUnstaged" class="v-item-list">
          <div v-for="f in unstagedFiles" :key="f.path" class="v-file-item" @click="emit('diff', f)">
            <span class="v-status-dot" :style="{ background: getStatusColor(f.status) }">{{ f.status[0] }}</span>
            <span class="fname">{{ f.name }}</span>
            <button class="mini-stage-btn" @click.stop="emit('stage', f)" v-html="IconPlus"></button>
          </div>
          <div v-if="unstagedFiles.length === 0" class="v-empty">Clean</div>
        </div>
      </div>

      <!-- Staged -->
      <div class="v-section">
        <div class="v-section-head" @click="showStaged = !showStaged">
          <span class="chevron" :class="{ open: showStaged }" v-html="ChevronRight"></span>
          <span>STAGED</span>
          <span class="v-badge">{{ stagedFiles.length }}</span>
        </div>
        <div v-if="showStaged" class="v-item-list">
          <div v-for="f in stagedFiles" :key="f.path" class="v-file-item" @click="emit('diff', f)">
            <span class="v-status-dot" :style="{ background: getStatusColor(f.status) }">{{ f.status[0] }}</span>
            <span class="fname">{{ f.name }}</span>
            <button class="mini-stage-btn" @click.stop="emit('unstage', f)" v-html="IconMinus"></button>
          </div>
          <div v-if="stagedFiles.length === 0" class="v-empty">None</div>
        </div>
      </div>

      <!-- Branches -->
      <div class="v-section">
        <div class="v-section-head" @click="showBranches = !showBranches">
          <span class="chevron" :class="{ open: showBranches }" v-html="ChevronRight"></span>
          <span>BRANCHES</span>
          <span class="v-badge">{{ branches.length }}</span>
        </div>
        <div v-if="showBranches" class="v-item-list">
          <div v-for="b in branches" :key="b.name" 
               class="v-branch-item" 
               :class="{ active: b.isCurrent || selectedBranchName === b.name }"
               @click="emit('checkout', b.name)">
            <span class="b-icon" v-html="IconBranch"></span>
            <span class="b-name">{{ b.isRemote ? b.name.replace(/^origin\//, '') : b.name }}</span>
            <span v-if="b.isCurrent" class="curr-dot"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-v { width:240px; border-right:1px solid rgba(255,255,255,.05); display:flex; flex-direction:column; background:rgba(0,0,0,.15); }
.repo-header-v { padding:14px; border-bottom:1px solid rgba(255,255,255,.05); }
.repo-path-v { display:flex; align-items:center; gap:8px; font-size:.78rem; font-weight:700; color:rgba(255,255,255,.7); }
.path-txt { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.refresh-btn-v { background:transparent; border:none; color:var(--accent-color); cursor:pointer; opacity:.6; transition:opacity .2s; }
.refresh-btn-v:hover { opacity:1; }
.refresh-btn-v.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from {transform:rotate(0deg)} to {transform:rotate(360deg)} }

.sidebar-scroll { flex:1; overflow-y:auto; padding-bottom:20px; }
.v-section { margin-top:8px; }
.v-section-head { display:flex; align-items:center; gap:6px; padding:6px 14px; cursor:pointer; font-size:.65rem; font-weight:950; letter-spacing:.03em; color:rgba(255,255,255,.3); }
.v-section-head:hover { background:rgba(255,255,255,.03); color:rgba(255,255,255,.6); }
.chevron { transition:transform .2s; opacity:.5; }
.chevron.open { transform:rotate(90deg); }
.v-badge { background:rgba(255,255,255,.05); padding:2px 6px; border-radius:10px; font-size:.6rem; margin-left:auto; }

.v-item-list { padding:2px 0; }
.v-file-item, .v-branch-item { display:flex; align-items:center; gap:10px; padding:6px 14px 6px 28px; cursor:pointer; font-size:.78rem; transition:background .1s; }
.v-file-item:hover, .v-branch-item:hover { background:rgba(99,102,241,.1); }
.v-branch-item.active { background:rgba(99,102,241,.15); color:var(--accent-color); font-weight:600; }

.v-status-dot { width:14px; height:14px; border-radius:3px; display:flex; align-items:center; justify-content:center; color:#000; font-size:.55rem; font-weight:900; }
.fname { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:rgba(255,255,255,.7); }
.mini-stage-btn { opacity:0; background:transparent; border:none; color:var(--accent-color); cursor:pointer; padding:2px; }
.v-file-item:hover .mini-stage-btn { opacity:1; }

.b-icon { opacity:.3; }
.b-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.curr-dot { width:6px; height:6px; background:var(--accent-color); border-radius:50%; box-shadow:0 0 8px var(--accent-color); }
.v-empty { padding:6px 14px 6px 32px; font-size:.7rem; opacity:.2; font-style:italic; }

.icon-green { color:#34d399; }
</style>
