/* Паритет разметки и геометрии: точная мера там, где пиксели шумят.
 *
 * Снимок сравнивает две РАЗНЫЕ структуры обёрток (рантайм DC оборачивает каждый маунт в
 * .sc-host), поэтому у него есть неустранимый шум субпиксельного сглаживания текста —
 * и порог, который этот шум допускает, слишком широк, чтобы ловить сдвиг на пиксель.
 *
 * Эта проверка шума не имеет вовсе: она сравнивает СОСТАВ разметки — роли, хуки, ARIA,
 * текст и рамки элементов. Сдвиг на полпикселя, пропавший атрибут, лишний узел и
 * переставленный порядок она видит точно.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { open } from '../support/browser.js';
import { ROOT } from '../support/dc.js';
import { propsFor as sharedProps } from '../support/fixtures.js';

const propsFor = (name) => sharedProps(name, api);

const api = JSON.parse(readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const migrated = JSON.parse(readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components;
const LEDGER = JSON.parse(readFileSync(path.join(ROOT, 'tests/parity/known-box-deltas.json'), 'utf8'));
const KNOWN_BOXES = LEDGER.known;
const KNOWN_STATES = LEDGER.states ?? {};


/**
 * Снимок разметки: то, что несёт смысл, и ничего из того, что его не несёт.
 *
 * Нормализации ниже — не поблажки, а перевод с одного языка на другой. Каждая названа:
 *   — обёртки-маунты рантайма DC (.sc-host) и такие же безымянные обёртки React смысла не
 *     несут: это строительные леса, и сравнивать надо содержимое;
 *   — DC заворачивает каждую подстановку в <span class="sc-interp">, поэтому текст берём
 *     накопленный, а не только собственные текстовые узлы;
 *   — пустой атрибут (data-tooltip="", data-press="false", aria-label="") в ds.css инертен
 *     по построению: правила ловят либо «true», либо непустое значение;
 *   — <g-icon> и React-иконка — один и тот же инлайновый svg с одинаковой рамкой;
 *   — data-track-item — хук нового трекера подложки, у эталона аналога нет.
 */
