<script setup lang="ts">
import { sanitize } from '../../utils/security';
import { type GraphCommit, type GraphPath } from '../../utils/git-parser';

defineProps<{
  commits: GraphCommit[];
  paths: GraphPath[];
  maxLanes: number;
  isLoading: boolean;
  selectedBranchName?: string;
  showAllHistory: boolean;
}>();

const emit = defineEmits<{
  (e: 'inspect', hash: string): void;
  (e: 'checkout', hash: string): void;
  (e: 'contextMenu', event: MouseEvent, commit: GraphCommit): void;
  (e: 'update:showAllHistory', val: boolean): void;
  (e: 'refreshHistory'): void;
}>();

const IconCommit = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="1.05" y1="12" x2="7" y2="12"></line><line x1="17.01" y1="12" x2="22.96" y2="12"></line></svg>`;
</script>

<template>
  <div class="panel-body">
    <div class="history-context-bar">
      <div style="display:flex; align-items:center; gap:8px;">
        <span v-html="IconCommit"></span>
        <b v-if="showAllHistory">All Branches</b>
        <b v-else-if="selectedBranchName">{{ selectedBranchName }}</b>
        <b v-else>History</b>
      </div>
      <span class="h-spacer"></span>
      <label class="all-history-toggle">
        <input type="checkbox" :checked="showAllHistory" @change="emit('update:showAllHistory', ($event.target as HTMLInputElement).checked); emit('refreshHistory')" />
        <span>Show All Branches</span>
      </label>
    </div>
    
    <div v-if="isLoading" class="panel-loading">
      <span class="spin"></span> Loading history...
    </div>
    <div v-else-if="!selectedBranchName && !showAllHistory" class="panel-hint">
      Click a branch to view its commit history
    </div>
    <div v-else-if="commits.length === 0" class="panel-hint">No commits found</div>
    <div v-else class="git-svg-container">
      <svg class="graph-svg" :style="{ width: (maxLanes * 16 + 20) + 'px', height: (commits.length * 36) + 'px' }">
        <path v-for="(p, i) in paths" :key="i" :d="p.d" :stroke="p.color" fill="none" stroke-width="2" />
      </svg>
      <div class="commit-rows-overlay">
        <div v-for="c in commits" :key="c.hash" 
             class="commit-row-v" 
             :style="{ height: '36px', '--row-color': c.color + '1a' }"
             @click.stop="emit('inspect', c.hash)"
             @dblclick.stop="emit('checkout', c.hash)"
             @contextmenu.prevent.stop="emit('contextMenu', $event, c)">
           
           <div class="g-node-abs" :style="{ left: (16 + c.lane * 16 + 8) + 'px', background: c.color }" :data-initials="c.initials"></div>
           
           <div class="log-details-single" :style="{ paddingLeft: (maxLanes * 16 + 40) + 'px' }">
             <span v-html="sanitize(c.decorHtml)"></span>
             <span class="c-msg">{{ c.msg }}</span>
             <span class="c-hash">{{ c.hash.substring(0, 7) }}</span>
             <span class="c-date">{{ c.date }}</span>
             <span class="c-author">{{ c.author }}</span>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-body { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
.history-context-bar { display:flex; align-items:center; gap:8px; padding:8px 14px; background:rgba(255,255,255,.03); border-bottom:1px solid rgba(255,255,255,.05); font-size:.76rem; }
.all-history-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s; font-size: 0.72rem; }
.all-history-toggle:hover { opacity: 1; }
.all-history-toggle input { cursor: pointer; margin: 0; }
.h-spacer { flex:1; }
.panel-hint { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; opacity:.35; font-size:.78rem; gap:8px; }
.panel-loading { display:flex; align-items:center; gap:10px; padding:20px; opacity:.5; font-size:.78rem; }
.git-svg-container { position: relative; width: 100%; flex: 1; overflow-y: auto; overflow-x: hidden; }
.graph-svg { position: absolute; top: 0; left: 16px; z-index: 1; }
.commit-rows-overlay { position: relative; z-index: 2; width: 100%; }
.g-node-abs {
  position: absolute; top: 50%; transform: translateY(-50%) translateX(-50%);
  width: 20px; height: 20px; border-radius: 50%; color: #fff; font-size: 0.6rem;
  font-weight: 800; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 6px rgba(0,0,0,.4); border: 2px solid rgba(255,255,255,0.1); pointer-events: none;
}
.g-node-abs::after { content: attr(data-initials); }
.commit-row-v {
  position: relative; box-sizing: border-box; display: flex; align-items: center;
  cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.015); 
  background: var(--row-color); transition: background .1s;
}
.commit-row-v:hover { background: rgba(255,255,255,0.08); }
.log-details-single { flex: 1; display: flex; align-items: center; gap: 10px; overflow: hidden; white-space: nowrap; height: 100%; }
.c-hash { color: var(--accent-color); font-weight: 700; opacity: .3; font-size: .65rem; font-family: monospace; }
.c-msg { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; color: var(--text-color); font-size: .84rem; }
.c-date, .c-author { font-size: .62rem; opacity: .2; white-space: nowrap; }
.c-author { font-weight: 600; }
:deep(.d-pill) { font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; font-weight: 700; white-space: nowrap; background: rgba(255,255,255,0.1); color: rgba(255,255,255,.8); border: 1px solid rgba(255,255,255,0.15); margin-right: 4px; }
:deep(.d-pill.head) { background: #34d39922; color: #34d399; border-color: #34d39944; }
:deep(.d-pill.remote) { background: #f472b622; color: #f472b6; border-color: #f472b644; }
:deep(.d-pill.tag) { background: #fbbf2422; color: #fbbf24; border-color: #fbbf2444; }
.spin { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent-color); animation:pulse .8s ease-in-out infinite; margin-left:4px; }
@keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)} }
</style>
