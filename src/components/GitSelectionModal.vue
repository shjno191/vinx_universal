<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { gitBranches, gitTabRepoPath, projectRootPath } from '../store';

const props = defineProps<{
    mode: 'branch' | 'commit';
    action?: 'compare' | 'checkout';
    filePath: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}>();

const filter = ref('');
const isLoading = ref(false);
const commits = ref<{ hash: string; shortHash: string; message: string; date: string }[]>([]);

const filteredBranches = computed(() => {
    return gitBranches.value.filter(b => b.name.toLowerCase().includes(filter.value.toLowerCase()));
});

const filteredCommits = computed(() => {
    return commits.value.filter(c => 
        c.message.toLowerCase().includes(filter.value.toLowerCase()) || 
        c.shortHash.toLowerCase().includes(filter.value.toLowerCase())
    );
});

const loadCommits = async () => {
    const repoPath = gitTabRepoPath.value || projectRootPath.value;
    if (!repoPath) return;
    isLoading.value = true;
    try {
        const raw = await invoke<string>('git_execute', {
            args: ['log', '--pretty=format:%H|%h|%ar|%s', '-50', '--', props.filePath],
            cwd: repoPath
        });
        commits.value = raw.split('\n').filter(l => l.trim()).map(line => {
            const [hash, shortHash, date, ...msg] = line.split('|');
            return { hash, shortHash, date, message: msg.join('|') };
        });
    } catch (e) {
        console.error('Failed to load commits:', e);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    if (props.mode === 'commit') {
        loadCommits();
    }
});
</script>

<template>
    <div class="modal-backdrop" @click.self="onClose">
        <div class="modal-content">
            <div class="modal-header">
                <span v-if="action === 'checkout'">Select Branch to Switch To</span>
                <span v-else>Select {{ mode === 'branch' ? 'Branch' : 'Commit' }} to Compare</span>
                <button class="close-btn" @click="onClose">&times;</button>
            </div>
            <div class="modal-body">
                <input 
                    v-model="filter" 
                    type="text" 
                    :placeholder="mode === 'branch' ? 'Search branches...' : 'Search commits...'" 
                    class="search-input"
                    autofocus
                />
                
                <div v-if="isLoading" class="loading">Loading...</div>
                
                <div class="list-container">
                    <template v-if="mode === 'branch'">
                        <div 
                            v-for="branch in filteredBranches" 
                            :key="branch.name" 
                            class="item"
                            @click="onSelect(branch.name)"
                        >
                            <span class="item-icon">?</span>
                            <span class="item-text">{{ branch.name }}</span>
                            <span v-if="branch.isRemote" class="badge">remote</span>
                        </div>
                    </template>
                    
                    <template v-else>
                        <div 
                            v-for="commit in filteredCommits" 
                            :key="commit.hash" 
                            class="item commit-item"
                            @click="onSelect(commit.hash)"
                        >
                            <span class="commit-hash">{{ commit.shortHash }}</span>
                            <div class="commit-info">
                                <div class="commit-msg">{{ commit.message }}</div>
                                <div class="commit-meta">{{ commit.date }}</div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.modal-content {
    background: var(--container-bg);
    border: var(--border-style);
    border-radius: 8px;
    width: 450px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
    padding: 12px 16px;
    border-bottom: var(--border-style);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
}

.close-btn {
    background: none; border: none; color: var(--text-color);
    font-size: 1.5rem; cursor: pointer; padding: 0 4px;
}

.modal-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
}

.search-input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 8px 12px;
    color: var(--text-color);
    outline: none;
}

.search-input:focus { border-color: var(--accent-color); }

.list-container {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.item {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    border-radius: 4px;
}

.item:hover { background: rgba(255, 255, 255, 0.05); }

.item-icon { opacity: 0.5; }

.item-text { flex: 1; font-size: 0.9rem; }

.badge {
    font-size: 0.7rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 10px;
    opacity: 0.6;
}

.commit-item {
    align-items: flex-start;
    padding: 10px 12px;
}

.commit-hash {
    font-family: monospace;
    color: var(--accent-color);
    background: rgba(var(--accent-rgb), 0.1);
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 0.8rem;
}

.commit-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
}

.commit-msg {
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.commit-meta {
    font-size: 0.7rem;
    opacity: 0.5;
}

.loading {
    padding: 20px;
    text-align: center;
    opacity: 0.5;
}
</style>
