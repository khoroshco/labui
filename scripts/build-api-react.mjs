/* Контракт РЕАЛИЗАЦИИ: api.react.json из исходников packages/ds-react.
 *
 * Зачем отдельно от api.json. Тот описывает ЗАМОРОЖЕННЫЙ эталон (`runtime: dc`) и нужен
 * паритетным гейтам: они сверяют React с ним и берут оттуда дефолты. Этот описывает то,
 * что уезжает потребителю, и нужен витрине: плейграунд обязан показывать ВСЕ пропсы
 * компонента, а у React их больше (default*, className, id, data-*, aria-*).
 *
 * Два файла живут ровно до смерти DC-рантайма: с ним уходит эталон, уходит api.json, и
 * этот остаётся единственным. Пока они оба есть, у каждого один владелец и один читатель —
 * это лучше, чем один файл, который врёт половине читателей.
 *
 * Почему разбор свой, а не компилятором: TypeScript в проекте версии 7, у неё нет
 * классического JS-API (`ts.createProgram` отсутствует, модуль отдаёт только версию), а
 * ставить рядом второй TypeScript ради одного скрипта — ровно та зависимость, которую
 * запрещает ADR 0006. Интерфейсы у нас пишутся в одном стиле, поэтому разбор надёжен; а
 * чтобы «надёжен» не осталось словом, в конце стоят проверки: у каждого компонента есть
 * пропсы, у каждого союза строковых литералов разобраны варианты, состав совпадает с
 * migrated.json.
 *
 *   node scripts/build-api-react.mjs          перезаписать api.react.json
 *   node scripts/build-api-react.mjs --check  сверить с записанным (гейт CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { reactSources, report, ROOT } from './lib/dc.mjs';

const OUT = path.join(ROOT, 'api.react.json');
const migrated = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components;
const manual = JSON.parse(fs.readFileSync(path.join(ROOT, 'components.json'), 'utf8'));

/** Разбить список деструктуризации по запятым ВЕРХНЕГО уровня. */
function splitTop(src) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  out.push(src.slice(start));
  return out;
}

/** Значение по умолчанию из текста: строка, число, булево, пустой массив. */
function literal(text) {
  const v = text.trim();
  if (/^'[^']*'$/.test(v)) return v.slice(1, -1);
  if (/^"[^"]*"$/.test(v)) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === '[]') return [];
  return undefined;
}

