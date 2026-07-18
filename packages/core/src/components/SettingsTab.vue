<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useSettings, useGlobalLoading, Icons, showSettingsTrigger, theme, useFileSystem } from '@vinx/sdk';
import { invoke } from '@tauri-apps/api/core';

const emit = defineEmits(['theme-changed']);

const {
  currentCategory,
  settings,
  categories,
  isRecording,
  shortcutInputRef,
  refreshSettings,
  saveSettings,
  openSettingsFile,
  pickDictionary,
  addTranslateGroup,
  removeTranslateGroup,
  renameTranslateGroup,
  toggleGroupActive,
  addPathToGroup,
  removePathFromGroup,
  downloadTemplate,
  startRecording,
  formatShortcut,
  handleShortcutKey
} = useSettings();
const { simulateLoading } = useGlobalLoading();

onMounted(() => {
  refreshSettings();
});

const handleSaveAndEmit = async () => {
  await saveSettings();
  emit('theme-changed', theme.value);
};

const handleClearCache = async () => {
  try {
    const configDir = await invoke<string>('get_app_config_dir');
    const files = await invoke<string[]>('list_files_in_dir', { path: configDir, extension: 'json' });
    const { writeFile } = useFileSystem();
    let count = 0;
    for (const file of files) {
      const lower = file.toLowerCase();
      if (!lower.endsWith('settings.json') && !lower.endsWith('history.json')) {
        await writeFile(file, '{}');
        count++;
      }
    }
    alert(`Đã xóa ${count} file cache thành công! Vui lòng tải lại từ điển nếu cần thiết.`);
  } catch (err) {
    console.error(err);
    alert('Có lỗi xảy ra khi xóa cache');
  }
};

defineExpose({
  refreshSettings,
  openSettingsFile,
  downloadTemplate
});

watch(showSettingsTrigger, (val) => {
  if (val && val.category) {
    currentCategory.value = val.category as any;
  }
});
</script>

