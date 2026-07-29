/* Генерируется scripts/build-api.mjs из data-props каждого компонента. Руками не править. */
/* @banner-lab/ds 0.1.0 — контракт пропсов для потребителей. */

/** Avatar · atoms · stable */
export interface AvatarProps {
  /** По умолчанию: "Марина Ковалёва" */
  author?: string;
  /** По умолчанию: "" */
  src?: string;
  /** По умолчанию: "s" */
  size?: 's'|'m'|'l'|'xl';
  /** По умолчанию: false */
  ai?: boolean;
  /** По умолчанию: false */
  inverse?: boolean;
  /** По умолчанию: false */
  bare?: boolean;
}

/** Badge · atoms · stable */
export interface BadgeProps {
  /** По умолчанию: "300×250" */
  label?: string;
  /** По умолчанию: "" */
  icon?: string;
  /** По умолчанию: false */
  nums?: boolean;
  /** По умолчанию: "soft" */
  variant?: 'solid'|'soft'|'quiet';
  /** По умолчанию: "neutral" */
  tone?: 'neutral'|'ok'|'warn'|'danger'|'info';
}

/** Button · atoms · stable */
export interface ButtonProps {
  /** По умолчанию: "Выгрузить" */
  label?: string;
  /** По умолчанию: "primary" */
  variant?: 'primary'|'secondary'|'ghost'|'accent';
  /** По умолчанию: "m" */
  size?: 'xs'|'s'|'m'|'l';
  /** По умолчанию: "default" */
  tone?: 'default'|'ok'|'danger';
  /** По умолчанию: "" */
  icon?: string;
  /** По умолчанию: "" */
  iconRight?: string;
  /** По умолчанию: "" */
  tooltip?: string;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: false */
  loading?: boolean;
  onClick?: () => void;
}

/** Checkbox · atoms · stable */
export interface CheckboxProps {
  /** По умолчанию: "Применить ко всем форматам" */
  label?: string;
  /** По умолчанию: true */
  checked?: boolean;
  /** По умолчанию: false */
  invalid?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  ariaLabel?: string;
  bare?: boolean;
  onChange?: (on: boolean) => void;
}

/** CycleButton · atoms · stable */
export interface CycleButtonProps {
  options?: string[];
  /** По умолчанию: 0 */
  value?: number;
  /** По умолчанию: "" */
  tooltip?: string;
  /** По умолчанию: false */
  disabled?: boolean;
  onChange?: (index: number, option: string) => void;
}

/** Input · atoms · stable */
export interface InputProps {
  /** По умолчанию: "Осенний сейл" */
  value?: string;
  /** По умолчанию: "" */
  ariaLabel?: string;
  /** По умолчанию: "" */
  placeholder?: string;
  /** По умолчанию: "" */
  icon?: string;
  /** По умолчанию: "" */
  prefix?: string;
  /** По умолчанию: "" */
  suffix?: string;
  /** По умолчанию: false */
  clearable?: boolean;
  /** По умолчанию: 0 */
  maxLength?: number;
  /** По умолчанию: false */
  invalid?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: "left" */
  align?: 'left' | 'right';
  bare?: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onInput?: (value: string) => void;
}

/** OptionGroup · atoms · stable */
export interface OptionGroupProps {
  pill?: boolean;
  inverse?: boolean;
  options?: (string | {icon: string, title?: string, label?: string})[];
  /** По умолчанию: 0 */
  value?: number;
  /** По умолчанию: "" */
  ariaLabel?: string;
  /** По умолчанию: false */
  disabled?: boolean;
  onChange?: (index: number) => void;
}

/** Pin · atoms · stable */
export interface PinProps {
  /** По умолчанию: 1 */
  number?: number;
  /** По умолчанию: "" */
  author?: string;
  /** По умолчанию: "" */
  src?: string;
  /** По умолчанию: false */
  resolved?: boolean;
  /** По умолчанию: false */
  hasReply?: boolean;
}

/** Skeleton · atoms · stable */
export interface SkeletonProps {
  /** По умолчанию: "line" */
  shape?: 'line' | 'rect' | 'circle';
  /** По умолчанию: "140px" */
  width?: string;
  /** По умолчанию: "" */
  height?: string;
}

/** Toggle · atoms · stable */
export interface ToggleProps {
  /** По умолчанию: "Живое превью" */
  label?: string;
  /** По умолчанию: true */
  checked?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  ariaLabel?: string;
  bare?: boolean;
  onChange?: (checked: boolean) => void;
}

/** ActionRow · molecules · stable · монтирует: Button */
export interface ActionRowProps {
  /** По умолчанию: "Извлечь сцену" */
  label?: string;
  /** По умолчанию: "primary" */
  variant?: 'primary'|'secondary'|'ghost'|'accent';
  /** По умолчанию: false */
  loading?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  onClick?: () => void;
}

