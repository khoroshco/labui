/* Гейт словаря и разметки (Фаза 2): правила CLAUDE.md, которые проверяются машинно.
 *
 * Проза объясняет «почему», гейт держит «что». Разошлись — значит либо правило устарело,
 * либо код сломан, и это решается явно, а не молча.
 *
 * Каждое правило здесь оплачено уже случившейся правкой: имена пропсов переименовывались
 * (onAccent → inverse, snap → snapStep, action → actionLabel, active → value), сепаратор
 * пытался жить и у ряда, и у острова, а иконка с опечаткой в имени просто не рисовалась.
 */
import fs from 'node:fs';
import path from 'node:path';
import { components, reactSources, report, ROOT, showcase } from './lib/dc.mjs';

const problems = [];
const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.json'), 'utf8'));

/** Имена, которые в системе означают другое или означали раньше. */
const BANNED = {
  active: 'выбранная опция везде называется value — одно имя на все группы',
  on: 'тоггл и чекбокс используют checked, как в HTML и ARIA',
  onAccent: 'на инверсной подложке — inverse: приставка on читается как колбэк',
  title: 'тултип приходит пропом tooltip и рендерится в data-tooltip; браузерный title не используем',
  flat: '«без своей поверхности» — всегда bare, других слов не заводим',
  embedded: '«без своей поверхности» — всегда bare, других слов не заводим',
  state: 'оси state в системе нет — она ушла вместе с компонентом Status',
  error: 'серьёзность сообщения — level со значением danger; слова error в системе нет',
  snap: 'магнит слайдера называется snapStep',
};

for (const c of api.components) {
  for (const p of c.props) {
    if (BANNED[p.name]) problems.push(`${c.file}: проп «${p.name}» — ${BANNED[p.name]}`);
    if (/^on[A-Z]/.test(p.name) && !p.callback) {
      problems.push(`${c.file}: «${p.name}» выглядит как колбэк, но объявлен значением`);
    }
  }
  // Сепаратор рисует ОСТРОВ: две линии на одну границу — двойное владение.
  if (c.props.some((p) => p.name === 'separator')) {
    problems.push(`${c.file}: проп separator — сепаратором владеет остров, у рядов своего нет`);
  }
  // Уровень серьёзности сообщения называется одинаково у всех.
  for (const p of c.props) {
    if (/level$/i.test(p.name) && p.options) {
      const bad = p.options.filter((o) => !['ok', 'warn', 'danger', 'info'].includes(o));
      if (bad.length) problems.push(`${c.file}: ${p.name} допускает ${bad.join(', ')} — словарь уровней ok/warn/danger/info`);
    }
  }
}

// Браузерный title не используем: подсказка живёт в data-tooltip, иначе их будет две.
for (const c of [...components(), ...showcase()]) {
  for (const m of c.template.matchAll(/<(?!svg|title)([a-z-]+)[^>]*\stitle="/gi)) {
    problems.push(`${c.file}: атрибут title в разметке — тултип рисуется через data-tooltip`);
  }
}

// Иконки только gravity-ui и только существующие: опечатка в имени не рисует ничего,
// и заметно это не сразу — пустое место читается как «так задумано».
const icons = new Set(
  fs.readdirSync(path.join(ROOT, 'src/svgs')).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, ''))
);
// Имя иконки приезжает не одним способом, а четырьмя: тегом <g-icon name>, атрибутом
// icon= на вложенном компоненте, полем icon: в логике и тем же атрибутом/полем в React.
// Гейт знал только два из них — удаление src/svgs/trash-bin.svg проходило все линтеры
// зелёными, потому что «icon="trash-bin"» на кнопке ряда никто не читал.
const ICON_PATTERNS = [
  /<g-icon[^>]*\bname="([^"{}]+)"/g, // <g-icon name="plus">
  /\bicon[A-Za-z]*="([a-z][a-z0-9-]*)"/g, // icon="plus", iconRight="chevron-down"
  /\bicon[A-Za-z]*:\s*'([a-z][a-z0-9-]*)'/g, // icon: 'plus'
  // icon={'plus'} и icon={resolved ? 'circle-check-fill' : 'circle-check'} — привязка к
  // имени пропа обязательна: без неё в улов попадают любые пары строк в тернарнике
  /\bicon[A-Za-z]*=\{[^}]*?'([a-z][a-z0-9-]*)'(?:[^}]*?'([a-z][a-z0-9-]*)')?/g,
  /'([a-z][a-z0-9-]*)'\s+as\s+IconName/g, // 'picture' as IconName
];

const sources = [
  ...[...components(), ...showcase()].map((c) => ({ file: c.file, src: c.template + c.logic })),
  ...reactSources().map((r) => ({ file: r.file, src: r.body })),
];
for (const { file, src } of sources) {
  const names = new Set();
  for (const re of ICON_PATTERNS) {
    for (const m of src.matchAll(re)) for (const g of m.slice(1)) if (g) names.add(g);
  }
  for (const name of names) {
    if (!icons.has(name)) {
      problems.push(`${file}: иконки «${name}» нет в src/svgs — она не нарисуется`);
    }
  }
}

// Порядок яркости обязан совпадать с порядком важности: primary → body → secondary →
// tertiary → disabled. Проверяем по альфе в источнике токенов.
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/banner-lab.tokens.json'), 'utf8'));
// Разбор альфы прямой: «.76», «0.76» и «76%» — три законные записи одного значения.
// Прежняя склейка строки давала NaN на «0.76» и null на «76%», а NaN не меньше ничего —
// гейт сообщал «лестница сломана» на исправной палитре и «ослеп» на законной записи.
const alphaOf = (name) => {
  const v = String(source.alias[name]?.$value ?? '');
  if (!v) return null;
  if (!v.includes('/')) return /var\(--ink\)/.test(v) ? 1 : null; // без слэша — полная непрозрачность
  const m = /\/\s*([0-9]*\.?[0-9]+)\s*(%?)\s*\)/.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === '%' ? n / 100 : n;
};
const ladder = ['text-primary', 'text-body', 'text-secondary', 'text-tertiary', 'text-disabled'];
const alphas = ladder.map((n) => ({ n, a: alphaOf(n) }));
for (let i = 1; i < alphas.length; i++) {
  const prev = alphas[i - 1];
  const cur = alphas[i];
  if (prev.a === null || cur.a === null) {
    problems.push(`не читается яркость ${prev.n} / ${cur.n} — гейт лестницы ослеп`);
  } else if (!(cur.a < prev.a)) {
    problems.push(`лестница яркости сломана: ${cur.n} (${cur.a}) не тише ${prev.n} (${prev.a})`);
  }
}

process.exit(report('словарь имён, иконки и лестница яркости', problems));