<template>
  <div class="settings-layout">
    <aside class="settings-sidebar">
      <button 
        v-for="cat in categories" 
        :key="cat.id" 
        class="category-btn" 
        :class="{ active: currentCategory === cat.id }" 
        @click="currentCategory = cat.id as any"
      >
        <span class="category-icon-wrapper" v-html="Icons[cat.icon as keyof typeof Icons]"></span>
        {{ cat.name }}
      </button>
    </aside>

    <main v-if="settings && settings.editor" class="settings-content">
      <!-- GENERAL / APPEARANCE -->
      <div v-show="currentCategory === 'general'" class="settings-section">

        <div class="settings-grid">
          <div class="setting-card glass">
            <div class="card-header">
              <span class="card-icon" v-html="Icons.Settings"></span>
              <span class="card-label">Chủ đề & Hiển thị</span>
            </div>
            
            <div class="card-body">
              <div class="premium-field">
                <label>Ứng dụng (App Theme)</label>
                <select v-model="settings.theme" class="premium-select" @change="handleSaveAndEmit">
                  <option value="dark">Tối (Dark Mode)</option>
                  <option value="light">Sáng (Light Mode)</option>
                  <option value="95">Cổ điển (Windows 95)</option>
                </select>
              </div>

              <div class="premium-field">
                <label>Màn hình chờ (Loading)</label>
                <div class="theme-select-group">
                  <select v-model="settings.loading_theme" class="premium-select" @change="saveSettings">
                    <option value="cute">Chú mèo dễ thương</option>
                    <option value="premium">Neon hiện đại</option>
                    <option value="retro">Cổ điển Win95</option>
                    <option value="cyber">Cyberpunk</option>
                  </select>
                  <button class="test-loading-btn-mini" @click="simulateLoading">
                    <span v-html="Icons.Play"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="setting-card glass">
            <div class="card-header">
              <span class="card-icon" v-html="Icons.Folder"></span>
              <span class="card-label">Hệ thống tệp</span>
            </div>
            <div class="card-body">
              <div class="premium-field">
                <label>Dữ liệu cấu hình</label>
                <button class="premium-button full" @click="openSettingsFile">Mở thư mục cài đặt</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TRANSLATE / DICTIONARY -->
      <div v-show="currentCategory === 'translate'" class="settings-section">

        <div class="setting-card glass">
          <div class="card-header">
            <span class="card-icon" v-html="Icons.Globe"></span>
            <span class="card-label">Từ điển chính</span>
          </div>
          <div class="card-body">
            <div class="path-picker-modern">
              <input v-model="settings.dictionary_path" type="text" class="premium-input-path" readonly placeholder="Chưa cấu hình từ điển..." />
              <button class="premium-button" @click="pickDictionary">Chọn file</button>
            </div>
            <button class="link-action" @click="downloadTemplate">
              <span v-html="Icons.Download"></span> Tải Excel mẫu
            </button>
          </div>
        </div>

        <div class="setting-card glass">
          <div class="card-header">
            <span class="card-icon" v-html="Icons.Plus"></span>
            <span class="card-label">Nguồn quét từ điển (Quick Translate)</span>
            <div style="margin-left: auto; display: flex; gap: 8px;">
              <button class="icon-btn-danger" style="opacity: 0.8; font-size: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; padding: 4px 8px;" @click="handleClearCache" title="Xóa toàn bộ Cache">
                <span v-html="Icons.Trash2" style="margin-right: 4px; display: inline-flex; align-items: center;"></span> Xóa Cache
              </button>
              <button class="add-group-btn" @click="addTranslateGroup" title="Thêm nhóm mới">
                <span v-html="Icons.Plus"></span> Nhóm mới
              </button>
            </div>
          </div>
          <div class="card-body">
            <div v-for="group in settings.advanced_translate_groups" :key="group.id" class="translate-group">
              <div class="group-header">
                <div class="group-title-row">
                  <input 
                    type="text" 
                    class="group-name-input" 
                    :value="group.name" 
                    @change="(e) => renameTranslateGroup(group.id, (e.target as HTMLInputElement).value)"
                    placeholder="Tên nhóm..."
                  />
                  <div class="group-actions">
                    <div 
                      class="toggle-switch-mini" 
                      :class="{ active: group.active }" 
                      @click="toggleGroupActive(group.id)"
                      :title="group.active ? 'Đang kích hoạt' : 'Đang tạm dừng'"
                    >
                      <div class="switch-handle"></div>
                    </div>
                    <button class="icon-btn-danger" @click="removeTranslateGroup(group.id)" title="Xóa nhóm">
                      <span v-html="Icons.Trash2"></span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="group-paths">
                <div v-if="!group.paths || group.paths.length === 0" class="empty-group-hint">
                  Chưa có nguồn nào trong nhóm này...
                </div>
                <div v-for="(p, pIdx) in group.paths" :key="pIdx" class="path-chip-modern">
                  <div class="path-chip-header">
                    <span class="chip-icon" v-html="p.type === 'folder' ? Icons.Folder : Icons.File"></span>
                    <span class="chip-text" :title="p.path">{{ p.path }}</span>
                    <span class="chip-remove" @click="removePathFromGroup(group.id, pIdx)" v-html="Icons.Close"></span>
                  </div>
                  <div class="path-chip-config">
                    <div class="config-input-group">
                      <label>Phys Col</label>
                      <input type="text" v-model="p.physCol" class="mini-input" placeholder="A" @change="saveSettings" />
                    </div>
                    <div class="config-input-group">
                      <label>JP Col</label>
                      <input type="text" v-model="p.jpCol" class="mini-input" placeholder="B" @change="saveSettings" />
                    </div>
                    <div class="config-input-group">
                      <label>Start Row</label>
                      <input type="number" v-model="p.startRow" class="mini-input" placeholder="1" @change="saveSettings" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="group-footer">
                <button class="premium-button-dashed mini" @click="addPathToGroup(group.id, true)">
                  <span v-html="Icons.Plus"></span> Thư mục
                </button>
                <button class="premium-button-dashed mini" @click="addPathToGroup(group.id, false)">
                  <span v-html="Icons.Plus"></span> Tệp Excel
                </button>
              </div>
            </div>
            
            <div v-if="!settings.advanced_translate_groups || settings.advanced_translate_groups.length === 0" class="empty-state">
              <p>Chưa có nhóm nguồn từ điển nào được tạo.</p>
              <button class="premium-button secondary" @click="addTranslateGroup">Tạo nhóm đầu tiên</button>
            </div>
          </div>
        </div>

        <div class="setting-card glass">
          <div class="card-header">
            <span class="card-icon" v-html="Icons.Edit3"></span>
            <span class="card-label">Màu sắc Highlight</span>
          </div>
          <div class="card-body">
            <div class="color-pickers-grid">
              <div class="premium-field">
                <label>Base Dictionary</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.translate.baseHighlightColor" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.translate.baseHighlightColor" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
              <div class="premium-field">
                <label>Technical Dictionary</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.translate.techHighlightColor" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.translate.techHighlightColor" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
              <div class="premium-field">
                <label>Composed / Mixed</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.translate.composedHighlightColor" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.translate.composedHighlightColor" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- EDITOR -->
      <div v-show="currentCategory === 'editor'" class="settings-section">

        <!-- Syntax Colors -->
        <div class="setting-card glass" v-if="settings.editor.colors">
          <div class="card-header">
            <span class="card-icon" v-html="Icons.Edit3"></span>
            <span class="card-label">Màu sắc Cú pháp (Syntax)</span>
          </div>
          <div class="card-body">
            <div class="color-pickers-grid">
              <div class="premium-field">
                <label>Hàm (Function)</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.editor.colors.function" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.editor.colors.function" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
              <div class="premium-field">
                <label>Biến (Variable)</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.editor.colors.variable" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.editor.colors.variable" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
              <div class="premium-field">
                <label>Bình luận (Comment)</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.editor.colors.comment" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.editor.colors.comment" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
              <div class="premium-field">
                <label>Từ khóa (Keyword)</label>
                <div class="color-input-wrapper">
                  <input v-model="settings.editor.colors.keyword" type="color" class="color-picker-input" @change="saveSettings" />
                  <input v-model="settings.editor.colors.keyword" type="text" class="premium-input-hex" maxlength="7" @change="saveSettings" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mouse Behavior Feature Cards -->
        <div class="behavior-grid">
           <div class="feature-card glass" :class="{ active: settings.editor.middleClickClose }" @click="settings.editor.middleClickClose = !settings.editor.middleClickClose; saveSettings()">
              <div class="feature-icon" v-html="Icons.Close"></div>
              <div class="feature-info">
                 <span class="feature-name">Middle Click Close</span>
                 <span class="feature-hint">Chuột giữa đóng tab nhanh</span>
              </div>
              <div class="feature-toggle">
                 <div class="toggle-track"><div class="toggle-thumb"></div></div>
              </div>
           </div>
           
           <div class="feature-card glass" :class="{ active: settings.editor.doubleClickNewTab }" @click="settings.editor.doubleClickNewTab = !settings.editor.doubleClickNewTab; saveSettings()">
              <div class="feature-icon" v-html="Icons.Plus"></div>
              <div class="feature-info">
                 <span class="feature-name">Double Click New</span>
                 <span class="feature-hint">Click đúp mở tab trống</span>
              </div>
              <div class="feature-toggle">
                 <div class="toggle-track"><div class="toggle-thumb"></div></div>
              </div>
           </div>

           <div class="feature-card glass" :class="{ active: settings.editor.mouseNavHistory }" @click="settings.editor.mouseNavHistory = !settings.editor.mouseNavHistory; saveSettings()">
              <div class="feature-icon" v-html="Icons.ArrowLeft"></div>
              <div class="feature-info">
                 <span class="feature-name">Mouse Navigation</span>
                 <span class="feature-hint">Nút hông chuột Back/Forward</span>
              </div>
              <div class="feature-toggle">
                 <div class="toggle-track"><div class="toggle-thumb"></div></div>
              </div>
           </div>

           <div class="feature-card glass" :class="{ active: settings.editor.renderWhitespace }" @click="settings.editor.renderWhitespace = !settings.editor.renderWhitespace; saveSettings()">
              <div class="feature-icon" v-html="Icons.Eye"></div>
              <div class="feature-info">
                 <span class="feature-name">Show Whitespace</span>
                 <span class="feature-hint">Hiện ký hiệu Tab/Space ẩn</span>
              </div>
              <div class="feature-toggle">
                 <div class="toggle-track"><div class="toggle-thumb"></div></div>
              </div>
           </div>
        </div>

      </div>



      <!-- SHORTCUTS -->
      <div v-show="currentCategory === 'shortcut'" class="settings-section">

        <div class="setting-item-vertical">
          <label>Phím tắt Editor (Nhấp đúp thay đổi)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('open_file')">
              <span class="shortcut-desc">Mở file (Open File)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'open_file' }">
                {{ isRecording === 'open_file' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.open_file || 'ctrl+p') }}
              </span>
              <input v-if="isRecording === 'open_file'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('new_tab')">
              <span class="shortcut-desc">Tạo tab mới (New Tab)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'new_tab' }">
                {{ isRecording === 'new_tab' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.new_tab || 'ctrl+n') }}
              </span>
              <input v-if="isRecording === 'new_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('close_tab')">
              <span class="shortcut-desc">Đóng tab hiện tại (Close Tab)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'close_tab' }">
                {{ isRecording === 'close_tab' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.close_tab || 'ctrl+w') }}
              </span>
              <input v-if="isRecording === 'close_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('close_all_tabs')">
              <span class="shortcut-desc">Đóng tất cả tab (Close All Tabs)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'close_all_tabs' }">
                {{ isRecording === 'close_all_tabs' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.close_all_tabs || 'ctrl+shift+w') }}
              </span>
              <input v-if="isRecording === 'close_all_tabs'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('global_search')">
              <span class="shortcut-desc">Tìm kiếm văn bản toàn cục</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'global_search' }">
                {{ isRecording === 'global_search' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.global_search || 'ctrl+shift+f') }}
              </span>
              <input v-if="isRecording === 'global_search'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('move_tab_left')">
              <span class="shortcut-desc">Chuyển tab sang trái (Move Tab Left)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'move_tab_left' }">
                {{ isRecording === 'move_tab_left' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.move_tab_left || 'alt+arrowleft') }}
              </span>
              <input v-if="isRecording === 'move_tab_left'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('move_tab_right')">
              <span class="shortcut-desc">Chuyển tab sang phải (Move Tab Right)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'move_tab_right' }">
                {{ isRecording === 'move_tab_right' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.move_tab_right || 'alt+arrowright') }}
              </span>
              <input v-if="isRecording === 'move_tab_right'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
          </div>
        </div>

        <div class="setting-item-vertical">
          <label>Phím tắt Điều hướng Tab (Global)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('prev_tab')">
              <span class="shortcut-desc">Chuyển về Tab phía trước</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'prev_tab' }">
                {{ isRecording === 'prev_tab' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.prev_tab || 'ctrl+shift+[') }}
              </span>
              <input v-if="isRecording === 'prev_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('next_tab')">
              <span class="shortcut-desc">Chuyển sang Tab tiếp theo</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'next_tab' }">
                {{ isRecording === 'next_tab' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.next_tab || 'ctrl+shift+]') }}
              </span>
              <input v-if="isRecording === 'next_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('open_settings')">
              <span class="shortcut-desc">Mở Cài đặt (Open Settings)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'open_settings' }">
                {{ isRecording === 'open_settings' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.open_settings || 'ctrl+shift+s') }}
              </span>
              <input v-if="isRecording === 'open_settings'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
          </div>
        </div>
      </div>


      <!-- SMOKING / CHILL -->
      <div v-show="currentCategory === 'chill'" class="settings-section">

        <div class="setting-item-vertical">
          <label>Trạng thái Widget</label>
          <label class="checkbox-container">
            <input type="checkbox" v-model="settings.chill.enableWidget" @change="saveSettings" />
            <span class="checkmark"></span>
            Hiển thị điếu thuốc ở góc màn hình
          </label>
        </div>
      </div>

      <!-- CONVERT UI -->
      <div v-show="currentCategory === 'convert'" class="settings-section">

        <div class="rules-container">
          <div class="rule-group glass">
            <h4 class="rule-title">Định dạng tập tin: PDA JSP</h4>
            <div class="rule-list">
              <div class="rule-item"><span class="rule-tag">CSS</span><p>Tự động thay bằng <code>common_pda.css</code>.</p></div>
              <div class="rule-item"><span class="rule-tag">LAYOUT</span><p>Bọc trang trong thẻ <code>div.pda_list</code>.</p></div>
              <div class="rule-item"><span class="rule-tag">STYLE</span><p>Tách CSS ra khỏi mã JSP và đưa lên phần đầu.</p></div>
              <div class="rule-item"><span class="rule-tag">INDENT</span><p>Sử dụng 4 khoảng trắng cho thụt dòng.</p></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-layout { display: flex; flex: 1; height: 100%; background-color: var(--container-bg); color: var(--text-color); overflow: hidden; }
