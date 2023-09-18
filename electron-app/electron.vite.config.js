import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
export default function ({ mode }) {
  const env = loadEnv(mode, process.cwd())
  return defineConfig({
    main: {
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()],
      server: {
        port: 3000,
        host: true,
        // Get rid of the CORS error
        proxy: {
          '/api': {
            target: env.RENDERER_VITE_APIURI,
            changeOrigin: true,
            secure: false
          }
        }
      }
    }
  })
}
