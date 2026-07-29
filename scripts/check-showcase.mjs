/* Гейт против дрейфа витрины.
 *
 * Витрина объявлена единственным источником истины по составу — и именно поэтому она
 * уже расходилась с кодом: описывала удалённый режим острова, ссылалась на удалённый
 * компонент Status, показывала уровень яркости, которого у компонента нет. Причина всегда
 * одна: состав написан руками. Пока витрина не строится из api.json (Фаза 2 ROADMAP),
 * гейт держит её честной с другой стороны — сверкой.
 *
 * Проверяем:
 *   1. каждый компонент из api.json показан в витрине;
 *   2. каждый компонент, упомянутый витриной, существует;
 *   3. таблица статусов совпадает с api.json по уровню и зрелости;
 *   4. каждый токен, упомянутый витриной, объявлен в tokens.css или ds.css.
 */
import fs from 'node:fs';
import path from 'node:path';
import { declaredTokens, LEVEL_RU, report, ROOT, showcase } from './lib/dc.mjs';

const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const known = new Map(api.components.map((c) => [c.name, c]));
const problems = [];

const files = showcase();
const all = files.map((f) => f.src).join('\n');

// 1 + 2. Состав: витрина подписывает каждый компонент строкой «Name.dc.html».
const mentioned = new Set([...all.matchAll(/>([A-Z][A-Za-z]+)\.dc\.html</g)].map((m) => m[1]));
for (const name of known.keys()) {
  if (!mentioned.has(name)) problems.push(`витрина не показывает компонент «${name}» — состав разошёлся`);
}
for (const name of mentioned) {
  if (!known.has(name) && !['Storybook', 'SbControls'].includes(name)) {
    problems.push(`витрина ссылается на несуществующий компонент «${name}»`);
  }
}

// Монтаж: <dc-import name="X"> в витрине обязан указывать на живой компонент.
for (const f of files) {
  for (const name of f.imports) {
    if (!known.has(name) && name !== 'SbControls') {
      problems.push(`${f.file} монтирует несуществующий компонент «${name}»`);
    }
  }
}

// 3. Таблица статусов — рукописный массив statusRows в логике витрины.
const rowsSrc = /statusRows:\s*\[([\s\S]*?)\]\.map\(/.exec(all)?.[1];
if (!rowsSrc) {
  problems.push('в витрине не найден массив statusRows — гейт статусов ослеп, проверь разметку');
} else {
  const rows = [...rowsSrc.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([01])\s*\]/g)].map((m) => ({
    name: m[1],
    level: m[2],
    status: m[3] === '1' ? 'stable' : 'beta',
  }));
  const seen = new Set();
  for (const r of rows) {
    seen.add(r.name);
    const c = known.get(r.name);
    if (!c) {
      problems.push(`статусы витрины: «${r.name}» не существует`);
      continue;
    }
    if (r.level !== LEVEL_RU[c.level]) {
      problems.push(
        `статусы витрины: «${r.name}» показан как ${r.level}, а лежит в ${c.level} (${LEVEL_RU[c.level]})`
      );
    }
    if (r.status !== c.status) {
      problems.push(`статусы витрины: «${r.name}» показан как ${r.status}, в components.json — ${c.status}`);
    }
  }
  for (const name of known.keys()) {
    if (!seen.has(name)) problems.push(`статусы витрины: «${name}» отсутствует в таблице`);
  }
}

// 4. Токены: витрина документирует систему, поэтому не имеет права называть несуществующее.
const declared = declaredTokens();
const localVars = new Set([...all.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
for (const m of all.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
  const t = m[1];
  if (!declared.has(t) && !localVars.has(t)) problems.push(`витрина ссылается на несуществующий токен ${t}`);
}

process.exit(report('витрина против кода', problems));
