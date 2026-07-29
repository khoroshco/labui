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
import { components, report } from './lib/dc.mjs';

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

process.exit(report('контракт пропсов', problems));
