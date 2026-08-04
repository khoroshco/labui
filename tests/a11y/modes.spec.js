/* РЕЖИМЫ СИСТЕМЫ: «поменьше движения» и «свои цвета» не должны отбирать смысл.
 *
 * prefers-reduced-motion. Общее правило гасит все анимации до 0.01 мс. Там, где анимация
 * УКРАШАЕТ, это правильно; там, где она единственный носитель сообщения, — это отбирает
 * не движение, а само сообщение. Таких мест два. Упор в maxLength: событие о заблокированном
 * символе браузер не даёт вовсе, и кроме дрожания у поля нет никакой обратной связи —
 * ввод просто переставал приниматься молча. Спиннер кнопки: без вращения остаётся
 * статичная дуга, то есть «идёт работа» не сообщается ничем.
 *
 * forced-colors (Windows High Contrast). Режим подменяет цвета автора и ВЫРЕЗАЕТ тень.
 * Плавающие поверхности — тултип, тост, карточка пина — отделены от полотна именно тенью,
 * и без неё плашка сливается с тем, что под ней. Край возвращает граница: её режим
 * переживает.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

/**
 * Включить режим и УБЕДИТЬСЯ, что он включился.
 *
 * Контекстные опции Playwright (`test.use({ forcedColors })`) до страницы не доезжают, а
 * `open()` вдобавок переставляет медиа под свою тему. Молча выключенный режим — худший
 * исход из возможных: проверка зеленеет, ничего не проверив, и именно так выглядела бы
 * «поддержка forced-colors», которой в тестах не было ни строчки.
 */
async function mode(page, options, query) {
  await page.emulateMedia(options);
  const on = await page.evaluate((q) => matchMedia(q).matches, query);
  expect(on, `режим «${query}» не включился — проверка мерила бы обычную страницу`).toBe(true);
}

test.describe('prefers-reduced-motion', () => {

  test('упор в maxLength даёт обратную связь', async ({ page }) => {
    // freeze:false — заморозка оснастки перебила бы ровно то, что здесь проверяется
    await open(page, 'Input', { ariaLabel: 'erid', maxLength: 3, value: 'abc' }, { impl: 'react', freeze: false });
    await mode(page, { reducedMotion: 'reduce' }, '(prefers-reduced-motion: reduce)');
    const field = page.locator('#dc-root [data-field]');
    await page.locator('#dc-root input').focus();
    await page.keyboard.press('d'); // символ сверх предела: браузер молча его отбрасывает
    const anim = await field.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, duration: cs.animationDuration };
    });
    expect(anim.name, 'отказ ввода обязан быть показан — иначе поле молча перестаёт принимать').toContain('ds-shake');
    expect(
      parseFloat(anim.duration),
      'общее правило гасит анимацию до 0.01 мс, и обратной связи не остаётся вовсе'
    ).toBeGreaterThan(0.05);
  });

  test('спиннер кнопки продолжает вращаться', async ({ page }) => {
    await open(page, 'Button', { label: 'Выгрузить', loading: true }, { impl: 'react', freeze: false });
    await mode(page, { reducedMotion: 'reduce' }, '(prefers-reduced-motion: reduce)');
    // спиннер живёт по таймингам ДС — ждём, пока он появится
    const spinner = page.locator('#dc-root [data-btn] span[style*="ds-spin"]').first();
    await expect(spinner).toHaveCount(1, { timeout: 5000 });
    const anim = await spinner.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { count: cs.animationIterationCount, duration: cs.animationDuration };
    });
    expect(anim.count, 'один оборот за 0.01 мс — это статичная дуга, а не ожидание').toBe('infinite');
    expect(parseFloat(anim.duration), 'вращение мелкое и локальное: это существенное движение, оно остаётся').toBeGreaterThan(
      0.05
    );
  });
});

test.describe('forced-colors', () => {

  for (const { name, props, sel, pseudo } of [
    { name: 'Toast', props: { text: 'Готово', level: 'ok' }, sel: '[data-toast]' },
    { name: 'PinCard', props: { author: 'Марина Ковалёва', messages: [{ name: 'Марина', text: 'Поправил.' }] }, sel: '[data-float]' },
    { name: 'Button', props: { icon: 'gear', tooltip: 'Настройки' }, sel: '[data-tooltip]', pseudo: '::before' },
  ]) {
    test(`${name}: плавающая поверхность не сливается с полотном`, async ({ page }) => {
      await open(page, name, props, { impl: 'react' });
      await mode(page, { forcedColors: 'active' }, '(forced-colors: active)');
      const el = page.locator(`#dc-root ${sel}`).first();
      await expect(el, 'элемент обязан быть — иначе проверять нечего').toHaveCount(1);
      const px = await el.evaluate((node, p) => parseFloat(getComputedStyle(node, p || null).borderTopWidth), pseudo ?? '');
      expect(
        px,
        'режим вырезает тень: без границы плашка сливается с тем, что под ней, и её края не видно вовсе'
      ).toBeGreaterThan(0);
    });
  }
});
