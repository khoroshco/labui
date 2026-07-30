/* DTCG → CSS. Источник истины — tokens/banner-lab.tokens.json; src/tokens.css теперь артефакт.
 *
 * Из одного источника собираются и CSS, и пакет @khoroshco/tokens: значение живёт в одном
 * месте, а не в двух похожих. Порядок вывода — примитивы, алиасы, тема: тема обязана идти
 * после базы, иначе перемапливание не сработает.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = path.join(ROOT, 'tokens/banner-lab.tokens.json');

export function readSource() {
  return JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
}

const isToken = (v) => v && typeof v === 'object' && '$value' in v;

/**
 * Ссылки DTCG «{группа.имя}» → var(--имя).
 *
 * Раньше разворачивалась только ссылка, занимающая ВСЮ строку и ровно двухуровневая. Всё
 * остальное — ссылка внутри выражения (`color-mix(in srgb, {alias.accent} 20%, transparent)`)
 * или лишний уровень вложенности — молча уезжало в CSS фигурными скобками, то есть
 * значением, которого браузер не понимает. Разворачиваем ссылку в любом месте строки и на
 * любой глубине; неразвёрнутых скобок в выводе не остаётся вовсе (проверяется в build).
 */
export function resolve(value) {
  return String(value).replace(/\{([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)\}/gi, (_, ref) => {
    const parts = ref.split('.');
    return `var(--${parts[parts.length - 1]})`;
  });
}

/** Плоская карта «--имя → значение» по слоям — то, чем пользуются и генератор, и гейт. */
export function flatten(doc = readSource()) {
  const layer = (obj) =>
    Object.fromEntries(
      Object.entries(obj)
        .filter(([k, v]) => !k.startsWith('$') && isToken(v))
        .map(([k, v]) => [`--${k}`, resolve(v.$value)])
    );
  return {
    primitive: layer(doc.primitive),
    alias: layer(doc.alias),
    light: layer(doc.theme.light),
  };
}

export function emit(doc) {
  const sections = doc.$extensions?.['com.bannerlab.sections'] ?? {};
  const lines = [];
  const block = (group, indent = '  ') => {
    let current = null;
    for (const [name, token] of Object.entries(doc[group] ?? {})) {
      if (name.startsWith('$') || !isToken(token)) continue;
      const section = sections[group]?.[name];
      if (section && section !== current) {
        current = section;
        lines.push(`${indent}/* ${section} */`);
      }
      const desc = token.$description ? `   /* ${token.$description} */` : '';
      lines.push(`${indent}--${name}: ${resolve(token.$value)};${desc}`);
    }
  };

  lines.push('/* ============================================================');
  lines.push('   Banner Lab — дизайн-токены. ФАЙЛ СОБИРАЕТСЯ, руками не правится.');
  lines.push('   Источник: tokens/banner-lab.tokens.json (формат W3C DTCG).');
  lines.push('   Правка здесь потеряется при первой же сборке — правь источник.');
  lines.push('');
  lines.push('   Три слоя:');
  lines.push('     1. ПРИМИТИВЫ (--c-* / --k-*) — сырая палитра. Смысл: «какой это цвет».');
  lines.push('        В компоненты НЕ попадают напрямую.');
  lines.push('     2. АЛИАСЫ (--bg-* / --text-* / --accent …) — семантика. Смысл: «для чего цвет».');
  lines.push('        Компоненты используют ТОЛЬКО этот слой.');
  lines.push('     3. ТЕМА ([data-theme]) — перемапливает алиасы на другие примитивы.');
  lines.push('        Имя алиаса не меняется — меняется значение. Базовая тема — тёмная.');
  lines.push('   Полупрозрачные токены (текст, границы, наложения) выводятся из «чернильных»');
  lines.push('   каналов --ink / --tint, поэтому тема переопределяет ДВА канала, а не 12 токенов.');
  lines.push('   ============================================================ */');
  lines.push(':root {');
  lines.push('  /* ---------- 1. ПРИМИТИВЫ — напрямую в компонентах не использовать ---------- */');
  block('primitive');
  lines.push('');
  lines.push('  /* ---------- 2. АЛИАСЫ — тёмная тема как база ---------- */');
  block('alias');
  lines.push('}');
  lines.push('');
  lines.push('/* ---------- 3. ТЕМА: светлая — только перемапливание алиасов ---------- */');
  lines.push('[data-theme="light"] {');
  let themeCurrent = null;
  for (const [name, token] of Object.entries(doc.theme.light)) {
    if (name.startsWith('$') || !isToken(token)) continue;
    if (token.$description && token.$description !== themeCurrent) {
      themeCurrent = token.$description;
    }
    const desc = token.$description ? `   /* ${token.$description} */` : '';
    lines.push(`  --${name}: ${resolve(token.$value)};${desc}`);
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

/** Скобки, которые не развернулись: значение, которого браузер не понимает. */
export function unresolved(css) {
  return [...new Set((css.match(/\{[^}\n]*\}/g) ?? []).filter((x) => !x.startsWith('{"')))];
}

/**
 * Ссылки на несуществующие токены. Опечатка в имени разворачивается в var(--чего-нет) —
 * валидный CSS, который просто ничего не красит. Тише этой ошибки не бывает: ни браузер,
 * ни линтер стилей о ней не скажут.
 *
 * Одна реализация на генератор и на гейт: раньше гейтом служил ТОТ ЖЕ однонивелевый
 * регексп, что и генератором, — он не мог найти то, чего сам не умел разворачивать.
 */
export function brokenRefs(doc = readSource()) {
  const flat = flatten(doc);
  const known = new Set([...Object.keys(flat.primitive), ...Object.keys(flat.alias)]);
  const out = [];
  const scan = (label, obj) => {
    for (const [name, token] of Object.entries(obj ?? {})) {
      if (!isToken(token)) continue;
      for (const [, ref] of String(token.$value).matchAll(/\{([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)\}/gi)) {
        if (!known.has(`--${ref.split('.').pop()}`)) out.push(`${label}.${name} → {${ref}}`);
      }
    }
  };
  scan('primitive', doc.primitive);
  scan('alias', doc.alias);
  scan('theme.light', doc.theme?.light);
  return out;
}

/** Собрать src/tokens.css из источника. Возвращает true, если файл изменился. */
export function build() {
  const doc = readSource();
  const out = path.join(ROOT, 'src/tokens.css');
  const next = emit(doc);
  const left = unresolved(next);
  if (left.length) throw new Error(`tokens.css: ссылки не развернулись — ${left.join(', ')}`);
  const broken = brokenRefs(doc);
  if (broken.length) throw new Error(`токены: ссылка в пустоту — ${broken.join('; ')}`);
  const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (prev !== next) fs.writeFileSync(out, next);
  return { changed: prev !== next, doc };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { doc } = build();
  const f = flatten(doc);
  console.log(
    `src/tokens.css собран: ${Object.keys(f.primitive).length} примитивов, ` +
      `${Object.keys(f.alias).length} алиасов, ${Object.keys(f.light).length} переопределений темы`
  );
}
