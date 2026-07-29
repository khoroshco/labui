/* Снапшот контракта: api.json + types.d.ts.
 *
 * api.json — единственный машинный источник состава: что существует, на каком уровне,
 * с какими пропсами и типами, что во что вкладывается, что стабильно. Из него строятся
 * типы для потребителей и гейт против дрейфа витрины; в Фазе 2 он же становится чек-листом
 * паритетного харнесса, а в Фазе 5 — тем, что отдаётся агентам.
 *
 * Руками api.json не правят: он выводится из исходников. Руками ведётся components.json —
 * там лежит только то, чего в коде нет (зрелость и правила композиции).
 *
 *   node scripts/build-api.mjs          перезаписать api.json и types.d.ts
 *   node scripts/build-api.mjs --check  сверить с записанным (гейт CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { components, LEVELS, report, ROOT } from './lib/dc.mjs';

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manual = JSON.parse(fs.readFileSync(path.join(ROOT, 'components.json'), 'utf8'));

const list = components();
const byName = new Map(list.map((c) => [c.name, c]));

// кто монтирует кого — обратная сторона графа вложенности
const mountedBy = new Map(list.map((c) => [c.name, []]));
for (const c of list) for (const dep of c.imports) mountedBy.get(dep)?.push(c.name);

const api = {
  $comment: 'Генерируется scripts/build-api.mjs из исходников. Руками не править.',
  package: pkg.name,
  version: pkg.version,
  runtime: 'dc',
  levels: LEVELS,
  components: list.map((c) => ({
    name: c.name,
    level: c.level,
    file: c.file,
    status: manual.status[c.name] ?? 'unknown',
    preview: c.preview,
    mounts: c.imports,
    mountedBy: mountedBy.get(c.name).sort(),
    acceptsChildren: c.propsRead.has('children'),
    props: Object.entries(c.props).map(([name, meta]) => ({
      name,
      type: meta.tsType ?? 'unknown',
      ...(meta.default !== undefined ? { default: meta.default } : {}),
      editor: meta.editor ?? null,
      ...(meta.options ? { options: meta.options } : {}),
      callback: /^on[A-Z]/.test(name),
    })),
  })),
  composition: {
    islandRows: manual.composition.islandRows,
    outsideIsland: manual.composition.outsideIsland.components,
    noValidation: manual.composition.noValidation.components,
    warnOnly: manual.composition.warnOnly.components,
  },
};

const jsDocDefault = (p) =>
  p.default === undefined ? '' : `  /** По умолчанию: ${JSON.stringify(p.default)} */\n`;

const types = [
  '/* Генерируется scripts/build-api.mjs из data-props каждого компонента. Руками не править. */',
  `/* @banner-lab/ds ${pkg.version} — контракт пропсов для потребителей. */`,
  '',
  ...api.components.flatMap((c) => [
    `/** ${c.name} · ${c.level} · ${c.status}${c.mounts.length ? ` · монтирует: ${c.mounts.join(', ')}` : ''} */`,
    `export interface ${c.name}Props {`,
    ...c.props.map((p) => `${jsDocDefault(p)}  ${p.name}?: ${p.type};`),
    ...(c.acceptsChildren ? ['  /** Содержимое кладёт родитель. */\n  children?: unknown;'] : []),
    '}',
    '',
  ]),
  `export type ComponentName =\n${api.components.map((c) => `  | '${c.name}'`).join('\n')};`,
  '',
  'export interface ComponentPropsMap {',
  ...api.components.map((c) => `  ${c.name}: ${c.name}Props;`),
  '}',
  '',
].join('\n');

const files = {
  'api.json': JSON.stringify(api, null, 2) + '\n',
  'types.d.ts': types,
};

if (process.argv.includes('--check')) {
  const problems = [];
  for (const [name, content] of Object.entries(files)) {
    const p = path.join(ROOT, name);
    const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (current !== content) {
      problems.push(
        `${name} разошёлся с исходниками — перегенерируй «npm run api» и запиши ченджсет: ` +
          `смена контракта не проезжает молча`
      );
    }
  }
  process.exit(report('снапшот контракта (api.json, types.d.ts)', problems));
}

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(ROOT, name), content);
  console.log(`записан ${name}`);
}