/** CheckboxRow · molecules · beta · монтирует: Checkbox, RowInfo, RowLabel, RowMsg */
export interface CheckboxRowProps {
  /** По умолчанию: "Применить ко всем форматам" */
  label?: string;
  /** По умолчанию: "" */
  subtitle?: string;
  /** По умолчанию: false */
  checked?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: "" */
  info?: string;
  infoImage?: string;
  /** По умолчанию: "" */
  msg?: string;
  /** По умолчанию: "ok" */
  msgLevel?: 'ok'|'warn'|'danger';
  onChange?: (checked: boolean) => void;
}

/** ChoiceRow · molecules · stable · монтирует: OptionGroup, RowInfo, RowLabel */
export interface ChoiceRowProps {
  /** По умолчанию: "Тип выхода" */
  label?: string;
  options?: (string | {icon: string, title?: string, label?: string})[];
  /** По умолчанию: 0 */
  value?: number;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: "" */
  info?: string;
  infoImage?: string;
  onChange?: (index: number) => void;
}

/** Disclosure · molecules · beta */
export interface DisclosureProps {
  /** По умолчанию: "Примеры" */
  label?: string;
  /** По умолчанию: "" */
  count?: number | string;
  /** По умолчанию: "eyebrow" */
  variant?: 'eyebrow'|'plain';
  /** По умолчанию: false */
  open?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  onToggle?: ((open: boolean) => void) | null;
  /** Содержимое кладёт родитель. */
  children?: unknown;
}

/** InputRow · molecules · stable · монтирует: CycleButton, Input, RowInfo, RowLabel, RowMsg, Skeleton */
export interface InputRowProps {
  /** По умолчанию: "Отступ лигала" */
  label?: string;
  /** По умолчанию: "10" */
  value?: string;
  /** По умолчанию: "" */
  placeholder?: string;
  options?: string[] | null;
  /** По умолчанию: 0 */
  maxLength?: number;
  /** По умолчанию: false */
  nums?: boolean;
  /** По умолчанию: false */
  loading?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: "" */
  msg?: string;
  /** По умолчанию: "ok" */
  msgLevel?: 'ok' | 'warn' | 'danger';
  /** По умолчанию: "" */
  info?: string;
  infoImage?: string;
  onInput?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** По умолчанию: 0 */
  optionIndex?: number;
  onOptionChange?: (index: number, option: string) => void;
}

/** PinCard · molecules · beta · монтирует: Avatar, Button, PinComposer */
export interface PinCardProps {
  messages?: ({ ai: true; text: string } | { ai?: false; text: string; name: string; src?: string })[];
  /** По умолчанию: "thread" */
  variant?: 'thread'|'preview';
  /** По умолчанию: false */
  resolved?: boolean;
  author?: string;
  onClick?: () => void;
  onResolve?: (resolved: boolean) => void;
  onSend?: (text: string) => void;
  onClose?: () => void;
}

/** PinComposer · molecules · beta · монтирует: Avatar, Button, Input */
export interface PinComposerProps {
  /** По умолчанию: "" */
  author?: string;
  authorSrc?: string;
  /** По умолчанию: "Комментарий…" */
  placeholder?: string;
  /** По умолчанию: "" */
  value?: string;
  /** По умолчанию: 0 */
  maxLength?: number;
  bare?: boolean;
  autofocus?: boolean;
  /** По умолчанию: "Отправить" */
  sendLabel?: string;
  onSend?: (text: string) => void;
  onCancel?: () => void;
}

/** RowInfo · molecules · stable */
export interface RowInfoProps {
  /** По умолчанию: true */
  open?: boolean;
  /** По умолчанию: "Текст подсказки приходит пропсом." */
  text?: string;
  /** По умолчанию: "" */
  image?: string;
}

/** RowLabel · molecules · stable */
export interface RowLabelProps {
  /** По умолчанию: "Запекать в растр" */
  label?: string;
  /** По умолчанию: "" */
  subtitle?: string;
  /** По умолчанию: true */
  hasInfo?: boolean;
  /** По умолчанию: false */
  open?: boolean;
  onToggle?: () => void;
}

/** RowMsg · molecules · stable */
export interface RowMsgProps {
  /** По умолчанию: "Токен — латиница и цифры, минимум 11 символов" */
  text?: string;
  /** По умолчанию: "danger" */
  level?: 'ok' | 'warn' | 'danger';
}

/** Segments · molecules · stable · монтирует: OptionGroup */
export interface SegmentsProps {
  options?: string[];
  /** По умолчанию: 0 */
  value?: number;
  onChange?: (i: number) => void;
}

