/* Инвариант: ничьих пикселей нет (CLAUDE.md).
 *
 * Зазор между опциями принадлежит кнопкам, зона контрола растянута на высоту ряда,
 * а клик в любой точке ряда не вызывает ЧУЖОГО действия. Проверяем поведением, а не
 * геометрией: важно не «куда попал курсор», а «что произошло».
 *
 * Здесь же — инвариант про вложенные label: у ряда с ⓘ клик по подсказке когда-то и
 * раскрывал её, и флипал тоггл, потому что внешний label порождал второе активационное
 * событие с другим target.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

// Ряды и группы живут в островах шириной ~380–500px, а не во весь экран. Ширина здесь
// важна по делу: пресс уменьшает элемент на процент от ШИРИНЫ, и на 1280px этот процент
// превращается в десяток мёртвых пикселей у края — свойство масштаба, а не ряда.
test.use({ viewport: { width: 420, height: 400 } });

// Движение НЕ замораживаем: пресс — это transform со своим переходом, и остановленный
// переход применяет масштаб мгновенно и целиком. Тогда мышь нажимает по элементу, а
// отпускает уже мимо него — и тест обвиняет систему в том, что делает сам.
const live = { freeze: false };

/** Клик в точку и что после него стало с рядом. */
async function clickAt(page, x, y) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(80);
}

test('OptionGroup: зазор между опциями принадлежит кнопкам', async ({ page }) => {
  // начинаем с третьей опции: иначе «клик попал в первую» и «клик пропал» неразличимы
  await open(page, 'OptionGroup', { options: ['Первая', 'Вторая', 'Третья'], value: 2 }, live);

  const rects = await page.evaluate(() =>
    [...document.querySelectorAll('#dc-root [role="radio"], #dc-root button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
  );
  expect(rects.length, 'опции обязаны отрисоваться').toBeGreaterThanOrEqual(3);

  const gap = { from: rects[0].x + rects[0].w, to: rects[1].x, y: rects[0].y + rects[0].h / 2 };
  expect(gap.to - gap.from, 'между опциями должен быть зазор, иначе проверять нечего').toBeGreaterThan(0);

  // ни одного ничьего пикселя по всей ширине зазора
  const owners = await page.evaluate(
    ([from, to, y]) => {
      const out = [];
      for (let x = from; x <= to; x += 0.5) {
        const el = document.elementFromPoint(x, y);
        out.push({ x, owner: el?.closest('[role="radio"]') ? 'опция' : (el?.tagName ?? 'ничто') });
      }
      return out;
    },
    [gap.from, gap.to, gap.y]
  );
  const orphans = owners.filter((o) => o.owner !== 'опция');
  expect(orphans, `зазор принадлежит кнопкам целиком, а не контейнеру: ${JSON.stringify(orphans)}`).toEqual([]);

  await clickAt(page, (gap.from + gap.to) / 2, gap.y);
  const selected = await page.evaluate(
    () => [...document.querySelectorAll('#dc-root [aria-checked]')].findIndex((b) => b.getAttribute('aria-checked') === 'true')
  );
  expect([0, 1], 'клик в зазор обязан выбрать одного из соседей, а не пропасть впустую').toContain(selected);
});

test('SwitchRow: клик в любую точку ряда переключает ряд, а не что-то ещё', async ({ page }) => {
  await open(page, 'SwitchRow', { label: 'Запекать в растр', checked: false, info: 'Подсказка про растр' }, live);

  const row = await page.evaluate(() => {
    const r = document.querySelector('#dc-root [data-row], #dc-root [role="switch"]').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  const state = () =>
    page.evaluate(() => {
      const el = document.querySelector('#dc-root [role="switch"], #dc-root [aria-checked]');
      const info = document.querySelector('#dc-root button[aria-expanded]');
      return { checked: el?.getAttribute('aria-checked'), info: info?.getAttribute('aria-expanded') };
    });

  // точки по всей площади ряда, кроме зоны ⓘ
  const info = await page.evaluate(() => {
    const b = document.querySelector('#dc-root button[aria-expanded]');
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  });

  const points = [
    { x: row.x + 6, y: row.y + 4 },
    { x: row.x + 6, y: row.y + row.h - 4 },
    { x: row.x + row.w / 2, y: row.y + 4 },
    { x: row.x + row.w - 6, y: row.y + row.h / 2 },
    { x: row.x + row.w - 6, y: row.y + 4 },
  ].filter((p) => Math.abs(p.x - info.x) > info.w || Math.abs(p.y - info.y) > info.h);

  let expected = false;
  for (const p of points) {
    await clickAt(page, p.x, p.y);
    expected = !expected;
    const s = await state();
    expect(
      s.checked,
      `клик в (${Math.round(p.x - row.x)}, ${Math.round(p.y - row.y)}) от угла ряда не переключил ряд: ` +
        `значит там ничья зона или чужой обработчик`
    ).toBe(String(expected));
    expect(s.info, 'клик по ряду не имеет права раскрывать подсказку').toBe('false');
  }
});

test('SwitchRow: клик по ⓘ раскрывает подсказку и НЕ трогает переключатель', async ({ page }) => {
  await open(page, 'SwitchRow', { label: 'Запекать в растр', checked: false, info: 'Подсказка про растр' }, live);

  const before = await page.evaluate(() =>
    document.querySelector('#dc-root [role="switch"], #dc-root [aria-checked]')?.getAttribute('aria-checked')
  );
  await page.locator('#dc-root button[aria-expanded]').click();
  await page.waitForTimeout(120);

  const after = await page.evaluate(() => ({
    checked: document.querySelector('#dc-root [role="switch"], #dc-root [aria-checked]')?.getAttribute('aria-checked'),
    info: document.querySelector('#dc-root button[aria-expanded]')?.getAttribute('aria-expanded'),
  }));

  expect(after.info, 'подсказка обязана раскрыться').toBe('true');
  expect(
    after.checked,
    'справка — не действие: клик по ⓘ не переключает ряд (так ломался вложенный label)'
  ).toBe(before);
});

test('InputRow: зона ввода растянута на высоту ряда', async ({ page }) => {
  await open(page, 'InputRow', { label: 'Название', value: 'Осенний сейл' }, live);

  const row = await page.evaluate(() => {
    const r = document.querySelector('#dc-root [data-row], #dc-root > *').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  for (const y of [row.y + 3, row.y + row.h / 2, row.y + row.h - 3]) {
    await page.evaluate(() => document.activeElement?.blur());
    await clickAt(page, row.x + row.w - 12, y);
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused, `клик на высоте ${Math.round(y - row.y)} от верха ряда обязан ставить курсор в поле`).toBe('INPUT');
  }
});

test('нигде нет вложенных label: второе активационное событие проходит мимо гейта ⓘ', async ({ page }) => {
  for (const name of ['SwitchRow', 'CheckboxRow', 'InputRow', 'ChoiceRow', 'ActionRow']) {
    await open(page, name, { label: 'Ряд', info: 'Подсказка' }, live);
    const nested = await page.evaluate(() => document.querySelectorAll('#dc-root label label').length);
    expect(nested, `${name}: корень ряда обязан быть div, а не label`).toBe(0);
  }
});