.settings-sidebar { 
  width: 180px; 
  border-right: 1px solid rgba(128, 128, 128, 0.1); 
  display: flex; 
  flex-direction: column; 
  padding: 15px 0; 
  background: rgba(128, 128, 128, 0.04); 
}
.category-btn { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 10px 20px; 
  border: none; 
  background: transparent; 
  color: var(--text-color); 
  cursor: pointer; 
  text-align: left; 
  font-size: 0.8rem; 
  font-weight: 700; 
  opacity: 0.6; 
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.category-btn:hover { background-color: rgba(128, 128, 128, 0.08); opacity: 1; }
.category-btn.active { background-color: var(--accent-color); color: #fff; opacity: 1; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2); }

.category-icon-wrapper { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }

.settings-content { flex: 1; padding: 25px 35px; overflow-y: auto; background: var(--container-bg); }
.settings-section { display: flex; flex-direction: column; gap: 20px; }

.settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 10px; }

.setting-card { 
  background: rgba(128, 128, 128, 0.05); 
  border: 1px solid rgba(128, 128, 128, 0.1); 
  border-radius: 16px; 
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}
.setting-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
.setting-card.no-padding { padding: 0 !important; }

.card-header { padding: 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(128, 128, 128, 0.05); }
.card-header-filled { background: rgba(99, 102, 241, 0.1); padding: 10px 16px; }
.card-icon { width: 18px; height: 18px; color: var(--accent-color); }
.card-label { font-size: 0.75rem; font-weight: 900; letter-spacing: 0.05em; color: var(--accent-color); text-transform: uppercase; }

.card-body { padding: 16px; display: flex; flex-direction: column; gap: 15px; }

/* Premium Fields */
.premium-field { display: flex; flex-direction: column; gap: 8px; }
.premium-field label { font-size: 0.7rem; font-weight: 800; opacity: 0.4; text-transform: uppercase; }

.premium-select, .premium-input { 
  background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.2); 
  border-radius: 10px; padding: 10px 14px; color: var(--text-color); font-size: 0.8rem; font-weight: 600;
  outline: none; transition: 0.2s;
  flex: 1; min-width: 0;
}
.premium-select:focus, .premium-input:focus { border-color: var(--accent-color); background: rgba(99,102,241,0.05); }

