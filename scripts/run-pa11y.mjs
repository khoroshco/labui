/* Второй движок доступности: pa11y-ci (HTML_CodeSniffer), стандарт WCAG2AA.
 *
 * Зачем второй, когда есть axe: движки проверяют разное. axe читает вычисленное дерево
 * доступности, CodeSniffer идёт по буквам техник WCAG. Пересечение большое, но края —
 * разные, а у нас нет человека, который заметит пропущенное.
 *
 * Сервер поднимается программно тем же плагином, что и npm run dev: гейт обязан смотреть
 * на то же, что видит разработчик.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { buildFlatMap } from './vite-plugin-flat-ds.mjs';
import flatDs from './vite-plugin-flat-ds.mjs';

const PORT = 5174; // не мешаем открытому npm run dev
const root = process.cwd();

const urls = [...buildFlatMap(root)]
  .filter(([u]) => u.endsWith('.dc.html'))
  .map(([u]) => `http://localhost:${PORT}${u}`)
  .sort();

const config = {
  defaults: {
    standard: 'WCAG2AA',
    timeout: 40000,
    wait: 1200, // DC-страница монтируется рантаймом, а не приходит готовой
    hideElements: '#dc-root [aria-hidden="true"]',
    // Контраст ведётся отдельным бюджетом на ТОКЕНАХ (tests/a11y/contrast-budget.json):
    // одно и то же решение не должно проверяться двумя движками с разной математикой.
    ignore: [
      'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail',
      'WCAG2AA.Principle1.Guideline1_4.1_4_3.G145.Fail',
      'WCAG2AA.Principle1.Guideline1_4.1_4_3_1.G18.Fail',
    ],
    chromeLaunchConfig: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  urls,
};

const server = await createServer({
  configFile: false,
  root,
  plugins: [flatDs()],
  server: { port: PORT, strictPort: true },
  logLevel: 'error',
});
await server.listen();

const configPath = path.join(os.tmpdir(), `pa11yci-${process.pid}.json`);
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

const code = await new Promise((resolve) => {
  const child = spawn('npx', ['pa11y-ci', '--config', configPath], { stdio: 'inherit', shell: false });
  child.on('close', resolve);
});

fs.rmSync(configPath, { force: true });
await server.close();
process.exit(code ?? 1);
