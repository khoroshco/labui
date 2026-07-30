import { defineConfig } from 'vite';
import { build as buildTokens } from './scripts/build-tokens-css.mjs';
import flatDs from './scripts/vite-plugin-flat-ds.mjs';

// src/tokens.css — артефакт: источник истины лежит в tokens/banner-lab.tokens.json.
// Собираем на старте, чтобы дев-сервер и тесты никогда не видели устаревший файл.
buildTokens();

export default defineConfig({
  plugins: [flatDs()],
  server: {
    // Порт задаётся снаружи: гейты поднимают СВОЙ сервер на своём порту и никогда не
    // подключаются к открытому дев-серверу. Иначе прогон мог тихо проверять другой чекаут
    // того же репозитория — тот, что кто-то оставил на 5173 час назад.
    port: Number(process.env.DS_PORT ?? 5173),
    strictPort: true,
    open: process.env.CI ? false : '/',
  },
});
