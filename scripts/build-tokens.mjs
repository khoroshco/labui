/* Сборка пакета @banner-lab/tokens.
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

// От файла, а не от cwd: npm запускает prepack из каталога пакета.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'packages/tokens');
const dist = path.join(pkgDir, 'dist');
const css = fs.readFileSync(path.join(root, 'src/tokens.css'), 'utf8');

/** Объявления внутри блока-селектора. */
function block(selector) {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const body = re.exec(css)?.[1] ?? '';
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

const base = block(':root');
const light = block('[data-theme="light"]');
if (Object.keys(base).length < 50) throw new Error('в tokens.css не разобрался :root — сборка токенов остановлена');

const layerOf = (name) => (/^--[ck]-/.test(name) ? 'primitive' : 'alias');

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

console.log(`@banner-lab/tokens: ${names.length} токенов (${names.filter((n) => layerOf(n) === 'alias').length} алиасов)`);
