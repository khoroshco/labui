/* Визуальные снапшоты: каждый компонент в обеих темах и при prefers-reduced-motion.
 *
 * Это единственный гейт, который ловит «одинаковое выглядит одинаково» и вообще всё,
 * что не выражается числом: оптику, тон, геометрию, состояния. Снапшоты обновляются
 * ТОЛЬКО осознанно и только посмотрев на диффы — иначе гейт превращается в штамп.
 *
 * Снимок берётся с #dc-root, а не со страницы целиком: так дифф показывает компонент,
 * а не поля вокруг него. Движение останавливается дважды: встроенным animations:'disabled'
 * и своим стилем-заморозкой — без второго кадр не устаканивается у Skeleton (бесконечная
 * пульсация), Island и PinCard, и снимок ждёт двух одинаковых кадров до таймаута.
 */
import { expect, test } from '@playwright/test';
import { dcPages } from '../support/dc.js';
import { open } from '../support/browser.js';
import { FIXTURES } from '../support/fixtures.js';

const components = dcPages()
  .filter((p) => p.file.startsWith('src/'))
  .map((p) => p.name);


for (const name of components) {
  for (const theme of ['dark', 'light']) {
    test(`${name} · ${theme}`, async ({ page }) => {
      await open(page, name, FIXTURES[name] ?? null, { theme });
      await expect(page.locator('#dc-root')).toHaveScreenshot(`${name}-${theme}.png`, {
        animations: 'disabled',
        threshold: 0.01,
        maxDiffPixels: 10,
      });
    });
  }

  test(`${name} · reduced-motion`, async ({ page }) => {
    // Уважение к prefers-reduced-motion — часть контракта: крупные перемещения, пресс и
    // пружины заменяются фейдами, а цвет и фокус остаются. Картинка обязана остаться той же.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, name, FIXTURES[name] ?? null, { theme: 'dark' });
    await expect(page.locator('#dc-root')).toHaveScreenshot(`${name}-reduced-motion.png`, {
      animations: 'disabled',
      threshold: 0.01,
        maxDiffPixels: 10,
    });
  });
}
