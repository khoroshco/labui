/* Гейт: правка того, что видит потребитель, приходит вместе с записью ченджсета.
 *
 * История, ради которой это заведено: пропсы переименовывались молча — onAccent → inverse,
 * snap → snapStep, action → actionLabel, active → value. Каждая такая правка это мажор для
 * того, кто уже вызвал компонент; без записи она уезжает как «мелочь».
 *
 * Проверяем не всё подряд: правка тестов, документов и инфраструктуры ченджсета не требует.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';

/** Что считается сменой контракта для потребителя. */
const WATCHED = [
  /^packages\/ds-react\/src\//, // то, что уезжает в пакет компонентов
  /^packages\/tokens\//,
  /^tokens\//, // источник токенов: переименование токена — мажор
  /^src\//, // эталон и глобальный ds.css
  /^api\.json$/,
  /^types\.d\.ts$/,
  /^components\.json$/,
];

const changed = execSync(`git diff --name-only ${BASE}...HEAD`, { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const contractChanges = changed.filter((f) => WATCHED.some((re) => re.test(f)));
if (contractChanges.length === 0) {
  console.log('✓ ченджсет не требуется: контракт не менялся');
  process.exit(0);
}

// Считаем записи, ДОБАВЛЕННЫЕ этим диапазоном, а не лежащие в каталоге. Иначе гейт
// зеленеет от чужих нераскрытых записей: пока публикация ждёт токен, их там шесть,
// и «ченджсет есть» перестаёт значить «ченджсет добавлен».
const notes = execSync(`git diff --name-only --diff-filter=A ${BASE}...HEAD -- .changeset`, {
  encoding: 'utf8',
})
  .split('\n')
  .map((s) => s.trim())
  .filter((f) => f.endsWith('.md') && !f.endsWith('README.md'));

if (notes.length === 0) {
  console.error(
    '✗ контракт изменён, а ченджсета нет.\n\n' +
      '  Изменено:\n' +
      contractChanges.map((f) => `    ${f}`).join('\n') +
      '\n\n  Заведи запись: npx changeset\n' +
      '  Учитываются только записи, добавленные ЭТИМ диапазоном.\n' +
      '  Смена, которую увидит потребитель, не имеет права уехать молча.\n'
  );
  process.exit(1);
}

console.log(`✓ ченджсет на месте (${notes.join(', ')})`);
