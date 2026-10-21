import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: './src/client',
  build: {
    outDir: '../../dist/public',
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/sse': 'http://127.0.0.1:3000',
      '/messages': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/state': 'http://127.0.0.1:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
