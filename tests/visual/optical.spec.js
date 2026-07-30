/* Инвариант: оптическая центровка считается по ФОРМЕ набора (CLAUDE.md).
 *
 * У цифр нет выносных элементов, их чернильное пятно сидит в строковом боксе выше, чем у
 * прозы, — поэтому числовой набор опускается сильнее. Гейт обязан сравнивать ИНК-ЦЕНТР
 * (canvas actualBoundingBoxAscent/Descent) относительно НЕПОДВИЖНОГО контейнера, а не
 * центр бокса самого текста: бокс едет вместе с компенсацией, и такое сравнение всегда
 * сходится — даже когда картинка явно кривая. Это мы уже проходили.
 */
import { expect, test } from '@playwright/test';
import { IMPLS, open, setProps } from '../support/browser.js';

/** Абсолютный чернильный центр текста элемента и центр контейнера, относительно которого он живёт. */
const MEASURE = `(sel, boxSel) => {
  const el = document.querySelector(sel);
  const box = document.querySelector(boxSel);
  const cs = getComputedStyle(el);
  const text = el.tagName === 'INPUT' ? el.value : el.textContent.trim();
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  const m = ctx.measureText(text);
  const rect = el.getBoundingClientRect();
  const fbA = m.fontBoundingBoxAscent, fbD = m.fontBoundingBoxDescent;
  let baseline;
  if (el.tagName === 'INPUT') {
    const top = rect.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
    const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    baseline = top + (h - (fbA + fbD)) / 2 + fbA;
  } else {
    baseline = rect.top + fbA;
  }
  const inkCenter = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  const b = box.getBoundingClientRect();
  return { text, inkCenter, boxCenter: b.top + b.height / 2, textBoxCenter: rect.top + rect.height / 2 };
}`;

const measure = (page, sel, boxSel) =>
  page.evaluate(`(${MEASURE})(${JSON.stringify(sel)}, ${JSON.stringify(boxSel)})`);

const FIELD = '#dc-root .sc-host > *';

for (const impl of IMPLS)
test(`числовой набор стоит в оптическом центре поля${impl === 'react' ? ' · react' : ''}`, async ({ page }) => {
  // У цифр нет выносных: без компенсации их пятно уезжает вверх. Проверяем результат —
  // чернильный центр значения совпадает с центром поля.
  await open(page, 'Input', { value: '64' }, { impl });
  const a = await measure(page, '#dc-root input', FIELD);
  // Второе значение открываем заново, а не через мост пропсов рантайма: у React-харнесса
  // такого моста нет, а проверка нужна на обеих реализациях.
  await open(page, 'Input', { value: '1920' }, { impl });
  const b = await measure(page, '#dc-root input', FIELD);

  for (const m of [a, b]) {
    expect(
      Math.abs(m.inkCenter - m.boxCenter),
      `«${m.text}»: чернильный центр ушёл от центра поля на ${(m.inkCenter - m.boxCenter).toFixed(2)}px`
    ).toBeLessThan(0.35);
  }
  expect(
    Math.abs((a.inkCenter - a.boxCenter) - (b.inkCenter - b.boxCenter)),
    'одинаковая картинка обязана центрироваться одинаково: у «64» и «1920» набор один'
  ).toBeLessThan(0.05);
});

for (const impl of IMPLS)
test(`прозаическое значение стоит в оптическом центре поля${impl === 'react' ? ' · react' : ''}`, async ({ page }) => {
  // Прозе выносные достаются от «р», «у», «д» — её пятно ниже, и компенсация ей нужна
  // меньшая. Один и тот же сдвиг на оба набора развалил бы ровно эту картинку.
  await open(page, 'Input', { value: 'Обрезка рубрик' }, { impl });
  const m = await measure(page, '#dc-root input', FIELD);
  expect(
    Math.abs(m.inkCenter - m.boxCenter),
    `«${m.text}»: чернильный центр ушёл от центра поля на ${(m.inkCenter - m.boxCenter).toFixed(2)}px`
  ).toBeLessThan(0.7);
});

// Только на эталоне: это проверка САМОГО МЕТОДА измерения, а не реализации, и она
// снимает компенсацию через мост пропсов рантайма DC, которого у React-харнесса нет.
test(`гейт видит потерю компенсации — иначе он ничего не сторожит`, async ({ page }) => {
  await open(page, 'Input', { value: '64' });
  const withFix = await measure(page, '#dc-root input', FIELD);

  // ровно та ошибка, от которой защищаемся: числовому набору выдали прозаический сдвиг
  await page.evaluate(() => {
    document.querySelector('#dc-root input').style.top = '0.5px';
  });
  const without = await measure(page, '#dc-root input', FIELD);

  expect(
    Math.abs(withFix.inkCenter - without.inkCenter),
    'потеря компенсации обязана быть видна гейту'
  ).toBeGreaterThan(0.4);
  expect(
    Math.abs(withFix.textBoxCenter - without.textBoxCenter - (withFix.inkCenter - without.inkCenter)),
    'проверка меры: центр бокса едет вместе с текстом, поэтому по нему разницы не увидеть'
  ).toBeLessThan(0.01);
});

for (const impl of IMPLS)
test(`надпись кнопки стоит в оптическом центре капсулы${impl === 'react' ? ' · react' : ''}`, async ({ page }) => {
  await open(page, 'Button', { label: 'Выгрузить' }, { impl });
  const m = await measure(page, '#dc-root button span', '#dc-root button');
  // Допуск 1.5px, а не 0.5: метрики шрифта округляются по-разному на macOS и Linux
  // (замер той же кнопки — 0.6px и 1.0px). Потерянная компенсация даёт 2.5px и больше,
  // то есть гейт по-прежнему ловит именно её, а не разницу платформ.
  expect(
    Math.abs(m.inkCenter - m.boxCenter),
    `чернильный центр надписи ушёл от центра капсулы на ${(m.inkCenter - m.boxCenter).toFixed(2)}px`
  ).toBeLessThan(1.5);
});

for (const impl of IMPLS)
test(`значение и единицы в слайдере стоят на одной линии${impl === 'react' ? ' · react' : ''}`, async ({ page }) => {
  // Компенсация принадлежит ГРУППЕ: относительный сдвиг одного из двух соседей,
  // выровненных по базовой линии («64» и «px»), рвёт общую линию.
  await open(page, 'Slider', { value: 24, unit: 'px' }, { impl });
  const gap = await page.evaluate(() => {
    const num = document.querySelector('#dc-root input');
    const unit = [...document.querySelectorAll('#dc-root span')].find((e) => e.textContent.trim() === 'px');
    if (!num || !unit) return null;
    return Math.abs(num.getBoundingClientRect().bottom - unit.getBoundingClientRect().bottom);
  });
  expect(gap, 'в слайдере обязаны быть и значение, и единицы').not.toBeNull();
  expect(gap, 'значение и единицы — соседи по базовой линии: их нельзя двигать по отдельности').toBeLessThan(2.5);
});
