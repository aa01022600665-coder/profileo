import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: {
        entry: path.resolve(__dirname, 'electron/main.js')
      },
      rollupOptions: {
        external: ['puppeteer-core']
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: {
        entry: path.resolve(__dirname, 'electron/preload.js')
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: path.resolve(__dirname, 'src/index.html')
      }
    },
    plugins: [react()]
  }
})
