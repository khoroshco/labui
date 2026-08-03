/* Клавиатура вложенного контрола принадлежит ЕМУ, а не ряду.
 *
 * Ряд-переключатель сам себе контрол: у него своя роль, свой tabindex и свой обработчик
 * клавиш. Но внутри него живёт вторая кнопка — ⓘ. Событие с неё ВСПЛЫВАЕТ в ряд, и там
 * обработчик ряда делал две вещи разом: переключал ряд и гасил событие через
 * preventDefault. Второе отменяло активацию самой кнопки — то есть Enter на подсказке
 * переключал тоггл и НЕ открывал подсказку. Мышью всё работало: клик ряд у себя
 * отфильтровывал (fromInfo), а клавиатуру фильтровать забыли.
 *
 * Мышиный путь этот дефект не ловит по построению, а снимки — тем более: с виду ряд
 * исправен. Поэтому проверка отдельная и клавиатурная.
 */
import { expect, test } from '@playwright/test';
import { IMPLS, open } from '../support/browser.js';

/**
 * Дефекты ЗАМОРОЖЕННОГО эталона: он живёт под тегом ds-reference-v0, править его
 * компоненты запрещено, и этот же дефект в нём остаётся. Запись обязана ВОСПРОИЗВОДИТЬСЯ:
 * если эталон однажды перестанет ошибаться, гейт покраснеет и строка уйдёт — устаревшая
 * запись хуже отсутствующей, потому что выглядит как истина.
 */
const ETALON_BROKEN = {
  dc: 'эталон заморожен (ds-reference-v0): обработчик ряда ловит всплывшее событие ⓘ',
};

const ROWS = [
  { name: 'SwitchRow', role: 'switch' },
  { name: 'CheckboxRow', role: 'checkbox' },
];

for (const impl of IMPLS) {
  for (const { name, role } of ROWS) {
    for (const key of ['Enter', ' ']) {
      test(`${name}: «${key === ' ' ? 'Пробел' : key}» на ⓘ открывает подсказку и не трогает ряд (${impl})`, async ({
        page,
      }) => {
        await open(
          page,
          name,
          { label: 'Запекать в растр', info: 'Растр не даёт заменить текст после сборки.' },
          { impl }
        );

        const row = page.locator(`#dc-root [role="${role}"]`).first();
        const info = page.locator('#dc-root button[aria-expanded]').first();
        await expect(info, 'кнопка ⓘ обязана быть — иначе проверять нечего').toHaveCount(1);

        const before = await row.getAttribute('aria-checked');
        await info.focus();
        await page.keyboard.press(key === ' ' ? 'Space' : key);
        await page.waitForTimeout(120);

        const opened = await info.getAttribute('aria-expanded');
        const after = await row.getAttribute('aria-checked');

        if (ETALON_BROKEN[impl]) {
          // Запись из ledger'а обязана воспроизводиться, иначе она переживёт свою правду.
          expect(
            opened === 'true' && after === before,
            `${impl}: дефект больше не воспроизводится — вычеркни ${impl} из ETALON_BROKEN (${ETALON_BROKEN[impl]})`
          ).toBe(false);
          return;
        }

        expect(opened, 'клавиша на ⓘ обязана раскрыть подсказку — это её собственное действие').toBe('true');
        expect(after, 'ряд не должен переключаться от клавиши, нажатой на вложенной кнопке').toBe(before);
      });
    }
  }
}
