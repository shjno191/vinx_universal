<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';

const code = ref('');
const editorRef = ref<any>(null);

const MONACO_OPTIONS = {
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: true },
  fontSize: 14,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  fixedOverflowWidgets: true,
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  // Multiple cursors are usually enabled by default in Monaco
  // with Ctrl+D (Add Selection To Next Find Match)
  // and Ctrl+Shift+L (Select All Occurrences)
};

const handleMount = (editor: any) => {
  editorRef.value = editor;
  
  // Ensure the editor focus if needed
  // editor.focus();
};

// Handle value change if needed for external sync
const onChange = (value: string | undefined) => {
  // console.log("onChange", value);
};

</script>

<template>
  <div class="editor-tab-container">
    <VueMonacoEditor
      v-model:value="code"
      theme="vs-dark"
      language="javascript"
      :options="MONACO_OPTIONS"
      @mount="handleMount"
      @change="onChange"
      class="monaco-instance"
    />
  </div>
</template>

<style scoped>
.editor-tab-container {
  width: 100%;
  height: 100%;
  background-color: #1e1e1e; /* Match vs-dark background */
  overflow: hidden;
}

.monaco-instance {
  width: 100%;
  height: 100%;
}
</style>
