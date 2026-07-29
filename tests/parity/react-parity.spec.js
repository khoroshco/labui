/* Паритетный харнесс: React-версия против замороженного эталона (тег ds-reference-v0).
 *
 * Сравнение идёт не «на глаз» и не с человеческой памятью, а с теми же файлами эталонов,
 * которые снял снапшот-тест с DC-версии. Компонент считается мигрированным, только когда
 * его React-версия воспроизводит эталон в обеих темах.
 *
 * Порядок миграции — снизу вверх по графу зависимостей: молекула из немигрированных
 * атомов не проверяет ничего.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/dc.js';
import { FIXTURES } from '../support/fixtures.js';
import { freezeMotion, setTheme } from '../support/browser.js';
import { preparePage } from '../support/dc.js';

const api = JSON.parse(readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const migrated = JSON.parse(readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components;

/** Дефолты из контракта — ровно то, с чем DC-страница снимала эталон. */
function propsFor(name) {
  const c = api.components.find((x) => x.name === name);
  const defaults = Object.fromEntries(
    (c?.props ?? []).filter((p) => p.default !== undefined).map((p) => [p.name, p.default])
  );
  return { ...defaults, ...(FIXTURES[name] ?? {}) };
}

test('список мигрированных компонентов не пуст и состоит из существующих', () => {
  expect(migrated.length).toBeGreaterThan(0);
  const known = new Set(api.components.map((c) => c.name));
  expect(migrated.filter((n) => !known.has(n))).toEqual([]);
});

for (const name of migrated) {
  for (const theme of ['dark', 'light']) {
    test(`${name} · ${theme} совпадает с эталоном`, async ({ page }) => {
      const { errors } = preparePage(page);
      const props = encodeURIComponent(JSON.stringify(propsFor(name)));
      await page.goto(`/harness/?c=${name}&theme=${theme}&props=${props}`, { waitUntil: 'load' });
      await page.waitForSelector('#dc-root .sc-host > *');
      await freezeMotion(page);
      await setTheme(page, theme);
      await page.waitForTimeout(120);

      expect(errors, `${name}/${theme}: React-версия загрузилась не чисто\n${errors.join('\n')}`).toEqual([]);

      const shot = await page.locator('#dc-root').screenshot({ animations: 'disabled' });
      // Порог тот же, что у снапшотов DC: «выглядит похоже» не считается.
      expect(shot).toMatchSnapshot(`${name}-${theme}.png`, { maxDiffPixelRatio: 0.002 });
    });
  }
}
