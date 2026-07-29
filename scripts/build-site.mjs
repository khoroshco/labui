/* Статическая витрина для GitHub Pages.
 *
 * Сборки как таковой нет и не нужно: DC-страницы статичны. Единственное, что делает этот
 * скрипт, — раскладывает исходники в ПЛОСКИЙ каталог, потому что рантайм монтирует соседей
 * относительно открытого документа (см. CLAUDE.md, «Репозиторий»). То есть на Pages уезжает
 * ровно то же дерево URL, что отдаёт npm run dev, — гейты и живой сайт смотрят на одно и то же.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildFlatMap } from './vite-plugin-flat-ds.mjs';

const root = process.cwd();
const out = path.join(root, 'dist-site');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let count = 0;
for (const [url, file] of buildFlatMap(root)) {
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
<body><a href="./Storybook.dc.html">Витрина Banner Lab DS</a></body>
</html>
`
);

// Pages по умолчанию прогоняет всё через Jekyll и выбрасывает файлы, начинающиеся с «_».
fs.writeFileSync(path.join(out, '.nojekyll'), '');

console.log(`dist-site: ${count} файлов + index.html`);
