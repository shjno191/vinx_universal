import { VinxPlugin } from '@vinx/sdk';
import TranslateTab from './TranslateTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'translate',
    name: 'Translate',
    version: '0.1.0',
    description: 'Advanced translation tool with Excel support'
  },
  component: TranslateTab
};

export default plugin;
