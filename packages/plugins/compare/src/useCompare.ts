import { ref, watch } from 'vue';
import { sharedInput, sharedOutput, activeTab } from '@vinx/sdk';

export function useCompare() {
  const originalText = ref(sharedInput.value);
  const modifiedText = ref(sharedOutput.value);
  const diffEditorRef = ref<any>(null);

  const normalize = (val: string) => (val ? val.replace(/\r\n/g, '\n') : '');

  // Sync with shared store (from store to local)
  watch(sharedInput, (val) => {
    const normVal = normalize(val);
    if (normalize(originalText.value) !== normVal) {
      originalText.value = normVal;
    }
  });

  watch(sharedOutput, (val) => {
    if (activeTab.value !== 'Compare') return;
    const normVal = normalize(val);
    if (normalize(modifiedText.value) !== normVal) {
      modifiedText.value = normVal;
    }
  });

  // Sync local changes back to store
  watch(originalText, (val) => {
    const normVal = normalize(val);
    if (normalize(sharedInput.value) !== normVal) {
      sharedInput.value = normVal;
    }
  });

  watch(modifiedText, (val) => {
    const normVal = normalize(val);
    if (normalize(sharedOutput.value) !== normVal) {
      sharedOutput.value = normVal;
    }
  });

  const handleEditorMount = (editor: any) => {
    diffEditorRef.value = editor;
    const original = editor.getOriginalEditor();
    const modified = editor.getModifiedEditor();

    original.onDidChangeModelContent(() => {
      const val = normalize(original.getValue());
      if (normalize(originalText.value) !== val) {
        originalText.value = val;
      }
    });

    modified.onDidChangeModelContent(() => {
      const val = normalize(modified.getValue());
      if (normalize(modifiedText.value) !== val) {
        modifiedText.value = val;
      }
    });
  };

  const swapInputs = () => {
    const temp = originalText.value;
    originalText.value = modifiedText.value;
    modifiedText.value = temp;
  };

  const clearInputs = () => {
    originalText.value = '';
    modifiedText.value = '';
  };

  const sortIdenticalToTop = () => {
    if (!originalText.value && !modifiedText.value) return;

    const lines1 = originalText.value.split(/\r?\n/);
    const lines2 = modifiedText.value.split(/\r?\n/);

    const common: string[] = [];
    const only1: string[] = [];
    const only2: string[] = [];

    const freq2 = new Map<string, number>();
    lines2.forEach((l) => freq2.set(l, (freq2.get(l) || 0) + 1));

    lines1.forEach((l) => {
      const count = freq2.get(l) || 0;
      if (count > 0) {
        common.push(l);
        freq2.set(l, count - 1);
      } else {
        only1.push(l);
      }
    });

    const freq1_copy = new Map<string, number>();
    lines1.forEach((l) => freq1_copy.set(l, (freq1_copy.get(l) || 0) + 1));

    lines2.forEach((l) => {
      const count = freq1_copy.get(l) || 0;
      if (count > 0) {
        freq1_copy.set(l, count - 1);
      } else {
        only2.push(l);
      }
    });

    originalText.value = [...common, ...only1].join('\n');
    modifiedText.value = [...common, ...only2].join('\n');
  };

  return {
    originalText,
    modifiedText,
    diffEditorRef,
    handleEditorMount,
    swapInputs,
    clearInputs,
    sortIdenticalToTop,
    normalize,
  };
}
