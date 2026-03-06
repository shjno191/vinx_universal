<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { projectRootPath, gitStatus, triggerOpenDiff, type GitFile } from '../store';
import { readTextFile } from '@tauri-apps/plugin-fs';

const commitMessage = ref('');
const isLoading = ref(false);

const stagedChanges = computed(() => gitStatus.value.filter(f => f.staged));
const unstagedChanges = computed(() => gitStatus.value.filter(f => !f.staged));

const refreshStatus = async () => {
  if (!projectRootPath.value) return;
  isLoading.value = true;
  try {
    const output = await invoke<string>('git_execute', { 
      args: ['status', '--porcelain', '-u'], 
      cwd: projectRootPath.value 
    });
    
    const files: GitFile[] = [];
    const lines = output.split('\n').filter(l => l.length >= 3);
    
    for (const line of lines) {
      // Porcelain format: XY filename (or XY -> rename)
      const x = line[0]; // Staged status
      const y = line[1]; // Unstaged status
      // Handle rename syntax "old -> new"
      const rawPath = line.substring(3).split(' -> ').pop()!.trim();
      const name = rawPath.replace(/\\/g, '/').split('/').pop() || rawPath;
      
      if (x !== ' ' && x !== '?') {
        files.push({ path: rawPath, name, status: x as any, staged: true });
      }
      if (y !== ' ') {
        files.push({ path: rawPath, name, status: y === '?' ? '??' : y as any, staged: false });
      }
    }
    gitStatus.value = files;
  } catch (err) {
    // Not a git repo or git not found ? clear status silently
    console.warn('Git status:', err);
    gitStatus.value = [];
  } finally {
    isLoading.value = false;
  }
};

const stageFile = async (file: GitFile) => {
  try {
    await invoke('git_execute', { 
      args: ['add', file.path], 
      cwd: projectRootPath.value 
    });
    refreshStatus();
  } catch (e) { console.error(e); }
};

const unstageFile = async (file: GitFile) => {
  try {
    await invoke('git_execute', { 
      args: ['reset', 'HEAD', file.path], 
      cwd: projectRootPath.value 
    });
    refreshStatus();
  } catch (e) { console.error(e); }
};

const commitChanges = async () => {
  if (!commitMessage.value.trim()) return;
  try {
    await invoke('git_execute', { 
      args: ['commit', '-m', commitMessage.value], 
      cwd: projectRootPath.value 
    });
    commitMessage.value = '';
    refreshStatus();
  } catch (e) { 
    alert('Commit failed: ' + e);
  }
};

const openDiff = async (file: GitFile) => {
  if (!projectRootPath.value) return;
  
  try {
    let original = '';
    let modified = '';
    let label = '';

    if (file.staged) {
      // Staged: Compare Index against HEAD
      label = 'Index';
      try {
        original = await invoke<string>('git_execute', { 
          args: ['show', `HEAD:${file.path}`], 
          cwd: projectRootPath.value 
        });
      } catch { original = ''; } // New file in HEAD
      
      modified = await invoke<string>('git_execute', { 
        args: ['show', `:${file.path}`], 
        cwd: projectRootPath.value 
      });
    } else {
      // Unstaged: Compare Working Tree against Index
      label = 'Working Tree';
      try {
        original = await invoke<string>('git_execute', { 
          args: ['show', `:${file.path}`], 
          cwd: projectRootPath.value 
        });
      } catch { 
        // If not in index, it's untracked
        original = ''; 
      }
      
      // Read current file from disk
      modified = await invoke<string>('read_file_content', { 
        path: projectRootPath.value + '/' + file.path 
      });
    }

    triggerOpenDiff.value = {
      path: file.path,
      name: file.name,
      original,
      modified,
      label
    };
  } catch (err) {
    console.error('Error opening diff:', err);
  }
};

onMounted(() => {
  if (projectRootPath.value) refreshStatus();
});
watch(projectRootPath, (val) => {
  if (val) refreshStatus();
});

// Icons
const PlusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
const MinusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
const RefreshIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>';
const CheckIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
</script>

