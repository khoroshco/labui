/* СЕЛЕКТ: клавиатура, роли и то, ради чего он вообще в портале.
 *
 * Ни один существующий гейт этого не видит. Снимок снимает ЗАКРЫТЫЙ селект — то есть поле
 * с шевроном; axe читает дерево в покое; паритета у компонента нет по построению. Всё, что
 * отличает селект от кнопки — перебор, поиск по буквам, возврат фокуса, край списка, —
 * живёт в событиях, и проверить это можно только нажатиями.
 *
 * Мера везде — СЛЕДСТВИЕ, а не признак. «Список не режется» проверяется попаданием точки
 * в список, а не наличием портала в разметке: портал можно оставить и всё равно обрезать.
 * «Фокус вернулся» — тождеством узла, а не совпадением тега.
 */
import { expect, test } from '@playwright/test';
import { open } from '../support/browser.js';

const OPTS = ['Первый', 'Второй', 'Третий', 'Четвёртый'];

const openSelect = (page, props = {}) =>
  open(page, 'Select', { options: OPTS, ariaLabel: 'Формат', ...props }, { impl: 'react', freeze: false });

const trigger = (page) => page.locator('#dc-root [data-select="true"]');
const list = (page) => page.locator('[role="listbox"]');
const items = (page) => page.locator('[role="option"]');
/**
 * Подсвеченный пункт — тот, у кого НАСТОЯЩИЙ фокус: подсветка и фокус здесь одно и то же.
 *
 * Спрашиваем именно роль. Первая версия читала текст активного элемента как есть — а у
 * поля селекта текст тот же, что у выбранного пункта, и проверка радостно принимала
 * «фокус остался на поле» за «подсветка на выбранном». Ровно этот дефект в компоненте и
 * был, и гейт его сперва не увидел.
 */
const highlighted = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el.getAttribute('role') !== 'option') return `фокус не на пункте списка, а на ${el?.tagName}[role=${el?.getAttribute('role')}]`;
    return el.textContent?.trim() ?? '';
  });

