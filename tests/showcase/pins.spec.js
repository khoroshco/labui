/* СЦЕНАРИЙ С ПИНАМИ: проза раздела обязана быть правдой.
 *
 * Раздел «Пины на канвасе» — не компонент, а экранная композиция, и именно поэтому его не
 * проверял никто: снимки снимают компоненты по отдельности, паритет сравнивает компоненты,
 * lint:showcase-react читает имена пропсов. Композиция оказалась ровно тем местом, где
 * проза расходится с кодом молча: раздел обещал пять вещей, и ни одна не работала.
 *
 * Цена этого не косметическая. Витрина — образец применения: потребитель копирует сцену
 * к себе вместе с дефектом, и «точка непрочитанного ответа», зажигающаяся от собственного
 * сообщения, приезжает в продукт как поведение системы.
 *
 * Проверяем СЛЕДСТВИЯ: цвет капли, наличие точки, попадание карточки в видимую область,
 * состав сообщений треда — то, что видит человек, а не имена пропсов.
 */
import { expect, test } from '@playwright/test';
import { SHOWCASE_URL } from '../../playwright.config.js';

const canvas = (page) => page.locator('#pincanvas div[style*="crosshair"]').first();
const pin = (page, i = 0) => page.locator(`#pincanvas [data-scene-pin="${i}"]`);
const preview = (page) => page.locator('#pincanvas [data-scene-preview]');
const thread = (page) => page.locator('#pincanvas [data-scene-thread]');

async function openScene(page) {
  await page.goto(SHOWCASE_URL, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('radio', { name: 'Сценарии', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('#pincanvas').scrollIntoViewIfNeeded();
  await expect(canvas(page), 'канвас сцены обязан быть — иначе проверять нечего').toHaveCount(1);
}

/**
 * Заливка КАПЛИ, а не пропа: у решённого пина она гаснет до --bg-active, у обычного
 * акцентная. Мера — нарисованный цвет: проверка «проп resolved передан» прошла бы и на
 * компоненте, который его не читает.
 */
const dropFill = (page, i = 0) =>
  page.evaluate((n) => {
    const wrap = document.querySelector(`#pincanvas [data-scene-pin="${n}"]`);
    // :scope важен — без него первым совпадением «span > span» оказывается сам корень
    // Pin (его родитель тоже span), а он прозрачный, и проверка сравнивала пустоту с пустотой.
    const drop = wrap?.querySelector(':scope > span > span');
    return drop ? getComputedStyle(drop).backgroundColor : null;
  }, i);

test('решённый пин гаснет, но не исчезает', async ({ page }) => {
  await openScene(page);
  const before = await dropFill(page);
  expect(before, 'капля не найдена — проверять нечего').toBeTruthy();

  // Открыть тред и нажать «Решено».
  await pin(page).click();
  await page.getByRole('button', { name: 'Решено' }).click();

  const after = await dropFill(page);
  expect(after, 'проп resolved не доехал до Pin: решённый пин выглядит как обычный').not.toBe(before);
  await expect(pin(page), 'решённый пин гаснет, а не исчезает').toHaveCount(1);
});

test('точка непрочитанного зажигается от ОТВЕТА, а не от собственного сообщения', async ({ page }) => {
  await openScene(page);
  // У единственного пина есть своё сообщение и нет ответов.
  await expect(
    page.locator('#pincanvas [data-dot="true"]'),
    'точка горит без единого ответа — она заполнена из своего же первого сообщения'
  ).toHaveCount(0);

  await page.getByRole('button', { name: /Отправить в AI/ }).click();
  await expect(page.locator('#pincanvas [data-dot="true"]'), 'ответ пришёл, а точки нет').toHaveCount(1);
});

test('у правого края карточка отражается влево и не режется канвасом', async ({ page }) => {
  await openScene(page);
  const box = await canvas(page).boundingBox();
  // Ставим пин у правого края: там расти вправо некуда.
  await page.mouse.click(box.x + box.width - 40, box.y + 60);
  await expect(page.locator('#pincanvas [data-scene-composer]'), 'клик по полотну обязан ставить пин с композером').toHaveCount(1);

  const fits = await page.evaluate(() => {
    const canvasEl = [...document.querySelectorAll('#pincanvas div')].find((d) => getComputedStyle(d).cursor === 'crosshair');
    const card = canvasEl.querySelector('[data-scene-composer]');
    const cb = canvasEl.getBoundingClientRect();
    const fb = card.getBoundingClientRect();
    return { left: fb.left >= cb.left - 1, right: fb.right <= cb.right + 1, w: fb.width };
  });
  expect(fits.w, 'композер нулевой ширины — измерять нечего').toBeGreaterThan(40);
  expect(
    fits.right,
    'карточка уехала за правый край и срезана overflow канваса: проза обещает отражение влево'
  ).toBe(true);
  expect(fits.left, 'отразили слишком сильно — теперь режет слева').toBe(true);
});

test('наведение на пин даёт превью, а не пустоту', async ({ page }) => {
  await openScene(page);
  await pin(page).hover();
  await expect(preview(page), 'превью по наведению обещано прозой раздела, а PinCard умеет variant=preview').toHaveCount(1);
  // Превью — только текст, без действий: кнопок в нём быть не должно.
  expect(await preview(page).locator('button').count(), 'превью показывает текст, а действия живут в раскрытом треде').toBe(0);
});

test('второй ответ не затирает первый, и ответ человека подписан человеком', async ({ page }) => {
  await openScene(page);
  await page.getByRole('button', { name: /Отправить в AI/ }).click();
  await pin(page).click();

  await expect(thread(page)).toHaveCount(1);
  await thread(page).locator('input').fill('Проверил, всё на месте.');
  await thread(page).locator('input').press('Enter');

  const authors = await page.evaluate(() => {
    const card = document.querySelector('#pincanvas [data-scene-thread]');
    return card ? card.innerText : '';
  });
  expect(authors, 'ответ AI пропал — второй ответ затёр первый').toContain('Поправил охранное поле');
  expect(authors, 'ответ человека не дошёл').toContain('Проверил, всё на месте');
  expect(authors, 'ответ человека подписан «AI»: у сцены одно поле ответа на всех').toContain('Пётр Соколов');
});
