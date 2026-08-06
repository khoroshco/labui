'use client';

/* Директива обязана быть ПЕРВОЙ строкой точки входа. Все 27 компонентов клиентские
 * (useState/useEffect/forwardRef), плюс installFocusModality() — побочный эффект уровня
 * модуля. Без директивы Next.js App Router роняет сборку потребителя на первом импорте:
 * серверный компонент не имеет права тянуть хуки. */

/* Публичная поверхность пакета. Экспорт именованный: дерево тряски работает, а импорт
 * по путям (@khoroshco/ds/Button) не заводим — как только сервисы начнут им пользоваться,
 * менять раскладку файлов станет breaking change. */
import { installFocusModality } from './lib/focusModality.js';

// Побочный эффект осознанный: все правила фокуса в ds.css висят на html[data-modality],
// и без него у потребителя нет ни одного фокус-кольца. Под SSR не выполняется.
installFocusModality();

export { installFocusModality } from './lib/focusModality.js';
export { Icon, type IconName, type IconProps } from './lib/Icon.js';
export { useControlled, useReducedMotion, useSpin, useTrackActive } from './lib/hooks.js';

export { Skeleton, type SkeletonProps } from './atoms/Skeleton.js';
export { Badge, type BadgeProps, type BadgeTone, type BadgeVariant } from './atoms/Badge.js';
export { Avatar, type AvatarProps } from './atoms/Avatar.js';
export { Pin, type PinProps } from './atoms/Pin.js';
export { Toggle, type ToggleProps } from './atoms/Toggle.js';
export { Checkbox, type CheckboxProps } from './atoms/Checkbox.js';
export { Button, type ButtonProps, type ButtonSize, type ButtonTone, type ButtonVariant } from './atoms/Button.js';
export { CycleButton, type CycleButtonProps } from './atoms/CycleButton.js';
export { OptionGroup, type OptionGroupProps, type OptionItem } from './atoms/OptionGroup.js';
export { Input, type InputProps } from './atoms/Input.js';
export { Textarea, type TextareaProps } from './atoms/Textarea.js';

export { RowLabel, type RowLabelProps } from './molecules/RowLabel.js';
export { RowInfo, type RowInfoProps } from './molecules/RowInfo.js';
export { RowMsg, type MsgLevel, type RowMsgProps } from './molecules/RowMsg.js';
export { ActionRow, type ActionRowProps } from './molecules/ActionRow.js';
export { ChoiceRow, type ChoiceRowProps } from './molecules/ChoiceRow.js';
export { SwitchRow, type SwitchRowProps } from './molecules/SwitchRow.js';
export { CheckboxRow, type CheckboxRowProps } from './molecules/CheckboxRow.js';
export { Segments, type SegmentsProps } from './molecules/Segments.js';
export { Tabs, type TabItem, type TabsProps } from './molecules/Tabs.js';
export { InputRow, type InputRowProps } from './molecules/InputRow.js';
export { Slider, type SliderProps } from './molecules/Slider.js';
export { PinCard, type PinCardProps, type PinMessage } from './molecules/PinCard.js';
export { PinComposer, type PinComposerProps } from './molecules/PinComposer.js';
export { Toast, type ToastLevel, type ToastProps } from './molecules/Toast.js';
export { Disclosure, type DisclosureProps } from './molecules/Disclosure.js';
export { Select, type SelectOption, type SelectProps, type SelectReason } from './molecules/Select.js';

export { EmptyState, type EmptyStateProps } from './organisms/EmptyState.js';
export { Island, type IslandProps, type IslandRow } from './organisms/Island.js';
export { Modal, type ModalProps, type ModalReason } from './organisms/Modal.js';
