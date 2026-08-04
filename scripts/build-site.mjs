/* Статическая витрина для GitHub Pages.
 *
 * Сборки как таковой нет и не нужно: DC-страницы статичны. Единственное, что делает этот
 * скрипт, — раскладывает исходники в ПЛОСКИЙ каталог, потому что рантайм монтирует соседей
 * относительно открытого документа (см. CLAUDE.md, «Репозиторий»). То есть на Pages уезжает
 * ровно то же дерево URL, что отдаёт npm run dev, — гейты и живой сайт смотрят на одно и то же.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFlatMap } from './vite-plugin-flat-ds.mjs';

// Корень — от файла, а не от cwd. С cwd запуск из подкаталога делал rm -rf по чужому пути
// и выкладывал ПУСТОЙ сайт: карта URL собиралась не оттуда, а пустой список ошибкой не был.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-site');

const map = [...buildFlatMap(root)];
// Страховка от тихой пустоты: страниц тридцать, к ним стили, шрифты и иконки.
if (map.length < 40) {
  throw new Error(`build-site: карта URL собрала ${map.length} файлов — сайт был бы пустым`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let count = 0;
for (const [url, file] of map) {
  const target = path.join(out, url);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
  count++;
}

// Корень: витрина остаётся по своему адресу — рантайм узнаёт корневой компонент по имени
// файла, и index.html сломал бы это определение. Поэтому здесь редирект, а не копия.
fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Banner Lab DS</title>
<meta http-equiv="refresh" content="0; url=./Storybook.dc.html">
<link rel="canonical" href="./Storybook.dc.html">
</head>
<body>
<a href="./Storybook.dc.html">Витрина Banner Lab DS</a> ·
<a href="./showcase/">та же витрина на React (проверяется)</a>
</body>
</html>
`
);

// Pages по умолчанию прогоняет всё через Jekyll и выбрасывает файлы, начинающиеся с «_».
fs.writeFileSync(path.join(out, '.nojekyll'), '');

// React-витрина собирается сюда же, в /showcase. Пока их две, старая остаётся корнем:
// сравнивать их должен человек, а не гейт, и для этого обе обязаны быть открыты.
// Локальный бинарник, а не npx: при неполном node_modules npx молча тянет одноимённый
// пакет из сети и собирает сайт ЧУЖИМ сборщиком. Правило репозитория, и здесь оно
// нарушалось — единственное место, где npx оставался.
execFileSync(path.join(root, 'node_modules/.bin/vite'), ['build', '--config', path.join(root, 'showcase/vite.config.mjs')], {
  stdio: 'inherit',
  cwd: root,
});

// Проверка, которой не было: страница отдавала 200 и БЕЛЫЙ ЛИСТ, потому что Vite собрал
// абсолютные пути к ассетам, а сайт живёт в подкаталоге (…/labui/showcase/). Ни один гейт
// этого не видел — нашёл владелец, открыв ссылку. Теперь: ни одной абсолютной ссылки на
// ассет и каждый упомянутый файл существует.
const showcaseHtml = path.join(out, 'showcase/index.html');
const html = fs.readFileSync(showcaseHtml, 'utf8');
const absolute = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
if (absolute.length) {
  throw new Error(`витрина ссылается на ассеты абсолютным путём — в подкаталоге это белый лист: ${absolute.join(', ')}`);
}
const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
if (refs.length < 2) throw new Error('в собранной витрине нет ссылок на скрипт и стиль — сборка пуста');
for (const ref of refs) {
  const file = path.join(out, 'showcase', ref.replace(/^\.\//, ''));
  if (!fs.existsSync(file)) throw new Error(`витрина ссылается на несуществующий файл: ${ref}`);
}

console.log(`dist-site: ${count} файлов + index.html + витрина на React в /showcase/ (${refs.length} ассета на месте)`);
