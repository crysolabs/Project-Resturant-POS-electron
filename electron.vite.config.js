import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    },
    build: {
      watch: {} // This enables main process reloading
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload')
      }
    },
    build: {
      watch: {} // This enables main process reloading
    }
  },
  renderer: {
    resolve: {
      alias: {
        // '@renderer': resolve('src/renderer/src'),
        '@loader': resolve('src/renderer/loader/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          // main: resolve('src/renderer/index.html'),
          loader: resolve('src/renderer/loader/index.html')
        }
      }
    },
    plugins: [react()]
  }
});
