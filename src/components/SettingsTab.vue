<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useTranslateManager } from '../composables/useTranslateManager';
import { Icons } from '../utils/icons';
import { showSettingsTrigger, theme } from '../store';

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
  pickAdvancedPath,
  removeAdvancedPath,
  downloadTemplate,
  startRecording,
  formatShortcut,
  handleShortcutKey
} = useSettings();

onMounted(() => {
  refreshSettings();
});

const handleSaveAndEmit = async () => {
  await saveSettings();
  emit('theme-changed', theme.value);
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
        <div class="section-header-modern">
          <h2 class="section-title">Giao diện & Hệ thống</h2>
          <p class="section-desc">Cấu hình chủ đề và các cài đặt chung cho toàn bộ ứng dụng.</p>
        </div>

        <div class="setting-item">
          <label>Chủ đề ứng dụng (Theme)</label>
          <select v-model="settings.theme" class="theme-select" @change="handleSaveAndEmit">
            <option value="dark">Tối (Dark Mode)</option>
            <option value="light">Sáng (Light Mode)</option>
            <option value="95">Cổ điển (Windows 95)</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Chủ đề nạp dữ liệu (Loading Theme)</label>
          <div class="theme-select-group">
            <select v-model="settings.loading_theme" class="theme-select" @change="saveSettings">
              <option value="cute">Chú mèo dễ thương (Cute Cat)</option>
              <option value="premium">Neon hiện đại (Premium Neon)</option>
              <option value="retro">Cổ điển Win95 (Retro UI)</option>
              <option value="cyber">Cyberpunk (High Tech)</option>
              <option value="nature">Thiên nhiên (Nature/Garden)</option>
              <option value="orbit">Không gian (Space Orbit)</option>
            </select>
            <button class="test-loading-btn" @click="() => useTranslateManager().simulateLoading()" title="Click to test loading screen">
              <span v-html="Icons.Play" class="test-icon"></span>
              TEST
            </button>
          </div>
        </div>

        <div class="setting-item">
          <label>Thư mục cấu hình (Config)</label>
          <button class="save-all-btn" @click="openSettingsFile">Mở thư mục cài đặt</button>
        </div>
      </div>

      <!-- TRANSLATE / DICTIONARY -->
      <div v-show="currentCategory === 'translate'" class="settings-section">
        <div class="section-header-modern">
          <h2 class="section-title">Tab Dictionary & Translate</h2>
          <p class="section-desc">Cấu hình từ điển định dạng Excel phục vụ tính năng dịch nhanh và quản lý từ vựng.</p>
        </div>

        <div class="setting-item-vertical">
          <label>Đường dẫn file từ điển chính (.xlsx)</label>
          <div class="path-picker">
            <input v-model="settings.dictionary_path" type="text" class="text-input path-input" readonly placeholder="Chưa chọn file từ điển..." />
            <button class="save-all-btn" @click="pickDictionary">Chọn file</button>
          </div>
          <div class="helper-actions">
             <button class="text-link-btn" @click="downloadTemplate">
               <span v-html="Icons.Download" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span>
               Tải file Excel mẫu (.xlsx)
             </button>
          </div>
        </div>

        <div class="setting-item-vertical" style="margin-top: 10px; border-top: 1px solid rgba(128,128,128,0.1); padding-top: 20px;">
          <div class="section-label-group">
            <label>Quick Translate Source Folders</label>
            <p class="field-hint">Danh sách các thư mục chứa file Excel dùng để quét từ điển nâng cao.</p>
          </div>
          
          <div class="path-list-modern">
            <div v-for="(path, idx) in settings.advanced_translate_paths" :key="idx" class="path-list-item glass">
              <span class="path-text" :title="path">{{ path }}</span>
              <button class="remove-path-btn" @click="removeAdvancedPath(idx)" title="Remove">
                <span v-html="Icons.Trash"></span>
              </button>
            </div>
            
            <button class="add-path-btn-dashed" @click="pickAdvancedPath">
              <span v-html="Icons.Plus" style="margin-right: 8px;"></span>
              Thêm thư mục nguồn dữ liệu mới
            </button>
          </div>
        </div>
      </div>

      <!-- GIT CONTROL -->
      <div v-show="currentCategory === 'git'" class="settings-section">
        <div class="section-header-modern">
          <h2 class="section-title">Tab Git Control</h2>
          <p class="section-desc">Cấu hình đường dẫn Repository để sử dụng các tính năng Git tích hợp.</p>
        </div>
        
        <div class="setting-item-vertical">
          <label>Đường dẫn Local Repository</label>
          <div class="path-picker">
            <input v-model="settings.last_git_repo" type="text" class="text-input path-input" placeholder="Ví dụ: C:/Projects/my-app" @change="saveSettings" />
          </div>
          <p class="field-hint">Nhập đường dẫn tuyệt đối đến thư mục chứa <code>.git</code> của dự án.</p>
        </div>
      </div>

      <!-- EDITOR TAB -->
      <div v-show="currentCategory === 'editor'" class="settings-section">
        <div class="section-header-modern">
          <h2 class="section-title">Tab Editor</h2>
          <p class="section-desc">Cấu hình các hành vi và trải nghiệm người dùng khi làm việc với trình chỉnh sửa mã.</p>
        </div>

        <div class="setting-item-vertical">
          <label>Hành vi chuột & Tab</label>
          <div class="setting-checkbox-list">
            <label class="checkbox-container">
              <input type="checkbox" v-model="settings.editor.middleClickClose" @change="saveSettings" />
              <span class="checkmark"></span>
              Nhấn chuột giữa để đóng Tab
            </label>
            <label class="checkbox-container">
              <input type="checkbox" v-model="settings.editor.doubleClickNewTab" @change="saveSettings" />
              <span class="checkmark"></span>
              Nhấp đúp vào thanh tab để mở Tab mới
            </label>
            <label class="checkbox-container">
              <input type="checkbox" v-model="settings.editor.mouseNavHistory" @change="saveSettings" />
              <span class="checkmark"></span>
              Sử dụng nút Back/Forward của chuột để quay lại Tab cũ
            </label>
          </div>
        </div>
      </div>

      <!-- SHORTCUTS -->
      <div v-show="currentCategory === 'shortcut'" class="settings-section">
        <div class="section-header-modern">
          <h2 class="section-title">Phím tắt hệ thống</h2>
          <p class="section-desc">Cấu hình các tổ hợp phím để thao tác nhanh mà không cần dùng chuột.</p>
        </div>

        <div class="setting-item-vertical">
          <label>Phím tắt Editor (Nhấp để thay đổi)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('open_file')">
              <span class="shortcut-desc">Mở file (Open File)</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'open_file' }">
                {{ isRecording === 'open_file' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.open_file) }}
              </span>
              <input v-if="isRecording === 'open_file'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row locked">
              <span class="shortcut-desc">Tìm kiếm văn bản toàn cục</span>
              <span class="shortcut-key">CTRL + SHIFT + F</span>
            </div>
          </div>
        </div>

        <div class="setting-item-vertical">
          <label>Phím tắt Điều hướng Tab (Global)</label>
          <div class="shortcut-list">
            <div class="shortcut-row" @click="startRecording('prev_tab')">
              <span class="shortcut-desc">Chuyển về Tab phía trước</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'prev_tab' }">
                {{ isRecording === 'prev_tab' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.prev_tab) }}
              </span>
              <input v-if="isRecording === 'prev_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
            <div class="shortcut-row" @click="startRecording('next_tab')">
              <span class="shortcut-desc">Chuyển sang Tab tiếp theo</span>
              <span class="shortcut-key" :class="{ 'recording': isRecording === 'next_tab' }">
                {{ isRecording === 'next_tab' ? 'HÃY NHẤN TỔ HỢP PHÍM MỚI...' : formatShortcut(settings.shortcuts?.next_tab) }}
              </span>
              <input v-if="isRecording === 'next_tab'" ref="shortcutInputRef" type="text" class="hidden-input" @keydown="handleShortcutKey($event)" @blur="isRecording = null" />
            </div>
          </div>
        </div>
      </div>

      <!-- AI SERVICES -->
      <div v-show="currentCategory === 'ai'" class="settings-section">
        <div class="section-header-modern">
          <h2 class="section-title">AI Content Services</h2>
          <p class="section-desc">Cấu hình API Key cho các mô hình AI, phục vụ tính năng vẽ Flowchart và hỗ trợ viết code.</p>
        </div>

        <div class="setting-item">
          <label>Nhà cung cấp mặc định (Provider)</label>
          <select v-model="settings.ai.provider" class="theme-select" @change="saveSettings">
            <option value="gemini">Gemini (Google) - Nên dùng</option>
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="ollama">Ollama (Chạy Offline cục bộ)</option>
          </select>
        </div>

        <div class="provider-block glass" :class="{ active: settings.ai.provider === 'gemini' }">
          <div class="provider-label"><span class="provider-dot gemini"></span> Google Gemini API</div>
          <input v-model="settings.ai.geminiKey" type="password" class="text-input" placeholder="Nhập API Key (AIza...)" @change="saveSettings"/>
          <select v-model="settings.ai.geminiModel" class="theme-select" @change="saveSettings">
            <option value="gemini-1.5-flash">gemini-1.5-flash (Nhanh)</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro (Mạnh nhất)</option>
          </select>
        </div>
      </div>

      <!-- SMOKING / CHILL -->
      <div v-show="currentCategory === 'chill'" class="settings-section">
        <div class="section-header-modern">
          <h2 class="section-title">Smoking & Relax</h2>
          <p class="section-desc">Cài đặt cho widget giải lao khi làm việc căng thẳng.</p>
        </div>

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
        <div class="section-header-modern">
          <h2 class="section-title">Tab Convert UI Rules</h2>
          <p class="section-desc">Các quy tắc định dạng được áp dụng khi thực hiện chuyển đổi JSP sang cấu trúc PDA/Common.</p>
        </div>

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

