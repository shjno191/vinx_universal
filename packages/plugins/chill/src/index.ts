import { VinxPlugin } from '@vinx/sdk';
import SmokeTab from './SmokeTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'chill',
    name: 'Chill',
    version: '0.1.0',
    description: 'Relaxation and chill features'
  },
  component: SmokeTab
};

export default plugin;
