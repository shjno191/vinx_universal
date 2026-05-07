import { VinxPlugin } from '@vinx/sdk';
import ConvertTab from './ConvertTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'convert',
    name: 'Convert',
    version: '0.1.0',
    description: 'Text and code conversion tools'
  },
  component: ConvertTab
};

export default plugin;
