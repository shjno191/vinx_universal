import sys, re

file_path = r'd:\vinx_tools\vinx_universal\packages\plugins\translate\src\translate\TranslationPane.vue'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const contextMenu = ref({ show: false, x: 0, y: 0, text: '' });",
    "const contextMenu = ref({ show: false, x: 0, y: 0, text: '' });\nconst sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });"
)

sheet_funcs = """const closeContextMenu = () => {
  contextMenu.value.show = false;
  sheetContextMenu.value.show = false;
};

const handleContextAdd = () => {
  emit('contextAdd', contextMenu.value.text);
  closeContextMenu();
};

const onSheetContextMenu = (e: MouseEvent, fullKey: string) => {
  e.preventDefault();
  const meta = props.sheetMetadata[fullKey];
  sheetContextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    logical: meta?.logical || '',
    physical: meta?.physical || fullKey.split('::').pop() || '',
    fullKey
  };
};

const copyFromSheetContext = (type: 'logical' | 'physical') => {
  const text = type === 'logical' ? sheetContextMenu.value.logical : sheetContextMenu.value.physical;
  if (text) {
    emit('copy', text, new MouseEvent('click', { clientX: sheetContextMenu.value.x, clientY: sheetContextMenu.value.y }));
  }
  closeContextMenu();
};"""

content = re.sub(
    r'const closeContextMenu = \(\) => \{[\s\S]*?closeContextMenu\(\);\r?\n\};',
    sheet_funcs,
    content
)

content = content.replace(
    'class="sheet-item compact" :title="sheetMetadata[fullKey]?.physical || fullKey">',
    'class="sheet-item compact" :title="sheetMetadata[fullKey]?.physical || fullKey" @contextmenu.prevent="onSheetContextMenu($event, fullKey)">'
)

content = content.replace(
    'class="sheet-item" :title="sheetMetadata[s.file + \'::\' + s.name]?.physical || s.name">',
    'class="sheet-item" :title="sheetMetadata[s.file + \'::\' + s.name]?.physical || s.name" @contextmenu.prevent="onSheetContextMenu($event, s.file + \'::\' + s.name)">'
)

sheet_html = """      </div>

      <div v-if="sheetContextMenu.show" 
           class="vinx-context-menu glass" 
           :style="{ left: sheetContextMenu.x + 'px', top: sheetContextMenu.y + 'px' }"
           @click.stop>
        <div class="menu-item" @click="copyFromSheetContext('physical')" v-if="sheetContextMenu.physical">
          <span v-html="Icons.Copy || '📋'"></span> Copy EN name 
          <span class="context-preview">{{ sheetContextMenu.physical }}</span>
        </div>
        <div class="menu-item" @click="copyFromSheetContext('logical')" v-if="sheetContextMenu.logical">
          <span v-html="Icons.Copy || '📋'"></span> Copy JP name 
          <span class="context-preview">{{ sheetContextMenu.logical }}</span>
        </div>
      </div>
    </Teleport>"""

content = content.replace('      </div>\n    </Teleport>', sheet_html)
content = content.replace('      </div>\r\n    </Teleport>', sheet_html)

content = content.replace(
    '</style>',
    '.context-preview { opacity: 0.6; font-size: 0.85em; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: inline-block; vertical-align: middle; }\n</style>'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Patched successfully!')