test.describe('Select: клавиатура', () => {
  test('стрелка вниз открывает список и ведёт подсветку от выбранного', async ({ page }) => {
    await openSelect(page, { value: 'Второй' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(list(page), 'стрелка обязана открывать список — так ведёт себя нативный селект').toHaveCount(1);
    expect(await highlighted(page), 'подсветка начинается с ВЫБРАННОГО, а не с первого пункта').toContain('Второй');
    await page.keyboard.press('ArrowDown');
    expect(await highlighted(page)).toContain('Третий');
    await page.keyboard.press('ArrowUp');
    expect(await highlighted(page)).toContain('Второй');
  });

  test('край списка — это край, а не переход в начало', async ({ page }) => {
    await openSelect(page, { value: 'Первый' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    expect(
      await highlighted(page),
      'зацикливание на длинном перечне читается как потеря места — у нативного селекта его нет'
    ).toContain('Первый');
  });

  test('Home и End уводят в края', async ({ page }) => {
    await openSelect(page, { value: 'Второй' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await highlighted(page)).toContain('Четвёртый');
    await page.keyboard.press('Home');
    expect(await highlighted(page)).toContain('Первый');
  });

  test('Enter выбирает, закрывает и возвращает фокус на поле', async ({ page }) => {
    await openSelect(page, { defaultValue: 'Первый' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(list(page), 'выбор в одиночном режиме закрывает список').toHaveCount(0);
    await expect(trigger(page)).toHaveText(/Второй/);
    // Тождество узла, а не совпадение тега: фокус, уехавший на другую кнопку, прошёл бы
    // проверку «активен button».
    const back = await page.evaluate(() => document.activeElement === document.querySelector('#dc-root [data-select="true"]'));
    expect(back, 'после выбора фокус обязан вернуться на поле — иначе следующий Tab начнёт обход с начала').toBe(true);
  });

  test('Escape закрывает и возвращает фокус, значение не меняется', async ({ page }) => {
    await openSelect(page, { defaultValue: 'Первый' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // подсветка ушла на «Второй», но выбора не было
    await page.keyboard.press('Escape');
    await expect(list(page)).toHaveCount(0);
    await expect(trigger(page), 'Escape отменяет перебор, а не подтверждает его').toHaveText(/Первый/);
    const back = await page.evaluate(() => document.activeElement === document.querySelector('#dc-root [data-select="true"]'));
    expect(back).toBe(true);
  });

  test('буквы на ЗАКРЫТОМ селекте меняют значение, не открывая список', async ({ page }) => {
    // Подписи здесь латиницей, и это ограничение ОСНАСТКИ, а не системы: движок умеет
    // нажать только клавишу, которая есть на раскладке, а кириллический символ он
    // вставляет через insertText — без keydown, то есть мимо всей клавиатурной логики.
    // Механизм поиска от алфавита не зависит: сравнивается префикс подписи в нижнем
    // регистре, и в витрине он работает на русских подписях так же.
    await openSelect(page, { options: ['Alpha', 'Beta', 'Gamma'], defaultValue: 'Alpha' });
    await trigger(page).focus();
    await page.keyboard.press('g');
    await expect(list(page), 'нативный <select> на букву список не раскрывает').toHaveCount(0);
    await expect(trigger(page)).toHaveText(/Gamma/);
  });

  test('повтор одной буквы перебирает совпадения, а не залипает на первом', async ({ page }) => {
    await openSelect(page, { options: ['Alpha', 'Beta', 'Aurora', 'Astra'], defaultValue: 'Alpha' });
    await trigger(page).focus();
    await page.keyboard.press('a');
    await expect(trigger(page), 'первое нажатие ищет со следующей опции, иначе перебор упирается в выбранную').toHaveText(/Aurora/);
    await page.keyboard.press('a');
    await expect(trigger(page), 'второе «а» — это перебор на «а», а не запрос «аа»').toHaveText(/Astra/);
    await page.keyboard.press('a');
    await expect(trigger(page), 'перебор идёт по кругу').toHaveText(/Alpha/);
  });

  test('отключённая опция пропускается перебором и не выбирается', async ({ page }) => {
    await openSelect(page, {
      options: [{ value: 'a', label: 'Доступный' }, { value: 'b', label: 'Занятый', disabled: true }, { value: 'c', label: 'Свободный' }],
      defaultValue: 'a',
    });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await highlighted(page), 'перебор обязан перешагивать через отключённое').toContain('Свободный');
  });

  test('Tab закрывает список и уводит фокус дальше', async ({ page }) => {
    await openSelect(page);
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(list(page)).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(list(page), 'уйдя из контрола, человек закрыл список — держать его открытым нечего').toHaveCount(0);
  });
});

test.describe('Select: роли и форма', () => {
  test('роли и связи объявлены так, как ждёт диктор', async ({ page }) => {
    await openSelect(page, { value: 'Первый' });
    const t = trigger(page);
    await expect(t).toHaveAttribute('role', 'combobox');
    await expect(t).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(t, 'закрытый селект ничем не управляет').toHaveAttribute('aria-expanded', 'false');
    await t.click();
    await expect(t).toHaveAttribute('aria-expanded', 'true');
    const controls = await t.getAttribute('aria-controls');
    expect(controls, 'открытый обязан назвать свой список').toBeTruthy();
    const found = await page.evaluate((id) => !!document.getElementById(id), controls);
    expect(found, 'ссылка ведёт в несуществующий узел — диктору некуда идти').toBe(true);
    await expect(items(page)).toHaveCount(OPTS.length);
    await expect(items(page).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('значение уезжает в форму настоящим полем', async ({ page }) => {
    await openSelect(page, { value: 'Третий', name: 'format' });
    const data = await page.evaluate(() => {
      const input = document.querySelector('#dc-root input[name="format"]');
      if (!input) return null;
      const form = document.createElement('form');
      const clone = input.cloneNode(true);
      form.appendChild(clone);
      return [...new FormData(form).entries()];
    });
    expect(data, 'без нативного поля нет ни FormData, ни автозаполнения, ни required').toEqual([['format', 'Третий']]);
  });

  test('скрытое поле не берёт фокус и не озвучивается', async ({ page }) => {
    await openSelect(page, { value: 'Первый', name: 'format' });
    const info = await page.evaluate(() => {
      const el = document.querySelector('#dc-root input[name="format"]');
      return { tabIndex: el?.tabIndex, hidden: el?.getAttribute('aria-hidden'), w: el?.getBoundingClientRect().width };
    });
    expect(info.tabIndex, 'имя и роль несёт видимое поле — второй остановки таба быть не должно').toBe(-1);
    expect(info.hidden).toBe('true');
    // Не display:none и не hidden: браузеру нужно, к чему прицепить пузырь «заполните это
    // поле». Спрятанному display:none полю он его не покажет, и отправка просто не пройдёт.
    expect(info.w, 'поле обязано существовать в раскладке, иначе нативная валидация немая').toBeGreaterThan(0);
  });
});

test('список не режется предком с overflow — он в портале', async ({ page }) => {
  await openSelect(page);
  // Оборачиваем селект в короб, который РЕЖЕТ содержимое, — так он и стоит в реальном
  // экране: остров владеет радиусом и overflow:hidden, карточка и панель — тоже.
  await page.evaluate(() => {
    const host = document.querySelector('#dc-root .sc-host');
    const box = document.createElement('div');
    box.style.cssText = 'overflow:hidden;height:40px;width:220px;position:relative';
    host.parentNode.insertBefore(box, host);
    box.appendChild(host);
  });
  await trigger(page).click();
  await expect(list(page)).toHaveCount(1);

  // Мера — ПОПАДАНИЕ: точка в списке возвращает список. Проверка «есть ли портал» прошла
  // бы и на обрезанном списке, потому что портал — это признак, а не следствие.
  const visible = await page.evaluate(() => {
    const el = document.querySelector('[role="listbox"]');
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { hit: false, why: 'нулевая рамка' };
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(18, r.height / 2));
    return { hit: !!at && (el === at || el.contains(at)), why: at?.tagName ?? 'ничего' };
  });
  expect(visible.hit, `список обрезан предком: в его точке оказалось «${visible.why}»`).toBe(true);
});

test('клик мимо закрывает список', async ({ page }) => {
  await openSelect(page);
  await trigger(page).click();
  await expect(list(page)).toHaveCount(1);
  await page.mouse.click(5, 5);
  await expect(list(page)).toHaveCount(0);
});

test('readOnly показывает значение, но не открывается', async ({ page }) => {
  await openSelect(page, { value: 'Первый', readOnly: true });
  const t = trigger(page);
  await t.click();
  await expect(list(page), 'readOnly отличается от disabled тем, что остаётся в табе, а не тем, что открывается').toHaveCount(0);
  await t.focus();
  await page.keyboard.press('ArrowDown');
  await expect(list(page)).toHaveCount(0);
  expect(await t.evaluate((el) => el.tabIndex), 'readOnly остаётся в порядке таба').toBeGreaterThanOrEqual(0);
});
