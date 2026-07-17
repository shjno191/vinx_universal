const fs = require('fs');

const filePath = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\translate\\\\TranslationPane.vue';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
    "const contextMenu = ref({ show: false, x: 0, y: 0, text: '' });",
    "const contextMenu = ref({ show: false, x: 0, y: 0, text: '' });\nconst sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });"
);

const sheetFuncs = `const closeContextMenu = () => {
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
};`;

content = content.replace(/const closeContextMenu = \(\) => \{[\s\S]*?closeContextMenu\(\);\r?\n\};/, sheetFuncs);

content = content.replace(
    'class="sheet-item compact" :title="sheetMetadata[fullKey]?.physical || fullKey">',
    'class="sheet-item compact" :title="sheetMetadata[fullKey]?.physical || fullKey" @contextmenu.prevent="onSheetContextMenu($event, fullKey)">'
);

content = content.replace(
    'class="sheet-item" :title="sheetMetadata[s.file + \'::\' + s.name]?.physical || s.name">',
    'class="sheet-item" :title="sheetMetadata[s.file + \'::\' + s.name]?.physical || s.name" @contextmenu.prevent="onSheetContextMenu($event, s.file + \'::\' + s.name)">'
);

const sheetHtml = `      </div>

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
    </Teleport>`;

content = content.replace('      </div>\n    </Teleport>', sheetHtml);
content = content.replace('      </div>\r\n    </Teleport>', sheetHtml);

content = content.replace(
    '</style>',
    '.context-preview { opacity: 0.6; font-size: 0.85em; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: inline-block; vertical-align: middle; }\n</style>'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Patched correctly!');
