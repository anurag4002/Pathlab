import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
  },
  '/uploads': {
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'shared-formula-runtime',
    apply: 'serve',
    transform(code, id) {
      if (id.split('?')[0].endsWith('/services/formulaRuntime.cjs')) {
        return { code: code.replace('module.exports = { parseFormula, evaluateFormula };', 'export { parseFormula, evaluateFormula };'), map: null }
      }
    }
  }],
  // The restricted arithmetic runtime is shared with save-time validation.
  build: { commonjsOptions: { include: [/node_modules/, /formulaRuntime\.cjs$/] } },
  server: {
    port: 3000,
    proxy,
    fs: { allow: ['.', '../backend/src/services/formulaRuntime.cjs'] },
  },
  preview: {
    port: 3000,
    proxy,
  }
})
