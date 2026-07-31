/* Демо-данные витрины: то, чего нельзя вывести из контракта.
 *
 * Контракт (api.react.json) знает ИМЕНА, типы, варианты и дефолты — их витрина берёт оттуда
 * и никогда не дублирует. Здесь лежит только СОДЕРЖИМОЕ: список опций, ряды острова,
 * сообщения треда. Вывести его из кода нельзя, потому что это не свойство компонента, а
 * пример его применения.
 *
 * Правило прежнее: если что-то можно вывести из кода — оно выводится, а не пишется здесь.
 */
export const DEMO: Record<string, Record<string, unknown>> = {
  Button: { label: 'Выгрузить' },
  Input: { value: 'Осенний сейл', ariaLabel: 'Название кампании' },
  Checkbox: { label: 'Применить ко всем форматам' },
  Toggle: { label: 'Живое превью' },
  CycleButton: { options: ['PX', '%', 'PT'] },
  OptionGroup: { options: ['JPG', 'PNG', 'WEBP'], value: 1 },
  Badge: { label: '300×250' },
  Skeleton: { shape: 'line', width: '140px', height: '12px' },
  Avatar: { author: 'Марина Ковалёва' },
  Pin: { number: 1 },

  RowLabel: { label: 'Запекать в растр', hasInfo: true },
  RowInfo: { text: 'Текст подсказки приходит пропсом.', open: true },
  RowMsg: { text: 'Токен — латиница и цифры, минимум 11 символов', level: 'danger' },

  InputRow: { label: 'Отступ лигала', value: '10', options: ['PX', '%'], nums: true },
  ChoiceRow: { label: 'Тип выхода', options: ['Растр', 'Вектор'], value: 0 },
  SwitchRow: { label: 'Запекать в растр', subtitle: 'Текст станет частью картинки', checked: true },
  CheckboxRow: { label: 'Согласен с условиями размещения', subtitle: 'Без этого выгрузка не стартует' },
  ActionRow: { label: 'Извлечь сцену' },

  Slider: { label: 'Охранное поле', value: 24, min: 0, max: 64, unit: 'px', snapStep: 8 },
  Disclosure: { label: 'Примеры', count: 3, children: 'Содержимое приходит детьми — раскрывашка не знает, что внутри.' },
  Segments: { options: ['Все', 'С пометками', 'Готовые'], value: 0 },
  Tabs: {
    options: [
      ['Все форматы', '18'],
      ['Требуют внимания', '4'],
    ],
  },
  Toast: { text: '12 форматов готовы к выгрузке', level: 'info', actionLabel: 'Открыть' },
  PinCard: {
    author: 'Марина Ковалёва',
    messages: [
      { author: 'Марина Ковалёва', text: 'Логотип уезжает за охранное поле на мобильном.' },
      { author: 'Пётр Соколов', text: 'Поправил, посмотри.' },
    ],
  },
  PinComposer: { author: 'Марина Ковалёва' },

  Island: {
    rows: [
      { type: 'text', label: 'Название', value: 'Осенний сейл' },
      { type: 'text', label: 'erid', value: '2Vtzqx', nums: true },
      { type: 'toggle', label: 'Запекать в растр', checked: true },
      { type: 'segmented', label: 'Формат', options: ['JPG', 'PNG', 'WEBP'], value: 1 },
      { type: 'action', label: 'Выгрузить' },
    ],
  },
  EmptyState: {
    label: 'Пока нет форматов',
    subtitle: 'Добавьте первый баннер — остальные размеры пересчитаются сами',
    actionLabel: 'Добавить баннер',
  },
};

/** Компоненты, которым нужна своя ширина: иначе демо растягивается на весь экран. */
export const WIDTH: Record<string, string> = {
  PinCard: '400px',
  PinComposer: '360px',
  Toast: '420px',
  EmptyState: '100%',
  Island: '100%',
  Slider: '100%',
};
