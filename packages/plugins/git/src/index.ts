import { VinxPlugin } from '@vinx/sdk';
import GitTab from './GitTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'git',
    name: 'Git',
    version: '0.1.0',
    description: 'Git source control management'
  },
  component: GitTab
};

export default plugin;
