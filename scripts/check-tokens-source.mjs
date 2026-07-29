/* Гейт источника токенов (Фаза 1).
 *
 * Проверяет то, что рушится молча:
 *   — ссылка ведёт в никуда: {alias.нет-такого} превращается в var(--нет-такого), и
 *     браузер молча берёт initial. Ни ошибки, ни следа — просто «цвет поехал»;
 *   — у токена нет $type: файл перестаёт быть машиночитаемым для Style Dictionary и Figma;
 *   — тема переопределяет несуществующий алиас: перемапливание в пустоту;
 *   — тема лезет в примитивы: слои схлопываются, и «имя алиаса стабильно» перестаёт работать;
 *   — токен объявлен, но нигде не используется — палитра растёт, а система нет;
 *   — собранный src/tokens.css разошёлся с источником.
 */
import fs from 'node:fs';
import path from 'node:path';
import { build, flatten, readSource, ROOT } from './build-tokens-css.mjs';
import { components, report, showcase } from './lib/dc.mjs';

const doc = readSource();
const flat = flatten(doc);
const problems = [];

const tokensOf = (obj) => Object.entries(obj).filter(([k, v]) => !k.startsWith('$') && v && typeof v === 'object');
const all = new Set([...Object.keys(flat.primitive), ...Object.keys(flat.alias)]);

// 1. типы и ссылки
for (const [group, obj] of [
  ['primitive', doc.primitive],
  ['alias', doc.alias],
  ['theme.light', doc.theme.light],
]) {
  for (const [name, token] of tokensOf(obj)) {
    if (!token.$type) problems.push(`${group}.${name}: нет $type — файл перестаёт быть машиночитаемым`);
    const ref = /^\{([a-z]+)\.([a-z0-9-]+)\}$/i.exec(String(token.$value));
    if (ref && !all.has(`--${ref[2]}`)) {
      problems.push(`${group}.${name}: ссылка {${ref[1]}.${ref[2]}} ведёт в никуда — var() молча уйдёт в initial`);
    }
  }
}

// 2. тема переопределяет только алиасы и только существующие
for (const name of Object.keys(flat.light)) {
  if (flat.alias[name] === undefined) {
    problems.push(
      flat.primitive[name] !== undefined
        ? `тема переопределяет примитив ${name}: слои схлопываются, «имя алиаса стабильно» перестаёт работать`
        : `тема переопределяет несуществующий алиас ${name}`
    );
  }
}

// 3. орфаны: токен объявлен, но им никто не пользуется
const usage = [
  ...components().map((c) => c.template + c.logic),
  ...showcase().map((s) => s.src),
  fs.readFileSync(path.join(ROOT, 'src/ds.css'), 'utf8'),
].join('\n');
// Примитив используется не компонентом, а алиасом — через ссылку DTCG. Оба вида
// употребления законны: важно, что токен кому-то нужен, а не кто именно его назвал.
const referenced = new Set(
  [...JSON.stringify(doc).matchAll(/\{[a-z]+\.([a-z0-9-]+)\}/gi)].map((m) => `--${m[1]}`)
);
const inExpression = new Set(
  [...JSON.stringify(doc).matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1])
);
for (const name of all) {
  const used =
    new RegExp(`var\\(\\s*${name}\\b`).test(usage) || referenced.has(name) || inExpression.has(name);
  if (!used) problems.push(`${name} объявлен, но нигде не используется — палитра растёт, а система нет`);
}

// 4. собранный CSS не разошёлся с источником
const { changed } = build();
if (changed) {
  problems.push('src/tokens.css был не собран из источника — перегенерируй «npm run tokens»');
}

process.exit(report('источник токенов (DTCG)', problems));
