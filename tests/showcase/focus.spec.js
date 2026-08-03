/* ВИТРИНА: клавиатура не должна проваливаться в невидимое.
 *
 * Чего это стоило. Свёрнутая раскрывашка прячет содержимое высотой (grid-rows:0fr плюс
 * overflow:hidden) — пиксели исчезают, УЗЛЫ остаются. Значит остаются и в порядке таба, и
 * в дереве доступности. В витрине под каждым компонентом лежит блок «Примеры», а в нём —
 * живые кнопки, поля и слайдеры. Человек табал по панели острова и после неё получал
 * полтора десятка нажатий в никуда: фокус шёл по инпутам и слайдерам, которых не видно, и
 * до следующей кнопки не доходил. Со стороны это выглядит как «таб пропускает кнопку».
 *
 * Проверяем ПОВЕДЕНИЕМ, а не разметкой: гейт проходит по табу и смотрит, куда фокус
 * реально встаёт. Тогда он не знает и не должен знать, чем починено — inert, hidden или
 * снятием узлов; он знает только, что фокус не уходит в невидимое и доходит до видимого.
 *
 * Витрина — единственная поверхность, где компоненты стоят в настоящей композиции, и до
 * этого гейта её не открывал ни один браузерный тест.
 */
import { expect, test } from '@playwright/test';
import { SHOWCASE_URL } from '../../playwright.config.js';

// Уровни витрины: каждый показывает свой набор разделов, и таб-порядок у каждого свой.
const LEVELS = ['Примитивы', 'Атомы', 'Молекулы', 'Организмы', 'Сценарии'];

/** Всё, что браузер отдаёт табу. */
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Открыть витрину на нужном уровне, дождаться сборки и пометить узлы. */
async function openLevel(page, level) {
  await page.goto(SHOWCASE_URL, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('radio', { name: level, exact: true }).click();
  // пилюля уровня едет пружиной, разделы монтируются пачкой — ждём тишины
  await page.waitForTimeout(400);
  // Метим узлы: сравнивать элементы через границу теста нечем, а имён у половины из них нет.
  await page.evaluate(() => {
    let i = 0;
    for (const el of document.querySelectorAll('*')) el.setAttribute('data-tab-probe', String(i++));
  });
}

/** Что видно на странице и должно доставаться с клавиатуры. */
function visibleControls(page) {
  return page.evaluate((sel) => {
    /** Свёрнутая область: высота строки грида ровно ноль, содержимое срезано overflow. */
    const collapsed = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (getComputedStyle(a).gridTemplateRows === '0px') return true;
      }
      return false;
    };
    return [...document.querySelectorAll(sel)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        if (collapsed(el)) return false;
        // Роуминг — норма ARIA: в группе опций и в ленте вкладок таб видит одну кнопку,
        // между остальными ходят стрелки. Это не пропажа, а способ навигации.
        const role = el.getAttribute('role');
        return role !== 'radio' && role !== 'tab';
      })
      .map((el) => ({
        id: el.getAttribute('data-tab-probe'),
        what: `${el.closest('section')?.id ?? '—'} · ${el.tagName} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}»`,
      }));
  }, FOCUSABLE);
}

/** Полный круг по табу: где фокус побывал и что это было. */
async function tabWalk(page, limit) {
  const stops = [];
  const seen = new Set();
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const r = el.getBoundingClientRect();
      let hiddenBy = '';
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (getComputedStyle(a).gridTemplateRows === '0px') {
          hiddenBy = 'свёрнутая раскрывашка';
          break;
        }
      }
      return {
        id: el.getAttribute('data-tab-probe'),
        visible: r.width >= 1 && r.height >= 1 && !hiddenBy,
        hiddenBy,
        what: `${el.closest('section')?.id ?? '—'} · ${el.tagName} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}»`,
      };
    });
    if (!stop) continue; // фокус ушёл в браузерную обвязку — не наше дело
    if (seen.has(stop.id)) break; // круг замкнулся
    seen.add(stop.id);
    stops.push(stop);
  }
  return { stops, seen };
}

for (const level of LEVELS) {
  test(`витрина, ${level}: таб не встаёт на невидимое и доходит до видимого`, async ({ page }) => {
    await openLevel(page, level);

    const expected = await visibleControls(page);
    expect(expected.length, 'видимых контролов обязано быть много — иначе витрина не собралась').toBeGreaterThan(0);

    const { stops, seen } = await tabWalk(page, expected.length * 2 + 80);

    const blind = stops.filter((s) => !s.visible).map((s) => `${s.what} — ${s.hiddenBy || 'нулевая рамка'}`);
    expect(
      blind,
      'таб встал туда, где ничего не видно: человек жмёт клавишу вслепую и до следующей кнопки не доходит'
    ).toEqual([]);

    const missed = expected.filter((x) => !seen.has(x.id)).map((x) => x.what);
    expect(missed, 'видно, а табом не достаётся — до контрола нельзя дойти с клавиатуры').toEqual([]);
  });
}

test('витрина: загрузка без ошибок в консоли', async ({ page }) => {
  const bad = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') bad.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`));
  await page.goto(SHOWCASE_URL, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  for (const level of LEVELS) {
    await page.getByRole('radio', { name: level, exact: true }).click();
    await page.waitForTimeout(300);
  }
  expect(bad, 'витрина обязана открываться чисто на каждом уровне').toEqual([]);
});
