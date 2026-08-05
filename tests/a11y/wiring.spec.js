/* СВЯЗНОСТЬ ФОРМЫ: ошибка привязана к полю, у группы есть имя, живых областей нет.
 *
 * Приём взят у Base UI. Там в формах НЕТ живых областей вовсе — `assertive` не встречается
 * во всей библиотеке. Ошибка привязана к контролу через aria-describedby, а на сабмите
 * фокус уезжает в первое невалидное поле: в любой момент объявляется ровно одна ошибка, и
 * объявляет её перемещение фокуса, а не диктор. Плюс ошибку можно услышать ПОВТОРНО,
 * вернувшись в поле, — живая область этого не умеет: прозвучала один раз и исчезла.
 *
 * У нас было наоборот: три невалидных ряда в острове — три assertive-области, срабатывающие
 * в один тик. Они перебивали друг друга и всё, что диктор читал в этот момент, а текст при
 * возврате в поле не звучал вовсе, потому что связи с полем не было.
 *
 * axe этого не ловит: aria-describedby необязателен, а имя у radiogroup формально тоже.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

const react = { impl: 'react' };

/** Ряды, которые рисуют сообщение валидации, и роль их носителя. */
const ROWS = [
  { name: 'InputRow', control: 'input', props: { label: 'erid', value: 'кир' } },
  { name: 'CheckboxRow', control: '[role="checkbox"]', props: { label: 'Согласие' } },
  { name: 'SwitchRow', control: '[role="switch"]', props: { label: 'Запекать' } },
];

for (const { name, control, props } of ROWS) {
  test(`${name}: сообщение привязано к контролу`, async ({ page }) => {
    const level = name === 'SwitchRow' ? 'warn' : 'danger';
    await open(page, name, { ...props, msg: 'Так делать нельзя', msgLevel: level }, react);
    const described = await page.locator(`#dc-root ${control}`).getAttribute('aria-describedby');
    expect(described, `${name}: без связи диктор скажет «недопустимое значение» и не скажет почему`).toBeTruthy();
    for (const id of described.split(' ').filter(Boolean)) {
      await expect(page.locator(`#dc-root [id="${id}"]`), `${name}: ссылка на несуществующий узел`).toHaveCount(1);
    }
    await expect(page.locator(`#dc-root [id="${described.split(' ')[0]}"]`)).toContainText('нельзя');
  });
}

test('ChoiceRow: у группы опций есть имя', async ({ page }) => {
  await open(page, 'ChoiceRow', { label: 'Тип выхода', options: ['Растр', 'Вектор'] }, react);
  const group = page.locator('#dc-root [role="radiogroup"]');
  const label = await group.getAttribute('aria-label');
  const by = await group.getAttribute('aria-labelledby');
  const named = !!label || (!!by && (await page.locator(`#dc-root [id="${by}"]`).count()) === 1);
  expect(named, 'безымянная группа: диктор скажет «Растр, переключатель, 1 из 2», а чего — неизвестно').toBe(true);
});

test('в рядах нет живых областей', async ({ page }) => {
  for (const { name, props } of ROWS) {
    await open(page, name, { ...props, msg: 'Так делать нельзя', msgLevel: 'danger' }, react);
    const live = await page.locator('#dc-root [aria-live="assertive"], #dc-root [role="alert"]').count();
    expect(live, `${name}: три ошибки на сабмите превратятся в три перебивающих друг друга объявления`).toBe(0);
  }
});
