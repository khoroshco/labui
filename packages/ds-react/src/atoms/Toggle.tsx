import { useEffect, type CSSProperties, type KeyboardEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { useControlled } from '../lib/hooks.js';

export interface ToggleProps extends PassThrough {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  /** Нужен, когда подпись лежит СНАРУЖИ компонента: иначе контрол безымянный. */
  ariaLabel?: string;
  /** Чисто визуал: состоянием, вводом и семантикой владеет родительский ряд. */
  bare?: boolean;
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

export function Toggle({
  label = '',
  checked,
  defaultChecked = false,
  disabled = false,
  ariaLabel,
  bare = false,
  onChange,
  style,
  ...rest
}: ToggleProps) {
  const [on, setOn] = useControlled(checked, defaultChecked, onChange);

  useEffect(() => {
    if (!bare && !label && !ariaLabel) {
      console.warn('Toggle: нет ни label, ни ariaLabel — контрол безымянный для скринридера');
    }
  }, [bare, label, ariaLabel]);

  const flip = () => {
    if (bare || disabled) return;
    setOn(!on);
  };

  return (
    <label
      {...passThrough(rest)}
      tabIndex={bare || disabled ? -1 : 0}
      // bare: семантику несёт родительский ряд — прячем свою роль, чтобы SR не читал два свитча
      role={bare ? undefined : 'switch'}
      aria-hidden={bare ? true : undefined}
      aria-checked={on}
      aria-disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
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
        data-track="true"
        style={{
          width: '36px',
          height: '21px',
          borderRadius: 'var(--r-full)',
          // disabled — единый язык ДС: гасим токеном и приглушаем поверхность, без ad-hoc opacity
          background: disabled ? 'var(--bg-hover)' : on ? 'var(--inverse-bg)' : 'var(--bg-active)',
          position: 'relative',
          transition: 'background .25s ease',
          display: 'inline-block',
          flex: 'none',
        }}
      >
        <span
          data-knob="true"
          style={{
            position: 'absolute',
            top: '2.5px',
            left: on ? '17.5px' : '2.5px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: disabled ? 'var(--text-disabled)' : on ? 'var(--inverse-text)' : 'var(--text-secondary)',
            transition: 'left .35s var(--ease-spring), background .25s ease',
          }}
        />
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
}
