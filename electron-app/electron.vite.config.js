import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
export default function ({ mode }) {
  return defineConfig({
    main: {
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    }
  })
}
