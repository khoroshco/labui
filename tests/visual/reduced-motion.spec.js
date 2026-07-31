/* Снимок при prefers-reduced-motion обязан совпадать с обычным.
 *
 * Правило системы: при reduced-motion исчезают крупные перемещения, scale-пресс и пружины —
 * но КАРТИНКА в покое остаётся той же, а цвета и фокус-кольца не трогаются вовсе.
 *
 * До этого каждый reduced-motion-снимок сверялся с САМИМ СОБОЙ: ничто не сравнивало его с
 * обычной темой. Любая регрессия (пропавший элемент, невыключенный пресс, уехавшая
 * подложка) уехала бы в эталон при первом же --update-snapshots, не покраснев ни разу.
 *
 * Сравниваем не в браузере с компонентом, а сами файлы эталонов: это то, что гейт
 * действительно охраняет, и это не зависит от прогона.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/dc.js';

const DIR = path.join(ROOT, 'tests/__screenshots__');

/** Пары «обычный снимок → reduced-motion» для текущей платформы. */
function pairs() {
  const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(`-dark-chromium-${platform}.png`))
    .map((f) => ({
      name: f.replace(`-dark-chromium-${platform}.png`, ''),
      dark: path.join(DIR, f),
      reduced: path.join(DIR, f.replace('-dark-', '-reduced-motion-')),
    }))
    .filter((p) => fs.existsSync(p.reduced));
}

const ALL = pairs();

test('пары снимков есть — иначе гейт сравнивает пустоту', () => {
  expect(ALL.length).toBeGreaterThan(20);
});

test('reduced-motion не меняет картинку в покое', async ({ page }) => {
  // Порог измеренный: разница между парами — подпороговый шум субпиксельного сглаживания
  // (0, 1 и 0 отличающихся точек у Input, Segments и Tabs). Всё, что больше десятка, —
  // это уже элемент, а не сглаживание.
  const LIMIT = 10;
  await page.goto('about:blank');

  const problems = [];
  for (const { name, dark, reduced } of ALL) {
    const diff = await page.evaluate(
      async ([a, b]) => {
        const load = (src) =>
          new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = src;
          });
        const [x, y] = await Promise.all([load(a), load(b)]);
        if (x.width !== y.width || x.height !== y.height) return -1;
        const px = (img) => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, img.width, img.height).data;
        };
        const [p, q] = [px(x), px(y)];
        let n = 0;
        for (let i = 0; i < p.length; i += 4) {
          const d = Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
          if (d > 12) n++;
        }
        return n;
      },
      [`data:image/png;base64,${fs.readFileSync(dark).toString('base64')}`,
       `data:image/png;base64,${fs.readFileSync(reduced).toString('base64')}`]
    );
    if (diff === -1) problems.push(`${name}: разный размер снимка`);
    else if (diff > LIMIT) problems.push(`${name}: ${diff} отличающихся точек — это элемент, а не сглаживание`);
  }

  expect(problems, `reduced-motion изменил картинку в покое\n  ${problems.join('\n  ')}`).toEqual([]);
});
