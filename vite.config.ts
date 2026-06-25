import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
  // On GitHub Pages the app is served from /LaneInterruption/, so built asset
  // URLs must be prefixed with that path. Local dev stays at root.
  base: command === 'build' ? '/LaneInterruption/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
}));
