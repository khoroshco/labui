/* КЛАВИШИ, КОТОРЫЕ ПРИНАДЛЕЖАТ НЕ НАМ.
 *
 * Три правила подсмотрены у Base UI и все три — про то, что система забирает у потребителя
 * поведение, на которое не имеет прав.
 *
 * 1. Enter НЕ переключает чекбокс и тумблер. У нативного чекбокса Enter отправляет форму,
 *    а переключает пробел. Мы перехватывали обе клавиши и гасили событие, то есть форма
 *    потребителя переставала отправляться с клавиатуры.
 * 2. Стрелка с модификатором принадлежит браузеру: Ctrl+стрелка и Alt+стрелка — это
 *    переключение вкладок и навигация по истории. Группы опций и лента вкладок звали
 *    preventDefault не глядя на модификаторы и съедали системные сочетания.
 * 3. Home и End у слайдера — часть паттерна WAI-ARIA, а у нас их не было вовсе.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

const react = { impl: 'react' };

for (const [name, role] of [
  ['Checkbox', 'checkbox'],
  ['Toggle', 'switch'],
  ['CheckboxRow', 'checkbox'],
  ['SwitchRow', 'switch'],
]) {
  test(`${name}: Enter не переключает, пробел переключает`, async ({ page }) => {
    await open(page, name, { label: 'Согласие', ariaLabel: 'Согласие' }, react);
    const el = page.locator(`#dc-root [role="${role}"]`).first();
    const before = await el.getAttribute('aria-checked');
    await el.focus();
    await page.keyboard.press('Enter');
    await expect(el, 'Enter принадлежит форме: у нативного чекбокса он отправляет её, а не переключает').toHaveAttribute(
      'aria-checked',
      before
    );
    await page.keyboard.press('Space');
    await expect(el, 'пробел — это переключение').not.toHaveAttribute('aria-checked', before);
  });
}

for (const [name, sel] of [
  ['OptionGroup', '[role="radio"]'],
  ['Tabs', '[role="tab"]'],
]) {
  test(`${name}: стрелка с модификатором остаётся браузеру`, async ({ page }) => {
    await open(page, name, { options: ['Первая', 'Вторая', 'Третья'] }, react);
    const items = page.locator(`#dc-root ${sel}`);
    await items.first().focus();
    const before = await items.nth(0).getAttribute(name === 'Tabs' ? 'aria-selected' : 'aria-checked');
    await page.keyboard.press('Control+ArrowRight');
    await expect(
      items.nth(0),
      'Ctrl+стрелка — переключение вкладок браузера; система не вправе её съедать'
    ).toHaveAttribute(name === 'Tabs' ? 'aria-selected' : 'aria-checked', before);
  });
}

test('Slider: Home и End доводят до краёв диапазона', async ({ page }) => {
  await open(page, 'Slider', { label: 'Кегль', min: 6, max: 14, defaultValue: 8 }, react);
  const w = page.locator('#dc-root [role="slider"]');
  await w.focus();
  await page.keyboard.press('End');
  await expect(w, 'End — часть паттерна WAI-ARIA для слайдера').toHaveAttribute('aria-valuenow', '14');
  await page.keyboard.press('Home');
  await expect(w).toHaveAttribute('aria-valuenow', '6');
});
