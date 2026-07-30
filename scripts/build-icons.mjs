/* Иконки в TS-модуль: набор один (gravity-ui), и он должен проверяться компилятором.
 *
 * DC-версия тянула svg по сети (fetch('svgs/имя.svg')) — опечатка в имени давала пустое
 * место и ничего больше. В React иконки инлайнятся на сборке, а имя становится union-типом:
 * несуществующая иконка не компилируется. Это первый случай, когда миграция не повторяет
 * поведение эталона, а закрывает его дыру — и он же единственный, где это уместно:
 * картинка не меняется, меняется момент обнаружения ошибки.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/svgs');
const out = path.join(root, 'packages/ds-react/src/lib/icons.generated.ts');

const names = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, '')).sort();
const body = names
  .map((n) => {
    const svg = fs.readFileSync(path.join(dir, `${n}.svg`), 'utf8').trim().replace(/\s+/g, ' ');
    return `  '${n}': ${JSON.stringify(svg)},`;
  })
  .join('\n');

const next =
  `/* Генерируется scripts/build-icons.mjs из src/svgs. Руками не править. */\n` +
  `export type IconName =\n${names.map((n) => `  | '${n}'`).join('\n')};\n\n` +
  `export const ICONS: Record<IconName, string> = {\n${body}\n};\n`;

// --check: гейт против дрейфа. Между src/svgs и icons.generated.ts не было проверки вовсе —
// удалённая иконка в эталоне не рисовалась, а в React рисовалась СТАРАЯ, зашитая в модуль.
// Расхождение переживало и линтеры, и снапшоты: картинка-то не менялась.
if (process.argv.includes('--check')) {
  const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (prev === next) {
    console.log(`✓ иконки (${names.length} шт.) собраны из src/svgs`);
    process.exit(0);
  }
  console.error(
    prev === null
      ? '✗ icons.generated.ts не собран вовсе — запусти «npm run icons»'
      : '✗ icons.generated.ts разошёлся с src/svgs — запусти «npm run icons»'
  );
  process.exit(1);
}

fs.writeFileSync(out, next);
console.log(`иконок собрано: ${names.length}`);
