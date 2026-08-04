/* УСТОЙЧИВОСТЬ К ДАННЫМ, КОТОРЫЕ ПРИШЛИ НЕ ТАКИМИ.
 *
 * Все проверки ниже — про то, что происходит у ПОТРЕБИТЕЛЯ, а не в витрине. Витрина
 * кормит компоненты аккуратными наборами, поэтому ни один гейт таких состояний не видел:
 * список ещё не загрузился и пришёл пустым, диапазон вырожден, имя иконки приехало из
 * JSON, кнопка мыши нажата не та. Каждый пункт — подтверждённая находка консилиума.
 *
 * Проверяем React-версию: компоненты эталона заморожены тегом ds-reference-v0, править их
 * нельзя, и те же дефекты в них остаются до удаления DC-рантайма.
 */
import { expect, test } from '@playwright/test';
import { open, parkMouse } from '../support/browser.js';

const react = { impl: 'react' };
const calls = (page) => page.evaluate(() => window.__calls ?? []);
const setProps = (page, patch) => page.evaluate((p) => window.__setProps(p), patch);

// ── имя иконки приходит из данных ────────────────────────────────────────────
test('Icon: имя из прототипа объекта не роняет рендер', async ({ page }) => {
  // ICONS — обычный объект, поэтому ICONS["toString"] отдаёт функцию с прототипа, а не
  // разметку. Имена иконок приходят из конфигов и JSON: «toString» там ничем не хуже
  // «plus», и падать на нём компонент не имеет права.
  const bag = await open(page, 'Icon', { name: 'toString', size: 16 }, react);
  await expect(page.locator('#dc-root .sc-host')).toHaveCount(1);
  expect(await page.locator('#dc-root svg').count(), 'неизвестное имя оставляет пустое место').toBe(0);
  expect(bag.errors, 'рендер обязан пережить любое имя').toEqual([]);
});

// ── пустой список ────────────────────────────────────────────────────────────
for (const [name, sel] of [
  ['Tabs', '[data-tab]'],
  ['Segments', '[data-opt]'],
]) {
  test(`${name}: пустой список — это «вариантов нет», а не демо-подписи`, async ({ page }) => {
    await open(page, name, { options: [] }, react);
    const shown = await page.locator(`#dc-root ${sel}`).allTextContents();
    expect(
      shown,
      'демо-набор подставляется, когда список НЕ ЗАДАН вовсе; пустой список — это данные, и придумывать за них нельзя'
    ).toEqual([]);
  });
}

test('CycleButton: пустой список не ломает перебор', async ({ page }) => {
  const bag = await open(page, 'CycleButton', { options: [] }, react);
  const btn = page.locator('#dc-root [data-cycle]');
  await expect(btn).toHaveCount(1);
  await btn.click();
  await expect(btn, 'перебирать нечего — подпись остаётся пустой, а не NaN').toHaveText('');
  expect(bag.errors).toEqual([]);
});

// ── вырожденные диапазоны слайдера ───────────────────────────────────────────
test('Slider: max === min не даёт NaN', async ({ page }) => {
  await open(page, 'Slider', { label: 'Кегль', min: 10, max: 10, value: 10 }, react);
  const w = page.locator('#dc-root [role="slider"]');
  await expect(w).toHaveAttribute('aria-valuenow', '10');
  const fill = await page.locator('#dc-root [data-slider] ~ div').first().evaluate((el) => el.style.width);
  expect(fill, 'ноль в знаменателе уезжает в ширину заливки и остаётся там навсегда').not.toContain('NaN');
});

test('Slider: дробный магнит не плодит тысячи засечек', async ({ page }) => {
  await open(page, 'Slider', { label: 'Кегль', min: 0, max: 100, snapStep: 0.01 }, react);
  const ticks = await page.locator('#dc-root [data-ticks] > span').count();
  expect(ticks, 'десять тысяч узлов вешают вкладку — засечка это подсказка, а не обязанность').toBeLessThan(100);
});

test('Slider: шаг считается от min, а не от нуля', async ({ page }) => {
  await open(page, 'Slider', { label: 'Кегль', min: 10, max: 40, step: 3, defaultValue: 10 }, react);
  const w = page.locator('#dc-root [role="slider"]');
  await w.focus();
  await w.press('ArrowRight');
  await expect(w, 'шаг отсчитывается от начала диапазона: 10 + 3, а не «ближайшее кратное трём»').toHaveAttribute(
    'aria-valuenow',
    '13'
  );
});

test('Slider: правая кнопка мыши не тянет ползунок', async ({ page }) => {
  await open(page, 'Slider', { label: 'Кегль', min: 0, max: 100, defaultValue: 50 }, react);
  const w = page.locator('#dc-root [role="slider"]');
  const box = await page.locator('#dc-root [data-slider]').boundingBox();
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(w, 'контекстное меню — не перетаскивание: значение не должно прыгать к курсору').toHaveAttribute(
    'aria-valuenow',
    '50'
  );
  await parkMouse(page);
});

// ── композер ─────────────────────────────────────────────────────────────────
test('PinComposer: значение сверху перекрывает черновик и во второй раз', async ({ page }) => {
  await open(page, 'PinComposer', { value: 'первый', autofocus: false }, react);
  const input = page.locator('#dc-root input');
  await expect(input).toHaveValue('первый');
  await setProps(page, { value: 'второй' });
  await expect(input, 'ADR 0011: пришедшее сверху значение перекрывает своё — каждый раз, а не однажды').toHaveValue(
    'второй'
  );
});

test('PinComposer: пустая отправка — это отмена, а не сообщение', async ({ page }) => {
  await open(page, 'PinComposer', { autofocus: false, onSend: '@fn', onCancel: '@fn' }, react);
  await page.locator('#dc-root [data-btn]').click();
  const fired = (await calls(page)).map((c) => c.prop);
  expect(fired, 'пустая строка — не сообщение: у пинов это «передумал», и пустой пин обязан исчезнуть').toEqual([
    'onCancel',
  ]);
});