.glass {
  background: rgba(128, 128, 128, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 12px;
  padding: 16px;
}

.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.08); }
.setting-item-vertical { display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(128,128,128,0.08); }
.setting-item label, .setting-item-vertical label { font-weight: 800; font-size: 0.7rem; text-transform: uppercase; opacity: 0.4; letter-spacing: 0.1em; }

.section-header-modern { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(128, 128, 128, 0.1); }
.section-title { margin: 0; font-size: 1.25rem; font-weight: 900; color: var(--accent-color); letter-spacing: -0.02em; }
.section-desc { margin: 4px 0 0; font-size: 0.8rem; opacity: 0.6; font-weight: 500; }
.field-hint { margin: 4px 0 0; font-size: 0.7rem; opacity: 0.4; font-style: italic; }

.path-list-modern { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.path-list-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(0,0,0,0.05); border-radius: 8px; border: 1px solid rgba(128,128,128,0.1); }
.path-text { font-size: 0.75rem; font-weight: 600; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px; }
.remove-path-btn { background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px; display: flex; align-items: center; opacity: 0.6; transition: opacity 0.2s; }
.remove-path-btn:hover { opacity: 1; }
.add-path-btn-dashed { 
  background: transparent; border: 1.5px dashed rgba(128,128,128,0.3); border-radius: 8px; 
  padding: 12px; color: var(--accent-color); font-weight: 700; font-size: 0.75rem; 
  cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
}
.add-path-btn-dashed:hover { background: rgba(99,102,241,0.05); border-color: var(--accent-color); }

