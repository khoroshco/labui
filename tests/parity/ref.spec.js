/* REF ДОХОДИТ ДО КОРНЯ КОМПОНЕНТА.
 *
 * Потребителю ref нужен для обычных вещей: поставить фокус, измерить, показать поповер у
 * элемента. Без него это делается запросом по DOM из чужого кода — то есть системой
 * начинают пользоваться мимо контракта.
 *
 * Проверка отдельная и поведенческая, потому что НИ ОДИН другой гейт ref не видит: в DOM
 * он не атрибут, разметка с ним и без него одинакова, снимок тем более. Ошибка вида «ref
 * приняли, но никуда не поставили» прошла бы молча и обнаружилась бы у потребителя.
 *
 * Сверяем не «ref не пустой», а ТЕГ: узел обязан быть корнем компонента, а не любым
 * элементом внутри. Корень — первый элемент внутри .sc-host.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { open, parkMouse } from '../support/browser.js';
import { ROOT } from '../support/dc.js';
import { propsFor as sharedProps } from '../support/fixtures.js';

const api = JSON.parse(readFileSync(path.join(ROOT, 'api.react.json'), 'utf8'));
const migrated = JSON.parse(readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components;

test('каждый компонент отдаёт ref своего корня', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = [];
  for (const name of migrated) {
    const props = sharedProps(name, api);
    const q = `&props=${encodeURIComponent(JSON.stringify(props))}`;
    await page.goto(`/harness/?c=${name}&theme=dark&ref=1${q}`, { waitUntil: 'load' });
    await page.waitForSelector('#dc-root .sc-host', { state: 'attached' });
    await parkMouse(page);
    const got = await page.evaluate(() => {
      const w = window;
      const root = document.querySelector('#dc-root .sc-host')?.firstElementChild;
      return { ref: w.__refTag ?? null, root: root ? root.tagName.toLowerCase() : null };
    });
    if (!got.root) continue; // компонент имеет право отрисовать пусто (RowMsg без сообщения)
    if (got.ref !== got.root) {
      problems.push(`${name}: ref отдал «${got.ref ?? 'ничего'}», а корень — «${got.root}»`);
    }
  }
  expect(problems, 'ref обязан приезжать на корень компонента:\n  ' + problems.join('\n  ')).toEqual([]);
});
