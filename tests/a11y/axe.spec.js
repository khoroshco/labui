/* Доступность: axe-core по каждой странице системы, в обеих темах.
 *
 * Стандарт — WCAG 2.1 AA, ноль нарушений. Компонент, который нельзя объявить доступным,
 * нельзя объявить и готовым: у системы нет экрана, где это можно было бы «дочинить потом».
 *
 * Второй движок (pa11y / HTML_CodeSniffer) гоняется отдельно — npm run test:a11y. Движки
 * ловят разное: axe проверяет вычисленное дерево, CodeSniffer — разметку по буквам техник.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dcPages, ROOT } from '../support/dc.js';
import { open } from '../support/browser.js';

/** Ledger известных нарушений: гейт красный на всём, чего в нём нет, и на том,
 *  что в нём есть, но больше не воспроизводится. */
const KNOWN = JSON.parse(readFileSync(path.join(ROOT, 'tests/a11y/known-violations.json'), 'utf8')).known;

const FIXTURES = {
  Island: {
    rows: [
      { type: 'text', label: 'Название', value: 'Осенний сейл' },
      { type: 'toggle', label: 'Запекать в растр', checked: true },
      { type: 'segmented', label: 'Формат', options: ['JPG', 'PNG'], value: 0 },
      { type: 'action', label: 'Выгрузить' },
    ],
  },
  PinCard: {
    author: 'Марина Ковалёва',
    messages: [{ name: 'Марина Ковалёва', text: 'Логотип уезжает за охранное поле.' }],
  },
  OptionGroup: { options: ['JPG', 'PNG', 'WEBP'], value: 0 },
  // Подпись поля лежит снаружи компонента, поэтому имя приходит пропом — то же правило,
  // что у Toggle и Checkbox. Компонент без имени и не должен считаться доступным.
  Input: { ariaLabel: 'Название кампании' },
};

for (const { name, file } of dcPages()) {
  for (const theme of ['dark', 'light']) {
    test(`${file} · ${theme}`, async ({ page }) => {
      await open(page, name, FIXTURES[name] ?? null, { theme });

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .include('#dc-root')
        .analyze();

      const seen = violations.map((v) => `${name}/${theme}/${v.id}`);
      const fresh = violations.filter((v) => !KNOWN[`${name}/${theme}/${v.id}`]);
      const readable = fresh.map(
        (v) => `${v.id} (${v.impact}): ${v.help}\n      ${v.nodes.map((n) => n.html.slice(0, 120)).join('\n      ')}`
      );
      expect(readable, `${name}/${theme}: новые нарушения доступности\n  ${readable.join('\n  ')}`).toEqual([]);

      const stale = Object.keys(KNOWN)
        .filter((k) => k.startsWith(`${name}/${theme}/`))
        .filter((k) => !seen.includes(k));
      expect(
        stale,
        `${name}/${theme}: нарушение из ledger больше не воспроизводится — вычеркни строку ` +
          `из tests/a11y/known-violations.json, иначе она переживёт свою правду`
      ).toEqual([]);
    });
  }
}
