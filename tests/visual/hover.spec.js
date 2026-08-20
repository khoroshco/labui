/* ХОВЕРЫ: объявление обязано доезжать до элемента и быть ВИДНЫМ.
 *
 * Почему этого гейта не было и чего это стоило. Компоненты пишут базовый вид в АТРИБУТ
 * style — цвет, фон, рамку. Обычное объявление из таблицы стилей проигрывает атрибуту
 * style по каскаду: до специфичности дело не доходит вовсе. Поэтому правила вида
 * `[data-btn="ghost"]:hover { background:var(--bg-hover) }` в ds.css есть, выглядят
 * рабочими — и не делают НИЧЕГО. Так молча умерли ховеры secondary и ghost кнопки,
 * кнопки с тоном, циклера, опции, рамки поля и заголовка раскрывашки. Во всём tests/
 * слова hover не было ни разу: снимки снимаются в покое, а покой у всех был правильный.
 *
 * Гейт держит две разные вещи, и обе нужны:
 *   1. ДОЕЗЖАЕТ. Вычисленное значение под курсором равно объявленному в ds.css. Ловит
 *      проигрыш каскада — ровно тот дефект, который был.
 *   2. ВИДНО. Пиксели элемента под курсором отличаются от пикселей в покое. Ловит другое:
 *      объявление доехало, а изменения не видно. Так было у primary в светлой теме —
 *      brightness(1.08) на почти чёрной заливке не даёт ничего, и у самой частой кнопки
 *      системы ховера не было при формально живом правиле.
 *
 * Состав проверок выведен ИЗ ds.css: каждое правило с :hover обязано быть либо покрыто
 * случаем ниже, либо названо в SKIP с причиной. Новое правило без покрытия красит гейт —
 * иначе список случаев отстанет от файла в первый же заход.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { IMPLS, open, parkMouse } from '../support/browser.js';
import { ROOT } from '../support/dc.js';

const CSS = fs.readFileSync(path.join(ROOT, 'src/ds.css'), 'utf8');

/** Правила таблицы стилей со скобками любой вложенности: @media разбирается внутрь. */
function rules(css, out = [], cond = '') {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}' && --depth === 0) break;
    }
    const body = css.slice(open + 1, j);
    if (head.startsWith('@')) rules(body, out, cond ? `${cond} ${head}` : head);
    else out.push({ selector: head.replace(/\s+/g, ' '), body, cond });
    i = j + 1;
  }
  return out;
}

const HOVER_RULES = rules(CSS.replace(/\/\*[\s\S]*?\*\//g, '')).filter((r) => r.selector.includes(':hover'));

/** Объявления правила: свойство → значение. */
function decls(body) {
  return body
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const k = s.indexOf(':');
      return { prop: s.slice(0, k).trim(), value: s.slice(k + 1).replace('!important', '').trim() };
    });
}

/** Свойство объявления → свойство, по которому его видно в getComputedStyle. */
const COMPUTED = {
  background: 'backgroundColor',
  'background-color': 'backgroundColor',
  'border-color': 'borderTopColor',
  color: 'color',
  opacity: 'opacity',
  filter: 'filter',
  'animation-play-state': 'animationPlayState',
  // Проценты в transform считаются от СОБСТВЕННОЙ рамки элемента, поэтому развернуть
  // объявление на пробном узле нечем: translateX(-50%) у пустого span даёт 0, а у плашки
  // тултипа — её половину. Сдвиг тултипа держит пиксельная проверка, opacity — точная.
  transform: null,
  transition: null, // переход не состояние, а способ в него попасть
  'transition-delay': null,
};

/**
 * Правила, которые этот гейт не проверяет, и почему. Список закрытый: он же и есть
 * доказательство, что непроверенных ховеров ровно столько.
 */
const SKIP = {
  'a:hover': 'ссылок в компонентах системы нет — правило живёт для прозы витрины и документов',
};

/**
 * Случай проверки: где взять элемент, что навести и что должно измениться.
 *
 * `keys` — куски селекторов ds.css, которые этот случай закрывает. Через них правило
 * привязывается к случаю, а не через рукописный список: правило переписали — привязка
 * либо сохранилась, либо гейт покраснел на непокрытом правиле.
 */
