/* МОДАЛЬНОЕ ОКНО: то, чего не видно ни в снимке, ни в разметке.
 *
 * Проверяем НА ВИТРИНЕ, а не в харнессе, и это не удобство. Всё существенное у модалки —
 * про отношения с ОСТАЛЬНОЙ СТРАНИЦЕЙ: фон уходит из таба и из озвучки, обход заперт,
 * фокус возвращается на кнопку, которой окно открыли, прокрутка стоит. В харнессе на
 * странице ровно один компонент — там «фон выключен» проверить не на чем, а «фокус
 * вернулся на триггер» некуда возвращать. Витрина — единственная поверхность, где
 * компонент стоит в настоящей композиции.
 *
 * Мера везде — следствие: тождество узла, а не совпадение тега; попадание таба, а не
 * наличие атрибута.
 */
import { expect, test } from '@playwright/test';
import { SHOWCASE_URL } from '../../playwright.config.js';

/** Открыть витрину на уровне организмов и доехать до раздела модалки. */
async function openShowcase(page) {
  await page.goto(SHOWCASE_URL, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('radio', { name: 'Организмы', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('#modal').scrollIntoViewIfNeeded();
}

const dialog = (page) => page.locator('[role="dialog"], [role="alertdialog"]');
const button = (page, name) => page.locator('#modal').getByRole('button', { name, exact: true });

test('у окна есть имя, и оно совпадает с заголовком', async ({ page }) => {
  // axe правило `aria-dialog-name` держит в теге best-practice, а сюита берёт только
  // wcag2a/aa; у pa11y такой техники нет вовсе. То есть `aria-labelledby={undefined}`
  // проходил оба движка, и диктор объявлял «диалог» без единого слова о том, какое
  // решение просят.
  await openShowcase(page);
  await button(page, 'Опасное').click();
  await expect(
    page.getByRole('alertdialog', { name: /Удалить кампанию/ }).or(page.getByRole('dialog', { name: /Удалить кампанию/ })),
    'вычисленное имя окна пусто или не совпадает с заголовком'
  ).toHaveCount(1);
});

test('открытие: фокус уходит внутрь окна, фон выключается', async ({ page }) => {
  await openShowcase(page);
  await button(page, 'Обычное').click();
  await expect(dialog(page)).toHaveCount(1);

  const state = await page.evaluate(() => {
    const popup = document.querySelector('[role="dialog"], [role="alertdialog"]');
    const outside = [...document.body.children].filter((el) => !el.contains(popup));
    return {
      inside: !!popup && popup.contains(document.activeElement),
      focused: document.activeElement?.tagName,
      // Фон обязан уйти И из таба (inert), И из дерева доступности (aria-hidden):
      // aria-modal сам по себе этого не делает, и полагаться на него нельзя.
      inert: outside.every((el) => el.hasAttribute('inert')),
      hidden: outside.every((el) => el.getAttribute('aria-hidden') === 'true'),
      n: outside.length,
      locked: getComputedStyle(document.body).overflow,
    };
  });
  expect(state.n, 'соседей по body не нашлось — проверять «фон выключен» было бы не на чем').toBeGreaterThan(0);
  expect(state.inside, `фокус остался снаружи окна (${state.focused}) — следующий Tab начнёт обход выключённой страницы`).toBe(true);
  expect(state.inert, 'без inert таб уходит в страницу под окном: человек правит форму, которой не видно').toBe(true);
  expect(state.hidden, 'без aria-hidden диктор читает фон подряд — перекрытие пикселями ему не сообщает ничего').toBe(true);
  expect(state.locked, 'страница под окном обязана стоять').toBe('hidden');
});

test('обход заперт внутри окна', async ({ page }) => {
  await openShowcase(page);
  await button(page, 'Обычное').click();
  await expect(dialog(page)).toHaveCount(1);

  // Кругов больше, чем элементов внутри: если ловушка не работает, фокус успеет уйти.
  const escaped = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const out = await page.evaluate(() => {
      const popup = document.querySelector('[role="dialog"], [role="alertdialog"]');
      const el = document.activeElement;
      return popup && el && !popup.contains(el) ? `${el.tagName}.${el.className || ''}`.slice(0, 40) : null;
    });
    if (out) escaped.push(`шаг ${i + 1}: ${out}`);
  }
  expect(escaped, `фокус вышел за пределы окна:\n  ${escaped.join('\n  ')}`).toEqual([]);

  // И обратно тоже.
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+Tab');
  const inside = await page.evaluate(() => {
    const popup = document.querySelector('[role="dialog"], [role="alertdialog"]');
    return !!popup && popup.contains(document.activeElement);
  });
  expect(inside, 'Shift+Tab у первого элемента обязан уводить на последний, а не наружу').toBe(true);
});

test('Escape закрывает и возвращает фокус на ту же кнопку', async ({ page }) => {
  await openShowcase(page);
  const trigger = button(page, 'Обычное');
  await trigger.click();
  await expect(dialog(page)).toHaveCount(1);
  await page.evaluate(() => {
    // Запоминаем УЗЕЛ, а не имя: фокус, уехавший на другую кнопку с той же подписью,
    // прошёл бы проверку по тексту.
    window.__opener = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Обычное');
  });
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  const back = await page.evaluate(() => document.activeElement === window.__opener);
  expect(back, 'фокус не вернулся на кнопку — следующий Tab начнёт обход документа с начала').toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow), 'прокрутка обязана вернуться').not.toBe('hidden');
  const restored = await page.evaluate(() =>
    [...document.body.children].every((el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true')
  );
  expect(restored, 'фон остался выключенным после закрытия — страница мертва').toBe(true);
});

test('клик по подложке закрывает отменяемое окно', async ({ page }) => {
  await openShowcase(page);
  await button(page, 'Обычное').click();
  await expect(dialog(page)).toHaveCount(1);
  // В угол: там подложка и ничего больше.
  await page.mouse.click(6, 6);
  await expect(dialog(page)).toHaveCount(0);
});

test('обязательное решение не закрывается ни Escape, ни кликом мимо', async ({ page }) => {
  await openShowcase(page);
  await button(page, 'Обязательное решение').click();
  const d = dialog(page);
  await expect(d).toHaveCount(1);
  // Роль другая: диктор объявляет это как требующее ответа, а не как «открылось окно».
  await expect(d, 'обязательное решение объявляется ролью alertdialog').toHaveAttribute('role', 'alertdialog');
  await expect(d).toHaveAttribute('aria-modal', 'true');

  await page.keyboard.press('Escape');
  await expect(d, 'Escape закрыл окно, которое закрывать нельзя').toHaveCount(1);
  await page.mouse.click(6, 6);
  await expect(d, 'клик мимо закрыл окно, которое закрывать нельзя').toHaveCount(1);
  // Крестика у такого окна нет: закрыть без решения нечем.
  const closes = await page.evaluate(
    () => [...document.querySelectorAll('[role="alertdialog"] button')].map((b) => b.getAttribute('aria-label')).filter(Boolean)
  );
  expect(closes, 'крестик — это способ уйти без решения; у обязательного его быть не должно').not.toContain('Закрыть');

  await page.getByRole('button', { name: 'Войти снова' }).click();
  await expect(d).toHaveCount(0);
});

test('окно уходит из DOM не мгновенно, и на время ухода не берёт фокус', async ({ page }) => {
  await openShowcase(page);
  await button(page, 'Обычное').click();
  await expect(dialog(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  // Сразу после закрытия окно ещё в DOM — иначе выход схлопывается рывком, а правило
  // системы говорит «выход всегда анимирован». Но фокус оно уже не берёт: 220 мс оно
  // видно, и таб успевал попасть на кнопку, которой сейчас не станет.
  const during = await page.evaluate(() => {
    const popup = document.querySelector('[role="dialog"], [role="alertdialog"]');
    return popup
      ? { present: true, inert: popup.hasAttribute('inert'), focus: document.activeElement?.textContent?.trim() }
      : { present: false, inert: null, focus: null };
  });
  // Присутствие — ТРЕБОВАНИЕ, а не условие. Пока оно стояло под `if`, обнуление EXIT
  // выключало проверку целиком: окно схлопывалось рывком, тело `if` не исполнялось, и
  // единственное, что оставалось, — «в конце его нет». Гейт зеленел над сломанным
  // правилом «выход всегда анимирован».
  expect(during.present, 'окно исчезло в тот же кадр — выход не анимирован').toBe(true);
  expect(during.inert, 'уходящее окно обязано быть inert: на его кнопку успевает попасть таб').toBe(true);
  expect(during.focus, 'фокус на 220 мс завис в никуда: Tab в это время начинает обход документа с начала').toBe('Обычное');
  await expect(dialog(page), 'окно обязано исчезнуть, а не остаться навсегда').toHaveCount(0);
});

test('селект внутри окна лежит ПОВЕРХ него и попадает под указатель', async ({ page }) => {
  // Самая частая композиция и самое опасное место: оба всплывающих уходят порталом в body
  // и становятся соседями. Пока номера слоёв жили литералами в двух файлах, список
  // рисовался ПОД окном и под его затемнением — человек нажимал на поле, фокус уезжал в
  // невидимый список, и на экране не менялось ничего.
  await openShowcase(page);
  await button(page, 'Обычное').click();
  await expect(dialog(page)).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Формат выгрузки' }).click();

  const seen = await page.evaluate(() => {
    const list = document.querySelector('[role="listbox"]');
    if (!list) return { why: 'списка нет' };
    const r = list.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(18, r.height / 2));
    return { hit: !!at && (list === at || list.contains(at)), why: at?.tagName ?? 'ничего', w: r.width };
  });
  expect(seen.w, 'список нулевой ширины — измерять нечего').toBeGreaterThan(40);
  expect(seen.hit, `список накрыт окном: в его точке оказалось «${seen.why}»`).toBe(true);
});

test('Escape в открытом списке закрывает список, а не окно', async ({ page }) => {
  // События из портала всплывают по дереву REACT, а не по DOM: без явного гашения одно
  // нажатие закрывало два слоя сразу — список и окно вместе с заполненной формой.
  await openShowcase(page);
  await button(page, 'Обычное').click();
  await page.getByRole('combobox', { name: 'Формат выгрузки' }).click();
  await expect(page.locator('[role="listbox"]')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('[role="listbox"]'), 'список обязан закрыться').toHaveCount(0);
  await expect(dialog(page), 'одно нажатие закрыло и окно: клавишу съедает верхний слой, а не оба').toHaveCount(1);

  // А второе нажатие — уже окно.
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('второе окно не запирает прокрутку страницы навсегда', async ({ page }) => {
  // Счётчик замков общий, а снимок прежних значений каждая копия брала СВОЙ: вторая
  // запоминала уже изменённые значения как «прежние» и возвращала их при закрытии.
  // Страница оставалась без прокрутки и с пустой полосой справа до перезагрузки.
  await openShowcase(page);
  const before = await page.evaluate(() => ({
    overflow: document.body.style.overflow,
    pad: document.body.style.paddingRight,
  }));

  await button(page, 'Обычное').click();
  await expect(dialog(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await button(page, 'Опасное').click();
  await expect(dialog(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  const after = await page.evaluate(() => ({
    overflow: document.body.style.overflow,
    pad: document.body.style.paddingRight,
  }));
  expect(after, 'прокрутка и компенсация полосы не вернулись к тому, что было до окон').toEqual(before);
});
