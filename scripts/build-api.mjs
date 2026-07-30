/* Снапшот контракта ЭТАЛОНА: api.json.
 *
 * api.json — машинный источник состава: что существует, на каком уровне, с какими пропсами
 * и типами, что во что вкладывается, что стабильно. Из него строится таблица состава в
 * витрине, гейт против дрейфа витрины и дефолты, с которыми снимаются эталоны снапшотов.
 *
 * ВАЖНО, чей это контракт: он выведен из data-props ЗАМОРОЖЕННОГО эталона (runtime: dc).
 * Типы для потребителя — не здесь: их отдаёт tsc в packages/ds-react/dist/index.d.ts из
 * настоящих исходников. Корневой types.d.ts, который раньше писал этот скрипт, удалён:
 * он описывал эталон, но назывался «контрактом для потребителей», и в нём не было
 * default*-пропсов React — читатель делал вывод, что неуправляемого режима не существует.
 *
 * Руками api.json не правят: он выводится из исходников. Руками ведётся components.json —
 * там лежит только то, чего в коде нет (зрелость и правила композиции).
 *
 *   node scripts/build-api.mjs          перезаписать api.json
 *   node scripts/build-api.mjs --check  сверить с записанным (гейт CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { components, LEVELS, report, ROOT } from './lib/dc.mjs';

// Версия в контракт НЕ попадает вовсе. Она там была украшением, а стоила дорого: снапшот
// устаревал от каждого бампа, и релизный PR (его пишет бот, он не запускает npm run api)
// не мог позеленеть никогда — гейт запирал собственную публикацию.
const manual = JSON.parse(fs.readFileSync(path.join(ROOT, 'components.json'), 'utf8'));

const list = components();
const byName = new Map(list.map((c) => [c.name, c]));

// кто монтирует кого — обратная сторона графа вложенности
const mountedBy = new Map(list.map((c) => [c.name, []]));
for (const c of list) for (const dep of c.imports) mountedBy.get(dep)?.push(c.name);

const api = {
  $comment:
    'Генерируется scripts/build-api.mjs из data-props ЗАМОРОЖЕННОГО эталона (runtime: dc). ' +
    'Руками не править. Типы для потребителя отдаёт tsc: packages/ds-react/dist/index.d.ts — ' +
    'там есть default*-пропсы React, которых в этом снапшоте нет по построению.',
  package: '@khoroshco/ds',
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

const files = {
  'api.json': JSON.stringify(api, null, 2) + '\n',
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
  process.exit(report('снапшот контракта (api.json)', problems));
}

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(ROOT, name), content);
  console.log(`записан ${name}`);
}