.theme-select, .text-input { 
  padding: 8px 12px; 
  background-color: rgba(0,0,0,0.1); 
  color: var(--text-color); 
  border: 1px solid rgba(128, 128, 128, 0.2); 
  border-radius: 8px; 
  font-size: 0.8rem; 
  font-weight: 600;
  outline: none; 
  transition: border-color 0.2s;
}
.theme-select:focus, .text-input:focus { border-color: var(--accent-color); }

.theme-select-group { display: flex; gap: 10px; align-items: center; }
.test-loading-btn { 
  display: flex; align-items: center; gap: 6px; padding: 6px 12px;
  background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--accent-color); border-radius: 8px; font-weight: 800; font-size: 0.7rem;
  cursor: pointer; transition: all 0.2s;
}
.test-loading-btn:hover { background: var(--accent-color); color: #fff; }
.test-icon { width: 14px; height: 14px; display: flex; align-items: center; }

.path-picker { display: flex; gap: 8px; }
.path-input { flex: 1; opacity: 0.7; cursor: default; }

.save-all-btn { 
  background: var(--accent-color); 
  color: white; border: none; 
  padding: 6px 16px; 
  border-radius: 8px; 
  font-weight: 700; 
  font-size: 0.75rem; 
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.2s;
}
.save-all-btn:hover { box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); transform: translateY(-1px); }

