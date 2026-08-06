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

// ── новые компоненты: то, чего витрина не показывает никогда ──────────────────

test('Select: пустой список открывается и говорит, что вариантов нет', async ({ page }) => {
  // Справочник ещё не пришёл — это законное состояние, а не повод падать. И не повод
  // молча показать пустую панель: пустота читается как «сломалось».
  const bag = await open(page, 'Select', { options: [], ariaLabel: 'Площадка' }, react);
  await page.locator('#dc-root [data-select="true"]').click();
  await expect(page.locator('[role="listbox"]')).toHaveCount(1);
  // Плашка объявлена ОПЦИЕЙ, а не просто текстом: обычный div внутри listbox для дерева
  // доступности не существует вовсе — диктор молчал бы там, где человек видит слова.
  const empty = page.locator('[role="option"]');
  await expect(empty).toHaveCount(1);
  await expect(empty).toHaveAttribute('aria-disabled', 'true');
  await expect(empty, 'пустая панель без слов читается как поломка').toHaveText('Ничего нет');
  expect(bag.errors).toEqual([]);
});

test('Select: пока справочник едет, «вариантов нет» — это неправда', async ({ page }) => {
  // Пустой список и загрузка выглядят одинаково, но означают разное: сказать «вариантов
  // нет» про справочник, который ещё не приехал, — соврать, и потребитель это скопирует.
  await open(page, 'Select', { options: [], loading: true, ariaLabel: 'Площадка' }, react);
  await page.locator('#dc-root [data-select="true"]').click();
  await expect(page.locator('[role="option"]')).toHaveText('Загружаем…');
});

test('Select: значение, которого нет в списке, показывает плейсхолдер, а не пустоту', async ({ page }) => {
  // Значение приходит с сервера и может отстать от справочника: выбранной опции больше
  // нет. Поле обязано честно сказать «не выбрано», а не показать пустую строку.
  await open(page, 'Select', { options: ['JPG', 'PNG'], value: 'HEIC', placeholder: 'Не выбрано', ariaLabel: 'Формат' }, react);
  await expect(page.locator('#dc-root [data-select="true"]')).toHaveText(/Не выбрано/);
});

test('Select: перебор в списке из одной опции никуда не уезжает', async ({ page }) => {
  await open(page, 'Select', { options: ['Единственный'], defaultValue: 'Единственный', ariaLabel: 'Формат' }, react);
  const trigger = page.locator('#dc-root [data-select="true"]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  const role = await page.evaluate(() => document.activeElement?.getAttribute('role'));
  expect(role, 'край списка из одной опции — это она сама, а не потеря фокуса').toBe('option');
});

test('Select: список из одних отключённых опций не крадёт фокус в никуда', async ({ page }) => {
  const bag = await open(
    page,
    'Select',
    { options: [{ value: 'a', label: 'Занято', disabled: true }, { value: 'b', label: 'Тоже занято', disabled: true }], ariaLabel: 'Слот' },
    react
  );
  const trigger = page.locator('#dc-root [data-select="true"]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="listbox"]')).toHaveCount(1);
  // Подсвечивать нечего — фокус остаётся там, где был, и Escape закрывает.
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  expect(bag.errors).toEqual([]);
});

test('Textarea: maxRows меньше rows не схлопывает поле', async ({ page }) => {
  // Конфиг приходит из данных, и «maxRows: 1 при rows: 4» там ничем не хуже осмысленного.
  await open(page, 'Textarea', { rows: 4, maxRows: 1, value: 'строка', ariaLabel: 'Комментарий' }, react);
  const h = await page.locator('#dc-root textarea').evaluate((el) => el.getBoundingClientRect().height);
  expect(h, 'потолок ниже пола оставил бы поле нулевой высоты').toBeGreaterThan(40);
});

test('Textarea: длинный текст упирается в потолок и прокручивается, а не растёт бесконечно', async ({ page }) => {
  const long = Array.from({ length: 60 }, (_, i) => `строка ${i}`).join('\n');
  await open(page, 'Textarea', { value: long, rows: 2, maxRows: 4, ariaLabel: 'Комментарий' }, react);
  const box = await page.locator('#dc-root textarea').evaluate((el) => ({
    h: el.getBoundingClientRect().height,
    scroll: el.scrollHeight,
    overflow: getComputedStyle(el).overflowY,
  }));
  expect(box.h, 'без потолка поле выдавливает кнопку отправки за экран').toBeLessThan(160);
  expect(box.scroll, 'содержимого больше, чем видно, — иначе проверять нечего').toBeGreaterThan(box.h);
  expect(box.overflow, 'упёрлись в потолок — обязана появиться прокрутка, иначе текст недостижим').toBe('auto');
});

test('Modal: закрытое окно не оставляет страницу выключенной', async ({ page }) => {
  const bag = await open(page, 'Modal', { open: false, label: 'Ничего' }, react);
  const state = await page.evaluate(() => ({
    inert: [...document.body.children].some((el) => el.hasAttribute('inert')),
    overflow: getComputedStyle(document.body).overflow,
    dialogs: document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length,
  }));
  expect(state.dialogs, 'закрытое окно не рисует ничего').toBe(0);
  expect(state.inert, 'закрытое окно не имеет права выключать страницу').toBe(false);
  expect(state.overflow, 'и не имеет права запирать прокрутку').not.toBe('hidden');
  expect(bag.errors).toEqual([]);
});

test('Modal: окно без единого интерактивного элемента всё равно держит фокус', async ({ page }) => {
  // Ни кнопок, ни полей: сообщение и всё. Фокусировать нечего, но оставлять фокус
  // снаружи нельзя — там выключённая страница, и следующий Tab уйдёт в её начало.
  await open(page, 'Modal', { open: true, label: 'Идёт сборка', dismissible: false }, react);
  const inside = await page.evaluate(() => {
    const popup = document.querySelector('[role="alertdialog"]');
    return !!popup && (popup === document.activeElement || popup.contains(document.activeElement));
  });
  expect(inside, 'фокус остался снаружи окна, в выключённой странице').toBe(true);
});
