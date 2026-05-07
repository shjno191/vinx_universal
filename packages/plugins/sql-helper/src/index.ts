import { VinxPlugin } from '@vinx/sdk';
import SQLHelperTab from './SQLHelperTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'sql-helper',
    name: 'SQL-Helper',
    version: '0.1.0',
    description: 'SQL extraction and formatting tool'
  },
  component: SQLHelperTab
};

export default plugin;
