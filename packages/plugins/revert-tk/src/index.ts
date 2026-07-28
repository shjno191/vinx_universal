import { VinxPlugin } from '@vinx/sdk';
import RevertTKTab from './RevertTKTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'revert-tk',
    name: 'RevertTK',
    version: '0.1.0',
    description: 'HTML Parser and Data Extraction Tool'
  },
  component: RevertTKTab
};

export default plugin;
