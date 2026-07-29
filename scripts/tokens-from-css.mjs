/* Разовая конверсия tokens.css → DTCG. Оставлена в репозитории как происхождение источника:
 * файл токенов не написан руками, а выведен из работавшей системы — значит ни одно значение
 * и ни один комментарий не потеряны по дороге.
 *
 *   node scripts/tokens-from-css.mjs > tokens/banner-lab.tokens.json
 *
 * После Фазы 1 источник — сам DTCG-файл, а этот скрипт больше не запускается.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src/tokens.css'), 'utf8');

/* Примитив — это СЫРОЕ значение из палитры. Имя тут не признак: --k-accent зовётся как
   примитив, но ссылается на другой токен и перемапливается темой, то есть по смыслу алиас
   («канал акцента текущей темы»). Признак — ссылается ли токен на что-то ещё. */
const groupOf = (name, value) => (/^--[ck]-/.test(name) && !/var\(/.test(value ?? '') ? 'primitive' : 'alias');
const leaf = (name) => name.replace(/^--/, '');

/** Разбор блока: объявления в порядке файла, с комментариями-описаниями. */
function parseBlock(selector) {
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const body = re.exec(css)[1];
  const out = [];
  let section = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const sectionOnly = /^\/\*\s*(.*?)\s*\*\/$/.exec(line);
    if (sectionOnly && !line.includes('--')) {
      section = sectionOnly[1].replace(/^-+\s*|\s*-+$/g, '').trim();
      continue;
    }
    // многострочный комментарий-описание секции
    if (line.startsWith('/*') && !line.includes('--')) {
      section = line.replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '').trim();
      continue;
    }
    let rest = line;
    let trailing = null;
    const tail = /\/\*\s*([\s\S]*?)\s*\*\/\s*$/.exec(rest);
    if (tail) {
      trailing = tail[1];
      rest = rest.slice(0, tail.index).trim();
    }
    for (const m of rest.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      out.push({ name: m[1], value: m[2].trim(), section, description: trailing });
      trailing = null; // хвостовой комментарий принадлежит последнему объявлению строки
    }
  }
  return out;
}

const RE_REF = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;

/** Тип по форме значения — ровно те типы, что определены спецификацией DTCG. */
function typeOf(name, value) {
  if (/^--fw-/.test(name)) return 'fontWeight';
  if (/^--font-/.test(name)) return 'fontFamily';
  if (/^--dur-/.test(name)) return 'duration';
  if (/^--ease-/.test(name)) return 'cubicBezier';
  if (/^--shadow-|^--focus-ring/.test(name)) return 'shadow';
  if (/^--ai-grad$/.test(name)) return 'gradient';
  if (/^(#|rgb|linear-gradient)/.test(value)) return 'color';
  if (/^\d+\s+\d+\s+\d+$/.test(value)) return 'color';
  if (/^-?[\d.]+(px|ch|em|rem|%)$/.test(value)) return 'dimension';
  if (/^-?[\d.]+$/.test(value)) return 'number';
  return 'color'; // все оставшиеся ссылки в системе — цветовые
}

/** Значение, которого спецификация выразить не умеет: CSS-выражение у места. */
function isExpression(value) {
  if (RE_REF.test(value)) return false;
  return /var\(|calc\(|linear\(|rgba?\(|,/.test(value);
}

function toToken(d) {
  const ref = RE_REF.exec(d.value);
  const $type = typeOf(d.name, d.value);
  const token = { $type };
  token.$value = ref ? `{${refGroup.get(ref[1])}.${leaf(ref[1])}}` : d.value;
  if (d.description) token.$description = d.description;
  if (!ref && isExpression(d.value)) {
    token.$extensions = {
      'com.bannerlab.css': {
        expression: true,
        why: 'CSS-выражение: спецификация DTCG такой формы значения не описывает (см. docs/adr/0009)',
      },
    };
  }
  return token;
}

const base = parseBlock(':root');
const light = parseBlock('[data-theme="light"]');
/* группа для ссылок считается по базовому блоку: тема ссылается на те же имена */
const refGroup = new Map(base.map((d) => [d.name, groupOf(d.name, d.value)]));

const doc = {
  $description:
    'Дизайн-токены Banner Lab. Три слоя: примитивы → алиасы → тема. Имя листа = имя CSS-переменной без «--»; ' +
    'ссылки записаны синтаксисом DTCG и разворачиваются в var(). Часть значений — CSS-выражения, ' +
    'которых спецификация не описывает: они помечены расширением com.bannerlab.css (docs/adr/0009).',
  primitive: {
    $description: 'Сырая палитра. Смысл: «какой это цвет». В компоненты напрямую не попадают.',
  },
  alias: {
    $description: 'Семантика. Смысл: «для чего цвет». Единственный слой, который используют компоненты.',
  },
  theme: {
    $description: 'Тема перемапливает алиасы на другие примитивы. Имя алиаса стабильно, меняется значение.',
    light: { $description: 'Светлая тема: переопределяет два «чернильных» канала и часть алиасов.' },
  },
};

const sections = {};
for (const d of base) {
  const group = groupOf(d.name, d.value);
  doc[group][leaf(d.name)] = toToken(d);
  if (d.section) (sections[group] ??= {})[leaf(d.name)] = d.section;
}
for (const d of light) doc.theme.light[leaf(d.name)] = toToken(d);

// секции файла сохраняем как метаданные группы: это навигация по палитре, а не украшение
doc.$extensions = { 'com.bannerlab.sections': sections };

process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
