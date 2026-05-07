import { VinxPlugin } from '@vinx/sdk';
import EditorTab from './EditorTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'editor',
    name: 'Editor',
    version: '0.1.0',
    description: 'Advanced code editor with file explorer'
  },
  component: EditorTab
};

export default plugin;
