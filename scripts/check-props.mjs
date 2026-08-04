/* Гейт: контракт пропсов совпадает с кодом в обе стороны.
 *
 *   объявлен  → обязан читаться  (иначе проп есть в редакторе, но ничего не делает)
 *   читается  → обязан быть объявлен (иначе между компонентами живёт невидимый канал)
 *
 * Гейт не теоретический, он уже ловил: Input.nums (объявлен, не читался),
 * Disclosure.separator (сепаратором владеет контейнер), CycleButton.hov (значение считалось
 * в пустоту), InputRow.tint (читался, но не объявлен).
 *
 * Прочитанным считается и хол шаблона: рантайм склеивает значения как
 * {...props, ...renderVals()}, поэтому «{{ label }}» — это законное чтение пропа.
 */
import fs from 'node:fs';
import path from 'node:path';
import { components, reactSources, report, ROOT, showcase } from './lib/dc.mjs';

const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.json'), 'utf8'));

/** Встроенные каналы рантайма: они видны редактору и без объявления в data-props.
 *  children — содержимое, которое родитель кладёт внутрь (Disclosure не знает, что там). */
const BUILTIN = new Set(['children']);

const problems = [];

for (const c of components()) {
  const declared = new Set(Object.keys(c.props));

  for (const name of declared) {
    if (!c.propsRead.has(name) && !c.templateHoles.has(name)) {
      problems.push(`${c.file} — проп «${name}» объявлен в data-props, но нигде не читается`);
    }
  }

  for (const name of c.propsRead) {
    if (!declared.has(name) && !BUILTIN.has(name)) {
      problems.push(`${c.file} — this.props.${name} читается, но не объявлен в data-props`);
    }
  }

  // Колбэк без пары «значение» — управляемый режим, у которого нечем управлять.
  for (const name of declared) {
    if (!/^on[A-Z]/.test(name)) continue;
    const pair = { onChange: ['value', 'checked', 'open'], onToggle: ['open', 'checked'] }[name];
    if (pair && !pair.some((p) => declared.has(p))) {
      problems.push(
        `${c.file} — есть колбэк «${name}», но нет ни одного из пропсов ${pair.join('/')}: ` +
          `управляемый режим без значения замораживает контрол`
      );
    }
  }
}


/** Разбить список деструктуризации по запятым ВЕРХНЕГО уровня. */
function splitTop(src) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  out.push(src.slice(start));
  return out;
}

// ── React: объявлен ⇔ читается, и словарь имён ──────────────────────────────
// Три гейта (этот, lint:api и словарь имён) читали ТОЛЬКО замороженный эталон — то есть
// физически не могли покраснеть от новой работы. В React-компонент можно было завести
// проп title (имя прямо запрещено словарём) или объявить проп и не читать его.
const BANNED_NAMES = new Set(['active', 'on', 'onAccent', 'title', 'state', 'flat', 'snap', 'separator', 'embedded']);
const REACT_BUILTIN = new Set(['children', 'className', 'id', 'style']);

for (const { file, body } of reactSources()) {
  for (const m of body.matchAll(/export interface (\w+Props)[^{]*\{([\s\S]*?)\n\}/g)) {
    const [, iface, block] = m;
    const declared = [...block.matchAll(/^\s{2}(\w+)\??:/gm)].map((x) => x[1]);
    const fn = new RegExp(`export function \\w+\\(\\{([\\s\\S]*?)\\}: ${iface}`).exec(body);
    // Имена берём по запятым верхнего уровня: значения по умолчанию могут содержать
    // объекты, массивы и вызовы, и «первое слово в строке» их не переживает.
    // Не нашли сигнатуру — это НЕ повод пропустить компонент. Раньше здесь был null, и
    // проверка «объявлен ⇔ читается» молча выключалась целиком: достаточно было написать
    // компонент чуть иначе (обёртка, forwardRef, деструктуризация в теле), чтобы гейт
    // перестал смотреть на него вовсе и никогда об этом не сказал.
    if (!fn) {
      problems.push(
        `${file} — не найдена сигнатура «export function …({…}: ${iface})»: без неё проверка ` +
          `«объявлен ⇔ читается» выключается молча. Разберите пропсы в сигнатуре или научите гейт новой форме`
      );
    }
    const taken = fn ? new Set(splitTop(fn[1]).map((part) => /^\s*\.{0,3}\s*(\w+)/.exec(part)?.[1]).filter(Boolean)) : null;
    for (const name of declared) {
      if (BANNED_NAMES.has(name)) {
        problems.push(`${file} — проп «${name}» запрещён словарём имён (CLAUDE.md)`);
      }
      if (taken && !taken.has(name) && !REACT_BUILTIN.has(name)) {
        problems.push(`${file} — проп «${name}» объявлен в ${iface}, но не разбирается компонентом: канал есть, а действия нет`);
      }
    }
  }
}

// ── Атрибуты вложенных компонентов ──────────────────────────────────────────
// Проверки не было вовсе: атрибут на <dc-import> мог называть проп, которого у цели нет,
// и уходил в пустоту. В витрине так жили шесть каналов, включая три ЗАПРЕЩЁННЫХ словарём
// имени — то есть демо рекламировало поведение, которого в системе нет.
const KEBAB = (a) => a.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const SKIP = /^(name|style|class|hint-|data-|aria-|on[A-Z])/;
const declared = new Map(api.components.map((c) => [c.name, new Set(c.props.map((p) => p.name))]));

for (const c of [...components(), ...showcase()]) {
  for (const m of c.template.matchAll(/<dc-import\s+([^>]*)>/g)) {
    const attrs = [...m[1].matchAll(/([a-zA-Z-]+)="/g)].map((x) => x[1]);
    const target = /name="([A-Za-z0-9]+)"/.exec(m[1])?.[1];
    const known = target && declared.get(target);
    if (!known) continue;
    for (const a of attrs) {
      if (SKIP.test(a)) continue;
      const prop = KEBAB(a);
      if (!known.has(prop)) {
        problems.push(`${c.file}: <dc-import name="${target}"> получает «${a}» — такого пропа у ${target} нет, значение уходит в пустоту`);
      }
    }
  }
}

process.exit(report('контракт пропсов', problems));