.shortcut-list { display: flex; flex-direction: column; gap: 8px; }
.shortcut-row { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 10px 14px; background: rgba(0,0,0,0.1); 
  border-radius: 8px; cursor: pointer; border: 1px solid transparent;
  transition: all 0.2s;
}
.shortcut-row:hover { border-color: var(--accent-color); background: rgba(99, 102, 241, 0.05); }
.shortcut-row.locked { opacity: 0.5; cursor: default; }

.shortcut-desc { font-size: 0.8rem; font-weight: 600; }
.shortcut-key { 
  font-family: 'Consolas', monospace; font-size: 0.75rem; 
  background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);
}
.shortcut-key.recording { color: var(--accent-color); font-weight: 800; animation: pulse 1.5s infinite; }

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

.rule-group { background: rgba(0,0,0,0.1); padding: 16px; }
.rule-title { margin: 0 0 12px 0; font-size: 0.75rem; color: var(--accent-color); font-weight: 900; letter-spacing: 0.05em; }
.rule-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.75rem; }
.rule-tag { background: rgba(99, 102, 241, 0.15); color: var(--accent-color); padding: 2px 8px; border-radius: 4px; font-weight: 900; min-width: 60px; text-align: center; }
.rule-item p { margin: 0; opacity: 0.7; font-weight: 600; }

.helper-actions { margin-top: 4px; }
.text-link-btn { background: none; border: none; color: var(--accent-color); padding: 0; font-size: 0.7rem; font-weight: 700; cursor: pointer; text-decoration: underline; opacity: 0.7; }
.text-link-btn:hover { opacity: 1; }

.provider-block { margin-top: 10px; display: flex; flex-direction: column; gap: 12px; opacity: 0.4; pointer-events: none; transition: opacity 0.3s; }
.provider-block.active { opacity: 1; pointer-events: all; }
.provider-label { font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.provider-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
.provider-dot.gemini { background: #4285f4; }

.hidden-input { position: absolute; opacity: 0; pointer-events: none; }

/* Win95 Variations */
.theme-95 .settings-layout, .theme-95 .settings-sidebar, .theme-95 .category-btn, .theme-95 .settings-content, .theme-95 .glass, .theme-95 .rule-group, .theme-95 .shortcut-row {
  background: #c0c0c0 !important; border-radius: 0 !important; border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; backdrop-filter: none !important; color: #000 !important;
}
.theme-95 .category-btn.active { background: #000080 !important; color: #fff !important; border: none !important; }
.theme-95 .save-all-btn { border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; background: #c0c0c0 !important; color: #000 !important; border-radius: 0; }
.theme-95 .theme-select, .theme-95 .text-input { border: 2px solid !important; border-color: #808080 #fff #fff #808080 !important; border-radius: 0; background: #fff !important; color: #000 !important; }
</style>