const CASES = [
  {
    name: 'Button secondary',
    keys: ['[data-btn="secondary"]:not(:disabled)'],
    component: 'Button',
    props: { variant: 'secondary', label: 'Выгрузить' },
    target: '[data-btn]',
  },
  {
    name: 'Button ghost',
    keys: ['[data-btn="ghost"]:not(:disabled)'],
    component: 'Button',
    props: { variant: 'ghost', label: 'Выгрузить' },
    target: '[data-btn]',
  },
  {
    name: 'Button primary',
    keys: ['[data-btn="primary"]:not(:disabled)'],
    component: 'Button',
    props: { variant: 'primary', label: 'Выгрузить' },
    target: '[data-btn]',
  },
  {
    name: 'Button accent',
    keys: ['[data-btn="accent"]:not(:disabled)'],
    component: 'Button',
    props: { variant: 'accent', label: 'Выгрузить' },
    target: '[data-btn]',
  },
  {
    name: 'Button primary + ok',
    keys: ['[data-btn="primary"][data-tone="ok"]'],
    component: 'Button',
    props: { variant: 'primary', tone: 'ok', label: 'Готово' },
    target: '[data-btn]',
  },
  {
    name: 'Button accent + danger',
    keys: ['[data-btn="accent"][data-tone="danger"]', '[data-btn="primary"][data-tone="danger"]'],
    component: 'Button',
    props: { variant: 'accent', tone: 'danger', label: 'Удалить' },
    target: '[data-btn]',
  },
  {
    name: 'Button secondary + ok',
    keys: ['[data-btn="secondary"][data-tone="ok"]', '[data-btn="ghost"][data-tone="ok"]'],
    component: 'Button',
    props: { variant: 'secondary', tone: 'ok', label: 'Готово' },
    target: '[data-btn]',
  },
  {
    name: 'Button ghost + danger',
    keys: ['[data-btn="secondary"][data-tone="danger"]', '[data-btn="ghost"][data-tone="danger"]'],
    component: 'Button',
    props: { variant: 'ghost', tone: 'danger', label: 'Удалить' },
    target: '[data-btn]',
  },
  {
    name: 'Button: тултип',
    keys: ['[data-tooltip]'],
    component: 'Button',
    props: { icon: 'gear', tooltip: 'Настройки' },
    target: '[data-btn]',
    pseudo: '::before',
    // плашка растёт ВВЕРХ от кнопки — снимок берём с запасом сверху
    pad: { top: 40, left: 40, right: 40, bottom: 0 },
  },
  {
    name: 'CycleButton',
    keys: ['[data-cycle]'],
    component: 'CycleButton',
    props: { options: ['PX', 'REM'] },
    target: '[data-cycle]',
  },
  {
    name: 'OptionGroup: невыбранная опция',
    keys: ['[data-opt]:not(:disabled):not([aria-checked="true"])'],
    component: 'OptionGroup',
    props: { options: ['JPG', 'PNG', 'WEBP'] },
    controlled: { value: 1 },
    target: '[data-opt]:not([aria-checked="true"])',
  },
  {
    name: 'OptionGroup: невыбранная опция на инверсной подложке',
    keys: ['[data-opt][data-inverse="true"]'],
    component: 'OptionGroup',
    props: { options: ['JPG', 'PNG', 'WEBP'], inverse: true },
    controlled: { value: 1 },
    target: '[data-opt]:not([aria-checked="true"])',
  },
  {
    name: 'Input: рамка поля',
    keys: ['[data-field]:not([data-disabled="true"])'],
    component: 'Input',
    props: { ariaLabel: 'Название', placeholder: 'Осенний сейл' },
    target: '[data-field]',
  },
  {
    name: 'Select: рамка поля',
    keys: ['[data-field]:not([data-disabled="true"])'],
    component: 'Select',
    props: { options: ['JPG', 'PNG'], ariaLabel: 'Формат' },
    target: '[data-select="true"]',
    // Компонента нет у замороженного эталона по построению: он заморожен тегом
    // ds-reference-v0 и расти не может.
    impls: ['react'],
  },
  {
    name: 'Textarea: рамка поля',
    keys: ['[data-field]:not([data-disabled="true"])'],
    component: 'Textarea',
    props: { ariaLabel: 'Комментарий', placeholder: 'Что поправить' },
    target: '[data-field]',
    impls: ['react'],
  },
  {
    name: 'Input: кнопка очистки',
    keys: ['[data-field] button[data-tap="true"]'],
    component: 'Input',
    props: { ariaLabel: 'Название', clearable: true },
    controlled: { value: 'Осенний сейл', defaultValue: 'Осенний сейл' },
    target: '[data-field] button[data-tap="true"]',
  },
  {
    name: 'Disclosure: рубрика',
    keys: ['[data-disc]:hover'],
    component: 'Disclosure',
    props: { label: 'Примеры' },
    target: '[data-disc]',
  },
  {
    name: 'Disclosure: заголовок во всю ширину',
    keys: ['[data-disc="plain"]:hover'],
    component: 'Disclosure',
    props: { label: 'Примеры', variant: 'plain' },
    target: '[data-disc]',
  },
  {
    name: 'RowLabel: кнопка ⓘ',
    keys: ['[data-tap="true"][aria-expanded="false"]'],
    component: 'RowLabel',
    props: { label: 'Формат', hasInfo: true },
    target: 'button[aria-expanded]',
  },
  {
    name: 'Tabs: вкладка',
    keys: ['[data-tab]:not([aria-disabled="true"]):hover'],
    component: 'Tabs',
    props: {},
    controlled: { value: 0 },
    target: '[data-tab][aria-selected="false"]',
  },
  {
    name: 'Island: зона под рядом',
    keys: ['[data-island] > :not([data-row])'],
    component: 'Island',
    props: { rows: [{ type: 'text', label: 'Название', value: 'Осенний сейл' }, { type: 'toggle', label: 'Запекать' }] },
    target: '[data-row]',
    subject: '[data-island] > *',
  },
  {
    name: 'Slider: засечки',
    keys: ['[data-ticks]'],
    component: 'Slider',
    props: { label: 'Охранное поле', min: 0, max: 64, snapStep: 8, unit: 'px' },
    controlled: { value: 24, defaultValue: 24 },
    target: '[data-slider]',
    subject: '[data-ticks]',
    // слой засечек — линия нулевой высоты: снимаем его с запасом, иначе снимать нечего
    pad: { top: 12, bottom: 12, left: 0, right: 0 },
    // засечки — линии в 1px на прозрачном слое: доля изменившихся пикселей мала
    faint: true,
  },
  {
    name: 'Toast: полоса таймера встаёт на паузу',
    keys: ['[data-toast]:hover'],
    component: 'Toast',
    // Полоса таймера рендерится ТОЛЬКО при длительности И колбэке — «@fn» даёт пустой
    // (см. harness/main.tsx). Длительность задаём явно: у эталона своего дефолта нет.
    props: { text: 'Готово', level: 'ok', duration: 8000, onTimeout: '@fn' },
    target: '[data-toast]',
    subject: '[data-toast-fill]',
    // пауза анимации — не краска: пиксели в замороженном прогоне те же
    computedOnly: true,
  },
];