/** Варианты значения: 'a' | 'b' → ['a','b']. Для остального — null. */
function optionsOf(type) {
  const parts = type.split('|').map((s) => s.trim());
  if (parts.length < 2) return null;
  if (!parts.every((p) => /^'[^']*'$/.test(p))) return null;
  return parts.map((p) => p.slice(1, -1));
}

// Псевдонимы типов: у пропа стоит ButtonVariant, а витрине нужны сами варианты.
const ALIASES = new Map();
for (const { body } of reactSources()) {
  for (const m of body.matchAll(/export type (\w+)\s*=\s*([^;]+);/g)) {
    ALIASES.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  }
}

/** Развернуть псевдонимы (двух проходов хватает: цепочек глубже у нас нет). */
function expand(type) {
  let out = type;
  for (let i = 0; i < 2; i++) {
    out = out
      .split('|')
      .map((part) => {
        const key = part.trim();
        return ALIASES.has(key) ? ALIASES.get(key) : part.trim();
      })
      .join(' | ');
  }
  return out;
}

/** Каким контролом проп редактируется в плейграунде. */
function editorOf(type, options) {
  if (options) return 'enum';
  if (/\bIconName\b/.test(type)) return 'icon';
  if (type === 'boolean') return 'boolean';
  if (type === 'number') return 'int';
  if (type === 'string') return 'text';
  return null; // сложное значение: массив, объект, колбэк — руками из фикстуры
}

const LEVELS = ['atoms', 'molecules', 'organisms'];
const components = [];
const mounts = new Map();

for (const { file, body } of reactSources()) {
  const level = LEVELS.find((l) => file.includes(`/${l}/`));
  if (!level) continue;

  for (const m of body.matchAll(/export interface (\w+)Props[^{]*\{([\s\S]*?)\n\}/g)) {
    const [, name, block] = m;
    if (!migrated.includes(name)) continue;

    // дефолты — из деструктуризации параметров компонента
    const fn = new RegExp(`export function ${name}\\(\\{([\\s\\S]*?)\\}: ${name}Props`).exec(body);
    const defaults = {};
    if (fn) {
      for (const part of splitTop(fn[1])) {
        const eq = /^\s*(\w+)\s*=\s*([\s\S]+)$/.exec(part);
        if (eq) {
          const value = literal(eq[2]);
          if (value !== undefined) defaults[eq[1]] = value;
        }
      }
    }

    // свойства: строка вида «  name?: тип;», перед ней может стоять /** описание */
    const props = [];
    let doc = '';
    for (const raw of block.split('\n')) {
      const line = raw.trimEnd();
      const jsdoc = /^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/.exec(line);
      if (jsdoc) {
        doc = jsdoc[1];
        continue;
      }
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
      const prop = /^\s{2}(\w+)\??:\s*(.+);\s*$/.exec(line);
      if (!prop) {
        if (line.trim()) doc = '';
        continue;
      }
      const [, pname, rawType] = prop;
      const type = rawType.trim();
      const options = optionsOf(expand(type));
      props.push({
        name: pname,
        type,
        options,
        editor: editorOf(type, options),
        default: defaults[pname],
        callback: /^on[A-Z]/.test(pname),
        info: doc || undefined,
      });
      doc = '';
    }

    const used = migrated.filter((other) => other !== name && new RegExp(`<${other}[\\s/>]`).test(body));
    mounts.set(name, used);
    components.push({ name, level, file, props });
  }
}

// ── Проверки разбора: «надёжен» обязано быть фактом, а не намерением ──────────
const problems = [];
const missing = migrated.filter((n) => !components.some((c) => c.name === n));
if (missing.length) problems.push(`не разобраны компоненты: ${missing.join(', ')}`);
for (const c of components) {
  if (c.props.length < 2) problems.push(`${c.name}: разобрано ${c.props.length} пропсов — похоже, разбор сорвался`);
  for (const p of c.props) {
    if (/^'[^']*'\s*\|/.test(expand(p.type)) && !p.options) {
      problems.push(`${c.name}.${p.name}: тип похож на набор вариантов, а варианты не разобраны`);
    }
  }
}
if (problems.length) {
  console.error('✗ разбор исходников сорвался\n');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

components.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
const mountedBy = new Map(components.map((c) => [c.name, []]));
for (const c of components) for (const dep of mounts.get(c.name) ?? []) mountedBy.get(dep)?.push(c.name);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/ds-react/package.json'), 'utf8'));
const api = {
  $comment:
    'Генерируется scripts/build-api-react.mjs из исходников packages/ds-react. Руками не править. ' +
    'Это контракт РЕАЛИЗАЦИИ, которая уезжает потребителю; api.json описывает замороженный эталон.',
  package: pkg.name,
  runtime: 'react',
  levels: LEVELS,
  icons: fs
    .readdirSync(path.join(ROOT, 'src/svgs'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.replace(/\.svg$/, ''))
    .sort(),
  components: components.map((c) => ({
    ...c,
    // «unknown», как в контракте эталона. «stable» по умолчанию — это обещание зрелости,
    // выданное молча: новый компонент объявлял себя устоявшимся, ничего для этого не сделав.
    status: manual.status?.[c.name] ?? 'unknown',
    mounts: mounts.get(c.name) ?? [],
    mountedBy: mountedBy.get(c.name) ?? [],
  })),
  composition: {
    islandRows: manual.composition.islandRows,
    outsideIsland: manual.composition.outsideIsland.components,
    noValidation: manual.composition.noValidation.components,
    warnOnly: manual.composition.warnOnly.components,
  },
};

const next = JSON.stringify(api, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  const drift =
    current === next
      ? []
      : [
          current === null
            ? 'api.react.json не собран — запусти «npm run api:react»'
            : 'api.react.json разошёлся с исходниками — запусти «npm run api:react»',
        ];
  process.exit(report('контракт реализации (api.react.json)', drift));
}

fs.writeFileSync(OUT, next);
console.log(
  `api.react.json: ${api.components.length} компонентов, ` +
    `${api.components.reduce((n, c) => n + c.props.length, 0)} пропсов`
);