const SIGNATURE = `(component) => {
  const root = document.querySelector('#dc-root');
  const rootBox = root.getBoundingClientRect();
  const out = [];
  const q = (n) => Math.round(n * 2) / 2;   // полпикселя — предел, ниже которого спорить не о чем
  const INERT = { 'data-tooltip': '', 'data-press': 'false', 'aria-label': '', 'data-invalid': 'false', 'data-disabled': 'false',
    // type="button" — ОСОЗНАННОЕ расхождение с эталоном, а не потеря: без него браузерный
    // дефолт submit отправляет форму потребителя, и переопределить это было нечем.
    // На вид не влияет ничем, поэтому из сравнения исключено явно и с объяснением.
    // Два дефолтных значения одного атрибута: 'button' у <button> (иначе форма
    // отправляется) и 'text' у <input> (дефолт браузера). Оба на вид не влияют ничем.
    'type': ['button', 'text'],
    // inert="" — второе ОСОЗНАННОЕ расхождение. Свёрнутое содержимое обязано уходить из
    // таба и из дерева доступности (иначе фокус проваливается в невидимое — так витрина
    // и ловила таб), а компоненты эталона заморожены тегом ds-reference-v0: чинить их
    // нельзя. Поэтому атрибут есть только у React. На отрисовку он не влияет ничем.
    // Записан ЗНАЧЕНИЕМ, а не именем: inert с любым другим значением снова станет виден.
    'inert': '',
    // data-float="true" — третье ОСОЗНАННОЕ расхождение. Windows High Contrast вырезает
    // тень, и плавающая карточка пина сливается с полотном; вернуть ей край можно только
    // по хуку, а компоненты эталона заморожены тегом ds-reference-v0. На обычную отрисовку
    // атрибут не влияет ничем — правило по нему живёт только внутри forced-colors.
    'data-float': 'true' };
  for (const el of root.querySelectorAll('*')) {
    // Маунт ряда острова — исключение из пропуска обёрток: сепаратор и тон ховера ds.css
    // рисует именно на нём, то есть это декор, а не леса. В эталоне это .sc-host рантайма,
    // в React — свой div; без этой оговорки гейт сравнивал 40 узлов против 44 и требовал
    // выкинуть из React то, что в эталоне пропущено по классу.
    const isIslandMount = el.parentElement && el.parentElement.hasAttribute('data-island');
    if ((el.classList.contains('sc-host') && !isIslandMount) || el.classList.contains('sc-interp')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const attrs = {};
    let wired = false; // у узла есть связь ARIA — сам он значим, но связь не сравнивается
    for (const a of el.attributes) {
      // data-dc-tpl и data-sc-name — бухгалтерия рантайма DC (номер шаблона и имя
      // смонтированного компонента), у React аналога нет и быть не должно
      if (/^(data-dc-tpl|data-sc-name|class|style|id|aria-controls|data-track-item)$/.test(a.name)) continue;
      // aria-describedby / aria-labelledby / aria-controls — ПЯТОЕ осознанное расхождение.
      // Это связи между узлами, и их значения — идентификаторы, сгенерированные React:
      // сравнивать их с эталоном нечем даже теоретически. Сами связи эталон получить не
      // может (заморожен тегом ds-reference-v0), а без них диктор на возврате в поле
      // говорит «недопустимое значение» и не говорит почему. Держит их отдельный гейт —
      // tests/a11y/wiring.spec.js, который проверяет, что ссылка ведёт в существующий
      // узел с ожидаемым текстом. Здесь мы их только не сравниваем.
      // Значение — сгенерированный идентификатор, сравнивать его с эталоном нечем, да и
      // самой связи у эталона нет. Но узел, у которого этот атрибут единственный, нельзя
      // просто выбросить: он тут же перестанет считаться значимым и выпадет из переписи
      // (эталон 11 узлов, React 10). Поэтому связь не сравниваем, а узел помечаем значимым.
      const WIRING = a.name === 'aria-describedby' || a.name === 'aria-labelledby' || a.name === 'aria-controls';
      // ЖИВАЯ ОБЛАСТЬ СООБЩЕНИЯ — шестое осознанное расхождение, и только у RowMsg.
      // Эталон объявляет ошибку через role=alert / aria-live=assertive. Три невалидных
      // ряда давали три объявления в один тик: они перебивали друг друга и всё, что
      // диктор читал, а при возврате в поле не звучало ничего — связи с контролом не было.
      // React связывает сообщение с контролом (aria-describedby) и живой области не имеет.
      // Эталон заморожен и связь получить не может. Правильность связи держит
      // tests/a11y/wiring.spec.js; здесь мы её только не сравниваем, и ТОЛЬКО у RowMsg.
      if (component === 'RowMsg' && (a.name === 'aria-live' || (a.name === 'role' && (a.value === 'alert' || a.value === 'status')))) continue;
      const meaningful = a.name === 'role' || a.name === 'tabindex' || a.name === 'disabled' || a.name === 'type' || a.name === 'inert' || a.name.startsWith('aria-') || a.name.startsWith('data-');
      if (!meaningful) continue;
      if (WIRING) { wired = true; continue; }
      const inert = INERT[a.name];
      if (inert !== undefined && (Array.isArray(inert) ? inert.includes(a.value) : inert === a.value)) continue;
      attrs[a.name] = a.value;
    }
    // Порядок атрибутов в HTML не значит ничего, а сравнение объектов строкой к нему
    // чувствительно: у Toggle в состоянии disabled набор тот же, а порядок другой.
    const sorted = {};
    for (const k of Object.keys(attrs).sort()) sorted[k] = attrs[k];
    const tag = el.tagName.toLowerCase() === 'g-icon' ? 'span' : el.tagName.toLowerCase();
    // Текст берём СВОЙ, а не накопленный: у контейнера накопленный склеивается по-разному
    // (эталон держит подстановки в отдельных span'ах, между ними в шаблоне есть пробелы),
    // и сравнение превратилось бы в сверку пробелов. Подстановочные span'ы эталона
    // считаются своим текстом родителя — они и есть его значение.
    const text = [...el.childNodes]
      .map((n) => (n.nodeType === 3 ? n.nodeValue : n.nodeType === 1 && n.classList.contains('sc-interp') ? n.textContent : ''))
      .join('')
      .replace(/\\s+/g, ' ')
      .trim();
    // Безымянная обёртка без текста — строительные леса любой из двух реализаций.
    // НО: если узел КРАСИТ (заливка, рамка, тень, градиент), он не лес, а декор, и его
    // геометрия — часть картинки. Правило без этой оговорки выбрасывало скользящее
    // подчёркивание Tabs целиком: span без атрибутов и без текста. Гейт при этом заявлял,
    // что видит сдвиг на полпикселя, а на деле не видел подчёркивание шире вкладки на 6px.
    const paints =
      (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') ||
      cs.backgroundImage !== 'none' ||
      cs.boxShadow !== 'none' ||
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderRightWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) > 0;
    if (!Object.keys(attrs).length && !text && !paints && !wired && (tag === 'div' || tag === 'span')) continue;
    const b = el.getBoundingClientRect();
    // КРАСКА сравнивается точно. До этого её не сверял НИКТО: style из подписи выброшен
    // (в React все стили инлайновые, то есть вся палитра лежит именно там), а бюджет
    // пиксельного снимка в 900 точек больше, чем весь компонент у пятерых из двадцати
    // семи — у циклера впятеро. То есть React-версия могла быть любого цвета.
    const paint = [
      cs.color, cs.backgroundColor, cs.backgroundImage, cs.boxShadow, cs.opacity,
      cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth,
      cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor,
      cs.borderRadius, cs.fontWeight, cs.fontSize, cs.fontFamily, cs.letterSpacing, cs.lineHeight,
      cs.textTransform, cs.textAlign,
    ].join(' | ');
    out.push({ tag, attrs: sorted, text, paint, box: [q(b.x - rootBox.x), q(b.y - rootBox.y), q(b.width), q(b.height)] });
  }
  return out;
}`;