// ── привязка правил ds.css к случаям: непокрытых быть не может ────────────────
test('каждое правило :hover в ds.css покрыто проверкой или названо в SKIP', () => {
  expect(HOVER_RULES.length, 'правила с :hover обязаны находиться — иначе разбор сломан').toBeGreaterThan(10);
  const uncovered = [];
  for (const r of HOVER_RULES) {
    if (Object.keys(SKIP).some((s) => r.selector.includes(s))) continue;
    if (CASES.some((c) => c.keys.some((k) => r.selector.includes(k)))) continue;
    uncovered.push(`${r.cond ? `${r.cond} ` : ''}${r.selector}`);
  }
  expect(uncovered, 'ховер без проверки — это ховер, который завтра умрёт молча').toEqual([]);
});

test('у каждого случая есть своё правило в ds.css', () => {
  const orphans = CASES.filter((c) => !c.keys.some((k) => HOVER_RULES.some((r) => r.selector.includes(k))));
  expect(
    orphans.map((c) => c.name),
    'случай без правила сторожит пустоту: правило переписали, а проверка осталась зелёной'
  ).toEqual([]);
});

/** Что правила ds.css обещают этому случаю. */
function promises(c) {
  const out = [];
  for (const r of HOVER_RULES) {
    if (!c.keys.some((k) => r.selector.includes(k))) continue;
    for (const d of decls(r.body)) {
      const prop = COMPUTED[d.prop];
      if (prop === undefined) throw new Error(`неизвестное свойство ховера «${d.prop}» — допишите COMPUTED`);
      if (prop === null) continue;
      out.push({ ...d, computed: prop, selector: r.selector });
    }
  }
  return out;
}

/** Вычисленное значение объявления: var() и функции разворачивает браузер, а не тест. */
async function resolve(page, prop, value, computed) {
  return page.evaluate(
    ([p, v, c]) => {
      const el = document.createElement('span');
      el.style.setProperty(p, v);
      document.body.appendChild(el);
      const out = getComputedStyle(el)[c];
      el.remove();
      return out;
    },
    [prop, value, computed]
  );
}

/** Средняя и максимальная разница двух снимков по каналам. Диффом занимается страница. */
async function delta(page, a, b) {
  return page.evaluate(
    async ([x, y]) => {
      const load = (s) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = `data:image/png;base64,${s}`;
        });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(ia, 0, 0);
      const da = g.getImageData(0, 0, w, h).data;
      g.clearRect(0, 0, w, h);
      g.drawImage(ib, 0, 0);
      const db = g.getImageData(0, 0, w, h).data;
      let sum = 0;
      let max = 0;
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const d = Math.abs(da[i + k] - db[i + k]);
          sum += d;
          if (d > max) max = d;
          n++;
        }
      }
      return { mean: sum / n, max };
    },
    [a, b]
  );
}

