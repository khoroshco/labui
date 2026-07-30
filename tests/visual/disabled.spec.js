/* Инварианты выключенного состояния (CLAUDE.md).
 *
 * 1. Потолок яркости: ни один элемент внутри disabled не заметнее --text-disabled,
 *    включая ::placeholder и семантические цвета.
 * 2. Выключенное не может быть ЗАМЕТНЕЕ доступного: приглушённую поверхность получают
 *    только варианты, у которых своя поверхность есть; ghost и secondary её не приобретают,
 *    а рамка secondary гаснет цветом, но остаётся — это форма, а не подсветка.
 *
 * Мера заметности — контраст к фону, а не «светлее/темнее»: в светлой теме ярче значит
 * темнее, и любая проверка по яркости в лоб ломается при первом же переключении темы.
 */
import { expect, test } from '@playwright/test';
import { contrast, flatten, IMPLS, open, parseColor, tokenValue } from '../support/browser.js';

/** Компоненты с disabled, у которых внутри есть что гасить. */
const DISABLEABLE = [
  'Button',
  'Input',
  'Checkbox',
  'Toggle',
  'CycleButton',
  'OptionGroup',
  'InputRow',
  'ChoiceRow',
  'SwitchRow',
  'CheckboxRow',
  'ActionRow',
  'Slider',
  'Disclosure',
];

for (const impl of IMPLS) {
  for (const theme of ['dark', 'light']) {
  for (const name of DISABLEABLE) {
    test(`${name}: в disabled ничто не ярче --text-disabled (${theme}, ${impl})`, async ({ page }) => {
      const props = { disabled: true };
      if (name === 'Input') props.placeholder = 'Плейсхолдер';
      if (name === 'InputRow') Object.assign(props, { placeholder: 'Плейсхолдер', msg: 'Ошибка', msgLevel: 'danger' });
      if (name === 'CheckboxRow') Object.assign(props, { msg: 'Ошибка', msgLevel: 'danger' });
      if (name === 'OptionGroup') props.options = ['Первая', 'Вторая'];
      // Без опций у ряда под проверку попадает один лейбл, а пилюли — самое вероятное
      // место нарушения потолка — в тест не попадают вовсе.
      if (name === 'ChoiceRow') props.options = ['Первая', 'Вторая'];

      await open(page, name, props, { theme, impl });

      const bg = parseColor(await tokenValue(page, '--bg-base', 'background-color'));
      const ceiling = flatten(parseColor(await tokenValue(page, '--text-disabled')), bg);
      const ceilingContrast = contrast(ceiling, bg);

      const offenders = await page.evaluate(() => {
        const out = [];
        const push = (el, css, where) => {
          if (!css || css === 'rgba(0, 0, 0, 0)') return;
          out.push({ tag: el.tagName.toLowerCase(), where, css, text: (el.textContent ?? '').trim().slice(0, 24) });
        };
        for (const el of document.querySelectorAll('#dc-root *')) {
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
          // цвет проверяем там, где он что-то красит: свой текст или иконка
          const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
          if (ownText || el.tagName === 'G-ICON' || el.tagName === 'INPUT') push(el, cs.color, 'color');
          if (el.tagName === 'INPUT') {
            push(el, getComputedStyle(el, '::placeholder').color, '::placeholder');
          }
        }
        return out;
      });

      const tooBright = offenders.filter((o) => {
        const c = contrast(flatten(parseColor(o.css), bg), bg);
        return c > ceilingContrast * 1.02; // 2% на округления браузера
      });

      expect(
        tooBright,
        `${name}/${theme}/${impl}: элементы ярче потолка --text-disabled (${ceilingContrast.toFixed(2)}:1)\n` +
          tooBright.map((o) => `  ${o.tag} ${o.where} = ${o.css} «${o.text}»`).join('\n')
      ).toEqual([]);
    });
  }
  }
}

for (const impl of IMPLS) {
test(`ghost и secondary не приобретают поверхность в disabled (${impl})`, async ({ page }) => {
  await open(page, 'Button', { variant: 'ghost' }, { impl });

  const read = () =>
    page.evaluate(() => {
      const b = document.querySelector('#dc-root button');
      const cs = getComputedStyle(b);
      return { bg: cs.backgroundColor, borderWidth: cs.borderTopWidth, borderColor: cs.borderTopColor };
    });

  const ghostOn = await read();
  await open(page, 'Button', { variant: 'ghost', disabled: true }, { impl });
  const ghostOff = await read();
  expect(ghostOff.bg, 'у ghost нет своей поверхности — в disabled ей неоткуда взяться').toBe(ghostOn.bg);

  await open(page, 'Button', { variant: 'secondary' }, { impl });
  const secOn = await read();
  await open(page, 'Button', { variant: 'secondary', disabled: true }, { impl });
  const secOff = await read();
  expect(secOff.bg, 'secondary тоже без поверхности: иначе недоступная кнопка единственная с заливкой').toBe(secOn.bg);
  expect(secOff.borderWidth, 'рамка secondary — его форма, она остаётся').toBe(secOn.borderWidth);
  expect(secOff.borderColor, 'но гаснет цветом').not.toBe(secOn.borderColor);
});
}

for (const impl of IMPLS) {
test(`primary и accent приглушают собственную поверхность, а не теряют её (${impl})`, async ({ page }) => {
  for (const variant of ['primary', 'accent']) {
    await open(page, 'Button', { variant }, { impl });
    const on = await page.evaluate(() => getComputedStyle(document.querySelector('#dc-root button')).backgroundColor);
    await open(page, 'Button', { variant, disabled: true }, { impl });
    const off = await page.evaluate(() => getComputedStyle(document.querySelector('#dc-root button')).backgroundColor);
    expect(off, `${variant}: поверхность обязана остаться`).not.toBe('rgba(0, 0, 0, 0)');
    expect(off, `${variant}: и обязана погаснуть`).not.toBe(on);
  }
});
}

for (const impl of IMPLS) {
test(`disabled не реагирует: ни курсора-руки, ни ховера, ни тултипа (${impl})`, async ({ page }) => {
  await open(page, 'Button', { disabled: true, tooltip: 'Подсказка' }, { impl });
  // Проверяем СМЫСЛ, а не механизм: подсказки не видно. Эталон оставляет атрибут и
  // прячет плашку до ховера, React-версия атрибут не пишет вовсе — оба варианта
  // выполняют правило, и тест не должен предпочитать один из них.
  const state = await page.evaluate(() => {
    const b = document.querySelector('#dc-root button');
    const cs = getComputedStyle(b);
    const before = getComputedStyle(b, '::before');
    return {
      cursor: cs.cursor,
      disabled: b.disabled,
      tooltipShown: before.content !== 'none' && before.opacity !== '0',
    };
  });
  expect(state.cursor).toBe('not-allowed');
  expect(state.disabled).toBe(true);
  expect(state.tooltipShown, 'у выключенного подсказки нет: тултип — тоже реакция').toBe(false);
});
}
