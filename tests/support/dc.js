/* Общая оснастка для тестов по DC-страницам. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFlatMap } from '../../scripts/vite-plugin-flat-ds.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Рантайм грузит React с unpkg по SRI. В тестах отдаём локальную копию из node_modules:
 *  прогон не должен зависеть от сети. Байты те же, поэтому SRI сходится — если когда-нибудь
 *  разойдутся, браузер откажется исполнять скрипт и тест упадёт громко, а не тихо. */
const CDN_LOCAL = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js':
    'node_modules/react-dom/umd/react-dom.production.min.js',
};

/** Неразрешённый хол шаблона, доехавший до сетевого запроса: «svgs/{{ ic }}.svg». */
const TEMPLATE_HOLE = /\{\{|%7B%7B/i;

const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>';
const EMPTY_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** Все DC-страницы системы: URL, по которому их отдаёт сервер, и файл-источник.
 *  Карта — та же, что у дев-сервера, поэтому новый компонент попадает в гейты сам. */
export function dcPages() {
  return [...buildFlatMap(ROOT)]
    .filter(([url]) => url.endsWith('.dc.html'))
    .map(([url, file]) => ({ url, file, name: path.basename(file, '.dc.html') }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Готовит страницу к проверке и возвращает две копилки: `errors` (всё, что делает
 * загрузку грязной) и `holes` (неразрешённые холы шаблона, ушедшие в сеть).
 *
 * Про холы. Шаблон компонента лежит в документе настоящей разметкой, поэтому браузер
 * успевает запросить «{{ src }}» и «svgs/{{ iconName }}.svg» до того, как рантайм подменит
 * DOM своим рендером. Починить это в компоненте нельзя (это свойство формата, оно уходит
 * вместе с DC-рантаймом в Фазе 3), а оставить как 404 — значит держать гейт вечно красным.
 * Поэтому такие запросы подменяются пустым валидным ответом, но ПЕРЕСЧИТЫВАЮТСЯ: тест
 * сверяет их с записанным списком, и любой новый хол виден сразу.
 */
export function preparePage(page) {
  const errors = [];
  const holes = new Set();

  page.route('https://unpkg.com/**', (route) => {
    const local = CDN_LOCAL[route.request().url()];
    if (!local) return route.continue(); // неизвестный CDN-адрес — пусть будет видно в сети
    route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: fs.readFileSync(path.join(ROOT, local)),
    });
  });

  page.route(
    (url) => TEMPLATE_HOLE.test(url.href),
    (route) => {
      const url = decodeURIComponent(new URL(route.request().url()).pathname);
      holes.add(url);
      const svg = url.endsWith('.svg');
      route.fulfill({
        status: 200,
        contentType: svg ? 'image/svg+xml' : 'image/gif',
        body: svg ? EMPTY_SVG : EMPTY_GIF,
      });
    }
  );

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`));
  page.on('requestfailed', (r) => {
    if (isIgnorable(r.url())) return;
    // Прогрев витрины идёт через <link rel="prefetch"> — спекулятивный запрос по определению.
    // Браузер отменяет часть из них, когда страница догрузилась; это не отказ ресурса,
    // и на странице ничего не меняет. Отменённый НЕспекулятивный запрос по-прежнему красный.
    if (r.resourceType() === 'other' && r.failure()?.errorText === 'net::ERR_ABORTED') return;
    errors.push(`requestfailed: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`);
  });
  // 404 — это НЕ requestfailed: запрос успешен, ответ пустой. Битый путь после раскладки
  // по уровням выглядит именно так, поэтому статусы проверяем отдельно.
  page.on('response', (r) => {
    if (isIgnorable(r.url())) return;
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });

  return { errors, holes };
}

/** Запрос самого браузера, а не системы. */
function isIgnorable(url) {
  return url.endsWith('/favicon.ico');
}

/** Открыть DC-страницу и дождаться, пока рантайм смонтирует корень и стихнет сеть. */
export async function openDc(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#dc-root')?.children.length > 0, null, {
    timeout: 15_000,
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300); // добить асинхронные маунты и хелперы из хелмета
}

/** Состояние трёх начертаний Unica 77 на странице. */
export async function unicaFaces(page) {
  return page.evaluate(async () => {
    const specs = ['400 16px "Unica 77"', '500 16px "Unica 77"', '900 16px "Unica 77"'];
    for (const s of specs) {
      try {
        await document.fonts.load(s);
      } catch {
        /* статус лица ниже расскажет точнее */
      }
    }
    const faces = [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'Unica 77');
    return {
      total: faces.length,
      loaded: faces.filter((f) => f.status === 'loaded').length,
      errored: faces.filter((f) => f.status === 'error').length,
    };
  });
}
