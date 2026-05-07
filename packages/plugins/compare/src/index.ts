import { VinxPlugin } from '@vinx/sdk';
import CompareTab from './CompareTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'compare',
    name: 'Compare',
    version: '0.1.0',
    description: 'Compare text and files'
  },
  component: CompareTab
};

export default plugin;
