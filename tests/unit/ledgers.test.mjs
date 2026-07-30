/* Ledger'ы известных отклонений сверяются с исходниками, а не только с прогоном.
 *
 * У ledger'а два способа врать. Первый — пропустить новое отклонение; его ловят гейты,
 * которые эти файлы читают. Второй — сохранить строку, которая больше не воспроизводится:
 * она выглядит как истина и живёт вечно. У ledger'а доступности проверка на второй случай
 * есть, у остальных двух её не было.
 *
 * Список дыр шаблона выводится из исходников статически (атрибуты с холом внутри), поэтому
 * сверка не требует браузера и не зависит от того, какие страницы успел открыть прогон.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/** Все .dc.html системы: компоненты и витрина. */
function dcFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name.endsWith('.dc.html')) out.push(path.join(dir, e.name));
    }
  };
  walk('src');
  walk('storybook');
  return out;
}

test('ledger дыр шаблона: ни лишней строки, ни пропущенной', () => {
  const known = read('tests/smoke/known-template-holes.json').known;

  // Хол уходит в сеть только из атрибута, который браузер грузит сам: src у <img> и
  // name у <g-icon> (последний рантайм превращает в запрос svgs/имя.svg).
  const found = new Set();
  for (const file of dcFiles()) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [, value] of src.matchAll(/<img[^>]*\ssrc="([^"]*\{\{[^"]*)"/g)) {
      found.add('/' + value.replace(/^\.?\//, ''));
    }
    for (const [, value] of src.matchAll(/<g-icon[^>]*\sname="([^"]*\{\{[^"]*)"/g)) {
      found.add(`/svgs/${value}.svg`);
    }
  }

  const stale = known.filter((h) => !found.has(h));
  assert.deepEqual(
    stale,
    [],
    `в ledger'е есть дыры, которых больше нет в исходниках — вычеркни их из ` +
      `tests/smoke/known-template-holes.json:\n  ${stale.join('\n  ')}`
  );

  const fresh = [...found].filter((h) => !known.includes(h));
  assert.deepEqual(
    fresh,
    [],
    `в исходниках появились новые дыры шаблона — либо опечатка в имени, либо значение, ` +
      `которого больше нет:\n  ${fresh.join('\n  ')}`
  );
});

test('ledger расхождений рамок: каждая запись про существующий компонент', () => {
  const known = read('tests/parity/known-box-deltas.json').known;
  const migrated = read('packages/ds-react/migrated.json').components;
  const unknown = Object.keys(known).filter((k) => !migrated.includes(k.split('/')[0]));
  assert.deepEqual(
    unknown,
    [],
    `запись ledger'а про компонент, которого нет среди мигрированных:\n  ${unknown.join('\n  ')}`
  );
});

test('бюджет контраста: каждая пара про существующие токены', () => {
  const budget = read('tests/a11y/contrast-budget.json');
  const css = fs.readFileSync(path.join(ROOT, 'src/tokens.css'), 'utf8');
  const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  const pairs = Object.keys(budget.below);
  assert.ok(pairs.length > 0, 'бюджет контраста пуст — гейт проверял бы ноль пар');
  // Ключ записи — «тема/текст/поверхность». Переименованный токен превращает запись
  // в мусор, который читается как измеренный факт.
  const ghosts = pairs
    .flatMap((k) => k.split('/').slice(1))
    .filter((t) => !declared.has(t));
  assert.deepEqual(ghosts, [], `в бюджете контраста токены, которых нет в tokens.css: ${ghosts.join(', ')}`);
});
