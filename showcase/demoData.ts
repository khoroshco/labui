/* Данные витрины, перенесённые из DC-версии дословно: шкалы набора, демо-наборы опций,
 * конфиги островов для примеров. Это СОДЕРЖИМОЕ показов, а не свойства компонентов —
 * вывести его из кода нельзя, поэтому оно лежит здесь и правится вместе с витриной.
 */

export const demoCycleOpts = ['PX', 'REM', '%'] as const;

export const demoScaleOpts = ['1x', '2x', '3x'] as const;

export const demoTypeOpts = ['HTML5', 'Статика'] as const;

export const demoUnitOpts = ['PX', 'REM'] as const;

export const demoAnchorOpts = [
        { icon: 'object-align-left', title: 'лево' }, { icon: 'object-align-center-horizontal', title: 'центр' },
        { icon: 'object-align-right', title: 'право' }, { icon: 'object-align-bottom', title: 'низ' },
      ] as const;

export const islandA = [
        { type: 'segmented', label: 'Тип выхода', options: ['HTML5', 'Статика'], value: 0 },
        { type: 'icons', label: 'Якорь героя', value: 2, info: 'Якорь — точка, за которую герой держится при пересчёте формата: при смене аспекта он прижимается к выбранному краю.', infoImage: 'инструкция: как якорь держит героя', options: [
          { icon: 'object-align-left', title: 'лево' }, { icon: 'object-align-center-horizontal', title: 'центр' },
          { icon: 'object-align-right', title: 'право' }, { icon: 'object-align-bottom', title: 'низ' },
        ]},
        { type: 'toggle', label: 'Запекать в растр', checked: false, info: 'Дисплейный текст (заголовки, декор) можно запекать в растр как осознанный выбор по слою — это экономит вес. Лигал всегда остаётся живым DOM.' },
      ] as const;

export const islandB = [
        { type: 'text', label: 'Текст CTA', value: 'За кормом' },
        { type: 'text', label: 'Отступ лигала', value: '10', nums: true, options: ['px', 'rem'] },
        { type: 'checkbox', label: 'Показывать пины', subtitle: 'Черновики видны только вам, пока не отправлены', checked: true },
      ] as const;

export const islandC = [
        { type: 'text', label: 'Секция Figma', value: 'figma.com/design/hLXqSkVGmvNIYT?node-id=204-1177' },
        { type: 'text', label: 'Кампания', value: 'Осенний сейл' },
        { type: 'action', label: 'Извлечь сцену' },
      ] as const;

export const islandLoading = [
        { type: 'text', label: 'Секция Figma', value: 'figma.com/design/hLXqSkVGmvNIYT?node-id=204-1177' },
        { type: 'text', label: 'Кампания', loading: true },
        { type: 'action', label: 'Извлечение сцены…', loading: true },
      ] as const;

export const FONT_SCALE = ['--fs-xs', '--fs-s', '--fs-m', '--fs-l', '--fs-h3', '--fs-h2', '--fs-h1', '--fs-display'] as const;

export const FONT_WEIGHTS = [['--fw-regular', 'Regular — весь обычный текст'], ['--fw-medium', 'Medium — заголовок или подпись контрола'], ['--fw-black', 'Black — только крупные заголовки']] as const;

export const TYPE_STYLES = [
    { name: 'Display', role: 'Титул экрана — один на макет', fs: 'var(--fs-display)', fw: 'var(--fw-black)', lh: 'var(--lh-display)', ls: 'var(--ls-display)', caps: 'none', color: 'var(--text-primary)', measure: 'none', sample: 'Сетка приёмки' },
    { name: 'H1', role: 'Заголовок страницы', fs: 'var(--fs-h1)', fw: 'var(--fw-black)', lh: 'var(--lh-display)', ls: 'var(--ls-display)', caps: 'none', color: 'var(--text-primary)', measure: 'none', sample: 'Осенний сейл — 18 форматов' },
    { name: 'H2', role: 'Заголовок раздела', fs: 'var(--fs-h2)', fw: 'var(--fw-black)', lh: 'var(--lh-heading)', ls: 'var(--ls-heading)', caps: 'none', color: 'var(--text-primary)', measure: 'none', sample: 'Шлюз нарезки' },
    { name: 'H3', role: 'Заголовок блока', fs: 'var(--fs-h3)', fw: 'var(--fw-medium)', lh: 'var(--lh-heading)', ls: 'normal', caps: 'none', color: 'var(--text-primary)', measure: 'none', sample: 'Правила бренда и площадки' },
    { name: 'H4', role: 'Самый низкий уровень заголовка', fs: 'var(--fs-l)', fw: 'var(--fw-medium)', lh: 'var(--lh-heading)', ls: 'normal', caps: 'none', color: 'var(--text-primary)', measure: 'none', sample: 'Пока нет форматов' },
    { name: 'Body', role: 'База набора. Тише делает цвет, а не кегль', fs: 'var(--fs-m)', fw: 'var(--fw-regular)', lh: 'var(--lh-text)', ls: 'normal', caps: 'none', color: 'var(--text-primary)', measure: 'var(--measure-narrow)', sample: 'Дизайнер отдаёт мастер и выбирает площадки — получает пачку креативов, прошедших правила площадок и правила ремесла.' },
    { name: 'Label', role: 'Подпись контрола: лейбл ряда, текст кнопки', fs: 'var(--fs-m)', fw: 'var(--fw-medium)', lh: 'var(--lh-ui)', ls: 'normal', caps: 'none', color: 'var(--text-primary)', measure: 'none', sample: 'Запекать в растр' },
    { name: 'Eyebrow', role: 'Рубрика и бейдж: капс + трекинг', fs: 'var(--fs-xs)', fw: 'var(--fw-medium)', lh: 'var(--lh-ui)', ls: 'var(--ls-eyebrow)', caps: 'uppercase', color: 'var(--text-tertiary)', measure: 'none', sample: 'Уровни яркости' },
  ] as const;

