/* Примеры из DC-витрины, перенесённые дословно.
 *
 * Это статичные показы под раскрывашкой «Примеры» у каждого раздела: варианты, тона,
 * размеры, состояния — то, что нельзя увидеть в плейграунде, не перещёлкав его руками.
 * Извлечены из исходника автоматически, а не переписаны: пересказ потерял бы половину.
 *
 * Две поправки на семантику при переносе: атрибут style в разметке — строка, а в React
 * объект; плоский атрибут (value="24") в HTML — строка, а не число, поэтому числами
 * становятся только выражения {{ 24 }}.
 */
import { demoAnchorOpts, demoCycleOpts, demoScaleOpts, demoTypeOpts, demoUnitOpts, islandA, islandB, islandC, islandLoading } from './demoData';

export interface Example { c: string; p: Record<string, unknown> }

export const EXAMPLES: Record<string, Example[]> = {
  button: [
    { c: 'Button', p: { label: "Выгрузить", variant: "primary" } },
    { c: 'Button', p: { label: "Отмена", variant: "secondary" } },
    { c: 'Button', p: { label: "Позже", variant: "ghost" } },
    { c: 'Button', p: { label: "На пересборку · 4", variant: "accent" } },
    { c: 'Button', p: { label: "Удалить", variant: "secondary", tone: "danger" } },
    { c: 'Button', p: { label: "Удалить всё", variant: "primary", tone: "danger" } },
    { c: 'Button', p: { label: "Недоступно", disabled: true } },
    { c: 'Button', p: { label: "Выгрузить 12 форматов", icon: "arrow-down-to-line", variant: "primary" } },
    { c: 'Button', p: { label: "Все площадки", iconRight: "chevron-down", variant: "secondary" } },
    { c: 'Button', p: { label: "Пересобрать", icon: "arrows-rotate-right", variant: "secondary", size: "s" } },
    { c: 'Button', p: { icon: "ellipsis", variant: "secondary", size: "s", tooltip: "Ещё" } },
    { c: 'Button', p: { icon: "pause-fill", variant: "ghost", size: "xs", tooltip: "Пауза" } },
    { c: 'Button', p: { label: "Решено", icon: "check", variant: "ghost", size: "s", tone: "ok" } },
    { c: 'Button', p: { icon: "plus", variant: "primary", size: "l", tooltip: "Создать" } },
    { c: 'Button', p: { label: "Извлечение…", loading: true, variant: "secondary" } },
  ],
  inputatom: [
    { c: 'Input', p: { icon: "magnifier", clearable: true, value: "осенний", placeholder: "Поиск по кампаниям", style: {"width": "220px"} } },
    { c: 'Input', p: { value: "hvostilapy", invalid: true, style: {"width": "160px"} } },
    { c: 'Input', p: { value: "Осенний сейл", disabled: true, style: {"width": "160px"} } },
    { c: 'Input', p: { value: 24, suffix: "px", style: {"width": "90px"} } },
    { c: 'Input', p: { prefix: "https://", value: "hvost-i-lapy.ru/sale", style: {"width": "230px"} } },
  ],
  textarea: [
    { c: 'Textarea', p: { placeholder: "Что поправить", ariaLabel: "Комментарий", style: {"width": "320px"} } },
    { c: 'Textarea', p: { value: "Короткая заметка", rows: 2, ariaLabel: "Заметка", style: {"width": "320px"} } },
    { c: 'Textarea', p: { value: "Поле растёт под содержимое, пока строк меньше потолка. Дальше оно перестаёт расти и прокручивается внутри себя — иначе длинный текст выдавливает кнопку отправки за экран.", maxRows: 4, ariaLabel: "Описание", style: {"width": "320px"} } },
    { c: 'Textarea', p: { value: "erid не похож на токен", invalid: true, ariaLabel: "Токен", style: {"width": "320px"} } },
    { c: 'Textarea', p: { value: "Правка запрещена", disabled: true, ariaLabel: "Комментарий", style: {"width": "320px"} } },
  ],
  cyclebutton: [
    { c: 'CycleButton', p: { options: demoUnitOpts } },
    { c: 'CycleButton', p: { options: demoCycleOpts } },
    { c: 'CycleButton', p: { options: demoScaleOpts } },
  ],
  optiongroup: [
    { c: 'OptionGroup', p: { options: demoTypeOpts, value: 0 } },
    { c: 'OptionGroup', p: { options: demoAnchorOpts, value: 2 } },
    // Иконочный режим: опция задаётся объектом { icon, title }. Заголовок обязателен —
    // он и есть ИМЯ опции для скринридера, а заодно текст тултипа.
    {
      c: 'OptionGroup',
      p: {
        options: [
          { icon: 'object-align-left', title: 'по левому краю' },
          { icon: 'object-align-center-horizontal', title: 'по центру' },
          { icon: 'object-align-right', title: 'по правому краю' },
        ],
        value: 1,
      },
    },
  ],
  badge: [
    { c: 'Badge', p: { label: "300×250", nums: true } },
    { c: 'Badge', p: { label: "внимание", icon: "triangle-exclamation-fill", tone: "warn" } },
    { c: 'Badge', p: { label: "block", icon: "circle-exclamation-fill", variant: "solid", tone: "danger" } },
    { c: 'Badge', p: { label: "аудит ок", icon: "circle-check-fill", tone: "ok" } },
    { c: 'Badge', p: { label: "HTML5", variant: "quiet" } },
    { c: 'Badge', p: { label: "erid 2Vtzqx", variant: "quiet", nums: true, icon: "lock" } },
  ],
  pin: [
    { c: 'Pin', p: { number: 1 } },
    { c: 'Pin', p: { author: "Марина Ковалёва" } },
    { c: 'Pin', p: { number: 2, resolved: true } },
    { c: 'Pin', p: { author: "Игорь Волков", hasReply: true } },
  ],
  avatar: [
    { c: 'Avatar', p: { author: "Игорь Волков", size: "s" } },
    { c: 'Avatar', p: { author: "Марина Ковалёва", size: "m" } },
    { c: 'Avatar', p: { ai: true, size: "l" } },
    { c: 'Avatar', p: { author: "Пётр Ким", inverse: true, size: "m" } },
  ],
  skeleton: [
    { c: 'Skeleton', p: { shape: "circle", width: "28px" } },
    { c: 'Skeleton', p: { shape: "line", width: "60%" } },
    { c: 'Skeleton', p: { shape: "line", width: "38%", height: "10px" } },
    { c: 'Island', p: { rows: islandLoading } },
  ],
  choicerow: [
    { c: 'ChoiceRow', p: { label: "Тип выхода", options: demoTypeOpts, value: 0 } },
    { c: 'ChoiceRow', p: { label: "Якорь героя", options: demoAnchorOpts, value: 2, info: "Якорь — точка, за которую герой держится при пересчёте формата." } },
  ],
  slider: [
    { c: 'Slider', p: { label: "Охранное поле", value: 24, min: 0, max: 64, step: 1, unit: "px" } },
    { c: 'Slider', p: { label: "Скругление CTA", value: 12, min: 0, max: 32, step: 1, unit: "px", snapStep: 4 } },
  ],
  select: [
    { c: 'Select', p: { options: ["JPG", "PNG", "WEBP", "AVIF"], value: "PNG", ariaLabel: "Формат", style: {"width": "200px"} } },
    { c: 'Select', p: { placeholder: "Не выбрано", options: ["Растр", "Вектор"], ariaLabel: "Тип выхода", style: {"width": "200px"} } },
    { c: 'Select', p: { icon: "layers", options: ["Все слои", "Только видимые"], value: "Все слои", ariaLabel: "Слои", style: {"width": "220px"} } },
    { c: 'Select', p: { options: ["RUB", "USD", "EUR"], value: "RUB", invalid: true, ariaLabel: "Валюта", style: {"width": "160px"} } },
    { c: 'Select', p: { options: ["JPG", "PNG"], value: "JPG", disabled: true, ariaLabel: "Формат", style: {"width": "160px"} } },
  ],
  toast: [
    { c: 'Toast', p: { text: "12 форматов готовы к выгрузке", level: "ok" } },
    { c: 'Toast', p: { text: "Ревизия r15 собирается…", level: "info" } },
    { c: 'Toast', p: { text: "erid не заполнен у 3 форматов", level: "warn", actionLabel: "Показать" } },
    { c: 'Toast', p: { text: "Block: вес 412 КБ — площадка отклонит", level: "danger", actionLabel: "Открыть" } },
  ],
  island: [
    { c: 'Island', p: { rows: islandA } },
    { c: 'Island', p: { rows: islandB } },
    { c: 'Slider', p: { label: "Кегль лигала", value: 8, min: 6, max: 14, step: 0.5, unit: "pt" } },
    { c: 'Island', p: { rows: islandC } },
  ],
};
