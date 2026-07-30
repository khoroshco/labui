/* Оснастка обязана отдавать ДОМОНТИРОВАННОЕ дерево, даже когда сеть медленная.
 *
 * Рантайм DC тянет каждый вложенный компонент и каждую иконку отдельным запросом, поэтому
 * остров собирается волнами. Пока `open()` возвращал управление сразу, всякий гейт на этой
 * оснастке мог смотреть половину дерева: при задержке ответов в 200 мс у острова было 12
 * узлов вместо 119. Снимок такое переживает — он ждёт двух одинаковых кадров, — а сверка
 * разметки и axe нет: axe на половине дерева честно сообщает ноль нарушений.
 *
 * Так это и проявилось: гейт разметки упал на CI («эталон 38 узлов, React 44»), причём
 * упал ПОСЛЕ того, как стал чувствительнее. До этого он молча сравнивал недосчитанное.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';
import { FIXTURES } from '../support/fixtures.js';

const SLOW = 200; // задержка на каждый запрос компонента и иконки

test('остров домонтирован к возврату из open(), даже когда сеть медленная', async ({ page }) => {
  for (const pattern of ['**/*.dc.html', '**/svgs/*.svg']) {
    await page.route(pattern, async (route) => {
      await new Promise((r) => setTimeout(r, SLOW));
      await route.continue();
    });
  }

  await open(page, 'Island', FIXTURES.Island, { theme: 'dark', impl: 'dc' });

  const atReturn = await page.evaluate(() => document.querySelectorAll('#dc-root *').length);
  // остров из пяти рядов — заведомо больше сотни узлов; проверка не только на «стабильно»,
  // но и на «не пусто»: замершее пустое дерево тоже стабильно
  expect(atReturn, 'остров вернулся из open() недомонтированным').toBeGreaterThan(100);

  await page.waitForTimeout(2500);
  const later = await page.evaluate(() => document.querySelectorAll('#dc-root *').length);
  expect(later, 'после open() дерево ещё достраивалось').toBe(atReturn);
});
