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
    // Угловые скобки НЕ считаем: стрелка «=>» в значении по умолчанию уводила глубину в
    // минус, и запятые верхнего уровня переставали быть точками разреза — дефолт соседа
    // терялся, а гейт краснел на ДРУГОМ пропе. Дженерики от этого не страдают: внутри них
    // запятых верхнего уровня нет по построению.
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
    // Разбор членов интерфейса. Однострочный регексп терял проп МОЛЧА на шести законных
    // формах: многострочный union, многострочный колбэк, многострочный объектный тип,
    // хвостовой комментарий, readonly, необязательный метод. Поэтому собираем объявление
    // по строкам до «;» на нулевой глубине скобок — как это делает язык.
    const declared = [];
    let doc = '';
    let buf = '';
    let depth = 0;
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].replace(/\s+$/, '');
      if (!buf) {
        // JSDoc — одной строкой или блоком: подсказка ⓘ у пропа не должна исчезать
        // только оттого, что её перенесли на три строки.
        const oneLine = /^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/.exec(line);
        if (oneLine) {
          doc = oneLine[1];
          continue;
        }
        if (/^\s*\/\*\*/.test(line)) {
          const parts = [line.replace(/^\s*\/\*\*/, '')];
          while (!/\*\//.test(parts[parts.length - 1]) && i + 1 < lines.length) parts.push(lines[++i]);
          doc = parts
            .join('\n')
            .replace(/\*\//, '')
            .split('\n')
            .map((x) => x.replace(/^\s*\*\s?/, '').trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          continue;
        }
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
        if (!line.trim()) {
          doc = '';
          continue;
        }
      }
      // хвостовой комментарий: «name?: string; // почему» — в языке это конец объявления
      const noTail = line.replace(/\s*\/\/.*$/, '');
      buf += (buf ? ' ' : '') + noTail.trim();
      for (const ch of noTail) {
        if ('([{<'.includes(ch)) depth++;
        else if (')]}>'.includes(ch)) depth--;
      }
      if (depth > 0 || !/;\s*$/.test(buf)) continue;
      const body = buf.replace(/;\s*$/, '').trim();
      buf = '';
      depth = 0;
      // Индексная сигнатура — не проп: у неё нет имени, и в контракт ей нечего дать.
      if (/^\[/.test(body)) {
        doc = '';
        continue;
      }
      // «readonly name?: T» и «name?(): T» — те же пропсы, что и обычные.
      const m2 = /^(?:readonly\s+)?(\w+)\??\s*(\(.*)$/.exec(body) ?? /^(?:readonly\s+)?(\w+)\??:\s*([\s\S]+)$/.exec(body);
      if (!m2) {
        doc = '';
        continue;
      }
      const type = m2[2].startsWith('(') ? m2[2].replace(/^\((.*?)\)\s*:\s*/, '($1) => ') : m2[2];
      declared.push({ name: m2[1], type: type.trim(), doc: doc || undefined });
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

/**
 * Имена, запрещённые словарём (CLAUDE.md, docs/design-system.md). Список ОДИН на оба
 * гейта: ручная копия в check-props разошлась с источником ровно на слово «error» —
 * в эталоне оно ловилось, в React-компонент его можно было завести беспрепятственно.
 */
export const BANNED_NAMES = new Set([
  'active', 'on', 'onAccent', 'title', 'state', 'flat', 'snap', 'separator', 'embedded', 'error',
]);
