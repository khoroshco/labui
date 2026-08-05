/* РЕЖИМ УПРАВЛЕНИЯ ФИКСИРУЕТСЯ НА МОНТИРОВАНИИ И НЕ ПЛЫВЁТ.
 *
 * ADR 0011: признак управляемости — наличие значения. Но вычислять этот признак НА КАЖДОМ
 * РЕНДЕРЕ нельзя. Пока контрол управляем, своё состояние не обновляется вовсе; стоит
 * значению сверху стать undefined — условный рендер, сброс формы, `?? undefined` в
 * маппинге данных, — и контрол молча покажет то, что лежало в defaultValue С МОМЕНТА
 * МОНТИРОВАНИЯ. Это протухшее значение, и увидеть его нечем: разметка валидна, типы целы.
 *
 * Приём подсмотрен у Base UI: режим у них живёт в useRef, а смена режима — предупреждение
 * в консоли. Мы берём фиксацию режима; предупреждение — тем же способом, что уже принят
 * в Toggle для безымянного контрола.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

const react = { impl: 'react' };
const setProps = (page, patch) => page.evaluate((p) => window.__setProps(p), patch);

test('значение сверху ушло в undefined — контрол не откатывается на старый дефолт', async ({ page }) => {
  await open(page, 'Tabs', { value: 1, defaultValue: 0 }, react);
  const tabs = page.locator('#dc-root [role="tab"]');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

  // Родитель перестал передавать значение. Показывать defaultValue, замороженный на
  // монтировании, нельзя: это состояние, которого не было ни у кого на экране.
  await setProps(page, { value: undefined });
  await expect(
    tabs.nth(1),
    'контрол откатился на defaultValue с монтирования — потребитель видит протухшее значение'
  ).toHaveAttribute('aria-selected', 'true');
});

test('неуправляемый контрол ведёт своё и не слушает defaultValue после монтирования', async ({ page }) => {
  await open(page, 'Tabs', { defaultValue: 0 }, react);
  const tabs = page.locator('#dc-root [role="tab"]');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  // defaultValue — НАЧАЛЬНОЕ значение. Его изменение после монтирования не событие.
  await setProps(page, { defaultValue: 0 });
  await expect(tabs.nth(1), 'defaultValue после монтирования не имеет права сбрасывать выбор').toHaveAttribute(
    'aria-selected',
    'true'
  );
});