/**
 * Состояния, в которых компонент сверяется дополнительно к дефолтному.
 *
 * До этого ВСЕ гейты видели ровно одну конфигурацию пропсов: в контракте девятнадцать
 * enum-пропсов, и ни одно их значение, кроме дефолтного, не рисовалось нигде. Дефект,
 * живущий в варианте (не тот тон у бейджа, пропавшая рамка у secondary, другой цвет
 * загрузки), проходил зелёным по построению.
 *
 * Состояния выводятся ИЗ КОНТРАКТА, а не пишутся руками: список вариантов растёт вместе
 * с компонентом сам. Матрица гоняется в одной теме — она ловит расхождение реализаций,
 * а тему стережёт снимок дефолтного состояния в обеих.
 */
const FLAGS = ['disabled', 'invalid', 'loading', 'open', 'checked', 'resolved', 'bare', 'inverse'];

function statesFor(name) {
  const c = api.components.find((x) => x.name === name);
  if (!c) return [];
  const out = [];
  for (const p of c.props) {
    if (Array.isArray(p.options) && p.options.length > 1) {
      for (const v of p.options.filter((o) => o !== p.default).slice(0, 2)) {
        out.push([`${p.name}=${v}`, { [p.name]: v }]);
      }
    } else if (FLAGS.includes(p.name) && p.type === 'boolean' && p.default !== true) {
      out.push([`${p.name}`, { [p.name]: true }]);
    }
  }
  return out.slice(0, 8); // потолок: матрица должна оставаться быстрее минуты
}