<template>
  <div class="source-control">
    <div class="sc-header">
      <span class="sc-title">SOURCE CONTROL</span>
      <button class="sc-icon-btn" @click="refreshStatus" title="Refresh Status" v-html="RefreshIcon"></button>
    </div>

    <div class="commit-box">
      <textarea 
        v-model="commitMessage" 
        placeholder="Message (Ctrl+Enter to commit)"
        @keydown.ctrl.enter="commitChanges"
      ></textarea>
      <button class="commit-btn" @click="commitChanges" :disabled="!commitMessage.trim()">
        Commit
      </button>
    </div>

    <div class="changes-list">
      <div v-if="stagedChanges.length > 0" class="list-section">
        <div class="section-header">STAGED CHANGES ({{ stagedChanges.length }})</div>
        <div v-for="file in stagedChanges" :key="file.path" class="git-item" @click="openDiff(file)" :title="'Open staged diff for ' + file.name">
          <span class="status-badge" :class="file.status" :title="'Staged: ' + (file.status === 'M' ? 'Modified' : file.status === 'A' ? 'Added' : file.status === 'D' ? 'Deleted' : 'Untracked')">{{ file.status }}</span>
          <span class="file-name">{{ file.name }}</span>
          <div class="item-actions">
            <button 
              class="action-btn unstage" 
              @click.stop="unstageFile(file)" 
              title="Unstage Changes"
              v-html="MinusIcon"
            ></button>
          </div>
        </div>
      </div>

      <div v-if="unstagedChanges.length > 0" class="list-section">
        <div class="section-header">CHANGES ({{ unstagedChanges.length }})</div>
        <div v-for="file in unstagedChanges" :key="file.path" class="git-item" @click="openDiff(file)" :title="'Open diff for ' + file.name">
          <span class="status-badge" :class="file.status" :title="file.status === 'M' ? 'Modified' : file.status === 'A' ? 'Added' : file.status === 'D' ? 'Deleted' : 'Untracked'">{{ file.status }}</span>
          <span class="file-name">{{ file.name }}</span>
          <div class="item-actions">
            <button 
              class="action-btn stage" 
              @click.stop="stageFile(file)" 
              title="Stage Changes"
              v-html="PlusIcon"
            ></button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="gitStatus.length === 0" class="sc-empty">
      <p>No changes detected</p>
    </div>
  </div>
</template>

<style scoped>
.source-control {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--container-bg);
}

.sc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: var(--border-style);
  height: 40px;
}

.sc-title {
  font-size: 0.65rem;
  font-weight: 800;
  opacity: 0.6;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

.sc-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  opacity: 0.5;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sc-icon-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

.commit-box {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: var(--border-style);
}

.commit-box textarea {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 8px;
  color: var(--text-color);
  font-size: 0.8rem;
  resize: none;
  min-height: 60px;
  outline: none;
}

.commit-box textarea:focus {
  border-color: var(--accent-color);
}

.commit-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.commit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.changes-list {
  flex: 1;
  overflow-y: auto;
}

.section-header {
  padding: 8px 14px;
  font-size: 0.6rem;
  font-weight: 900;
  opacity: 0.4;
  background: rgba(255, 255, 255, 0.02);
}

.git-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px;
  height: 28px;
  cursor: pointer;
  font-size: 0.82rem;
  transition: background 0.1s;
}

.git-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.status-badge {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 800;
  border-radius: 3px;
}

.status-badge.M { color: #e2c08d; } /* Orange */
.status-badge.A { color: #81b88b; } /* Green */
.status-badge.D { color: #c74e39; } /* Red */
.status-badge.\?\? { color: #73c991; } /* Light Green */

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.item-actions {
  display: none;
  gap: 4px;
}

.git-item:hover .item-actions {
  display: flex;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  opacity: 0.6;
  padding: 2px;
  border-radius: 4px;
}

.action-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.sc-empty {
  padding: 20px;
  text-align: center;
  opacity: 0.4;
  font-size: 0.8rem;
}
</style>
