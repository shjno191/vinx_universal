import { VinxPlugin } from '@vinx/sdk';
import BatchTab from './BatchTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'batch',
    name: 'Batch',
    version: '0.1.0',
    description: 'Batch processing analyzer, execution clustering and translation tool'
  },
  component: BatchTab
};

export default plugin;
export * from './utils/batch-parser';
