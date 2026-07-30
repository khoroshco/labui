/* Smoke: каждая DC-страница системы грузится без единой ошибки.
 *
 * Самый дешёвый гейт с самой высокой отдачей в AI-only репозитории. Ловит ровно то,
 * что ломается молча: битый путь после перекладки файлов, отвалившийся шрифт,
 * гонку при монтировании, компонент, который не смонтировался вовсе. */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dcPages, openDc, preparePage, ROOT, unicaFaces } from '../support/dc.js';
import { setProps } from '../support/browser.js';
import { FIXTURES } from '../support/fixtures.js';

const pages = dcPages();
const KNOWN_HOLES = JSON.parse(
  readFileSync(path.join(ROOT, 'tests/smoke/known-template-holes.json'), 'utf8')
).known;

test('в системе есть страницы для проверки', () => {
  // защита от «зелено, потому что нечего проверять»: карта пуста — гейт бессмыслен
  expect(pages.length).toBeGreaterThan(20);
});

for (const { url, file, name } of pages) {
  test(`грузится чисто: ${file}`, async ({ page }) => {
    const { errors, holes } = preparePage(page);

    await openDc(page, url);

    // корень смонтирован — иначе «нет ошибок» означало бы «нет и страницы»
    const mounted = await page.locator('#dc-root > *').count();
    expect(mounted, `${name}: рантайм не смонтировал компонент`).toBeGreaterThan(0);

    // …и НАРИСОВАЛ что-то. «Смонтировался» и «видно» — разные факты: у острова без рядов
    // два узла при нулевой высоте, и такой страницы гейт не отличал от рабочей. Тем, у кого
    // дефолтов не хватает на картинку, состояние даёт та же фикстура, что и остальным гейтам.
    if (FIXTURES[name]) await setProps(page, FIXTURES[name]);
    const box = await page.locator('#dc-root').boundingBox();
    expect(box?.height ?? 0, `${name}: компонент смонтирован, но не нарисовал ничего`).toBeGreaterThan(4);
    // рантайм не свалился в заглушку с текстом ошибки вместо самого компонента
    await expect(
      page.locator('#dc-root .sc-logic-error, #dc-root .sc-placeholder-error'),
      `${name}: рантайм показал заглушку с ошибкой вместо компонента`
    ).toHaveCount(0);

    // Шрифт. Отвал @font-face не роняет страницу — система молча уезжает на системный
    // шрифт, и вместе с ним едут метрики и вся оптическая центровка.
    const faces = await unicaFaces(page);
    expect(faces, `${name}: три начертания Unica 77 обязаны быть объявлены и загружены`).toEqual({
      total: 3,
      loaded: 3,
      errored: 0,
    });

    expect(errors, `${name}: страница загрузилась не чисто\n${errors.join('\n')}`).toEqual([]);

    // Известные холы (см. known-template-holes.json) допустимы, новые — нет:
    // новый хол это либо опечатка в шаблоне, либо значение, которого больше нет.
    const fresh = [...holes].filter((h) => !KNOWN_HOLES.includes(h));
    expect(fresh, `${name}: неизвестный неразрешённый хол шаблона ушёл в сеть`).toEqual([]);
  });
}
