/* Бюджет контраста: каждая пара «текстовый токен × поверхность» против WCAG AA.
 *
 * Это гейт на ТОКЕНАХ, а не на компонентах: контраст рождается в палитре, и чинить его
 * по одному компоненту бессмысленно. Пары, которые сегодня ниже нормы, перечислены в
 * contrast-budget.json с измеренным значением — гейт красный и на новом провале, и на
 * записи, которая больше не воспроизводится.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { contrast, flatten, open, parseColor } from '../support/browser.js';
import { ROOT } from '../support/dc.js';

const budget = JSON.parse(readFileSync(path.join(ROOT, 'tests/a11y/contrast-budget.json'), 'utf8'));

const TEXT = ['--text-primary', '--text-body', '--text-secondary', '--text-tertiary', '--danger', '--warn', '--ok', '--info', '--accent'];
const SURFACE = ['--bg-base', '--bg-surface', '--bg-raised', '--bg-float'];
const AA_NORMAL = 4.5;

for (const theme of ['dark', 'light']) {
  test(`контраст токенов ≥ ${AA_NORMAL}:1 (${theme})`, async ({ page }) => {
    await open(page, 'Button', null, { theme });

    const measured = await page.evaluate(
      ([texts, surfaces]) => {
        const read = (token, prop) => {
          const el = document.createElement('span');
          el.style.setProperty(prop, `var(${token})`);
          document.body.appendChild(el);
          const v = getComputedStyle(el)[prop];
          el.remove();
          return v;
        };
        const out = [];
        for (const s of surfaces) {
          const bg = read(s, 'background-color');
          for (const t of texts) out.push({ text: t, surface: s, fg: read(t, 'color'), bg });
        }
        return out;
      },
      [TEXT, SURFACE]
    );

    const rows = measured.map((m) => {
      const bg = parseColor(m.bg);
      const ratio = contrast(flatten(parseColor(m.fg), bg), bg);
      return { key: `${theme}/${m.text}/${m.surface}`, ratio: +ratio.toFixed(2) };
    });

    const below = rows.filter((r) => r.ratio < AA_NORMAL);
    const fresh = below.filter((r) => !budget.below[r.key]);
    expect(
      fresh.map((r) => `${r.key} = ${r.ratio}:1`),
      `новые пары ниже AA — палитра поехала:\n  ${fresh.map((r) => `${r.key} = ${r.ratio}:1`).join('\n  ')}`
    ).toEqual([]);

    const stale = Object.keys(budget.below)
      .filter((k) => k.startsWith(`${theme}/`))
      .filter((k) => !below.some((r) => r.key === k));
    expect(
      stale,
      'пара из бюджета дотянула до нормы — вычеркни строку из contrast-budget.json'
    ).toEqual([]);

    // расхождение с записанным значением больше 0.1 — палитру трогали, а бюджет нет
    const drifted = below
      .filter((r) => budget.below[r.key])
      .filter((r) => Math.abs(budget.below[r.key].ratio - r.ratio) > 0.1)
      .map((r) => `${r.key}: было ${budget.below[r.key].ratio}, стало ${r.ratio}`);
    expect(drifted, 'значения в бюджете разошлись с измеренными').toEqual([]);
  });
}
