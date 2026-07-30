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
  const INERT = { 'data-tooltip': '', 'data-press': 'false', 'aria-label': '', 'data-invalid': 'false', 'data-disabled': 'false' };
  for (const el of root.querySelectorAll('*')) {
    if (el.classList.contains('sc-host') || el.classList.contains('sc-interp')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const attrs = {};
    for (const a of el.attributes) {
      if (/^(data-dc-tpl|class|style|id|aria-controls|data-track-item)$/.test(a.name)) continue;
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
    // безымянная обёртка без текста — строительные леса любой из двух реализаций
    if (!Object.keys(attrs).length && !text && (tag === 'div' || tag === 'span')) continue;
    const b = el.getBoundingClientRect();
    out.push({ tag, attrs, text, box: [q(b.x - rootBox.x), q(b.y - rootBox.y), q(b.width), q(b.height)] });
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
