import { VinxPlugin } from '@vinx/sdk';
import FlowChartTab from './FlowChartTab.vue';

const plugin: VinxPlugin = {
  manifest: {
    id: 'flow-chart',
    name: 'FlowChart',
    version: '0.1.0',
    description: 'Generate flow charts from code'
  },
  component: FlowChartTab
};

export default plugin;
