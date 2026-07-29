import { defineConfig } from 'vite';
import flatDs from './scripts/vite-plugin-flat-ds.mjs';

export default defineConfig({
  plugins: [flatDs()],
  server: {
    port: 5173,
    strictPort: true,
    open: process.env.CI ? false : '/',
  },
});
