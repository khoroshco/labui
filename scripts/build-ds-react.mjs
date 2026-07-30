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
// Локальный tsc, а не npx: при неполном node_modules npx тянет из реестра пакет с именем
// «tsc» — это ЧУЖОЙ пакет, не TypeScript, и сборка начинает собирать неизвестно что.
const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
if (!fs.existsSync(tsc)) throw new Error('typescript не установлен — запусти npm ci');
execFileSync(tsc, ['-p', path.join(pkg, 'tsconfig.build.json')], { stdio: 'inherit', cwd: root });

// Глобальные правила (фокус, пресс, тултипы, forced-colors, reduced-motion, кейфреймы)
// инлайном не выражаются и едут файлом — как и было в эталоне.
//
// @font-face из шипаемого файла ВЫРЕЗАЕТСЯ. Причина не техническая: Unica 77 —
// коммерческая гарнитура, и раздавать её бинарники в пакете мы не вправе. Раньше
// правила ехали как есть и ссылались на fonts/*.otf, которых в тарболе нет: потребитель
// получал молчаливый откат на системный шрифт, а вместе с ним другие метрики и уехавшую
// оптику. Теперь честно: шрифт подключает потребитель, а пакет об этом говорит.
const dsCss = fs.readFileSync(path.join(root, 'src/ds.css'), 'utf8');
const withoutFonts = dsCss.replace(/^@font-face\s*\{[^}]*\}\s*$/gmu, '').replace(/^\n{2,}/gm, '\n');

// Правила ВИТРИНЫ в пакет тоже не едут. Они лежат в общем ds.css, потому что витрина —
// такая же страница системы, но у потребителя они активно вредят: `main section` въезжает
// с задержкой у любого, у кого есть <main><section>, а он есть у многих. Остальные — про
// разметку, которой в компонентах нет вовсе (плавающий лейбл, маркеры списка, демо-дорожка
// изингов). Список закрытый и проверяется: если правило перестанет находиться, сборка падает.
// Список закрытый и проверяется: если правило перестанет находиться, сборка падает.
const SHOWCASE_ONLY = ['@keyframes ds-rise', 'main section', '@keyframes sb-slide', '[data-float]', '[data-ol]', '@keyframes ds-pop-in'];

/** Вырезать правило целиком, считая вложенные скобки: у @keyframes они есть. */
function dropRules(css, head) {
  let out = css;
  let found = false;
  for (;;) {
    const at = out.indexOf(head);
    if (at < 0) break;
    const open = out.indexOf('{', at);
    if (open < 0) break;
    let depth = 0;
    let i = open;
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}' && --depth === 0) break;
    }
    out = out.slice(0, at) + out.slice(i + 1);
    found = true;
  }
  if (!found) throw new Error(`ds.css: правило витрины «${head}» больше не находится — список пора править`);
  return out;
}

let shipped = withoutFonts;
for (const head of SHOWCASE_ONLY) shipped = dropRules(shipped, head);
shipped = shipped.replace(/^[ \t]*\n{2,}/gm, '\n');
for (const dead of ['main section', 'ds-rise', 'sb-slide', 'data-float', 'data-ol', 'ds-pop-in']) {
  if (shipped.includes(dead)) throw new Error(`ds.css: «${dead}» остался в шипаемом файле`);
}
if (/@font-face/.test(withoutFonts)) throw new Error('ds.css: @font-face остался в шипаемом файле');
fs.writeFileSync(
  path.join(dist, 'ds.css'),
  '/* Banner Lab DS — глобальные правила. Гарнитуру Unica 77 подключает потребитель:\n' +
    '   объявите @font-face для family «Unica 77» (Regular 100–450, Medium 451–700,\n' +
    '   ExtraBlack 800–950). Без неё уедут метрики и вся оптическая центровка. */\n' +
    shipped
);

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
