/* Тост живёт положенное время — в том числе когда движение выключено.
 *
 * Автозакрытие висело на `animationend` полосы таймера, то есть КЛОК был анимацией. Под
 * `prefers-reduced-motion` глобальное правило гасит все анимации до 0.01 мс — полоса
 * добегала мгновенно, и тост исчезал сразу же. Сообщение уровня danger при этом было
 * нечитаемым в принципе: оно уходило раньше, чем его успевали заметить. То есть
 * настройка «поменьше движения» отбирала не движение, а СОДЕРЖАНИЕ.
 *
 * Здесь же второе требование того же класса: наведение обязано таймер останавливать —
 * иначе сообщение уезжает из-под курсора у того, кто как раз его читает (WCAG 2.2.1).
 *
 * Колбэк доезжает в компонент условным значением «@fn» и записывает свои вызовы в
 * window.__calls: снимком «когда сработало» не проверишь.
 */
import { expect, test } from '@playwright/test';
import { IMPLS, open } from '../support/browser.js';

const DURATION = 900;

/** Что и когда вызвал компонент. */
const calls = (page) => page.evaluate(() => window.__calls ?? []);

/**
 * Дефекты ЗАМОРОЖЕННОГО эталона (ds-reference-v0): править его компоненты запрещено.
 * Запись обязана ВОСПРОИЗВОДИТЬСЯ — иначе она переживёт свою правду.
 */
const ETALON_BROKEN = {
  dc: 'эталон заморожен: автозакрытие висит на animationend полосы',
};

for (const impl of IMPLS) {
  test(`Toast под prefers-reduced-motion живёт положенное время (${impl})`, async ({ browser }) => {
    // Движение выключено НА УРОВНЕ КОНТЕКСТА: правило ds.css читает медиа-запрос при
    // разборе таблицы, поэтому включать его после загрузки поздно.
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      // freeze: false — замораживать движение нельзя, тут именно оно и проверяется.
      await open(page, 'Toast', { text: 'Не удалось выгрузить', level: 'danger', duration: DURATION, onTimeout: '@fn' }, {
        impl,
        freeze: false,
      });
      await expect(page.locator('#dc-root [data-toast]')).toHaveCount(1);

      // Четверть срока: закрываться ещё нечему.
      await page.waitForTimeout(DURATION / 4);
      const early = await calls(page);

      if (ETALON_BROKEN[impl]) {
        expect(
          early.length,
          `${impl}: дефект больше не воспроизводится — вычеркни ${impl} из ETALON_BROKEN (${ETALON_BROKEN[impl]})`
        ).toBeGreaterThan(0);
        return;
      }

      expect(early, 'тост закрылся, не дожив до четверти срока: полоса добежала мгновенно, а с ней и таймер').toEqual([]);

      // Полный срок с запасом: закрыться обязан.
      await page.waitForTimeout(DURATION);
      expect(await calls(page), 'тост обязан закрыться сам — иначе он остаётся на экране навсегда').toHaveLength(1);
    } finally {
      await ctx.close();
    }
  });
}

test('Toast: наведение останавливает таймер (react)', async ({ page }) => {
  await open(page, 'Toast', { text: 'Готово', level: 'ok', duration: DURATION, onTimeout: '@fn' }, {
    impl: 'react',
    freeze: false,
  });
  const toast = page.locator('#dc-root [data-toast]');
  await toast.hover();
  // Полтора срока под курсором: без паузы тост давно бы закрылся.
  await page.waitForTimeout(DURATION * 1.5);
  expect(await calls(page), 'под курсором таймер обязан стоять: сообщение читают именно сейчас').toEqual([]);

  await page.mouse.move(10_000, 10_000);
  await page.waitForTimeout(DURATION);
  expect(await calls(page), 'курсор ушёл — отсчёт обязан продолжиться').toHaveLength(1);
});