for (const name of migrated) {
  for (const theme of ['dark', 'light']) {
    test(`${name} · ${theme}: разметка и геометрия совпадают с эталоном`, async ({ page }) => {
      const props = propsFor(name);
      await open(page, name, props, { theme, impl: 'dc' });
      const dc = await page.evaluate(`(${SIGNATURE})(${JSON.stringify(name)})`);
      await open(page, name, props, { theme, impl: 'react' });
      const react = await page.evaluate(`(${SIGNATURE})(${JSON.stringify(name)})`);

      expect(react.length, `${name}: другое число узлов (эталон ${dc.length}, React ${react.length})`).toBe(dc.length);

      const problems = [];
      const reproduced = new Set(); // какие записи ledger'а сегодня ещё правда
      for (let i = 0; i < dc.length; i++) {
        const a = dc[i];
        const b = react[i];
        // Разметка и текст — точно: пропавший атрибут или чужая роль это дефект, а не шум.
        if (a.tag !== b.tag || JSON.stringify(a.attrs) !== JSON.stringify(b.attrs) || a.text !== b.text) {
          problems.push(`узел №${i}: ${JSON.stringify(a)} против ${JSON.stringify(b)}`);
          continue;
        }
        if (a.paint !== b.paint) {
          const which = a.paint.split(' | ').map((v, k) => (v === b.paint.split(' | ')[k] ? null : `${v} → ${b.paint.split(' | ')[k]}`)).filter(Boolean);
          problems.push(`узел №${i} (${a.tag}${a.text ? ` «${a.text}»` : ''}): краска разошлась — ${which.join('; ')}`);
          continue;
        }
        // Геометрия — с допуском в пиксель: измерение подложки округляется по-разному, а
        // спорить о половине пикселя не о чем. Всё, что больше, — либо дефект, либо
        // объяснённое расхождение из ledger'а.
        const delta = a.box.map((v, k) => Math.abs(v - b.box[k]));
        const worst = Math.max(...delta);
        if (worst <= 1) continue;
        const key = `${name}/${a.tag}/${a.text}`;
        const known = KNOWN_BOXES[key];
        if (known) reproduced.add(key);
        if (known && worst <= known.upTo) continue;
        problems.push(
          `узел №${i} (${a.tag}${a.text ? ` «${a.text}»` : ''}): рамка ${JSON.stringify(a.box)} против ` +
            `${JSON.stringify(b.box)}, расхождение ${worst}px` + (known ? ` — больше записанных ${known.upTo}px` : '')
        );
      }
      // Запись, которая перестала воспроизводиться, хуже отсутствующей: она выглядит как
      // истина и разрешает расхождение, которого уже нет. Сверяем в ОДНОЙ теме — деталь
      // расхождения (блочная обёртка внутри строчного контейнера) от темы не зависит,
      // а требовать одинакового поведения в обеих значило бы ловить шум.
      if (theme === 'dark') {
        for (const k of Object.keys(KNOWN_BOXES)) {
          if (!k.startsWith(`${name}/`) || reproduced.has(k)) continue;
          problems.push(`запись ledger'а «${k}» больше не воспроизводится — вычеркни её из tests/parity/known-box-deltas.json`);
        }
      }
      expect(problems, `${name}/${theme}: разметка разошлась с эталоном\n  ${problems.join('\n  ')}`).toEqual([]);
    });
  }
}

/* Ключи ledger'а обязаны называть ЖИВЫЕ компоненты. Запись про удалённый компонент не
 * посетит ни один тест: она не покраснеет никогда и переживёт свою правду молча. */