.color-pickers-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
.color-input-wrapper { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.2); border-radius: 8px; padding: 4px; }
.color-picker-input { 
  -webkit-appearance: none; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; background: transparent; padding: 0;
}
.color-picker-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-picker-input::-webkit-color-swatch { border: none; border-radius: 4px; }
.premium-input-hex { 
  background: transparent; border: none; color: var(--text-color); font-size: 0.75rem; font-family: monospace; outline: none; font-weight: 700;
  width: 80px; flex-shrink: 0;
}

.theme-select-group { display: flex; gap: 10px; align-items: center; width: 100%; flex-wrap: nowrap; }

.premium-button { 
  background: var(--accent-color); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; 
  font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.2s;
}
.premium-button:hover { filter: brightness(1.1); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
.premium-button.full { width: 100%; }

.premium-button-dashed { 
  background: transparent; border: 1.5px dashed rgba(128,128,128,0.3); border-radius: 10px; padding: 12px; 
  color: var(--accent-color); font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.2s;
}
.premium-button-dashed:hover { background: rgba(99,102,241,0.05); border-color: var(--accent-color); }

/* Path Picker */
.path-picker-modern { display: flex; gap: 8px; }
.premium-input-path { flex: 1; background: rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.1); border-radius: 8px; padding: 0 12px; color: var(--text-color); font-size: 0.75rem; opacity: 0.6; }

