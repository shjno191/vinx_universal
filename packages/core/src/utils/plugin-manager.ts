import { ref, Component } from 'vue';
import { VinxPlugin, VinxApi, Theme, theme as globalTheme } from '@vinx/sdk';

export interface RegisteredPlugin {
  id: string;
  name: string;
  icon?: string;
  component: Component;
}

const plugins = ref<RegisteredPlugin[]>([]);
const activePluginId = ref<string | null>(null);

export function usePluginManager() {
  const registerPlugin = (plugin: VinxPlugin) => {
    if (plugins.value.find(p => p.id === plugin.manifest.id)) {
      console.warn(`Plugin ${plugin.manifest.id} is already registered.`);
      return;
    }

    plugins.value.push({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      icon: plugin.manifest.icon,
      component: plugin.component
    });

    console.log(`Plugin ${plugin.manifest.name} registered.`);
  };

  const getPlugins = () => plugins.value;

  const createApi = (pluginId: string): VinxApi => {
    return {
      theme: {
        current: globalTheme.value as Theme,
        set: (newTheme: Theme) => {
          globalTheme.value = newTheme;
        }
      },
      notifications: {
        success: (msg) => {
          // Future: use a real toast system
          console.log(`[Plugin:${pluginId}] Success:`, msg);
        },
        error: (msg) => console.error(`[Plugin:${pluginId}] Error:`, msg),
        info: (msg) => console.info(`[Plugin:${pluginId}] Info:`, msg)
      },
      storage: {
        get: async (key) => {
          const val = localStorage.getItem(`plugin:${pluginId}:${key}`);
          try {
            return val ? JSON.parse(val) : null;
          } catch {
            return val;
          }
        },
        set: async (key, value) => {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(`plugin:${pluginId}:${key}`, stringValue);
        }
      }
    };
  };

  const loadPlugins = async () => {
    // Dynamically scan for plugins in the packages/plugins folder
    // Note: This assumes the folder structure we've created
    const modules = import.meta.glob('../../../plugins/*/src/index.ts');
    
    for (const path in modules) {
      try {
        const mod = await modules[path]() as { default: VinxPlugin };
        if (mod.default) {
          registerPlugin(mod.default);
        }
      } catch (e) {
        console.error(`Failed to load plugin at ${path}:`, e);
      }
    }
  };

  return {
    plugins,
    activePluginId,
    registerPlugin,
    getPlugins,
    createApi,
    loadPlugins
  };
}
