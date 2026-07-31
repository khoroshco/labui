import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Toggle } from '../atoms/Toggle.js';
import { useControlled } from '../lib/hooks.js';
import { RowInfo } from './RowInfo.js';
import { RowLabel } from './RowLabel.js';
import { RowMsg } from './RowMsg.js';

export interface SwitchRowProps extends PassThrough {
  label?: string;
  subtitle?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  info?: string;
  infoImage?: string;
  msg?: string;
  /** У переключателя нет «неверно» — есть последствие выбора. Поэтому только ok и warn. */
  msgLevel?: 'ok' | 'warn';
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

/**
 * Ряд-переключатель: мгновенная настройка. Ряд САМ себе контрол — role, aria-checked,
 * tabindex и клавиатура у него собственные, а корень — div: вложенный label порождал бы
 * второе активационное событие с другим target, мимо гейта ⓘ.
 */
export function SwitchRow({
  label = '',
  subtitle = '',
  checked,
  defaultChecked = false,
  disabled = false,
  info = '',
  infoImage = '',
  msg = '',
  msgLevel = 'ok',
  onChange,
  style,
  ...rest
}: SwitchRowProps) {
  const [on, setOn] = useControlled(checked, defaultChecked, onChange);
  const [infoOpen, setInfoOpen] = useState(false);
  const hasInfo = !!info;
  const open = hasInfo && infoOpen;

  // Клик по ⓘ не должен дёргать действие ряда: ряд сам игнорирует клики из раскрывашки,
  // а не надеется, что дочерний маунт погасит всплытие.
  const fromInfo = (e: MouseEvent | null) =>
    !!(e && e.target && (e.target as HTMLElement).closest?.('button[aria-expanded]'));

  const flip = (e: MouseEvent | null) => {
    if (disabled || fromInfo(e)) return;
    // мышиный клик снимает фокус с ряда: действие мгновенное, кольцо — только с клавиатуры
    if (e && e.detail > 0 && e.currentTarget) (e.currentTarget as HTMLElement).blur();
    setOn(!on);
  };

  return (
    <div
      {...passThrough(rest)}
      data-row="true"
      data-disabled={disabled ? 'true' : 'false'}
      tabIndex={disabled ? -1 : 0}
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          flip(null);
        }
      }}
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={flip}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 var(--sp-4)',
        cursor: 'pointer',
        ...style,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'var(--row-h)',
          gap: 'var(--sp-3)',
          padding: `${subtitle ? '7px' : '0'} 0`,
        }}
      >
        <RowLabel label={label} subtitle={subtitle} hasInfo={hasInfo} open={open} onToggle={() => setInfoOpen((v) => !v)} />
        <Toggle bare checked={on} disabled={disabled} />
      </span>
      <RowInfo open={open} text={info} image={infoImage} />
      {/* У тоггла ОШИБКИ не бывает: оба состояния валидны. Но предупреждение бывает —
          оно говорит не «неверно», а «вот последствие выбора». */}
      <RowMsg text={msg} level={msgLevel === 'ok' ? 'ok' : 'warn'} />
    </div>
  );
}
