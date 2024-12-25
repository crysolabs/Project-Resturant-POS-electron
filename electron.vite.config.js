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
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload')
      }
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
