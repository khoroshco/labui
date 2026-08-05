/* ФОКУС-КОЛЬЦО: его должно быть ВИДНО, и оно не должно ничего портить.
 *
 * Кольцо — нетекстовый индикатор: норма контраста для него 3:1 (WCAG 1.4.11), и мерить
 * его надо к ОБЕИМ соседним поверхностям — к полотну снаружи и к поверхности карточки,
 * на которой контрол чаще всего стоит. Гейт контраста этого не видел вовсе: он мерил
 * `--accent` как ТЕКСТ по норме 4.5 и про пару «кольцо × фон» не знал. А в светлой теме
 * жёлтое кольцо на бумаге давало 1.52:1 — то есть индикатора фокуса там не было.
 *
 * Второе. Зазор кольца был ЗАЛИТ `--bg-base` — вторым слоем тени. Пока контрол стоит на
 * полотне, это незаметно; на карточке (`--bg-surface`) вокруг фокуса появлялось светлое
 * гало размером с кольцо. Подделывать фон нельзя: зазор обязан быть прозрачным.
 *
 * Третье. Сепараторы острова перечёркивали inset-кольцо ряда: правила гашения были
 * написаны по самому ряду, у которого границы нет вовсе, — то есть не работали.
 */
import { expect, test } from '@playwright/test';
import { contrast, flatten, open, parseColor } from '../support/browser.js';

/** Норма для нетекстового индикатора. */
const AA_NON_TEXT = 3;

/** Значение токена, посчитанное браузером. */
const token = (page, name, prop = 'color') =>
  page.evaluate(
    ([t, p]) => {
      const el = document.createElement('span');
      el.style.setProperty(p, `var(${t})`);
      document.body.appendChild(el);
      const v = getComputedStyle(el)[p];
      el.remove();
      return v;
    },
    [name, prop]
  );

for (const theme of ['dark', 'light']) {
  test(`кольцо фокуса контрастно обеим поверхностям ≥ ${AA_NON_TEXT}:1 (${theme})`, async ({ page }) => {
    await open(page, 'Button', { label: 'Выгрузить' }, { theme });
    // Несуществующий токен разворачивается в наследуемый цвет и проверка зеленеет на
    // пустоте: сперва убеждаемся, что он вообще объявлен.
    const declared = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--focus').trim());
    expect(declared, 'у фокуса обязан быть СВОЙ токен: кольцо не может делить цвет с акцентной заливкой').not.toBe('');

    // Мерим НАРИСОВАННОЕ кольцо, а не токен. Проверка на токене зеленела, когда цвет
    // подменяли на уровне --focus-ring: кольцо становилось цветом полотна (контраст 1:1),
    // индикатора фокуса не было вовсе, а все 135 тестов доступности проходили. Гейт обязан
    // мерить следствие — то, что видит человек.
    const btn = page.locator('#dc-root [data-btn]');
    await page.keyboard.press('Tab'); // клавиатурная модальность
    await btn.focus();
    const painted = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.outlineColor, width: parseFloat(cs.outlineWidth), style: cs.outlineStyle };
    });
    expect(painted.width, 'кольцо не нарисовано вовсе').toBeGreaterThan(0);
    expect(painted.style, 'невидимый стиль обводки — это отсутствие кольца').not.toBe('none');
    expect(painted.color, 'кольцо обязано быть набрано токеном фокуса, а не чем придётся').toBe(await token(page, '--focus'));
    const ring = parseColor(painted.color);
    for (const surface of ['--bg-base', '--bg-surface', '--bg-float']) {
      const bg = parseColor(await token(page, surface, 'background-color'));
      const ratio = contrast(flatten(ring, bg), bg);
      expect(
        +ratio.toFixed(2),
        `${theme}: кольцо на ${surface} — ${ratio.toFixed(2)}:1. Нетекстовому индикатору положено ${AA_NON_TEXT}:1, иначе фокуса просто не видно`
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });

  test(`зазор кольца прозрачен, а не залит фоном (${theme})`, async ({ page }) => {
    await open(page, 'Button', { label: 'Выгрузить' }, { theme });
    const base = await token(page, '--bg-base', 'background-color');
    const btn = page.locator('#dc-root [data-btn]');
    await btn.focus();
    await page.keyboard.press('Tab'); // включаем клавиатурную модальность
    await btn.focus();
    const painted = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { shadow: cs.boxShadow, outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, offset: cs.outlineOffset };
    });
    expect(
      painted.shadow.includes(base.replace(/\s/g, '')) || painted.shadow.includes(base),
      `зазор залит цветом полотна (${base}): на карточке это светлое гало вокруг фокуса. Прозрачный зазор даёт outline-offset, а не второй слой тени`
    ).toBe(false);
    expect(painted.outline, 'кольцо обязано быть нарисовано — иначе фокуса не видно вовсе').not.toContain('0px');
    expect(parseFloat(painted.offset), 'без зазора кольцо сливается с самим контролом').toBeGreaterThan(0);
  });
}

test('сепаратор острова не режет кольцо сфокусированного ряда', async ({ page }) => {
  await open(
    page,
    'Island',
    {
      rows: [
        { type: 'toggle', label: 'Первый' },
        { type: 'toggle', label: 'Второй' },
        { type: 'toggle', label: 'Третий' },
      ],
    },
    { impl: 'react' }
  );
  // Клавиатурная модальность: кольцо ряда показывается только после Tab.
  await page.keyboard.press('Tab');
  const rows = page.locator('#dc-root [data-row]');
  await rows.nth(1).focus();

  const borders = await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('#dc-root [data-island] > *')];
    const i = wraps.findIndex((w) => w.querySelector('[data-row]:focus-visible'));
    const color = (el) => (el ? getComputedStyle(el).borderTopColor : null);
    return { own: color(wraps[i]), next: color(wraps[i + 1]), i };
  });

  expect(borders.i, 'ряд обязан получить фокус, иначе проверять нечего').toBeGreaterThan(-1);
  for (const [where, value] of [
    ['над самим рядом', borders.own],
    ['под ним', borders.next],
  ]) {
    expect(
      parseColor(value)?.[3] ?? 1,
      `линия ${where} перечёркивает inset-кольцо: гашение написано по ряду, у которого границы нет вовсе`
    ).toBe(0);
  }
});
