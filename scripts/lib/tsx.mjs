/* ОДИН разбор TypeScript на все гейты.
 *
 * Компилятора у нас нет намеренно (ADR 0006: второй тулчейн в репозиторий не заводим),
 * поэтому пропсы читаются регекспами. Пока такой разбор был написан ТРИЖДЫ — в генераторе
 * контракта, в проверке «объявлен ⇔ читается» и в словаре имён, — регекспы разошлись:
 * один видел форму записи, которую другой пропускал, и гейты расходились в том, что
 * считать пропом. Расхождение парсеров хуже одного плохого парсера: оно необъяснимо.
 *
 * Здесь одна реализация. Она по-прежнему регекспами и по-прежнему может чего-то не увидеть
 * — но теперь ВСЕ гейты не увидят одного и того же, а независимая сверка двух контрактов
 * (scripts/check-contracts.mjs) ловит именно это: чтобы потерянный проп прошёл дальше,
 * ошибиться должны оба разбора сразу, а они собраны из разных источников.
 */

/** Разбить список по запятым ВЕРХНЕГО уровня: у пропа бывает объект или вызов в значении. */
export function splitTop(src) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  out.push(src.slice(start));
  return out;
}

/**
 * Все интерфейсы пропсов файла с их объявлениями и разобранной сигнатурой компонента.
 *
 * `declared` — свойства верхнего уровня: имя, тип и JSDoc-описание над ним (оно же
 * подсказка ⓘ в витрине). `taken` — имена, которые компонент разобрал в сигнатуре;
 * `null` значит, что сигнатуру найти не удалось, и это НЕ повод молча пропустить файл:
 * пусть решает вызывающий, но знает об этом явно.
 */
export function interfacesOf(body) {
  const out = [];
  for (const m of body.matchAll(/export interface (\w+)Props[^{]*\{([\s\S]*?)\n\}/g)) {
    const [, name, block] = m;
    const declared = [];
    let doc = '';
    for (const raw of block.split('\n')) {
      const line = raw.trimEnd();
      const jsdoc = /^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/.exec(line);
      if (jsdoc) {
        doc = jsdoc[1];
        continue;
      }
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
      const prop = /^\s{2}(\w+)\??:\s*(.+);\s*$/.exec(line);
      if (!prop) {
        if (line.trim()) doc = '';
        continue;
      }
      declared.push({ name: prop[1], type: prop[2].trim(), doc: doc || undefined });
      doc = '';
    }

    // Две законные формы объявления компонента. Вторая появилась вместе с прокидыванием
    // ref: forwardRef забирает типы в дженерик, и аннотации «: NameProps» в сигнатуре
    // больше нет. Гейт «объявлен ⇔ читается» честно покраснел на всех 27 компонентах
    // сразу — ровно за этим он и был научен не пропускать ненайденную сигнатуру молча.
    const fn =
      new RegExp(`export function ${name}\\(\\{([\\s\\S]*?)\\}: ${name}Props`).exec(body) ??
      new RegExp(`export const ${name} = forwardRef<[^>]*>\\(function ${name}\\(\\{([\\s\\S]*?)\\},\\s*ref\\)`).exec(body);
    const taken = fn
      ? new Set(splitTop(fn[1] ?? fn[2]).map((part) => /^\s*\.{0,3}\s*(\w+)/.exec(part)?.[1]).filter(Boolean))
      : null;
    const defaults = {};
    if (fn) {
      for (const part of splitTop(fn[1] ?? fn[2])) {
        const eq = /^\s*(\w+)\s*=\s*([\s\S]+)$/.exec(part);
        if (eq) defaults[eq[1]] = eq[2];
      }
    }
    out.push({ name, iface: `${name}Props`, block, declared, taken, defaults });
  }
  return out;
}
