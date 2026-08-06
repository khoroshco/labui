/* ГЕЙТ НАД ГЕЙТАМИ: тесты сторожат код, а тесты не сторожит никто.
 *
 * Дыра, ради которой это заведено. Агент может одним PR внести регрессию и тем же PR
 * расширить допуск снимка с 10 точек до 900 — прогон станет зелёным, ченджсет не
 * потребуется (в WATCHED каталога tests/ нет и быть не должно: правка теста не меняет
 * контракт потребителя и не заслуживает релиза), а в диффе это ОДНА ЦИФРА среди сотни
 * строк. Точно так же проходит `test.skip`, удалённый цикл и пропавший файл: сюита
 * остаётся зелёной, потому что проверять стало нечего.
 *
 * Ledger'ы у нас защищены хорошо — запись обязана воспроизводиться, число расходящихся
 * узлов сверяется. Сами пороги и само СУЩЕСТВОВАНИЕ теста не держало ничто.
 *
 * Что здесь записано и почему именно это:
 *   — ЧИСЛО тестов на файл. Ловит удаление теста, удаление файла и вырезанную ветку
 *     цикла (сюита генерируется из контракта, поэтому «стало на 27 меньше» — это
 *     пропавший компонент, а не переименование).
 *   — ЗНАЧЕНИЯ ослабляющих ручек на файл, мультимножеством. `maxDiffPixels`, `threshold`,
 *     `timeout` — числа, которыми проверку можно сделать неотличимой от её отсутствия.
 *     Мультимножество, а не сумма: 10+900 и 455+455 дают одно число, но разный смысл.
 *   — ВЫКЛЮЧЕННЫЕ тесты. `test.skip` / `fixme` / `only` — только записью в `muted` с
 *     причиной. Выключенный тест не оставляет следа; строка с объяснением оставляет.
 *
 * Гейт браузера не поднимает: `playwright --list` разбирает файлы и печатает состав.
 *
 * `node scripts/check-gates.mjs --record` перезаписывает слепок. Делать это осознанно:
 * запись — это и есть решение «допуск теперь такой», и она видна в диффе одной строкой
 * ровно там, где её будут искать.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { report, ROOT } from './lib/dc.mjs';

const LOCK = path.join(ROOT, 'tests/gates.lock.json');

/** Сюиты в том же составе, в каком их гоняет `npm test`. */
const SUITES = ['tests/smoke', 'tests/visual', 'tests/parity', 'tests/a11y', 'tests/showcase'];

/**
 * Ручки, которыми проверку можно ослабить до неразличимости с её отсутствием.
 *
 * Список закрытый и назван поимённо: гейт, который следит «за всеми числами», краснеет
 * на каждой правке и его выключат первым.
 */
const KNOBS = [
  ['maxDiffPixels', /\bmaxDiffPixels:\s*(\d+)/g],
  ['threshold', /\bthreshold:\s*([\d.]+)/g],
  ['timeout', /\b(?:setTimeout|timeout:)\s*\(?\s*([\d_]+)/g],
];

/** Выключение теста: след обязан остаться. */
const MUTES = /\b(?:test|test\.describe)\.(skip|fixme|only)\b/g;

/** Состав сюиты: имя файла → число тестов. Браузер не поднимается. */
function listSuite(dir) {
  const raw = execFileSync('npx', ['playwright', 'test', dir, '--list', '--reporter=json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const json = JSON.parse(raw);
  const counts = {};
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const file = spec.file ?? suite.file;
      counts[file] = (counts[file] ?? 0) + 1;
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of json.suites ?? []) walk(suite);
  return counts;
}

/**
 * Юниты считаются своим прогоном: у `node --test` режима «только перечислить» нет.
 *
 * Красный прогон здесь НЕ глотаем: при падении node печатает тот же TAP, и «# pass»
 * молча становится меньше — гейт обвинил бы автора в удалении теста, которого он не
 * удалял. Пусть падение называется падением.
 */
function listUnits() {
  let out;
  try {
    out = execFileSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/unit/**/*.test.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    out = e.stdout ?? '';
    const fail = /^# fail (\d+)$/m.exec(out)?.[1] ?? '?';
    throw new Error(`юниты красные (${fail} падений) — считать их состав нечестно, сперва почини npm run test:unit`);
  }
  const pass = /^# pass (\d+)$/m.exec(out);
  if (!pass) throw new Error('node --test не отдал итог TAP — считать нечего');
  return Number(pass[1]);
}

/** Ручки и выключения по файлам сюиты. */
function knobsOf(files) {
  const out = {};
  for (const file of files) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const found = {};
    for (const [name, re] of KNOBS) {
      const values = [...src.matchAll(new RegExp(re.source, re.flags))].map((m) => Number(m[1].replace(/_/g, '')));
      if (values.length) found[name] = values.sort((a, b) => a - b);
    }
    const muted = [...src.matchAll(new RegExp(MUTES.source, MUTES.flags))].map((m) => m[1]);
    if (muted.length) found._muted = muted.sort();
    if (Object.keys(found).length) out[file] = found;
  }
  return out;
}

/** Живой слепок: то, что сюиты представляют собой ПРЯМО СЕЙЧАС. */
function snapshot() {
  const counts = {};
  for (const dir of SUITES) Object.assign(counts, listSuite(dir));
  const testFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.(spec|test)\.(m?js)$/.test(entry.name)) testFiles.push(rel);
    }
  };
  walk('tests');
  return {
    tests: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
    units: listUnits(),
    knobs: knobsOf(testFiles.sort()),
  };
}

