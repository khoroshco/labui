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

/**
 * Дождаться подсветки. Нажатие возвращается СРАЗУ, а фокус доезжает до пункта следующим
 * кадром — читать состояние в тот же миг значило бы мерить не результат, а скорость
 * машины (гейт мигал один раз из пяти). Ожидание конечного состояния строгости не теряет:
 * подсветка обязана оказаться там, где сказано, и никакая пауза не сделает неверную
 * подсветку верной. А то, что второе быстрое нажатие не теряется, проверяется само собой —
 * пауз МЕЖДУ нажатиями здесь нет.
 */
async function expectHighlighted(page, text, why) {
  await expect.poll(() => highlighted(page), { message: why, timeout: 4000 }).toContain(text);
}

test.describe('Select: клавиатура', () => {
  test('стрелка вниз открывает список и ведёт подсветку от выбранного', async ({ page }) => {
    await openSelect(page, { value: 'Второй' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(list(page), 'стрелка обязана открывать список — так ведёт себя нативный селект').toHaveCount(1);
    await expectHighlighted(page, 'Второй', 'подсветка начинается с ВЫБРАННОГО, а не с первого пункта');
    await page.keyboard.press('ArrowDown');
    await expectHighlighted(page, 'Третий');
    await page.keyboard.press('ArrowUp');
    await expectHighlighted(page, 'Второй');
  });

  test('край списка — это край, а не переход в начало', async ({ page }) => {
    await openSelect(page, { value: 'Первый' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expectHighlighted(page, 'Первый', 'зацикливание на длинном перечне читается как потеря места — у нативного селекта его нет');
  });

  test('Home и End уводят в края', async ({ page }) => {
    await openSelect(page, { value: 'Второй' });
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await expectHighlighted(page, 'Четвёртый');
    await page.keyboard.press('Home');
    await expectHighlighted(page, 'Первый');
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
    await expectHighlighted(page, 'Свободный', 'перебор обязан перешагивать через отключённое');
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
    // Выбрана НЕ первая и ровно одна. Сверка «первая выбрана» при фикстуре, где выбрана
    // первая, — это сравнение константы с константой: `aria-selected={true}` у ВСЕХ
    // пунктов прошло бы её, и диктор объявлял бы каждую строку выбранной.
    const marked = await page.evaluate(() =>
      [...document.querySelectorAll('[role="option"][aria-selected="true"]')].map((el) => el.textContent?.trim())
    );
    expect(marked, 'выбранной обязана быть ровно одна опция, и та, что в значении').toEqual(['Первый']);
  });

  test('отключённую опцию нельзя выбрать и мышью', async ({ page }) => {
    // Перебор через неё перешагивает — это проверяет соседний тест. Но за клик отвечает
    // другая ветка кода, и `if (!o)` вместо `if (!o || o.disabled)` проходил бы её мимо.
    await openSelect(page, {
      options: [{ value: 'a', label: 'Доступный' }, { value: 'b', label: 'Занятый', disabled: true }],
      defaultValue: 'a',
    });
    await trigger(page).click();
    await items(page).nth(1).click({ force: true });
    await expect(trigger(page), 'клик по отключённой опции её выбрал').toHaveText(/Доступный/);
    await expect(list(page), 'и заодно закрыл список, будто выбор состоялся').toHaveCount(1);
  });

  test('значение уезжает в форму настоящим полем — и ПОСЛЕ смены выбора', async ({ page }) => {
    await openSelect(page, { defaultValue: 'Первый', name: 'format' });
    // Выбор МЕНЯЕТСЯ до замера: с неизменённым значением проверку проходило и
    // `defaultValue={current}` вместо `value={current}` — поле становилось неуправляемым,
    // на монтировании значение верное, а форма после любого выбора отправляла старое.
    await trigger(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(trigger(page)).toHaveText(/Второй/);

    // Поле оборачивается формой НА МЕСТЕ, а не клонируется: клон пережил бы даже переезд
    // input'а в портал, где никакой формы вокруг него уже нет.
    const data = await page.evaluate(() => {
      const input = document.querySelector('#dc-root input[name="format"]');
      if (!input) return null;
      const form = document.createElement('form');
      const at = input.parentNode;
      const next = input.nextSibling;
      form.appendChild(input);
      const out = [...new FormData(form).entries()];
      at.insertBefore(input, next);
      return out;
    });
    expect(data, 'без нативного поля нет ни FormData, ни автозаполнения, ни required').toEqual([['format', 'Второй']]);
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

/**
 * Клик ДЕЙСТВИТЕЛЬНО мимо.
 *
 * Угол (5, 5) для этого не годится: компонент в оснастке стоит в левом верхнем углу, и
 * клик туда попадает по самому полю — то есть закрывает список СВОИМ путём («trigger»),
 * а выглядит как «клик снаружи». Ровно на этом и разошлись причины закрытия.
 */
async function clickOutside(page) {
  const box = await trigger(page).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 240);
}

test('клик мимо закрывает список', async ({ page }) => {
  await openSelect(page);
  await trigger(page).click();
  await expect(list(page)).toHaveCount(1);
  await clickOutside(page);
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

test('причина закрытия называется честно', async ({ page }) => {
  // `reason` объявлен частью контракта ради одного сценария: «закрывать по Escape, но не
  // по клику мимо». Пока причину не проверял никто, `setOpen(false, 'outside')` можно
  // было заменить на `'escape'` — и сценарий у потребителя ломался молча.
  await openSelect(page, { defaultValue: 'Первый', onOpenChange: '@fn' });
  await trigger(page).click();
  await page.keyboard.press('Escape');
  await trigger(page).click();
  await clickOutside(page);
  const reasons = await page.evaluate(() =>
    (window.__calls ?? []).filter((c) => c.prop === 'onOpenChange').map((c) => `${c.args[0]}:${c.args[1]}`)
  );
  expect(reasons, 'причина обязана называть ПУТЬ, которым состояние изменилось').toEqual([
    'true:trigger',
    'false:escape',
    'true:trigger',
    'false:outside',
  ]);
});

test('список едет за якорем, когда страница прокручивается', async ({ page }) => {
  await openSelect(page);
  // Прокручиваем не окно, а ПАНЕЛЬ — так селект и стоит в реальном экране: список
  // форматов в боковой панели с overflow:auto. Слушатель в фазе перехвата обязан ловить
  // прокрутку любого предка, а не только окна.
  await page.evaluate(() => {
    const host = document.querySelector('#dc-root .sc-host');
    const box = document.createElement('div');
    box.id = 'scroller';
    box.style.cssText = 'overflow:auto;height:200px;width:260px';
    const filler = document.createElement('div');
    filler.style.cssText = 'height:60px';
    const tail = document.createElement('div');
    tail.style.cssText = 'height:900px';
    host.parentNode.insertBefore(box, host);
    box.append(filler, host, tail);
  });
  await trigger(page).click();
  const before = await page.evaluate(() => document.querySelector('[role="listbox"]').getBoundingClientRect().top);
  await page.evaluate(() => {
    document.getElementById('scroller').scrollTop = 60;
  });
  const box = () =>
    page.evaluate(() => {
      const list = document.querySelector('[role="listbox"]');
      const t = document.querySelector('#dc-root [data-select="true"]');
      return { list: list.getBoundingClientRect().top, trigger: t.getBoundingClientRect().bottom };
    });
  // Ждём КОНЕЧНОГО положения, а не фиксированной паузы: пересчёт идёт по событию прокрутки
  // и приходит следующим кадром, а фиксированная пауза мерила бы скорость машины (гейт
  // мигал один раз из пяти). Требование при этом не слабеет: расстояние между полем и
  // списком обязано сойтись, и никакое ожидание не сделает несошедшееся сошедшимся.
  await expect
    .poll(async () => Math.abs((await box()).list - (await box()).trigger), {
      message: 'список уехал от своего поля — привязка пересчитывается, но не туда',
      timeout: 4000,
    })
    .toBeLessThan(20);
  const after = await box();
  expect(
    Math.abs(before - after.list),
    'список остался висеть на прежнем месте: fixed в портале сам за якорем не едет'
  ).toBeGreaterThan(30);
});

test('Textarea: Enter остаётся полю, отправляет Cmd/Ctrl+Enter', async ({ page }) => {
  await open(page, 'Textarea', { ariaLabel: 'Комментарий', onSubmit: '@fn', defaultValue: 'первая' }, { impl: 'react', freeze: false });
  const area = page.locator('#dc-root textarea');
  await area.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('вторая');
  expect(await area.inputValue(), 'Enter в многострочном поле — перевод строки, и он принадлежит полю').toContain('\n');
  expect(await page.evaluate(() => (window.__calls ?? []).length), 'одинокий Enter отправлять не имеет права').toBe(0);
  await page.keyboard.press('ControlOrMeta+Enter');
  expect(await page.evaluate(() => (window.__calls ?? []).map((c) => c.prop)), 'Cmd/Ctrl+Enter — отправка').toEqual(['onSubmit']);
});

test('Textarea: поле растёт под содержимое и упирается в потолок', async ({ page }) => {
  await open(page, 'Textarea', { ariaLabel: 'Комментарий', rows: 2, maxRows: 4 }, { impl: 'react', freeze: false });
  const area = page.locator('#dc-root textarea');
  const height = () => area.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  await area.focus();

  const start = await height();
  await page.keyboard.type('первая');
  await page.keyboard.press('Enter');
  await page.keyboard.type('вторая');
  await page.keyboard.press('Enter');
  await page.keyboard.type('третья');
  const grown = await height();
  // Рост — единственная причина, по которой компонент существует отдельно от нативного
  // тега. Без этой проверки `const want = min` проходило девять тестов из девяти.
  expect(grown, `поле не выросло под содержимое (${start} → ${grown})`).toBeGreaterThan(start);

  for (const line of ['четвёртая', 'пятая', 'шестая', 'седьмая']) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(line);
  }
  const capped = await height();
  expect(capped, 'потолок maxRows не держит: поле выдавливает всё, что под ним').toBeLessThan(grown * 2);
  expect(
    await area.evaluate((el) => getComputedStyle(el).overflowY),
    'упёрлись в потолок — обязана появиться прокрутка, иначе хвост текста недостижим'
  ).toBe('auto');
});
