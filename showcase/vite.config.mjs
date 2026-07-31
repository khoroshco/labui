/* Сборка витрины.
 *
 * Плоского плагина здесь НЕТ намеренно: витрине он не нужен (стили она импортирует, иконки
 * инлайнятся на сборке), а его редирект с корня уводил на страницу старой DC-витрины —
 * то есть дев-сервер показывал не то, что собирается. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { build as buildTokens } from '../scripts/build-tokens-css.mjs';

buildTokens();

// Корень — от файла, а не от cwd: запуск из другого каталога иначе уводит сборку на уровень
// выше и раскладывает результат по чужому пути. Уже наступали в build-site.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root: path.join(ROOT, 'showcase'),
  build: {
    outDir: path.join(ROOT, 'dist-site/showcase'),
    emptyOutDir: true,

  },
  server: { port: Number(process.env.DS_PORT ?? 5174), strictPort: true },
});
