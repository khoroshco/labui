/* Гейт против дрейфа витрины.
 *
 * Витрина объявлена единственным источником истины по составу — и именно поэтому она
 * уже расходилась с кодом: описывала удалённый режим острова, ссылалась на удалённый
 * компонент Status, показывала уровень яркости, которого у компонента нет. Причина всегда
 * одна: состав написан руками. Витрина строится из api.json; этот гейт держит честной
 * вторую сторону — имена и токены, названные в тексте — сверкой.
 *
 * Проверяем:
 *   1. каждый компонент из api.json показан в витрине;
 *   2. каждый компонент, упомянутый витриной, существует;
 *   3. таблица статусов совпадает с api.json по уровню и зрелости;
 *   4. каждый токен, упомянутый витриной, объявлен в tokens.css или ds.css.
 */
import fs from 'node:fs';
import path from 'node:path';
import { declaredTokens, report, ROOT, showcase } from './lib/dc.mjs';

const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const known = new Map(api.components.map((c) => [c.name, c]));
const problems = [];

const files = showcase();
const all = files.map((f) => f.src).join('\n');

// 1 + 2. Состав: витрина подписывает каждый компонент строкой «Name.dc.html».
const mentioned = new Set([...all.matchAll(/>([A-Z][A-Za-z0-9]+)\.dc\.html</g)].map((m) => m[1]));
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

// 3. Состав витрины приезжает из api.json, а не из рукописного массива.
const HANDWRITTEN = /statusRows:\s*\[\s*\[/;
if (HANDWRITTEN.test(all)) {
  problems.push(
    'состав витрины снова записан руками (statusRows массивом) — он обязан приезжать из api.json: ' +
      'рукописный список уже расходился с кодом'
  );
}
if (!/fetch\(\s*['"]api\.json['"]/.test(all)) {
  problems.push('витрина не читает api.json — состав перестал быть машинным');
}

// 4. Токены: витрина документирует систему, поэтому не имеет права называть несуществующее.
const declared = declaredTokens();
const localVars = new Set([...all.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
for (const m of all.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
  const t = m[1];
  if (!declared.has(t) && !localVars.has(t)) problems.push(`витрина ссылается на несуществующий токен ${t}`);
}

process.exit(report('витрина против кода', problems));