/** Пять именованных групп цвета — как в DC-витрине, с русскими именами и токенами. */
export const COLOR_GROUPS = [
        { title: 'Фон', items: [
          { name: 'Канвас', token: '--bg-canvas', css: 'var(--bg-canvas)' },
          { name: 'База', token: '--bg-base', css: 'var(--bg-base)' },
          { name: 'Поверхность', token: '--bg-surface', css: 'var(--bg-surface)' },
          { name: 'Поднятое', token: '--bg-raised', css: 'var(--bg-raised)' },
        ]},
        { title: 'Текст', items: [
          { name: 'Основной', token: '--text-primary', css: 'var(--text-primary)' },
          { name: 'Вторичный', token: '--text-secondary', css: 'var(--text-secondary)' },
          { name: 'Третичный', token: '--text-tertiary', css: 'var(--text-tertiary)' },
          { name: 'Инверсия', token: '--inverse-bg', css: 'var(--inverse-bg)' },
        ]},
        { title: 'Акцент', items: [
          { name: 'Акцент', token: '--accent', css: 'var(--accent)' },
          { name: 'Акцент, фон', token: '--accent-dim', css: 'var(--accent-dim)' },
        ]},
        { title: 'AI', items: [
          { name: 'Градиент AI', token: '--ai-grad', css: 'var(--ai-grad)', noValue: true },
          { name: 'AI, сплошной', token: '--ai', css: 'var(--ai)' },
        ]},
        { title: 'Статусы', items: [
          { name: 'Ок', token: '--ok', css: 'var(--ok)' },
          { name: 'Внимание', token: '--warn', css: 'var(--warn)' },
          { name: 'Блок', token: '--danger', css: 'var(--danger)' },
          { name: 'Инфо', token: '--info', css: 'var(--info)' },
          { name: 'Ок, фон', token: '--ok-dim', css: 'var(--ok-dim)' },
          { name: 'Внимание, фон', token: '--warn-dim', css: 'var(--warn-dim)' },
          { name: 'Блок, фон', token: '--danger-dim', css: 'var(--danger-dim)' },
        ]},
      ] as const;

/** Кейфреймы системы: имя → что именно меняется. Перенесено из DC-витрины. */
export const KEYFRAMES: [string, string][] = [
  ['ds-fade', 'Простое появление — когда движения не нужно вовсе.'],
  ['ds-rise', 'Вход снизу: элемент приходит из потока, а не возникает.'],
  ['ds-appear', 'Пружинное появление мелкого: спиннер, точка, бейдж.'],
  ['ds-pop-in', 'Карточка растёт из точки привязки: PinCard у пина.'],
  ['pin-pop', 'Капля пина: ставится в точку клика.'],
  ['ds-pulse', 'Ожидание без прогресса. Форма — атом Skeleton.'],
  ['ds-spin', 'Работа идёт, конца не знаем. Только linear.'],
  ['ds-shake', 'Упор в предел: дальше ввод не идёт. Под reduced-motion — гашение.'],
  ['ds-toast-fill', 'Остаток времени тоста. Убывает, а не растёт.'],
];

/** Принципы движения: три колонки по пять правил. */
export const MOTION_PRINCIPLES: [string, string[]][] = [
  ['Материал', ['Пружина — из физики, не на глаз: затухающее колебание с овершутом ~4%.', 'Анимируем только transform и opacity; grid-rows у раскрывашек — осознанное исключение.', 'box-shadow не анимируем напрямую — кросс-фейд слоя тени через opacity.', 'transform-origin — из точки привязки: карточка растёт из пина, раскрывашка — сверху.', 'Длительность растёт с размером объекта: мелкий отклик быстрее крупной панели.']],
  ['Вход и выход', ['Вход и выход асимметричны: вход — пружина или ease-out, выход короче и тише.', 'Выход — полноправное состояние: ничего не исчезает без анимации.', 'Stagger: секции и списки входят каскадом 40–50 мс, не разом.', 'Перестановки — layout-анимацией: сосед съезжает плавно, не телепортом.', 'Связанные изменения — одной последовательностью: поле, сообщение и тонировка меняются согласованно.']],
  ['Отклик', ['Интерактив — на transitions: прерванная анимация подхватывается из текущей точки, не стартует заново.', 'Скорость наследуется: JS-анимации продолжают движение с текущей velocity, не с нуля.', 'Пресс — единый жест: scale и brightness на всём кликабельном, мгновенно.', 'Анимация не блокирует ввод: состояние меняется сразу, визуал догоняет.', 'prefers-reduced-motion уважается: крупные перемещения и пружины заменяются гашением, цвет и кольцо фокуса остаются.']],
];

