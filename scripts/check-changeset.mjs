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
const WATCHED = [/^src\//, /^api\.json$/, /^types\.d\.ts$/, /^components\.json$/];

const changed = execSync(`git diff --name-only ${BASE}...HEAD`, { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const contractChanges = changed.filter((f) => WATCHED.some((re) => re.test(f)));
if (contractChanges.length === 0) {
  console.log('✓ ченджсет не требуется: контракт не менялся');
  process.exit(0);
}

const dir = path.join(process.cwd(), '.changeset');
const notes = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
  : [];

if (notes.length === 0) {
  console.error(
    '✗ контракт изменён, а ченджсета нет.\n\n' +
      '  Изменено:\n' +
      contractChanges.map((f) => `    ${f}`).join('\n') +
      '\n\n  Заведи запись: npx changeset\n' +
      '  Смена, которую увидит потребитель, не имеет права уехать молча.\n'
  );
  process.exit(1);
}

console.log(`✓ ченджсет на месте (${notes.join(', ')})`);
