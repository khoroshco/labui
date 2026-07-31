import type { CSSProperties, MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { useControlled } from '../lib/hooks.js';

export interface CycleButtonProps extends PassThrough {
  options?: string[];
  value?: number;
  defaultValue?: number;
  tooltip?: string;
  disabled?: boolean;
  onChange?: (index: number, option: string) => void;
  style?: CSSProperties;
}

/** Циклер: пилюля, которая перебирает короткий набор значений по клику. */
export function CycleButton({
  options,
  value,
  defaultValue = 0,
  tooltip = '',
  disabled = false,
  onChange,
  style,
  ...rest
}: CycleButtonProps) {
  const opts = Array.isArray(options) && options.length ? options : ['PX', 'REM'];
  // Идиома общая на все шесть контролов (ADR 0011): задан value — владеет родитель,
  // задан только defaultValue — кнопка ведёт своё. Своя реализация «живой всегда» тут
  // была лечением симптома: замирал циклер не сам по себе, а потому что ряд отдавал ему
  // значение, не отдавая колбэка. Лечится это в композиции, а не расхождением идиом.
  const [raw, setRaw] = useControlled(value, defaultValue, (next: number) =>
    onChange?.(next, opts[((next % opts.length) + opts.length) % opts.length] ?? '')
  );
  const i = ((raw % opts.length) + opts.length) % opts.length;

  return (
    <button
      {...passThrough(rest)}
      data-tap="true"
      data-cycle="true"
      disabled={disabled}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        setRaw((i + 1) % opts.length);
      }}
      // живёт внутри кликабельных рядов: гасим mousedown, чтобы не красть фокус у ряда
      onMouseDown={(e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      // disabled не реагирует ни на что: ни ховера, ни курсора-руки, ни тултипа
      data-tooltip={disabled ? undefined : tooltip || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'var(--control-h-xs)',
        padding: '0 var(--sp-15)',
        background: 'transparent',
        border: `1px solid ${disabled ? 'var(--border-subtle)' : 'var(--border)'}`,
        borderRadius: 'var(--r-s)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
        fontSize: 'var(--fs-xs)',
        lineHeight: 'var(--lh-ui)',
        letterSpacing: 'var(--ls-pill)',
        ...style,
      }}
    >
      <span style={{ position: 'relative', top: '1.5px', textTransform: 'uppercase', marginRight: 'calc(-1 * var(--ls-pill))' }}>
        {String(opts[i] ?? '')}
      </span>
    </button>
  );
}
