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
import { contrast, flatten, open, parseColor, setProps, tokenValue } from '../support/browser.js';

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

for (const theme of ['dark', 'light']) {
  for (const name of DISABLEABLE) {
    test(`${name}: в disabled ничто не ярче --text-disabled (${theme})`, async ({ page }) => {
      const props = { disabled: true };
      if (name === 'Input') props.placeholder = 'Плейсхолдер';
      if (name === 'InputRow') Object.assign(props, { placeholder: 'Плейсхолдер', msg: 'Ошибка', msgLevel: 'danger' });
      if (name === 'CheckboxRow') Object.assign(props, { msg: 'Ошибка', msgLevel: 'danger' });
      if (name === 'OptionGroup') props.options = ['Первая', 'Вторая'];

      await open(page, name, props, { theme });

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
        `${name}/${theme}: элементы ярче потолка --text-disabled (${ceilingContrast.toFixed(2)}:1)\n` +
          tooBright.map((o) => `  ${o.tag} ${o.where} = ${o.css} «${o.text}»`).join('\n')
      ).toEqual([]);
    });
  }
}

test('ghost и secondary не приобретают поверхность в disabled', async ({ page }) => {
  await open(page, 'Button', { variant: 'ghost' });

  const read = () =>
    page.evaluate(() => {
      const b = document.querySelector('#dc-root button');
      const cs = getComputedStyle(b);
      return { bg: cs.backgroundColor, borderWidth: cs.borderTopWidth, borderColor: cs.borderTopColor };
    });

  const ghostOn = await read();
  await setProps(page, { disabled: true });
  const ghostOff = await read();
  expect(ghostOff.bg, 'у ghost нет своей поверхности — в disabled ей неоткуда взяться').toBe(ghostOn.bg);

  await setProps(page, { variant: 'secondary', disabled: false });
  const secOn = await read();
  await setProps(page, { disabled: true });
  const secOff = await read();
  expect(secOff.bg, 'secondary тоже без поверхности: иначе недоступная кнопка единственная с заливкой').toBe(secOn.bg);
  expect(secOff.borderWidth, 'рамка secondary — его форма, она остаётся').toBe(secOn.borderWidth);
  expect(secOff.borderColor, 'но гаснет цветом').not.toBe(secOn.borderColor);
});

test('primary и accent приглушают собственную поверхность, а не теряют её', async ({ page }) => {
  for (const variant of ['primary', 'accent']) {
    await open(page, 'Button', { variant });
    const on = await page.evaluate(() => getComputedStyle(document.querySelector('#dc-root button')).backgroundColor);
    await setProps(page, { disabled: true });
    const off = await page.evaluate(() => getComputedStyle(document.querySelector('#dc-root button')).backgroundColor);
    expect(off, `${variant}: поверхность обязана остаться`).not.toBe('rgba(0, 0, 0, 0)');
    expect(off, `${variant}: и обязана погаснуть`).not.toBe(on);
  }
});

test('disabled не реагирует: ни курсора-руки, ни ховера, ни тултипа', async ({ page }) => {
  await open(page, 'Button', { disabled: true, tooltip: 'Подсказка' });
  const state = await page.evaluate(() => {
    const b = document.querySelector('#dc-root button');
    const cs = getComputedStyle(b);
    return {
      cursor: cs.cursor,
      tooltipOpacity: getComputedStyle(b, '::before').opacity,
      disabled: b.disabled,
    };
  });
  expect(state.cursor).toBe('not-allowed');
  expect(state.disabled).toBe(true);
  expect(state.tooltipOpacity, 'у выключенного тултипа нет: подсказка — тоже реакция').toBe('0');
});
