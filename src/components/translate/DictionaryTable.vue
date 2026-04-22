<script setup lang="ts">
import { computed } from 'vue';
import { sanitize } from '../../utils/security';
import { Icons } from '../../utils/icons';

interface DictionaryEntry {
  jp: string;
  en: string;
  vi: string;
}

const props = defineProps<{
  data: DictionaryEntry[];
  isLoading: boolean;
  searchQuery: string;
  isStrict: boolean;
  dictionaryPath: string;
}>();

const emit = defineEmits<{
  (e: 'edit', item: DictionaryEntry): void;
  (e: 'delete', item: DictionaryEntry): void;
  (e: 'copy', text: string, event: MouseEvent): void;
}>();

const filteredData = computed(() => {
  if (!props.searchQuery) return props.data;
  const q = props.searchQuery.toLowerCase().trim();
  
  return props.data.filter(item => {
    if (props.isStrict) {
      return item.jp.toLowerCase() === q || 
             item.en.toLowerCase() === q || 
             item.vi.toLowerCase() === q;
    }
    return item.jp.toLowerCase().includes(q) || 
           item.en.toLowerCase().includes(q) || 
           item.vi.toLowerCase().includes(q);
  });
});

const highlightMatch = (text: string) => {
  if (!props.searchQuery || props.isStrict) return text;
  const q = props.searchQuery.trim();
  if (!q) return text;
  try {
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const highlighted = text.replace(regex, '<mark class="local-match">$1</mark>');
    return sanitize(highlighted);
  } catch { 
    return text; 
  }
};
</script>

<template>
  <div class="dictionary-container">
    <div class="dict-table-wrapper glass">
      <table class="dict-table">
        <thead>
          <tr>
            <th class="col-index">#</th>
            <th>JAPANESE</th>
            <th>ENGLISH</th>
            <th>VIETNAMESE</th>
            <th class="col-actions">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="5" class="empty-state">Loading dictionary...</td>
          </tr>
          <tr v-else-if="filteredData.length === 0">
            <td colspan="5" class="empty-state">
              {{ dictionaryPath ? 'No matches found.' : 'Please configure dictionary path in Settings.' }}
            </td>
          </tr>
          <tr v-for="(item, idx) in filteredData.slice(0, 100)" 
              :key="idx" 
              v-else
              v-memo="[item.jp, item.en, item.vi, props.searchQuery, props.isStrict]">
            <td class="col-index">{{ idx + 1 }}</td>
            <td @click="emit('copy', item.jp, $event)" class="clickable-cell">
              <span v-html="highlightMatch(item.jp)"></span>
            </td>
            <td @click="emit('copy', item.en, $event)" class="clickable-cell code-text">
              <span v-html="highlightMatch(item.en)"></span>
            </td>
            <td @click="emit('copy', item.vi, $event)" class="clickable-cell">
              <span class="lang-tag" v-html="highlightMatch(item.vi)"></span>
            </td>
            <td class="col-actions">
              <div class="action-icons">
                <button @click="emit('edit', item)" class="icon-action-btn edit" title="Edit">
                  <span v-html="Icons.Edit || Icons.Save"></span>
                </button>
                <button @click="emit('delete', item)" class="icon-action-btn delete" title="Delete">
                  <span v-html="Icons.Trash"></span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredData.length > 100">
            <td colspan="5" class="empty-state" style="padding: 15px !important; font-size: 0.7rem;">
              ... showing first 100 of {{ filteredData.length }} results. Use search to find specific items.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.dictionary-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.dict-table-wrapper { flex: 1; overflow-y: auto; border-radius: 12px; }
.dict-table { width: 100%; border-collapse: collapse; }
.dict-table th { position: sticky; top: 0; background: #6366f1; color: #fff; padding: 12px 15px; text-align: left; font-size: 0.65rem; font-weight: 800; z-index: 5; }
.dict-table tbody tr { transition: background 0.2s; }
.dict-table tbody tr:hover { background-color: rgba(99, 102, 241, 0.04); }
.dict-table td { padding: 10px 15px; font-size: 0.8rem; border-bottom: 1px solid rgba(128,128,128,0.08); color: var(--text-color); }
.clickable-cell { cursor: pointer; transition: background 0.2s; }
.clickable-cell:hover { background: rgba(99, 102, 241, 0.06); }
.clickable-cell:active { background: rgba(99, 102, 241, 0.1); }
.col-index { text-align: center; opacity: 0.4; }
.col-actions { text-align: center; width: 80px; }
.action-icons { display: flex; justify-content: center; gap: 5px; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.dict-table tbody tr:hover .action-icons { opacity: 1; pointer-events: auto; }
.icon-action-btn { width: 28px; height: 28px; border: 1px solid rgba(128,128,128,0.15); background: var(--container-bg); color: var(--text-color); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.icon-action-btn:hover { background: var(--button-hover); }
.icon-action-btn.edit { color: #6366f1; }
.icon-action-btn.delete { color: #f43f5e; }
.empty-state { padding: 40px !important; text-align: center; opacity: 0.5; font-style: italic; }
.lang-tag { background: rgba(99, 102, 241, 0.1); color: #6366f1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.code-text { font-family: 'Consolas', monospace; color: var(--accent-color); }
:deep(.local-match) { background: #6366f1; color: white; border-radius: 2px; padding: 0 2px; }
</style>
