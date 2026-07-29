/* Поведение React-версии: инварианты, которые снимком не проверишь.
 *
 * Идиома управления в React другая, чем была в DC: управляемость определяется НАЛИЧИЕМ
 * значения (value / checked), а не наличием колбэка. Это осознанное решение одно на все
 * шесть контролов (docs/adr/0011) — потребитель-React ждёт именно его. Инвариант при этом
 * прежний: пока значение приходит сверху, контрол показывает РОВНО его.
 */
import { expect, test } from '@playwright/test';
import { preparePage } from '../support/dc.js';

const openHarness = async (page, name, props = {}) => {
  preparePage(page);
  await page.goto(`/harness/?c=${name}&theme=dark&props=${encodeURIComponent(JSON.stringify(props))}`, {
    waitUntil: 'load',
  });
  await page.waitForSelector('#dc-root .sc-host > *');
};

test('Toggle: без value ведёт своё состояние, с value показывает переданное', async ({ page }) => {
  await openHarness(page, 'Toggle', { defaultChecked: false, label: 'Живое превью' });
  const el = page.locator('#dc-root [role="switch"]');
  await expect(el).toHaveAttribute('aria-checked', 'false');
  await el.click();
  await expect(el, 'без value контрол ведёт своё — иначе он заморожен').toHaveAttribute('aria-checked', 'true');

  await openHarness(page, 'Toggle', { checked: false, label: 'Живое превью' });
  const controlled = page.locator('#dc-root [role="switch"]');
  await controlled.click();
  await expect(
    controlled,
    'значением владеет родитель: пока проп не изменился, показ не меняется'
  ).toHaveAttribute('aria-checked', 'false');
});

test('Checkbox: та же идиома, что у Toggle', async ({ page }) => {
  await openHarness(page, 'Checkbox', { defaultChecked: false, label: 'Применить ко всем' });
  const el = page.locator('#dc-root [role="checkbox"]');
  await el.click();
  await expect(el).toHaveAttribute('aria-checked', 'true');

  await openHarness(page, 'Checkbox', { checked: true, label: 'Применить ко всем' });
  const controlled = page.locator('#dc-root [role="checkbox"]');
  await controlled.click();
  await expect(controlled).toHaveAttribute('aria-checked', 'true');
});

test('OptionGroup и Tabs переключаются кликом и стрелками', async ({ page }) => {
  await openHarness(page, 'OptionGroup', { options: ['JPG', 'PNG', 'WEBP'], defaultValue: 0 });
  const opts = page.locator('#dc-root [role="radio"]');
  await opts.nth(2).click();
  await expect(opts.nth(2)).toHaveAttribute('aria-checked', 'true');
  await opts.nth(2).press('ArrowLeft');
  await expect(opts.nth(1), 'стрелка обязана переключать опцию — WAI-ARIA radiogroup').toHaveAttribute(
    'aria-checked',
    'true'
  );

  await openHarness(page, 'Tabs', { defaultValue: 0 });
  const tabs = page.locator('#dc-root [role="tab"]');
  await tabs.nth(1).click();
  await expect(tabs.nth(1), 'замерзший контрол ловили здесь трижды').toHaveAttribute('aria-selected', 'true');
});

test('Disclosure: без open ведёт своё, с open слушается родителя', async ({ page }) => {
  await openHarness(page, 'Disclosure', { label: 'Примеры', defaultOpen: false });
  const head = page.locator('#dc-root button').first();
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');

  await openHarness(page, 'Disclosure', { label: 'Примеры', open: false });
  const controlled = page.locator('#dc-root button').first();
  await controlled.click();
  await expect(controlled).toHaveAttribute('aria-expanded', 'false');
});

test('CycleButton перебирает значения по кругу', async ({ page }) => {
  await openHarness(page, 'CycleButton', { options: ['PX', 'REM'], defaultValue: 0 });
  const btn = page.locator('#dc-root button');
  await expect(btn).toHaveText('PX');
  await btn.click();
  await expect(btn).toHaveText('REM');
  await btn.click();
  await expect(btn, 'после последнего значения — снова первое').toHaveText('PX');
});

test('Slider: магнит только на перетаскивании, клавиатура точна', async ({ page }) => {
  await openHarness(page, 'Slider', { label: 'Охранное поле', defaultValue: 24, min: 0, max: 64, step: 1, snapStep: 8, unit: 'px' });
  const widget = page.locator('#dc-root [role="slider"]');
  await expect(widget).toHaveAttribute('aria-valuenow', '24');

  await widget.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    widget,
    'шаг мельче силы магнита обязан двигать ползунок — иначе стрелка нажимается вхолостую'
  ).toHaveAttribute('aria-valuenow', '25');

  await page.keyboard.press('Shift+ArrowRight');
  await expect(widget, 'Shift при магните — переход к следующему узлу').toHaveAttribute('aria-valuenow', '32');

  // перетаскивание — неточный ввод: значение липнет к кратному
  const box = await page.locator('#dc-root > .sc-host > div').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.505, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  const v = Number(await widget.getAttribute('aria-valuenow'));
  expect(v % 8, `перетаскивание обязано лечь на кратное магнита, а не на ${v}`).toBe(0);
});

test('ⓘ раскрывает подсказку и не трогает переключатель ряда', async ({ page }) => {
  await openHarness(page, 'SwitchRow', { label: 'Запекать в растр', defaultChecked: false, info: 'Подсказка' });
  const row = page.locator('#dc-root [role="switch"]');
  const info = page.locator('#dc-root button[aria-expanded]');
  await info.click();
  await expect(info).toHaveAttribute('aria-expanded', 'true');
  await expect(row, 'справка — не действие').toHaveAttribute('aria-checked', 'false');
});
