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
import { IMPLS, open } from '../support/browser.js';
import { PORTALED, propsFor } from '../support/fixtures.js';

/** Ledger известных нарушений: гейт красный на всём, чего в нём нет, и на том,
 *  что в нём есть, но больше не воспроизводится. */
const KNOWN = JSON.parse(readFileSync(path.join(ROOT, 'tests/a11y/known-violations.json'), 'utf8')).known;
const api = JSON.parse(readFileSync(path.join(ROOT, 'api.json'), 'utf8'));

const migrated = new Set(
  JSON.parse(readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components
);

// По ОБЕИМ реализациям. До этого axe ходил только по эталону — то есть вычисленное дерево
// доступности у того, что уезжает потребителю, не проверял никто: второй движок (pa11y)
// видел шесть компонентов из двадцати семи, а имя контрола он считает по разметке, а не
// по вычисленному имени. Витрина есть только в DC, поэтому её проверяем как страницу.
//
// Состав REACT-стороны берётся из ЕГО контракта, а не из пересечения с эталоном. Раньше
// стоял фильтр по migrated.json, то есть по списку принятых паритетом: компонент, у
// которого эталона нет по построению (эталон заморожен и расти не может), не проверялся
// на доступность вообще — ни одним из двух движков, и молча.
const reactApi = JSON.parse(readFileSync(path.join(ROOT, 'api.react.json'), 'utf8'));
const CASES = [
  ...dcPages().map(({ name, file }) => ({ name, file, impl: 'dc' })),
  ...reactApi.components.map((c) => ({ name: c.name, file: c.file, impl: 'react' })),
];
// Страховка от тихой пустоты: список, собравшийся не из того места, дал бы зелёную сюиту.
test('состав проверок доступности собран', () => {
  expect(CASES.filter((c) => c.impl === 'dc').length, 'страниц эталона не найдено').toBeGreaterThan(20);
  expect(CASES.filter((c) => c.impl === 'react').length, 'React-контракт пуст').toBeGreaterThan(20);
  expect(IMPLS.length, 'реализаций две — иначе матрица собрана не из того места').toBe(2);
  expect([...migrated].length, 'список принятых паритетом пуст').toBeGreaterThan(20);
});

for (const { name, file, impl } of CASES) {
  {
  for (const theme of ['dark', 'light']) {
    test(`${file} · ${theme}${impl === 'react' ? ' · react' : ''}`, async ({ page }) => {
      await open(page, name, propsFor(name, api), { theme, impl });

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Компонент в портале живёт не внутри корня: сузив область до #dc-root, движок
        // проверил бы пустой узел и честно доложил ноль нарушений.
        .include(PORTALED.has(name) ? 'body' : '#dc-root')
        .analyze();

      // Записи ledger'а сверяются ПО ЧИСЛУ УЗЛОВ, а не по одному id правила. С одним id
      // запись «контраст у счётчика вкладки» покрывала бы и любой новый узел того же
      // класса — покрасить опцию в --warn и потерять контраст можно было бы бесшумно
      // (проверено). Число — не придирка: именно она отличает принятое решение от нового
      // долга, приехавшего под его прикрытием.
      const seen = new Map(violations.map((v) => [`${name}/${theme}${impl === 'react' ? '/react' : ''}/${v.id}`, v.nodes.length]));
      const problems = [];
      for (const v of violations) {
        const key = `${name}/${theme}${impl === 'react' ? '/react' : ''}/${v.id}`;
        const known = KNOWN[key];
        const where = v.nodes.map((n) => n.html.slice(0, 120)).join('\n      ');
        if (!known) {
          problems.push(`${v.id} (${v.impact}): ${v.help}\n      ${where}`);
        } else if (v.nodes.length !== known.nodes) {
          problems.push(
            `${v.id}: узлов ${v.nodes.length}, в ledger записано ${known.nodes} — ` +
              `нарушение того же класса приехало на новый узел или уехало с прежнего.\n      ${where}`
          );
        }
      }
      expect(problems, `${name}/${theme}: доступность разошлась с ledger'ом\n  ${problems.join('\n  ')}`).toEqual([]);

      const stale = Object.keys(KNOWN)
        // Префикс DC-ключа («Tabs/light/») совпадает и с React-ключом («Tabs/light/react/»),
        // поэтому хвост обязан быть ровно одним сегментом — id правила
        .filter((k) => {
          const prefix = `${name}/${theme}${impl === 'react' ? '/react' : ''}/`;
          return k.startsWith(prefix) && !k.slice(prefix.length).includes('/');
        })
        .filter((k) => !seen.has(k));
      expect(
        stale,
        `${name}/${theme}: нарушение из ledger больше не воспроизводится — вычеркни строку ` +
          `из tests/a11y/known-violations.json, иначе она переживёт свою правду`
      ).toEqual([]);
    });
  }
  }
}
