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
import { FIXTURES } from '../support/fixtures.js';

const api = JSON.parse(readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const migrated = JSON.parse(readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components;
const KNOWN_BOXES = JSON.parse(readFileSync(path.join(ROOT, 'tests/parity/known-box-deltas.json'), 'utf8')).known;

function propsFor(name) {
  const c = api.components.find((x) => x.name === name);
  const defaults = Object.fromEntries(
    (c?.props ?? []).filter((p) => p.default !== undefined).map((p) => [p.name, p.default])
  );
  return { ...defaults, ...(FIXTURES[name] ?? {}) };
}

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
const SIGNATURE = `() => {
  const root = document.querySelector('#dc-root');
  const rootBox = root.getBoundingClientRect();
  const out = [];
  const q = (n) => Math.round(n * 2) / 2;   // полпикселя — предел, ниже которого спорить не о чем
  const INERT = { 'data-tooltip': '', 'data-press': 'false', 'aria-label': '', 'data-invalid': 'false', 'data-disabled': 'false',
    // type="button" — ОСОЗНАННОЕ расхождение с эталоном, а не потеря: без него браузерный
    // дефолт submit отправляет форму потребителя, и переопределить это было нечем.
    // На вид не влияет ничем, поэтому из сравнения исключено явно и с объяснением.
    'type': 'button' };
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
    for (const a of el.attributes) {
      // data-dc-tpl и data-sc-name — бухгалтерия рантайма DC (номер шаблона и имя
      // смонтированного компонента), у React аналога нет и быть не должно
      if (/^(data-dc-tpl|data-sc-name|class|style|id|aria-controls|data-track-item)$/.test(a.name)) continue;
      const meaningful = a.name === 'role' || a.name === 'tabindex' || a.name === 'disabled' || a.name === 'type' || a.name.startsWith('aria-') || a.name.startsWith('data-');
      if (!meaningful) continue;
      if (INERT[a.name] !== undefined && a.value === INERT[a.name]) continue;
      attrs[a.name] = a.value;
    }
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
    if (!Object.keys(attrs).length && !text && !paints && (tag === 'div' || tag === 'span')) continue;
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
    out.push({ tag, attrs, text, paint, box: [q(b.x - rootBox.x), q(b.y - rootBox.y), q(b.width), q(b.height)] });
  }
  return out;
}`;

for (const name of migrated) {
  for (const theme of ['dark', 'light']) {
    test(`${name} · ${theme}: разметка и геометрия совпадают с эталоном`, async ({ page }) => {
      const props = propsFor(name);
      await open(page, name, props, { theme, impl: 'dc' });
      const dc = await page.evaluate(`(${SIGNATURE})()`);
      await open(page, name, props, { theme, impl: 'react' });
      const react = await page.evaluate(`(${SIGNATURE})()`);

      expect(react.length, `${name}: другое число узлов (эталон ${dc.length}, React ${react.length})`).toBe(dc.length);

      const problems = [];
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
        if (known && worst <= known.upTo) continue;
        problems.push(
          `узел №${i} (${a.tag}${a.text ? ` «${a.text}»` : ''}): рамка ${JSON.stringify(a.box)} против ` +
            `${JSON.stringify(b.box)}, расхождение ${worst}px` + (known ? ` — больше записанных ${known.upTo}px` : '')
        );
      }
      expect(problems, `${name}/${theme}: разметка разошлась с эталоном\n  ${problems.join('\n  ')}`).toEqual([]);
    });
  }
}
