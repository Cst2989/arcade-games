import { defineConfig } from 'vite';

export default defineConfig({
  base: '/open-source-invaders/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: { port: 5173 },
});