/* Indentation UI Level 2.0 */
.indentation-selector { display: flex; border-bottom: 1px solid rgba(128,128,128,0.05); }
.indent-option { 
  flex: 1; padding: 20px; display: flex; justify-content: space-between; align-items: start; 
  cursor: pointer; transition: 0.2s; border-right: 1px solid rgba(128,128,128,0.05);
}
.indent-option:last-child { border-right: none; }
.indent-option:hover { background: rgba(255,255,255,0.02); }
.indent-option.active { background: rgba(99, 102, 241, 0.05); position: relative; }
.indent-option.active::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--accent-color); }

.option-info { display: flex; flex-direction: column; gap: 4px; }
.option-title { font-size: 0.9rem; font-weight: 900; color: #fff; }
.option-desc { font-size: 0.7rem; opacity: 0.5; font-weight: 600; }
.active-badge { 
  background: var(--accent-color); color: #fff; font-size: 0.6rem; font-weight: 900; 
  padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 10px rgba(99,102,241,0.4);
}

.indent-footer { padding: 15px 20px; background: rgba(0,0,0,0.1); }
.indent-size-group { display: flex; align-items: center; gap: 15px; }
.size-text { font-size: 0.75rem; font-weight: 800; opacity: 0.4; }
.size-pills { display: flex; gap: 8px; }
.size-pill { 
  background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.1); color: var(--text-color);
  padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.2s;
}
.size-pill.active { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }

