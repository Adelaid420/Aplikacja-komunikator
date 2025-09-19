import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  },
  base: './'
});
