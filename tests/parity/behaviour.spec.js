/* Поведение React-версии: инварианты, которые снимком не проверишь.
 *
 * Идиома управления в React другая, чем была в DC: управляемость определяется НАЛИЧИЕМ
 * значения (value / checked), а не наличием колбэка. Это осознанное решение одно на все
 * шесть контролов (docs/adr/0011) — потребитель-React ждёт именно его. Инвариант при этом
 * прежний: пока значение приходит сверху, контрол показывает РОВНО его.
 */
import { expect, test } from '@playwright/test';
import { preparePage } from '../support/dc.js';
import { FIXTURES } from '../support/fixtures.js';

const openHarness = async (page, name, props = {}) => {
  preparePage(page);
  await page.goto(`/harness/?c=${name}&theme=dark&props=${encodeURIComponent(JSON.stringify(props))}`, {
    waitUntil: 'load',
  });
  await page.waitForSelector('#dc-root .sc-host > *');
  // Ждём шрифт: до его загрузки ширины меряются по подменному, и всё, что зависит от
  // измерений (скользящая подложка, подчёркивание), сравнивается не с тем.
  await page.evaluate(() => document.fonts.ready);
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

test('Input живой, даже когда значение пришло сверху без колбэка', async ({ page }) => {
  // Ревью нашло здесь паралич: строгая управляемость делала поле мёртвым при value без
  // onInput — то есть ровно в дефолтном вызове из контракта.
  await openHarness(page, 'Input', { value: 'Осенний сейл', ariaLabel: 'Название' });
  const field = page.locator('#dc-root input');
  await field.click();
  await field.press('End');
  await field.pressSequentially('XYZ');
  await expect(field, 'набор обязан быть живым всегда').toHaveValue('Осенний сейлXYZ');
});

test('ряд и остров набираются: значение из конфига не замораживает поле', async ({ page }) => {
  await openHarness(page, 'InputRow', { label: 'Название', value: '10' });
  const rowField = page.locator('#dc-root input');
  await rowField.click();
  await rowField.press('End');
  await rowField.pressSequentially('99');
  await expect(rowField).toHaveValue('1099');

  await openHarness(page, 'Island', {
    rows: [{ type: 'text', label: 'Название', value: 'Осенний сейл' }],
  });
  const islandField = page.locator('#dc-root input').first();
  await islandField.click();
  await islandField.press('End');
  await islandField.pressSequentially('!');
  await expect(islandField, 'форма из статичного конфига обязана набираться').toHaveValue('Осенний сейл!');
});

test('Slider живой при значении сверху и стартует от min', async ({ page }) => {
  await openHarness(page, 'Slider', { label: 'Поле', value: 24, min: 0, max: 64, step: 1 });
  const widget = page.locator('#dc-root [role="slider"]');
  await widget.focus();
  await page.keyboard.press('ArrowRight');
  await expect(widget, 'стрелка обязана двигать ползунок и при значении сверху').toHaveAttribute(
    'aria-valuenow',
    '25'
  );

  await openHarness(page, 'Slider', { label: 'Поле', min: 10, max: 20 });
  await expect(
    page.locator('#dc-root [role="slider"]'),
    'без значения слайдер стоит на min, а не на нуле вне диапазона'
  ).toHaveAttribute('aria-valuenow', '10');
});

test('у кнопки есть data-tone: ds.css ловит само наличие атрибута', async ({ page }) => {
  await openHarness(page, 'Button', { label: 'Выгрузить' });
  await expect(page.locator('#dc-root button')).toHaveAttribute('data-tone', 'default');
});

test('пакет сам ставит модальность фокуса — иначе кольца не появятся ни у кого', async ({ page }) => {
  await openHarness(page, 'Button', { label: 'Выгрузить' });
  await expect(page.locator('html')).toHaveAttribute('data-modality', 'mouse');
  await page.keyboard.press('Tab');
  await expect(page.locator('html'), 'клавиатура обязана переводить модальность в kb').toHaveAttribute(
    'data-modality',
    'kb'
  );
});

test('циклер живёт по общей идиоме: defaultValue щёлкается, value показывает ровно своё', async ({ page }) => {
  // Своя реализация «живой всегда» была лечением симптома: замирал циклер не сам по себе,
  // а потому что ряд отдавал ему значение, не отдавая колбэка. Лечится это в композиции —
  // ряд теперь отдаёт значение только вместе с колбэком, — а идиома у всех шести одна.
  await openHarness(page, 'CycleButton', { options: ['PX', 'REM'], defaultValue: 1 });
  const btn = page.locator('#dc-root button');
  await expect(btn).toHaveText('REM');
  await btn.click();
  await expect(btn, 'неуправляемый циклер обязан щёлкаться').toHaveText('PX');

  await openHarness(page, 'CycleButton', { options: ['PX', 'REM'], value: 1 });
  const owned = page.locator('#dc-root button');
  await owned.click();
  await expect(owned, 'управляемый контрол показывает РОВНО то, что пришло сверху').toHaveText('REM');
});

test('Avatar без автора не выдумывает имя', async ({ page }) => {
  await openHarness(page, 'Avatar', {});
  const el = page.locator('#dc-root [role="img"]');
  await expect(el, 'витринное имя не должно быть дефолтом библиотеки').toHaveAttribute('aria-label', 'Аватар');
  await expect(el).toHaveText('—');
});

test('подчёркивание вкладок перемеряется при смене подписей', async ({ page }) => {
  await openHarness(page, 'Tabs', {
    options: [['Очень длинная подпись вкладки', ''], ['Б', '']],
    defaultValue: 0,
  });
  // Подложка едет к вкладке пружиной .35s — мерить надо после того, как она приехала,
  // иначе тест ловит середину перехода, а не результат.
  await page.waitForTimeout(600);
  const bar = page.locator('#dc-root [role="tablist"] > span').first();
  const tab = page.locator('#dc-root [role="tab"]').first();
  const barW = (await bar.boundingBox())?.width ?? 0;
  const tabW = (await tab.boundingBox())?.width ?? 0;
  expect(Math.abs(barW - tabW), `подложка ${barW} против вкладки ${tabW}`).toBeLessThan(2);
});

/* Ряды острова, заданные конфигом без колбэка, обязаны оставаться живыми.
 *
 * В React признак управляемости — значение, поэтому остров, отдававший вниз checked/value
 * безусловно, делал тоггл, чекбокс и сегменты МЁРТВЫМИ: контрол показывал ровно переданное,
 * а менять его было нечем. Ряд при этом подсвечивался, продавливался и озвучивал role=switch.
 * Фикстура всех гейтов — ровно такой конфиг, поэтому дефект жил во всех снимках сразу.
 */
test('тоггл и сегменты в острове переключаются, когда конфиг без колбэка', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await openHarness(page, 'Island', FIXTURES.Island);

  const toggle = page.locator('#dc-root [role="switch"]').first();
  const before = await toggle.getAttribute('aria-checked');
  await toggle.click();
  expect(await toggle.getAttribute('aria-checked'), 'тоггл ряда не переключился').not.toBe(before);

  const opts = page.locator('#dc-root [role="radiogroup"] button');
  const last = opts.nth((await opts.count()) - 1);
  await last.click();
  expect(await last.getAttribute('aria-checked'), 'опция ряда не выбралась').toBe('true');
});
