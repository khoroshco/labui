import { defineConfig } from 'vite';
import { build as buildTokens } from './scripts/build-tokens-css.mjs';
import flatDs from './scripts/vite-plugin-flat-ds.mjs';

// src/tokens.css — артефакт: источник истины лежит в tokens/banner-lab.tokens.json.
// Собираем на старте, чтобы дев-сервер и тесты никогда не видели устаревший файл.
buildTokens();

export default defineConfig({
  plugins: [flatDs()],
  server: {
    port: 5173,
    strictPort: true,
    open: process.env.CI ? false : '/',
  },
});
