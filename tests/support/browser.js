/* Оснастка браузерных тестов: открыть компонент, загнать его в нужное состояние, померить.
 *
 * Состояния задаются через __dcSetProps — это документированный мост рантайма (тот самый,
 * которым в компонент едут пропсы из редактора). Поэтому тест смотрит на настоящий компонент
 * в настоящем DOM, а не на его копию, собранную ради теста.
 */
import { openDc, preparePage } from './dc.js';

/**
 * Открыть страницу компонента и вернуть копилку ошибок.
 *
 * `impl` выбирает реализацию: 'dc' — замороженный эталон, 'react' — то, что уезжает
 * потребителю. Инварианты обязаны проверяться на ОБЕИХ: ревью показало, что гейт,
 * ходящий только по эталону, пропустил сломанный потолок яркости в семи React-компонентах
 * и вложенный label в React-ряду.
 */
export async function open(page, name, props = null, { theme = 'dark', freeze = true, impl = 'dc' } = {}) {
  const bag = preparePage(page);
  await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' });
  if (impl === 'react') {
    const q = props ? `&props=${encodeURIComponent(JSON.stringify(props))}` : '';
    await page.goto(`/harness/?c=${name}&theme=${theme}${q}`, { waitUntil: 'load' });
    await page.waitForSelector('#dc-root .sc-host > *');
    // Ждём шрифт: без этого измерения попадают на подменный шрифт, и надпись оказывается
    // на 2.5px шире — сравнение геометрии превращается в лотерею.
    await page.evaluate(() => document.fonts.ready);
    if (freeze) await freezeMotion(page);
    await setTheme(page, theme);
    await settle(page);
    return bag;
  }
  await openDc(page, `/${name}.dc.html`);
  await page.evaluate(() => document.fonts.ready);
  if (freeze) await freezeMotion(page);
  await setTheme(page, theme);
  // Пустой набор — не повод перерисовывать: __dcSetProps перемонтирует дерево, и витрина
  // при этом сбрасывается на первую секцию (axe видел 1 узел вместо 187).
  if (props && Object.keys(props).length) await setProps(page, props);
  await settle(page);
  return bag;
}

/**
 * Дождаться, когда дерево перестанет меняться.
 *
 * Рантайм DC монтирует каждый вложенный компонент ОТДЕЛЬНЫМ запросом (и каждую иконку —
 * ещё одним), поэтому остров из пяти рядов собирается волнами. На быстрой машине это
 * незаметно, на медленной — нет: при задержке ответов в 200 мс сразу после open() у острова
 * 12 узлов, через 300 мс — 113, и только через полторы секунды — 119. Всё, что смотрит на
 * дерево раньше, смотрит на недомонтированный компонент. Снимок это переживает (он ждёт
 * двух одинаковых кадров), а сверка разметки и axe — нет: axe на половине дерева честно
 * сообщает ноль нарушений, и гейт зеленеет на невыполненной работе. Ровно так гейт разметки
 * и упал на CI, где эталон отдал 38 узлов вместо 44.
 *
 * Ждём не фиксированную паузу (мала на медленной машине, потрачена зря на быстрой), а
 * ТИШИНУ MutationObserver'а — и повторяем, пока число узлов не совпадёт с предыдущим
 * замером: пауза между волнами бывает длиннее окна тишины.
 */
export async function settle(page, { quiet = 120, rounds = 12 } = {}) {
  let prev = -1;
  for (let i = 0; i < rounds; i++) {
    const count = await page.evaluate(
      (quiet) =>
        new Promise((resolve) => {
          const root = document.querySelector('#dc-root') ?? document.body;
          let tick;
          const finish = () => {
            clearTimeout(tick);
            obs.disconnect();
            resolve(root.querySelectorAll('*').length);
          };
          const obs = new MutationObserver(() => {
            clearTimeout(tick);
            tick = setTimeout(finish, quiet);
          });
          obs.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
          tick = setTimeout(finish, quiet);
        }),
      quiet
    );
    if (count === prev) return;
    prev = count;
  }
}

/** Обе реализации: эталон и то, что уезжает потребителю. */
export const IMPLS = ['dc', 'react'];

/**
 * Остановить переходы и анимации.
 *
 * Без этого измерение попадает в середину перехода: getComputedStyle отдаёт
 * ИНТЕРПОЛИРОВАННОЕ значение, и «цвет выключенного» читается как 0.34 вместо 0.32 —
 * тест мигает на ровном месте и обвиняет компонент в том, чего тот не делал.
 */
export async function freezeMotion(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation-duration: .001s !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
    }`,
  });
}

/**
 * Пропсы корневого компонента страницы. Функции через границу не переносятся.
 *
 * __dcSetProps ЗАМЕНЯЕТ набор переопределений целиком, а не дополняет его: после
 * setProps({disabled:true}) вариант кнопки вернулся бы к дефолтному, и тест мерил бы
 * не то, что открывал. Поэтому накапливаем набор на стороне страницы.
 */
export async function setProps(page, props) {
  await page.evaluate((p) => {
    window.__testProps = { ...(window.__testProps ?? {}), ...p };
    window.__dcSetProps(window.__dcRootName(), window.__testProps);
  }, props);
  await page.waitForFunction(() => document.querySelector('#dc-root > *') !== null);
  await page.waitForTimeout(120); // добить перерисовку и анимации входа
}

export async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(60);
}

/** Значение токена, посчитанное браузером (var() уже развёрнут). */
export async function tokenValue(page, token, prop = 'color') {
  return page.evaluate(
    ([t, p]) => {
      const el = document.createElement('span');
      el.style.setProperty(p, `var(${t})`);
      document.body.appendChild(el);
      const v = getComputedStyle(el)[p];
      el.remove();
      return v;
    },
    [token, prop]
  );
}

/** Разбор «rgb(a, b, c)» / «rgba(a, b, c, d)» в [r, g, b, a]. */
export function parseColor(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** Наложить полупрозрачный цвет на фон. */
export function flatten([r, g, b, a], bg) {
  return [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a), 1];
}

/** Относительная яркость по WCAG. */
function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Контраст к фону — единственная мера «заметности», работающая в обеих темах. */
export function contrast(fg, bg) {
  const a = luminance(fg) + 0.05;
  const b = luminance(bg) + 0.05;
  return a > b ? a / b : b / a;
}
