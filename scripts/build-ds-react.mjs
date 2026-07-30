/* Сборка пакета компонентов. Бандлера нет: tsc отдаёт чистый ESM и типы.
 *
 * Бандлить нечего — у пакета нет зависимостей кроме React (peer) и токенов, а инлайн-стили
 * не требуют извлечения CSS. Меньше шагов сборки — меньше того, что может разойтись с тем,
 * что проверяли гейты: харнесс паритета смотрит на ИСХОДНИКИ, и они же уезжают в dist.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build as buildTokens } from './build-tokens-css.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = path.join(root, 'packages/ds-react');
const dist = path.join(pkg, 'dist');

buildTokens(); // ds.css ссылается на токены, собранные из источника
execFileSync('node', [path.join(root, 'scripts/build-icons.mjs')], { stdio: 'inherit' });
fs.rmSync(dist, { recursive: true, force: true });
execFileSync('npx', ['tsc', '-p', path.join(pkg, 'tsconfig.build.json')], { stdio: 'inherit', cwd: root });

// Глобальные правила (фокус, пресс, тултипы, forced-colors, reduced-motion, кейфреймы)
// инлайном не выражаются и едут файлом — как и было в эталоне.
fs.copyFileSync(path.join(root, 'src/ds.css'), path.join(dist, 'ds.css'));

// Собранный пакет ОБЯЗАН грузиться в Node. Это не паранойя: с moduleResolution "bundler"
// tsc отдавал импорты без расширений, Vite их терпел, а Node — нет, и dist не грузился
// вовсе. Ошибка вылезла бы у первого потребителя с SSR, а не у нас.
const entry = path.join(dist, 'index.js');
const mod = await import(pathToFileURL(entry).href);
// Список сверяется с составом, а не с числом: «не меньше 27» зеленело бы и на пакете,
// который экспортирует 27 хелперов и ни одного компонента.
const expected = JSON.parse(fs.readFileSync(path.join(pkg, 'migrated.json'), 'utf8')).components;
const missing = expected.filter((name) => typeof mod[name] !== 'function');
if (missing.length) {
  throw new Error(`dist/index.js не экспортирует: ${missing.join(', ')}`);
}

const files = fs.readdirSync(dist).length;
console.log(`@banner-lab/ds собран: ${files} записей в dist, ${expected.length} компонентов грузятся в Node`);