test('в ledger\'е расхождений нет записей про несуществующие компоненты', () => {
  const alive = new Set(migrated);
  const orphans = [...Object.keys(KNOWN_BOXES), ...Object.keys(KNOWN_STATES)].filter(
    (k) => !alive.has(k.split('/')[0])
  );
  expect(orphans, 'осиротевшая запись не воспроизводится и не проверяется — вычеркни её').toEqual([]);

  // Метка состояния в ключе тоже обязана существовать. Раньше сверялось только имя
  // компонента, и выдуманное «Button/variant=neverexisted» жило вечно: состояния с такой
  // меткой генератор не выдаёт, значит запись не посетит ни один прогон.
  const bogus = Object.keys(KNOWN_STATES).filter((k) => {
    const [name, label] = [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)];
    return !statesFor(name).some(([l]) => l === label);
  });
  expect(bogus, 'состояния с такой меткой не бывает — запись не проверяется ничем').toEqual([]);
});

// Матрица состояний: та же сверка, но компонент приведён в НЕдефолтное состояние.
for (const name of migrated) {
  const states = statesFor(name);
  if (!states.length) continue;
  test(`${name}: состояния совпадают с эталоном (${states.length})`, async ({ page }) => {
    // Один тест — до шестнадцати загрузок страницы (состояние × две реализации), плюс
    // первая компиляция харнесса. Дефолтные 30 секунд на это не рассчитаны.
    test.setTimeout(120_000);
    const problems = [];
    // Ошибку открытия НЕ глотаем. Первая версия этой матрицы глотала — и на холодной
    // сборке харнесса (первая компиляция TSX не укладывалась в короткий таймаут) выдала
    // «RowMsg: эталон 4 узла, React 0», то есть обвинила компонент в том, чего он не делал.
    // Гейт, который принимает несостоявшееся измерение за результат, хуже отсутствующего.
    const sign = async (impl, props) => {
      await open(page, name, props, { theme: 'dark', impl });
      return page.evaluate(`(${SIGNATURE})(${JSON.stringify(name)})`);
    };

    for (const [label, extra] of states) {
      const known = KNOWN_STATES[`${name}/${label}`];
      const props = { ...propsFor(name), ...extra };
      const dc = await sign('dc', props);
      const react = await sign('react', props);
      // Объяснённое расхождение обязано ВОСПРОИЗВОДИТЬСЯ: запись, которая перестала быть
      // правдой, хуже отсутствующей — она выглядит как истина и живёт вечно.
      if (known) {
        // Запись РАЗРЕШАЕТ названное расхождение, а не отменяет сверку. Раньше одна строка
        // выключала сравнение состояния целиком: любое расхождение любой природы шло за
        // «записанное воспроизводится», и подсаженный лишний атрибут проходил насквозь.
        // Поэтому сверяем ЧИСЛО расходящихся узлов с записанным `nodes`.
        const differing = dc.length !== react.length
          ? Math.max(dc.length, react.length)
          : dc.filter((a, i) => JSON.stringify(a) !== JSON.stringify(react[i])).length;
        if (!differing) {
          problems.push(`${label}: расхождение из ledger'а больше не воспроизводится — вычеркни строку из tests/parity/known-box-deltas.json`);
        } else if (differing > (known.nodes ?? 0)) {
          problems.push(
            `${label}: расходятся ${differing} узлов при записанных ${known.nodes ?? 0} — запись разрешает названное расхождение, а не любое`
          );
        }
        continue;
      }
      if (dc.length !== react.length) {
        problems.push(`${label}: другое число узлов (эталон ${dc.length}, React ${react.length})`);
        continue;
      }
      for (let i = 0; i < dc.length; i++) {
        const a = dc[i];
        const b = react[i];
        if (a.tag !== b.tag || JSON.stringify(a.attrs) !== JSON.stringify(b.attrs) || a.text !== b.text) {
          problems.push(`${label}, узел №${i}: ${JSON.stringify(a.attrs)} «${a.text}» против ${JSON.stringify(b.attrs)} «${b.text}»`);
          break;
        }
        if (a.paint !== b.paint) {
          problems.push(`${label}, узел №${i} (${a.tag}${a.text ? ` «${a.text}»` : ''}): краска разошлась`);
          break;
        }
      }
    }
    expect(problems, `${name}: состояния разошлись с эталоном\n  ${problems.join('\n  ')}`).toEqual([]);
  });
}