const live = snapshot();

if (process.argv.includes('--record')) {
  const lock = {
    _почему: [
      'Слепок гейтов: сколько тестов в каждом файле и какими числами их можно ослабить.',
      'Расширение допуска и удаление теста — это решение, а не мелочь в диффе: гейт',
      'краснеет, пока решение не записано ЗДЕСЬ, отдельной строкой, которую видно.',
      'Перезаписывается осознанно: node scripts/check-gates.mjs --record',
      'muted — выключенные тесты; ключ «файл:вид», значение — причина. Пусто и должно быть пусто.',
    ],
    muted: JSON.parse(fs.readFileSync(LOCK, 'utf8')).muted ?? {},
    ...live,
  };
  fs.writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`✓ слепок гейтов записан: ${Object.keys(live.tests).length} файлов, ${live.units} юнитов`);
  process.exit(0);
}

const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const problems = [];

// ── число тестов ─────────────────────────────────────────────────────────────
for (const [file, was] of Object.entries(lock.tests)) {
  const now = live.tests[file];
  if (now === undefined) {
    problems.push(`${file}: сюиты больше нет вовсе, а записано ${was} тестов — файл удалён или перестал подхватываться`);
  } else if (now !== was) {
    problems.push(
      `${file}: тестов ${now}, записано ${was}. ` +
        (now < was
          ? 'Проверок стало МЕНЬШЕ — это решение, а не мелочь: запиши его (--record) вместе с причиной в PR'
          : 'Проверок стало больше — запиши слепок (--record), чтобы новое число сторожило само себя')
    );
  }
}
for (const file of Object.keys(live.tests)) {
  if (!(file in lock.tests)) problems.push(`${file}: сюита не записана в слепке — запиши (--record), иначе её удаление пройдёт молча`);
}

if (live.units !== lock.units) {
  problems.push(`юнитов ${live.units}, записано ${lock.units} — то же правило, что и для браузерных сюит`);
}

// ── ослабляющие ручки ────────────────────────────────────────────────────────
const files = new Set([...Object.keys(lock.knobs), ...Object.keys(live.knobs)]);
for (const file of files) {
  const was = lock.knobs[file] ?? {};
  const now = live.knobs[file] ?? {};
  for (const knob of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const a = JSON.stringify(was[knob] ?? null);
    const b = JSON.stringify(now[knob] ?? null);
    if (a === b) continue;
    if (knob === '_muted') {
      problems.push(
        `${file}: выключенные тесты ${b} против записанных ${a}. ` +
          'Выключенный тест не оставляет следа — запиши причину в muted и перезапиши слепок'
      );
      continue;
    }
    problems.push(
      `${file}: ${knob} теперь ${b}, записано ${a}. ` +
        'Допуск — это и есть строгость гейта: расширенный порог делает проверку неотличимой от её отсутствия. ' +
        'Решил расширить — запиши (--record) и объясни в PR, что именно шумит'
    );
  }
}

// ── выключенные тесты обязаны иметь причину ──────────────────────────────────
for (const [file, found] of Object.entries(live.knobs)) {
  if (!found._muted) continue;
  for (const kind of found._muted) {
    if (kind === 'only') {
      problems.push(`${file}: test.only оставляет от сюиты один тест — в CI это ловит forbidOnly, здесь ловим раньше`);
      continue;
    }
    if (!lock.muted?.[`${file}:${kind}`]) {
      problems.push(`${file}: ${kind} без причины в tests/gates.lock.json → muted. Выключенный тест не оставляет следа, строка с объяснением оставляет`);
    }
  }
}

// ── страховка от тихой пустоты ───────────────────────────────────────────────
const total = Object.values(live.tests).reduce((a, b) => a + b, 0);
if (total < 100) problems.push(`всего ${total} браузерных тестов — слепок снят не с того места`);

process.exit(report('гейты против собственного слепка', problems));
