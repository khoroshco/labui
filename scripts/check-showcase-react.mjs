/* Гейт React-витрины. Его не было вовсе — и это дорого стоило.
 *
 * Консилиум нашёл в перенесённой витрине: несуществующие пропсы `dot` и `onClick` у Pin
 * (сценарий с пинами не открывал тред НИКОГДА), мусорный пример `{ gap, duration }` из
 * авто-извлечения, пустой остров вместо демонстрации валидации, числовые пропсы строками.
 * Ни одна из этих поломок не покраснела: `lint:showcase` смотрит только DC-страницу, а
 * тесты о каталоге `showcase/` не знают.
 *
 * Проверяем то, что можно проверить машиной:
 *   — у каждого компонента контракта есть раздел, и наоборот;
 *   — каждый пример называет существующий компонент;
 *   — каждый проп примера и демо ОБЪЯВЛЕН у этого компонента (ловит `Pin dot`);
 *   — примеров не бывает пустых (пустой объект — это мусор извлечения);
 *   — числовой проп не приезжает строкой.
 */
import fs from 'node:fs';
import path from 'node:path';
import { report, ROOT } from './lib/dc.mjs';

const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.react.json'), 'utf8'));
const read = (f) => fs.readFileSync(path.join(ROOT, 'showcase', f), 'utf8');

const problems = [];
const props = new Map(api.components.map((c) => [c.name, new Map(c.props.map((p) => [p.name, p]))]));
// каналы наружу объявлены общим типом PassThrough и в контракт компонента не попадают
const PASSTHROUGH = /^(className|id|style|children|key|data-|aria-)/;

// ── разделы против контракта ─────────────────────────────────────────────────
const sections = read('sections.ts');
const declared = [...sections.matchAll(/component: '(\w+)'/g)].map((m) => m[1]);
for (const c of api.components) {
  if (!declared.includes(c.name)) problems.push(`${c.name}: в контракте есть, а раздела в витрине нет`);
}
for (const name of declared) {
  if (!props.has(name)) problems.push(`раздел называет компонент «${name}», которого нет в контракте`);
}

// ── примеры и демо: имена компонентов и имена пропсов ────────────────────────
function checkProps(where, comp, body) {
  const known = props.get(comp);
  if (!known) {
    problems.push(`${where}: компонента «${comp}» нет в контракте`);
    return;
  }
  const names = topKeys(body);
  if (!names.length) problems.push(`${where}: пример без единого пропа — похоже на мусор извлечения`);
  for (const n of names) {
    if (PASSTHROUGH.test(n)) continue;
    const spec = known.get(n);
    if (!spec) {
      problems.push(`${where}: у ${comp} нет пропа «${n}» — значение уходит в пустоту`);
      continue;
    }
    // числовой проп строкой: в разметке это был атрибут, в React — тип
    const re = new RegExp(`\\b${n}:\\s*"(-?\\d+(?:\\.\\d+)?)"`);
    if (/^number\b/.test(spec.type) && re.test(body)) {
      problems.push(`${where}: ${comp}.${n} — число, а передана строка`);
    }
  }
}

/** Вырезать блок в фигурных скобках со счётом вложенности: у пропа может быть объект. */
function block(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { body: src.slice(open + 1, i), end: i };
  }
  return null;
}

/** Имена пропсов ВЕРХНЕГО уровня: вложенные объекты описывает не контракт компонента. */
function topKeys(body) {
  const out = [];
  let depth = 0;
  let token = '';
  let quote = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    // Строку проходим насквозь: двоеточие внутри «https://» — не имя пропа.
    if (quote) {
      if (ch === quote && body[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      token = '';
      continue;
    }
    if ('{(['.includes(ch)) depth++;
    else if ('})]'.includes(ch)) depth--;
    else if (ch === ':' && depth === 0) {
      const name = token.trim().replace(/^['"]|['"]$/g, '');
      if (/^[\w$-]+$/.test(name)) out.push(name);
      token = '';
      continue;
    } else if (ch === ',' && depth === 0) {
      token = '';
      continue;
    }
    token += ch;
  }
  return out;
}

const examples = read('examples.ts');
for (const m of examples.matchAll(/\{ c: '(\w+)', p: /g)) {
  const b = block(examples, m.index + m[0].length - 1);
  if (b) checkProps(`examples.ts → ${m[1]}`, m[1], b.body);
}

const demo = read('demo.ts');
const demoStart = demo.indexOf('export const DEMO');
for (const m of demo.slice(demoStart).matchAll(/\n  (\w+): \{/g)) {
  const b = block(demo, demoStart + m.index + m[0].length - 1);
  if (b) checkProps(`demo.ts → ${m[1]}`, m[1], b.body);
}

// ── страховка от тихой пустоты ───────────────────────────────────────────────
if (declared.length < 20) problems.push(`разделов-компонентов ${declared.length} — витрина собралась не из того места`);
const exCount = [...examples.matchAll(/\{ c: '/g)].length;
if (exCount < 40) problems.push(`примеров ${exCount} вместо полусотни — блок примеров потерялся`);

process.exit(report('витрина на React', problems));
