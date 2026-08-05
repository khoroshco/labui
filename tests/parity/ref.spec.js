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
 * Сверяем ТОЖДЕСТВО узла, а не имя тега: ref, уехавший на внутренний элемент того же тега
 * (корень острова против обёртки первого ряда — оба div), при сверке по тегу проходил.
 * Сравнение делается ВНУТРИ страницы: через границу теста узел не переносится.
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
  let checked = 0;
  for (const name of migrated) {
    const props = sharedProps(name, api);
    const q = `&props=${encodeURIComponent(JSON.stringify(props))}`;
    await page.goto(`/harness/?c=${name}&theme=dark&ref=1${q}`, { waitUntil: 'load' });
    await page.waitForSelector('#dc-root .sc-host', { state: 'attached' });
    await parkMouse(page);
    const got = await page.evaluate(() => {
      const node = window.__refNode ?? null;
      const root = document.querySelector('#dc-root .sc-host')?.firstElementChild ?? null;
      return {
        same: !!node && node === root,
        ref: node ? `${node.tagName?.toLowerCase()}${node.className ? '.' + String(node.className).slice(0, 20) : ''}` : 'ничего',
        root: root ? root.tagName.toLowerCase() : null,
      };
    });
    if (!got.root) {
      // Пусто — не повод пропустить молча: компонент, который однажды перестанет рисовать
      // корень, ушёл бы из гейта без следа. Считаем это находкой и требуем объяснения.
      problems.push(`${name}: компонент не отрисовал корня — проверять ref не на чем`);
      continue;
    }
    checked += 1;
    if (!got.same) problems.push(`${name}: ref отдал «${got.ref}», а корень — «${got.root}»`);
  }
  // Страховка от тихой пустоты: гейт обязан знать, скольких он проверил.
  expect(checked, 'проверено меньше компонентов, чем перенесено — часть выпала из гейта молча').toBe(migrated.length);
  expect(problems, 'ref обязан приезжать на корень компонента:\n  ' + problems.join('\n  ')).toEqual([]);
});
