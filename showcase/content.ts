/* Содержание витрины, перенесённое из DC-версии дословно.
 *
 * Это ПРОЗА системы: правила доступности, оси словаря, тон текста. Вывести её из кода
 * нельзя — она объясняет решения, а не описывает их. Всё, что можно вывести (состав,
 * пропсы, варианты, иконки, статусы), берётся из api.react.json и здесь не дублируется.
 */

export const A11Y: [string, string, string][] = [
        ['Toggle / Checkbox', 'role=switch/checkbox + aria-checked; aria-label без видимого лейбла; в bare роль скрыта', 'Tab, Space/Enter'],
        ['SwitchRow / CheckboxRow', 'ряд несёт role + aria-checked; вложенный атом скрыт от SR', 'Tab, Space/Enter'],
        ['Slider', 'role=slider + aria-valuemin/max/now/valuetext + aria-label', '←→↑↓ шаг · Shift — крупный'],
        ['Tabs', 'role=tablist / tab + aria-selected, roving tabindex', '←→ Home/End'],
        ['OptionGroup / Segments', 'role=radiogroup / radio + aria-checked, roving tabindex', '←→↑↓'],
        ['RowLabel ⓘ / SbControls ⓘ', 'кнопка-disclosure: aria-expanded + aria-label', 'Enter/Space'],
        ['Toast', 'role=status (polite); danger/warn → role=alert (assertive)', '—'],
        ['g-icon', 'по умолчанию aria-hidden; со label → role=img + aria-label', '—'],
        ['PinCard (тред)', 'поповер: Esc закрывает, клик мимо закрывает, фокус возвращается', 'Esc'],
        ['forced-colors (High Contrast)', 'система вырезает box-shadow и градиенты: фокус-кольцо → outline Highlight, состояния → Highlight/ButtonBorder/GrayText, точка Status и градиент AI сохраняются через forced-color-adjust', '—'],
      ];

export const TOKEN_LAYERS = [
        { n: '1', swatch: 'var(--c-gray-900)', name: 'Примитивы · --c-* / --k-*', desc: 'Сырая палитра. Смысл: «какой это цвет». В компоненты напрямую не попадают.', code: '--c-gray-900:#151517;   --k-light:244 244 242;' },
        { n: '2', swatch: 'var(--bg-surface)', name: 'Алиасы · --bg-* / --text-* / --accent', desc: 'Семантика: «для чего цвет». Единственный слой, который используют компоненты.', code: '--bg-surface: var(--c-gray-900);   --text-secondary: rgb(var(--ink) / .64);' },
        { n: '3', swatch: 'var(--bg-base)', name: 'Тема · [data-theme]', desc: 'Перемапливает алиасы на другие примитивы. Имя алиаса стабильно — меняется значение.', code: '[data-theme="light"] { --ink: var(--k-dark); --bg-surface: var(--c-white); }' },
      ];

export const UX_RULES = [
        { title: 'Тон', text: 'По-русски, на «вы» без слова «вы». Спокойно и по делу, без восклицаний и эмодзи. Термины предметной области — как есть.' },
        { title: 'Лейблы', text: 'Существительное, регистр предложения. Без точки и двоеточия. Не Title Case и не КАПС (капс — только у бейджей).' },
        { title: 'Кнопки', text: 'Глагол действия, одно-два слова. Пояснение — в тултипе (соло-иконка) или ⓘ ряда, не в самой кнопке.' },
        { title: 'Плейсхолдеры', text: 'Показывают пример или формат, а не повторяют лейбл. Не несут критичный смысл — он в лейбле или ⓘ.' },
        { title: 'Сообщения (RowMsg)', text: 'Что не так и как починить. Без «Ошибка:». Появляются после blur, гаснут как только значение валидно.' },
        { title: 'Тосты', text: 'Результат одной фразой. action — глагол одним словом. danger/warn формулируем как последствие.' },
        { title: 'EmptyState', text: 'Label говорит факт состояния, subtitle — что сделать дальше. У вида error действие всегда «Повторить».' },
        { title: 'Числа', text: 'Единица — отдельным элементом (unit / suffix), не вклеиваем в число. Табличные цифры — только по хуку data-nums.' },
      ];

export const SHADOWS = [
        { token: '--shadow-sm', css: 'var(--shadow-sm)' },
        { token: '--shadow-md', css: 'var(--shadow-md)' },
        { token: '--shadow-lg', css: 'var(--shadow-lg)' },
      ];

export const TEXT_LEVELS = [
        { token: '--text-primary', css: 'var(--text-primary)', role: 'Содержание: наборный текст, значение поля, заголовок.', sep: 'none' },
        { token: '--text-body', css: 'var(--text-body)', role: 'Набор: абзац, который нужно прочесть. Тише заголовка, ярче подписи.', sep: '0.5px solid var(--border-subtle)' },
        { token: '--text-secondary', css: 'var(--text-secondary)', role: 'Подчинение: лейбл ряда при значении, subtitle под лейблом, текст подсказки.', sep: '0.5px solid var(--border-subtle)' },
        { token: '--text-tertiary', css: 'var(--text-tertiary)', role: 'Служебное: плейсхолдер, единицы, счётчики, имена токенов.', sep: '0.5px solid var(--border-subtle)' },
        { token: '--text-disabled', css: 'var(--text-disabled)', role: 'Выключенное. Потолок для всего, что лежит внутри disabled.', sep: '0.5px solid var(--border-subtle)' },
      ];

export const DURATIONS = [
        ['ховер и мелкий отклик', '120–180 мс'],
        ['локальное раскрытие', '200–300 мс'],
        ['крупные панели', '300–400 мс'],
      ];

/** Оси имён в пропсах: три слова про разное, путать нельзя. */
export const AXES: [string, string][] = [
  ['variant', 'Вид и вес подачи. Button: primary, secondary, ghost, accent. Badge: solid, soft, quiet. Disclosure: eyebrow, plain.'],
  ['tone', 'Семантика, накладываемая на ЛЮБОЙ вариант: ok, danger. Поэтому отдельного варианта danger нет ни у кнопки, ни у бейджа.'],
  ['level', 'Серьёзность сообщения: ok, warn, danger, info. У рядов приезжает как msgLevel — там же, где значение, которое можно не дать.'],
];
