/* Второй движок доступности: pa11y-ci (HTML_CodeSniffer), стандарт WCAG2AA.
 *
 * Зачем второй, когда есть axe: движки проверяют разное. axe читает вычисленное дерево
 * доступности, CodeSniffer идёт по буквам техник WCAG. Пересечение большое, но края —
 * разные, а у нас нет человека, который заметит пропущенное.
 *
 * Что он смотрит:
 *   — каждую .dc.html standalone: это проверка страницы как ДОКУМЕНТА (lang, title,
 *     заголовки) — то, чего не видит axe, включённый по #dc-root;
 *   — React-харнесс с фикстурами: это проверка того, что реально уезжает потребителю,
 *     и единственный способ показать движку НАПОЛНЕННЫЙ компонент. Раньше он смотрел
 *     только страницы с дефолтными пропсами — то есть пустой ряд и пустой остров.
 *
 * Сервер поднимается программно тем же плагином, что и npm run dev.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { buildFlatMap } from './vite-plugin-flat-ds.mjs';
import flatDs from './vite-plugin-flat-ds.mjs';
import { FIXTURES, PORTALED } from '../tests/support/fixtures.js';

const PORT = 5275; // свой порт: 5173 занимает npm run dev, 5174 — витрина, 5273/5274 — Playwright
// Корень — от файла, а не от cwd: запуск из подкаталога молча отдавал пустой список URL,
// а пустой список для pa11y-ci — это успех.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = `http://localhost:${PORT}`;

const pageUrls = [...buildFlatMap(root)]
  .filter(([u]) => u.endsWith('.dc.html'))
  .map(([u]) => `${base}${u}`)
  .sort();

// Страховка от тихого нуля: страниц в системе тридцать. Любое число меньше двадцати
// означает, что список собрался не из того места, а не что доступность стала идеальной.
if (pageUrls.length < 20) {
  throw new Error(`pa11y: собрано ${pageUrls.length} страниц вместо тридцати — проверь корень и карту URL`);
}

// Ждать монтирования обязательно: первый запрос к харнессу компилируется на ходу, и на
// холодном сервере это дольше wait. Проверка пустой страницы — это ноль нарушений, то есть
// зелёный гейт над невыполненной работой. Проверено, что путь краснеет: кнопка-иконка без
// tooltip даёт «button element does not have a name», с tooltip — чисто.
// Та же причина у .dc.html: рантайм монтирует страницу сам, дотягивая React со стороны, —
// и без ожидания движок успевал прочитать документ до появления компонента.
const MOUNTED = ['wait for element #dc-root .sc-host to be visible'];

const pages = pageUrls.map((url) => ({ url, actions: MOUNTED }));

// Состав — из КОНТРАКТА ПАКЕТА, а не из migrated.json. Раньше стоял второй список
// (принятые паритетом), и компонент, у которого эталона нет по построению, второй движок
// доступности не видел вовсе. Панель пропсов витрины (SbControls) живёт только в эталоне,
// и харнесс на такой запрос честно отвечает «нет компонента» — её фикстура сюда не идёт.
const inReact = new Set(
  JSON.parse(fs.readFileSync(path.join(root, 'api.react.json'), 'utf8')).components.map((c) => c.name)
);
if (inReact.size < 20) throw new Error(`pa11y: в контракте пакета ${inReact.size} компонентов — список собрался не из того места`);

const filled = Object.entries(FIXTURES).filter(([name]) => inReact.has(name)).flatMap(([name, props]) =>
  ['dark', 'light'].map((theme) => ({
    url: `${base}/harness/?c=${name}&theme=${theme}&props=${encodeURIComponent(JSON.stringify(props))}`,
    // Компонент в портале внутри .sc-host не появляется — он на body. Ждём его самого.
    actions: PORTALED.has(name) ? ['wait for element [role="dialog"], [role="alertdialog"] to be visible'] : MOUNTED,
  }))
);

const config = {
  // pa11y поднимает отдельный Chrome на каждый URL — это самая долгая часть прогона.
  // Четыре параллельно укладываются в память раннера и режут время втрое.
  concurrency: 4,
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
  urls: [...pages, ...filled],
};

const server = await createServer({
  configFile: false,
  root,
  plugins: [flatDs()],
  server: { port: PORT, strictPort: true },
  logLevel: 'error',
});
await server.listen();

// Каталог с непредсказуемым именем: путь по pid угадывается, а в него пишется конфиг,
// который потом исполняется. Дешевле сделать правильно, чем объяснять, почему так можно.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa11yci-'));
const configPath = path.join(tmp, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

// Локальный бинарник, а не npx: при неполном node_modules npx молча тянет одноимённый
// пакет из реестра, и гейт начинает проверять чужой код.
const bin = path.join(root, 'node_modules', '.bin', 'pa11y-ci');
if (!fs.existsSync(bin)) throw new Error('pa11y-ci не установлен — запусти npm ci');

const code = await new Promise((resolve) => {
  const child = spawn(bin, ['--config', configPath], { stdio: 'inherit', shell: false });
  child.on('error', (err) => {
    console.error('pa11y-ci не запустился:', err.message);
    resolve(1);
  });
  child.on('close', resolve);
});

fs.rmSync(tmp, { recursive: true, force: true });
await server.close();
process.exit(code ?? 1);
