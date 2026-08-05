import { forwardRef, useEffect, type CSSProperties, type KeyboardEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Icon } from '../lib/Icon.js';
import { useControlled } from '../lib/hooks.js';

export interface CheckboxProps extends PassThrough {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Рамка краснеет тем же --danger, что и сообщение ряда. */
  invalid?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  /** Чисто визуал: состоянием, вводом и семантикой владеет родительский ряд. */
  bare?: boolean;
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

export const Checkbox = forwardRef<HTMLLabelElement, CheckboxProps>(function Checkbox({
  label = '',
  checked,
  defaultChecked = false,
  invalid: invalidProp = false,
  disabled = false,
  ariaLabel,
  bare = false,
  onChange,
  style,
  ...rest
}, ref) {
  const [on, setOn] = useControlled(checked, defaultChecked, onChange);
  // выключенное — потолок яркости: ошибку у disabled не показываем, иначе красный ярче гашения
  const invalid = invalidProp && !disabled;

  useEffect(() => {
    if (!bare && !label && !ariaLabel) {
      console.warn('Checkbox: нет ни label, ни ariaLabel — контрол безымянный для скринридера');
    }
  }, [bare, label, ariaLabel]);

  const flip = () => {
    if (bare || disabled) return;
    setOn(!on);
  };

  return (
    <label
      {...passThrough(rest)}
      ref={ref}
      tabIndex={bare || disabled ? -1 : 0}
      role={bare ? undefined : 'checkbox'}
      aria-hidden={bare ? true : undefined}
      aria-checked={on}
      aria-disabled={disabled}
      aria-invalid={invalid ? true : undefined}
      aria-label={label ? undefined : ariaLabel}
      onKeyDown={(e: KeyboardEvent) => {
        // Enter НЕ наш. У нативного чекбокса он отправляет форму, а переключает пробел;
        // перехватывая обе клавиши и гася событие, ряд забирал у формы потребителя
        // отправку с клавиатуры. Правило подсмотрено у Base UI, где ради него написан
        // отдельный блок: Enter гасит активацию и кликает сабмиттер формы.
        if (e.key === ' ') {
          e.preventDefault();
          flip();
        }
      }}
      onClick={flip}
      style={{
        display: 'flex',
        width: 'fit-content',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        cursor: bare ? 'default' : disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        pointerEvents: bare ? 'none' : 'auto',
        ...style,
      }}
    >
      <span
        data-box="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '5px',
          // Ошибка красит чекбокс ЦЕЛИКОМ тем же --danger, что сообщение ряда: отмеченный —
          // красная заливка с белой галочкой, снятый — красная рамка. Рамка поверх тёмной
          // заливки читалась как «рамка в рамке», а не как ошибка.
          border: `1px solid ${
            disabled ? 'var(--border)' : invalid ? 'var(--danger)' : on ? 'var(--inverse-bg)' : 'var(--border-strong)'
          }`,
          background: disabled
            ? on
              ? 'var(--bg-active)'
              : 'transparent'
            : on && invalid
              ? 'var(--danger)'
              : on
                ? 'var(--inverse-bg)'
                : 'transparent',
          // ИНВАРИАНТ: внутри disabled ничто не ярче --text-disabled
          color: disabled ? 'var(--text-disabled)' : 'var(--inverse-text)',
          transition: 'background .25s ease, border-color .25s ease',
          flex: 'none',
        }}
      >
        <span style={{ display: 'flex', transform: on ? 'scale(1)' : 'scale(0)', transition: 'transform .35s var(--ease-spring)' }}>
          <Icon name="check" size={12} />
        </span>
      </span>
      {label ? (
        <span
          style={{
            fontSize: 'var(--fs-m)',
            lineHeight: 'var(--lh-ui)',
            color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
            position: 'relative',
            top: '0.5px',
          }}
        >
          {label}
        </span>
      ) : null}
    </label>
  );
});