// Порог заметности. Ховер — самая тихая обратная связь системы, но именно поэтому он
// обязан быть НЕ НУЛЕВЫМ: разница в один-два уровня канала на глаз неотличима от шума
// сглаживания. Максимум по каналу в 6 единиц — примерно та граница, ниже которой
// изменение перестаёт читаться на плоской заливке.
const VISIBLE = { max: 6, mean: 0.4 };
const VISIBLE_FAINT = { max: 6, mean: 0.02 }; // тонкие линии: площадь мала, амплитуда нет

for (const impl of IMPLS) {
  for (const theme of ['dark', 'light']) {
    for (const c of CASES) {
      // Компонент, которого у эталона нет по построению, проверяется только в React.
      if (c.impls && !c.impls.includes(impl)) continue;
      test(`ховер ${c.name} — ${theme} (${impl})`, async ({ page }) => {
        // Управляемость набирается на своём диалекте: у эталона признак — колбэк,
        // у React — само наличие value (ADR 0011). Отдать React value без onChange
        // значит попросить его замереть.
        const ctrl = c.controlled
          ? impl === 'react'
            ? { ...c.controlled, value: undefined, defaultValue: c.controlled.defaultValue ?? c.controlled.value }
            : { value: c.controlled.value }
          : {};
        const props = { ...c.props, ...ctrl };
        for (const k of Object.keys(props)) if (props[k] === undefined) delete props[k];
        await open(page, c.component, props, { theme, impl });

        const target = page.locator(`#dc-root ${c.target}`).first();
        await expect(target, 'элемент, который наводим, обязан существовать').toHaveCount(1);
        const subject = c.subject ? page.locator(`#dc-root ${c.subject}`).first() : target;

        const want = promises(c);
        expect(want.length, `${c.name}: правило без единого проверяемого объявления`).toBeGreaterThan(0);

        // Снимок нужен не всегда: у полосы таймера тоста ховер меняет не краску, а ход
        // анимации, да и рамка её после замораживания движения схлопывается в ноль
        // (scaleX(0) на конце), — снимать там нечего и не за чем.
        const box = c.computedOnly ? null : await subject.boundingBox();
        const pad = c.pad ?? { top: 0, left: 0, right: 0, bottom: 0 };
        const clip = box && {
          x: Math.max(0, box.x - pad.left),
          y: Math.max(0, box.y - pad.top),
          width: box.width + pad.left + pad.right,
          height: box.height + pad.top + pad.bottom,
        };

        const read = () =>
          subject.evaluate(
            (el, pseudo) => {
              const cs = getComputedStyle(el, pseudo || null);
              const out = {};
              for (const p of ['backgroundColor', 'borderTopColor', 'color', 'opacity', 'filter', 'animationPlayState', 'transform'])
                out[p] = cs[p];
              return out;
            },
            c.pseudo ?? ''
          );

        // Курсор ЗА окном, а не в (0,0): контрол в харнессе стоит ровно в левом верхнем
        // углу, и «покой» снимался бы уже под курсором — обе картинки совпали бы, и
        // проверка заметности молча зеленела бы на том самом ховере, который мерит.
        await parkMouse(page);
        const rest = await read();
        const restShot = clip ? (await page.screenshot({ clip })).toString('base64') : null;

        const tb = await target.boundingBox();
        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
        const hovered = await read();
        const hoverShot = clip ? (await page.screenshot({ clip })).toString('base64') : null;

        // Под курсором обязано измениться ХОТЬ ЧТО-ТО. Проверка дешёвая и ловит другое,
        // чем две следующие: правило, которое объявляет ровно то, что уже стоит инлайном.
        expect(hovered, `${c.name}: состояние под курсором не отличается от покоя ничем`).not.toEqual(rest);

        // 1. ДОЕЗЖАЕТ: вычисленное под курсором равно объявленному в ds.css
        for (const p of want) {
          const expected = await resolve(page, p.prop, p.value, p.computed);
          expect(
            hovered[p.computed],
            `${c.name}: «${p.prop}:${p.value}» из правила ${p.selector} не доехало — атрибут style сильнее объявления таблицы`
          ).toBe(expected);
        }

        // 2. ВИДНО: пиксели под курсором отличаются от покоя
        if (!c.computedOnly) {
          const d = await delta(page, restShot, hoverShot);
          const min = c.faint ? VISIBLE_FAINT : VISIBLE;
          expect(
            d.max,
            `${c.name}: под курсором ничего не изменилось (max ${d.max.toFixed(1)}, mean ${d.mean.toFixed(2)}) — правило доехало, а ховера не видно`
          ).toBeGreaterThanOrEqual(min.max);
          expect(d.mean, `${c.name}: изменение слишком локально (mean ${d.mean.toFixed(3)})`).toBeGreaterThanOrEqual(min.mean);
        }
      });
    }
  }
}
