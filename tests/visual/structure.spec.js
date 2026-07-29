/* Структурные инварианты разметки (CLAUDE.md).
 *
 * 1. Капс и трекинг принадлежат НАДПИСИ, а не кнопке: иначе ::before-тултип наследует
 *    text-transform, и подсказка выходит капсом.
 * 2. Корень ряда — div, а не label (вложенный label даёт второе активационное событие).
 * 3. Соло-иконка без подписи обязана иметь тултип — он же даёт имя для скринридера.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

test('носитель тултипа не капсовый: подсказка не наследует преобразование', async ({ page }) => {
  for (const name of ['Button', 'CycleButton']) {
    await open(page, name, { tooltip: 'Единицы измерения' });
    const hosts = await page.evaluate(() =>
      [...document.querySelectorAll('#dc-root [data-tooltip]')].map((el) => ({
        tag: el.tagName.toLowerCase(),
        transform: getComputedStyle(el).textTransform,
        // капс живёт на вложенной надписи — это законно и нужно
        inner: [...el.querySelectorAll('*')].map((c) => getComputedStyle(c).textTransform),
      }))
    );
    expect(hosts.length, `${name}: тултип обязан появиться на элементе`).toBeGreaterThan(0);
    for (const h of hosts) {
      expect(
        h.transform,
        `${name}: ${h.tag} с data-tooltip набран капсом — подсказка выйдет капсом вместе с ним`
      ).toBe('none');
    }
  }
});

test('капс у капсульной надписи всё-таки есть — иначе проверять было бы нечего', async ({ page }) => {
  await open(page, 'CycleButton', { tooltip: 'Единицы измерения' });
  const inner = await page.evaluate(() =>
    [...document.querySelectorAll('#dc-root [data-tooltip] *')].map((c) => getComputedStyle(c).textTransform)
  );
  expect(inner, 'у пилюли циклера надпись капсовая, и капс лежит на ней').toContain('uppercase');
});

test('корень ряда — div: вложенных label в системе нет', async ({ page }) => {
  for (const name of ['SwitchRow', 'CheckboxRow', 'InputRow', 'ChoiceRow', 'ActionRow']) {
    await open(page, name, { label: 'Ряд' });
    const info = await page.evaluate(() => {
      const root = document.querySelector('#dc-root .sc-host > *');
      return { rootTag: root?.tagName.toLowerCase(), nested: document.querySelectorAll('#dc-root label label').length };
    });
    expect(info.rootTag, `${name}: корень ряда обязан быть div`).not.toBe('label');
    expect(info.nested, `${name}: вложенный label даёт второе активационное событие`).toBe(0);
  }
});

test('соло-иконка называет себя: тултип даёт имя для скринридера', async ({ page }) => {
  await open(page, 'Button', { label: '', icon: 'plus', tooltip: 'Добавить' });
  const btn = await page.evaluate(() => {
    const b = document.querySelector('#dc-root button');
    return {
      label: b.getAttribute('aria-label'),
      tooltip: b.getAttribute('data-tooltip'),
      text: b.textContent.trim(),
      square: Math.abs(b.getBoundingClientRect().width - b.getBoundingClientRect().height) < 1,
    };
  });
  expect(btn.text, 'у соло-иконки нет подписи').toBe('');
  expect(btn.tooltip, 'тултип обязателен').toBe('Добавить');
  expect(btn.label, 'он же даёт имя для скринридера').toBe('Добавить');
  expect(btn.square, 'кнопка-иконка квадратная').toBe(true);
});