/* Feature Cards Grid */
.behavior-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 15px; }
.feature-card { 
  padding: 16px; display: flex; align-items: center; gap: 14px; 
  cursor: pointer; border-radius: 12px; transition: 0.2s; border: 1px solid rgba(128,128,128,0.1);
}
.feature-card:hover { background: rgba(255,255,255,0.03); border-color: rgba(128,128,128,0.2); }
.feature-card.active { border-color: var(--accent-color); background: rgba(99, 102, 241, 0.03); }

.feature-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.5; color: var(--accent-color); }
.feature-card.active .feature-icon { opacity: 1; }
.feature-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.feature-name { font-size: 0.8rem; font-weight: 800; }
.feature-hint { font-size: 0.65rem; opacity: 0.4; font-weight: 600; }

.feature-toggle { width: 34px; height: 18px; }
.toggle-track { width: 100%; height: 100%; background: #333; border-radius: 10px; position: relative; transition: 0.3s; }
.feature-card.active .toggle-track { background: var(--accent-color); }
.toggle-thumb { width:12px; height: 12px; background: #fff; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: 0.3s; }
.feature-card.active .toggle-thumb { left: 19px; }

.test-loading-btn-mini { background: rgba(99,102,241,0.1); border: none; color: var(--accent-color); width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.test-loading-btn-mini:hover { background: var(--accent-color); color: #fff; }

.path-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.path-chip { background: rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.1); border-radius: 6px; padding: 4px 10px; display: flex; align-items: center; gap: 8px; max-width: 100%; }
.chip-text { font-size: 0.7rem; font-weight: 600; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip-remove { width: 12px; height: 12px; opacity: 0.4; cursor: pointer; }
.chip-remove:hover { opacity: 1; color: #ef4444; }

.link-action { background: none; border: none; color: var(--accent-color); font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 0; margin-top: 5px; opacity: 0.6; }
.link-action:hover { opacity: 1; text-decoration: underline; }

.hidden-input { position: absolute; opacity: 0; pointer-events: none; }



/* Win95 Variations */
.theme-95 .settings-layout, .theme-95 .settings-sidebar, .theme-95 .category-btn, .theme-95 .settings-content, .theme-95 .glass, .theme-95 .rule-group, .theme-95 .shortcut-row {
  background: #c0c0c0 !important; border-radius: 0 !important; border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; backdrop-filter: none !important; color: #000 !important;
}
.theme-95 .category-btn.active { background: #000080 !important; color: #fff !important; border: none !important; }
.theme-95 .save-all-btn { border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; background: #c0c0c0 !important; color: #000 !important; border-radius: 0; }
.theme-95 .theme-select, .theme-95 .text-input { border: 2px solid !important; border-color: #808080 #fff #fff #808080 !important; border-radius: 0; background: #fff !important; color: #000 !important; }
.add-group-btn {
  margin-left: auto;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: var(--accent-color);
  font-size: 0.65rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.add-group-btn:hover { background: var(--accent-color); color: #fff; }

.translate-group {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}

.group-header {
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(128, 128, 128, 0.05);
}

.group-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.group-name-input {
  background: transparent;
  border: none;
  color: var(--text-color);
  font-weight: 800;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 4px;
  flex: 1;
  outline: none;
}
.group-name-input:hover, .group-name-input:focus { background: rgba(0,0,0,0.05); }

.group-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-switch-mini {
  width: 32px;
  height: 16px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
}
.toggle-switch-mini.active { background: var(--accent-color); }
.switch-handle {
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.3s;
}
.toggle-switch-mini.active .switch-handle { left: 18px; }

.icon-btn-danger {
  background: transparent;
  border: none;
  color: #ef4444;
  opacity: 0.5;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}
.icon-btn-danger:hover { opacity: 1; }

.group-paths {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.path-chip-modern {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.05);
  border-radius: 8px;
  padding: 8px 12px;
  transition: all 0.2s;
}
.path-chip-modern:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(128, 128, 128, 0.1); }

.path-chip-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.path-chip-config {
  display: flex;
  gap: 12px;
  padding-top: 6px;
  border-top: 1px dashed rgba(128, 128, 128, 0.1);
}

.config-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.config-input-group label {
  font-size: 0.65rem;
  font-weight: 700;
  opacity: 0.5;
  text-transform: uppercase;
}
.mini-input {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 4px;
  color: var(--text-color);
  font-size: 0.75rem;
  padding: 2px 6px;
  width: 50px;
  text-align: center;
  outline: none;
}
.mini-input:focus { border-color: var(--accent-color); background: rgba(99, 102, 241, 0.1); }

.chip-icon { opacity: 0.5; display: flex; align-items: center; }

.group-footer {
  padding: 10px 12px;
  display: flex;
  gap: 8px;
}

.premium-button-dashed.mini {
  padding: 4px 10px;
  font-size: 0.65rem;
  margin-top: 0;
  flex: 1;
}

.empty-group-hint {
  font-size: 0.7rem;
  opacity: 0.3;
  font-style: italic;
  text-align: center;
  padding: 10px;
}

.empty-state {
  text-align: center;
  padding: 30px 10px;
  opacity: 0.5;
}
.empty-state p { font-size: 0.8rem; margin-bottom: 12px; }

.advanced-path-actions { display: flex; gap: 8px; margin-top: 8px; }
.advanced-path-actions .premium-button-dashed { flex: 1; margin-top: 0; }

/* Shortcuts UI */
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.shortcut-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.shortcut-row:hover {
  background: rgba(99, 102, 241, 0.05);
  border-color: var(--accent-color);
  transform: translateX(4px);
}
.shortcut-row.locked {
  cursor: default;
  opacity: 0.6;
}
.shortcut-row.locked:hover {
  transform: none;
  border-color: rgba(128, 128, 128, 0.1);
  background: rgba(255, 255, 255, 0.03);
}
.shortcut-desc {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color);
}
.shortcut-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--accent-color);
  background: rgba(99, 102, 241, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
  min-width: 100px;
  text-align: center;
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.shortcut-key.recording {
  background: var(--accent-color);
  color: #fff;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Converter UI Rules */
.rules-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rule-group {
  padding: 20px;
  background: rgba(128, 128, 128, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 16px;
}
.rule-title {
  margin: 0 0 15px 0;
  font-size: 0.9rem;
  font-weight: 900;
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(0, 0, 0, 0.1);
  padding: 10px 14px;
  border-radius: 8px;
}
.rule-tag {
  font-size: 0.65rem;
  font-weight: 900;
  background: var(--accent-color);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 50px;
  text-align: center;
}
.rule-item p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--text-color);
  opacity: 0.8;
}
.rule-item code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 4px;
  color: var(--accent-color);
  font-family: 'JetBrains Mono', monospace;
}
</style>