/** Slider · molecules · stable · монтирует: CycleButton */
export interface SliderProps {
  /** По умолчанию: "Охранное поле" */
  label?: string;
  /** По умолчанию: 24 */
  value?: number;
  /** По умолчанию: 0 */
  min?: number;
  /** По умолчанию: 64 */
  max?: number;
  /** По умолчанию: 1 */
  step?: number;
  /** По умолчанию: "px" */
  unit?: string;
  options?: string[];
  /** По умолчанию: 0 */
  optionIndex?: number;
  onOptionChange?: (i: number, o: string) => void;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: 0 */
  snapStep?: number;
  onChange?: (v: number) => void;
}

/** SwitchRow · molecules · stable · монтирует: RowInfo, RowLabel, RowMsg, Toggle */
export interface SwitchRowProps {
  /** По умолчанию: "Запекать в растр" */
  label?: string;
  /** По умолчанию: "" */
  subtitle?: string;
  /** По умолчанию: false */
  checked?: boolean;
  /** По умолчанию: false */
  disabled?: boolean;
  /** По умолчанию: "" */
  info?: string;
  infoImage?: string;
  /** По умолчанию: "" */
  msg?: string;
  /** По умолчанию: "ok" */
  msgLevel?: 'ok'|'warn';
  onChange?: (checked: boolean) => void;
}

/** Tabs · molecules · stable */
export interface TabsProps {
  options?: [string, string][];
  /** По умолчанию: 0 */
  value?: number;
  onChange?: (i: number) => void;
}

/** Toast · molecules · stable · монтирует: Button */
export interface ToastProps {
  /** По умолчанию: "12 форматов готовы к выгрузке" */
  text?: string;
  /** По умолчанию: "info" */
  level?: 'info'|'ok'|'warn'|'danger';
  /** По умолчанию: "" */
  actionLabel?: string;
  leaving?: boolean;
  gap?: number;
  /** По умолчанию: 0 */
  duration?: number;
  onAction?: () => void;
  onTimeout?: () => void;
  onClose?: (() => void) | null;
}

/** EmptyState · organisms · beta · монтирует: Button */
export interface EmptyStateProps {
  /** По умолчанию: "empty" */
  variant?: 'empty'|'error';
  /** По умолчанию: "Пока нет форматов" */
  label?: string;
  /** По умолчанию: "Добавьте первый баннер — он появится здесь вместе с остальной раскладкой." */
  subtitle?: string;
  /** По умолчанию: "" */
  icon?: string;
  /** По умолчанию: "Добавить баннер" */
  actionLabel?: string;
  onAction?: () => void;
}

/** Island · organisms · stable · монтирует: ActionRow, CheckboxRow, ChoiceRow, InputRow, SwitchRow */
export interface IslandProps {
  rows?: IslandRow[];
}

export type ComponentName =
  | 'Avatar'
  | 'Badge'
  | 'Button'
  | 'Checkbox'
  | 'CycleButton'
  | 'Input'
  | 'OptionGroup'
  | 'Pin'
  | 'Skeleton'
  | 'Toggle'
  | 'ActionRow'
  | 'CheckboxRow'
  | 'ChoiceRow'
  | 'Disclosure'
  | 'InputRow'
  | 'PinCard'
  | 'PinComposer'
  | 'RowInfo'
  | 'RowLabel'
  | 'RowMsg'
  | 'Segments'
  | 'Slider'
  | 'SwitchRow'
  | 'Tabs'
  | 'Toast'
  | 'EmptyState'
  | 'Island';

export interface ComponentPropsMap {
  Avatar: AvatarProps;
  Badge: BadgeProps;
  Button: ButtonProps;
  Checkbox: CheckboxProps;
  CycleButton: CycleButtonProps;
  Input: InputProps;
  OptionGroup: OptionGroupProps;
  Pin: PinProps;
  Skeleton: SkeletonProps;
  Toggle: ToggleProps;
  ActionRow: ActionRowProps;
  CheckboxRow: CheckboxRowProps;
  ChoiceRow: ChoiceRowProps;
  Disclosure: DisclosureProps;
  InputRow: InputRowProps;
  PinCard: PinCardProps;
  PinComposer: PinComposerProps;
  RowInfo: RowInfoProps;
  RowLabel: RowLabelProps;
  RowMsg: RowMsgProps;
  Segments: SegmentsProps;
  Slider: SliderProps;
  SwitchRow: SwitchRowProps;
  Tabs: TabsProps;
  Toast: ToastProps;
  EmptyState: EmptyStateProps;
  Island: IslandProps;
}
