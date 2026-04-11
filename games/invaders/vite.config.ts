import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env['BASE_PATH'] ?? '/open-source-invaders/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: { port: 5173 },
});
