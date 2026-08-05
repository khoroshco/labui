/* ПОВЕРХНОСТЬ, ОБРАЩЁННАЯ К ПОТРЕБИТЕЛЮ.
 *
 * Тимлид продуктовой команды собрал на системе настоящее приложение и упёрся в вещи,
 * которых не видел ни один гейт: остров молча выбрасывал детей (причём проверку типов это
 * ПРОХОДИЛО), у рядов не было ни id, ни data-*, поле не имело name — значит ни FormData,
 * ни менеджера паролей, — а сообщение об ошибке не было связано с полем, и скринридер на
 * возврате говорил «недопустимое значение», не говоря почему.
 *
 * Всё это невидимо снимку и разбору контракта: рендерится похоже, ломается у потребителя.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

const react = { impl: 'react' };

test('Island: каналы наружу доезжают до КОРНЯ ряда', async ({ page }) => {
  await open(
    page,
    'Island',
    {
      rows: [
        { type: 'text', label: 'Кампания', value: 'Осенний сейл', id: 'row-name', 'data-testid': 'name' },
        { type: 'toggle', label: 'Растр', className: 'my-row' },
      ],
    },
    react
  );
  const first = page.locator('#dc-root #row-name');
  await expect(first, 'id ряда обязан доехать: без него к невалидному полю не проскроллить').toHaveCount(1);
  await expect(first).toHaveAttribute('data-testid', 'name');
  await expect(first, 'канал должен быть на КОРНЕ ряда, а не на вложенном узле').toHaveAttribute('data-row', 'true');
  await expect(page.locator('#dc-root .my-row')).toHaveCount(1);
});

test('Island: ряд, принесённый потребителем, получает ту же обёртку-маунт', async ({ page }) => {
  // Конфиг покрывает пять типовых рядов. Всё остальное потребитель приносит сам, и остров
  // обязан дать ему обёртку: иначе сепараторы и радиусы крайних рядов придётся
  // воспроизводить копированием ds.css.
  await open(page, 'Island', { rows: [{ type: 'text', label: 'Кампания' }], children: '@slot' }, react);
  const mounts = page.locator('#dc-root [data-island] > *');
  await expect(mounts, 'детей острова раньше выбрасывало молча, и это проходило проверку типов').toHaveCount(2);
  await expect(page.locator('#dc-root [data-slot]')).toHaveCount(1);
});

test('InputRow: сообщение об ошибке связано с полем', async ({ page }) => {
  await open(
    page,
    'InputRow',
    { label: 'erid', value: 'кир', msg: 'Токен — латиница и цифры', msgLevel: 'danger' },
    react
  );
  const described = await page.locator('#dc-root input').getAttribute('aria-describedby');
  expect(described, 'без связи скринридер скажет «недопустимое значение» и не скажет почему').toBeTruthy();
  await expect(page.locator(`#dc-root [id="${described.split(' ')[0]}"]`)).toContainText('латиница');
});

test('Input: нативные атрибуты формы доезжают до input', async ({ page }) => {
  await open(
    page,
    'Input',
    { ariaLabel: 'Почта', name: 'email', type: 'email', autoComplete: 'email', required: true },
    react
  );
  const input = page.locator('#dc-root input');
  // Без name нет ни FormData, ни автозаполнения, ни менеджера паролей: браузеру не за что
  // зацепиться, и экран логина на системе не собрать.
  await expect(input).toHaveAttribute('name', 'email');
  await expect(input).toHaveAttribute('type', 'email');
  await expect(input).toHaveAttribute('autocomplete', 'email');
  await expect(input).toHaveAttribute('required', '');
});
