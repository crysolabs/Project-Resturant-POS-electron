import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    entry: 'installer/src/main/main.ts',
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'installer/out/main' }
  },
  preload: {
    input: { preload: resolve('installer/src/preload/preload.ts') },
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'installer/out/preload' }
  },
  renderer: {
    root: 'installer/src/renderer',
    publicDir: resolve('installer/src/renderer/assets'),
    css: { postcss: false },
    plugins: [react()],
    build: {
      outDir: resolve('installer/out/renderer'),
      rollupOptions: { input: resolve('installer/src/renderer/index.html') }
    }
  }
});
