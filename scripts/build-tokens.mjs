/* Сборка пакета @khoroshco/tokens.
 *
 * Токены публикуются, а компоненты — нет: токены не зависят от рантайма и полезны любому
 * стеку немедленно, а публикация компонентов на DC-рантайме создала бы связанность, из-за
 * которой миграция на React стала бы согласованным мажором во всех сервисах (ROADMAP §0).
 *
 * Источник — src/tokens.css. В Фазе 1 источником станет DTCG-файл, а tokens.css сам станет
 * артефактом сборки; этот скрипт тогда меняет вход, а не выход.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildCss, flatten, readSource } from './build-tokens-css.mjs';

// От файла, а не от cwd: npm запускает prepack из каталога пакета.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'packages/tokens');
const dist = path.join(pkgDir, 'dist');

// CSS в пакет уезжает собранным из того же источника — двух похожих файлов в системе нет.
buildCss();
const source = readSource();
const flat = flatten(source);
const base = { ...flat.primitive, ...flat.alias };
const light = flat.light;
// Порог от реальности, а не «больше пятидесяти»: в системе 127 токенов, и «50» пропускало
// вдвое урезанный источник. Числа ниже допускают только осознанное удаление, которое всё
// равно требует правки этой строки — то есть решения, а не случая.
const declared = Object.keys(base).length;
if (declared < 120 || Object.keys(light).length < 20) {
  throw new Error(
    `источник токенов урезан: ${declared} базовых и ${Object.keys(light).length} переопределений темы ` +
      '— ожидается около 127 и 23; если токены удалены осознанно, поправь порог вместе с ними'
  );
}

const layerOf = (name) => (flat.primitive[name] !== undefined ? 'primitive' : 'alias');

const tokens = {
  $comment: 'Генерируется scripts/build-tokens.mjs из src/tokens.css. Руками не править.',
  themes: {
    dark: 'база',
    light: 'переопределяет два канала (--ink, --tint) и часть алиасов',
  },
  tokens: Object.fromEntries(
    Object.entries(base).map(([name, value]) => [
      name,
      { value, layer: layerOf(name), ...(light[name] !== undefined ? { light: light[name] } : {}) },
    ])
  ),
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, 'src/tokens.css'), path.join(dist, 'tokens.css'));
fs.writeFileSync(path.join(dist, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n');

const names = Object.keys(base);
fs.writeFileSync(
  path.join(dist, 'index.js'),
  `/* Генерируется scripts/build-tokens.mjs. Руками не править. */\n` +
    `import tokens from './tokens.json' with { type: 'json' };\n` +
    `export const TOKENS = tokens.tokens;\n` +
    `/** Ссылка на токен для inline-стилей: token('--text-primary') → 'var(--text-primary)'. */\n` +
    `export const token = (name) => \`var(\${name})\`;\n` +
    `export default TOKENS;\n`
);
fs.writeFileSync(
  path.join(dist, 'index.d.ts'),
  `/* Генерируется scripts/build-tokens.mjs. Руками не править. */\n` +
    `export type TokenName =\n${names.map((n) => `  | '${n}'`).join('\n')};\n\n` +
    `export interface TokenMeta {\n  value: string;\n  layer: 'primitive' | 'alias';\n  /** Значение в светлой теме, если тема его переопределяет. */\n  light?: string;\n}\n\n` +
    `export declare const TOKENS: Record<TokenName, TokenMeta>;\n` +
    `export declare function token(name: TokenName): string;\n` +
    `export default TOKENS;\n`
);

console.log(`@khoroshco/tokens: ${names.length} токенов (${names.filter((n) => layerOf(n) === 'alias').length} алиасов)`);
