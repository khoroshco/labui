/* Разбор файлов Design Component — общий для линтеров, генератора api.json и тестов.
 * Один разборщик на всех: если формат поедет, поедет в одном месте. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Уровни в порядке вложенности: атом лежит в молекуле, молекула в организме. */
export const LEVELS = ['atoms', 'molecules', 'organisms'];

const unescapeHtml = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** Один разобранный .dc.html. */
function parseDc(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const name = path.basename(file, '.dc.html');

  const tplMatch = /<x-dc(?:\s[^>]*)?>([\s\S]*)<\/x-dc>/.exec(src);
  if (!tplMatch) throw new Error(`${file}: нет блока <x-dc> — это не Design Component`);
  const withHelmet = tplMatch[1];
  const template = withHelmet.replace(/<helmet(?:\s[^>]*)?>[\s\S]*?<\/helmet>/, '');

  const scriptMatch = /<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/.exec(src);
  const logic = scriptMatch?.[1] ?? '';

  const propsAttr = /data-props="([\s\S]*?)">\s*\n/.exec(src)?.[1];
  let propsMeta = {};
  if (propsAttr) {
    try {
      propsMeta = JSON.parse(unescapeHtml(propsAttr));
    } catch (e) {
      throw new Error(`${file}: data-props не разбирается как JSON — ${e.message}`);
    }
  }
  const preview = propsMeta.$preview ?? null;
  const props = Object.fromEntries(Object.entries(propsMeta).filter(([k]) => k !== '$preview'));

  const dir = path.dirname(file).split('/').pop();
  return {
    name,
    file,
    level: LEVELS.includes(dir) ? dir : null, // null — витрина, она вне уровней
    src,
    template,
    logic,
    props,
    preview,
    /** Имена компонентов, которые монтирует шаблон. */
    imports: [...new Set([...template.matchAll(/<dc-import\s+name="([^"]+)"/g)].map((m) => m[1]))].sort(),
    /** Пропсы, прочитанные логикой: p.X и this.props.X. Алиас у props в системе один — p. */
    propsRead: new Set([
      ...[...logic.matchAll(/\bp\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
      ...[...logic.matchAll(/\bthis\.props\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
    ]),
    /** Холы шаблона: {{ X }} и {{ X.y }} — берётся корневое имя. */
    templateHoles: new Set(
      [...template.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
    ),
  };
}

/** Все компоненты системы (без витрины), отсортированы по уровню и имени. */
export function components() {
  const out = [];
  for (const level of LEVELS) {
    const dir = path.join(ROOT, 'src', level);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.dc.html')).sort()) {
      out.push(parseDc(`src/${level}/${f}`));
    }
  }
  return out;
}

/** Файлы витрины: Storybook и её служебный SbControls. */
export function showcase() {
  return fs
    .readdirSync(path.join(ROOT, 'storybook'))
    .filter((f) => f.endsWith('.dc.html'))
    .sort()
    .map((f) => parseDc(`storybook/${f}`));
}

/**
 * Исходники React-пакета. Нужны сразу двум гейтам (значения из токенов, существование
 * иконок), поэтому реализация одна: правило про источник значений и про имя иконки от
 * формата файла не зависит.
 */
export function reactSources() {
  const dir = path.join(ROOT, 'packages/ds-react/src');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      // сгенерированные иконки — это svg-разметка, а не стили и не ссылки на иконки
      else if (e.name.endsWith('.tsx') || (e.name.endsWith('.ts') && !e.name.endsWith('.generated.ts'))) {
        out.push({ file: path.relative(ROOT, full), body: fs.readFileSync(full, 'utf8') });
      }
    }
  };
  walk(dir);
  return out;
}

/** Имена токенов, объявленных в tokens.css и ds.css. */
export function declaredTokens() {
  const out = new Set();
  for (const f of ['src/tokens.css', 'src/ds.css']) {
    const css = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) out.add(m[1]);
  }
  return out;
}

/** Печать результата линтера и код возврата. */
export function report(title, problems) {
  if (problems.length === 0) {
    console.log(`✓ ${title}`);
    return 0;
  }
  console.error(`✗ ${title} — нарушений: ${problems.length}\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  return 1;
}
