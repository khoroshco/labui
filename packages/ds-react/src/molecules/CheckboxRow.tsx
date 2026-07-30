import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { Checkbox } from '../atoms/Checkbox.js';
import { useControlled } from '../lib/hooks.js';
import { RowInfo } from './RowInfo.js';
import { RowLabel } from './RowLabel.js';
import { RowMsg, type MsgLevel } from './RowMsg.js';

export interface CheckboxRowProps {
  label?: string;
  subtitle?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  info?: string;
  infoImage?: string;
  msg?: string;
  msgLevel?: MsgLevel;
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

/**
 * Ряд-чекбокс: ВЫБОР или согласие, часть формы. Снятая галочка — законное «нет», которое
 * можно потребовать исправить, поэтому здесь есть полная валидация, включая danger.
 * Отдельно от SwitchRow, потому что различие не в виде контрола, а в смысле.
 */
export function CheckboxRow({
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
}: CheckboxRowProps) {
  const [on, setOn] = useControlled(checked, defaultChecked, onChange);
  const [infoOpen, setInfoOpen] = useState(false);
  const hasInfo = !!info;
  const open = hasInfo && infoOpen;
  const isError = msgLevel === 'danger';

  const fromInfo = (e: MouseEvent | null) =>
    !!(e && e.target && (e.target as HTMLElement).closest?.('button[aria-expanded]'));

  const flip = (e: MouseEvent | null) => {
    if (disabled || fromInfo(e)) return;
    if (e && e.detail > 0 && e.currentTarget) (e.currentTarget as HTMLElement).blur();
    setOn(!on);
  };

  return (
    <div
      data-row="true"
      data-invalid={isError ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      tabIndex={disabled ? -1 : 0}
      role="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      aria-invalid={isError ? true : undefined}
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
        {/* рамка чекбокса краснеет тем же --danger, что сообщение — один красный на ряд */}
        <Checkbox bare checked={on} invalid={isError} disabled={disabled} />
      </span>
      <RowInfo open={open} text={info} image={infoImage} />
      <RowMsg text={msg} level={msgLevel} />
    </div>
  );
}
