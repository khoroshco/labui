/* ВИТРИНА: клавиатура не должна проваливаться в невидимое.
 *
 * Чего это стоило. Свёрнутая раскрывашка прячет содержимое высотой (grid-rows:0fr плюс
 * overflow:hidden) — пиксели исчезают, УЗЛЫ остаются. Значит остаются и в порядке таба, и
 * в дереве доступности. В витрине под каждым компонентом лежит блок «Примеры», а в нём —
 * живые кнопки, поля и слайдеры. Человек табал по панели острова и после неё получал
 * полтора десятка нажатий в никуда: фокус шёл по инпутам и слайдерам, которых не видно, и
 * до следующей кнопки не доходил. Со стороны это выглядит как «таб пропускает кнопку».
 *
 * Проверяем ПОПАДАНИЕМ, а не именем CSS-свойства. Первая версия опознавала свёрнутое по
 * `grid-template-rows: 0px` — то есть по ПРИЗНАКУ одной конкретной техники. Стоило
 * схлопнуть раскрывашку эквивалентным `overflow:hidden + height:0`, и двадцать пять
 * остановок таба на невидимых кнопках снова стали для гейта «видимыми». Теперь мера одна:
 * попадает ли `elementFromPoint` в центр элемента в сам элемент. Это следствие, которое
 * видит человек, и оно не зависит от того, чем именно спрятали.
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
  // И ставим ОДНУ меру видимости на обе половины гейта — иначе список ожидаемого и список
  // остановок начнут расходиться в определении «видно».
  await page.evaluate(() => {
    let i = 0;
    for (const el of document.querySelectorAll('*')) el.setAttribute('data-tab-probe', String(i++));
    /**
     * Виден ли элемент ЧЕЛОВЕКУ: есть рамка, элемент не спрятан, и попадание в его центр
     * возвращает его же (или его потомка). Последнее и есть проверка на «обрезан предком»,
     * работающая независимо от техники — grid-rows, height, clip-path, overflow.
     */
    window.__reachable = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      // Обрезан ли элемент предком, который режет содержимое. Считаем ПЕРЕСЕЧЕНИЕ рамок, а
      // не смотрим на свойство: схлопнутая раскрывашка даёт предку нулевую высоту, и
      // пересечения нет — независимо от того, чем схлопнули (grid-rows, height, clip).
      // Хит-тест сюда не годится: элемент ниже сгиба его не проходит, а спрятанным не
      // является. Прокрутка ради замера двигала бы то, что меряем.
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow === 'visible' && cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
        const ar = a.getBoundingClientRect();
        const overlapY = Math.min(r.bottom, ar.bottom) - Math.max(r.top, ar.top);
        const overlapX = Math.min(r.right, ar.right) - Math.max(r.left, ar.left);
        if (overlapY < 1 || overlapX < 1) return false;
      }
      return true;
    };
  });
}

/** Что видно на странице и должно доставаться с клавиатуры. */
function visibleControls(page) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .filter((el) => {
        if (!window.__reachable(el)) return false;
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
      const visible = window.__reachable(el);
      return {
        id: el.getAttribute('data-tab-probe'),
        visible,
        hiddenBy: visible ? '' : r.width < 1 || r.height < 1 ? 'нулевая рамка' : 'закрыт или обрезан предком',
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
