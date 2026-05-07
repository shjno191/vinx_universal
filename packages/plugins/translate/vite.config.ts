import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'VinxPluginTranslate',
      fileName: (format) => `index.${format}.js`,
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', '@vinx/sdk', '@tauri-apps/api'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
});
