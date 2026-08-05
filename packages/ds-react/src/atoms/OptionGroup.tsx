import { forwardRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Icon, type IconName } from '../lib/Icon.js';
import { useControlled, useTrackActive } from '../lib/hooks.js';

export type OptionItem = string | { icon: IconName; title?: string; label?: string };

export interface OptionGroupProps extends PassThrough {
  /** Капсульная подача: скользящая пилюля и полные радиусы. */
  pill?: boolean;
  /** На инверсной подложке. */
  inverse?: boolean;
  options?: OptionItem[];
  value?: number;
  defaultValue?: number;
  ariaLabel?: string;
  disabled?: boolean;
  onChange?: (index: number) => void;
  style?: CSSProperties;
}

/**
 * Группа опций с одним выбором. Активная опция — скользящая подложка-пилюля, а не
 * телепорт: подложка едет к выбранной пружиной.
 *
 * Ничьих пикселей внутри группы нет: зазор между опциями принадлежит кнопкам
 * (хук data-hit в ds.css расширяет хит-зону на половину зазора).
 */
export const OptionGroup = forwardRef<HTMLDivElement, OptionGroupProps>(function OptionGroup({
  pill = false,
  inverse = false,
  options = [],
  value,
  defaultValue = 0,
  ariaLabel,
  disabled = false,
  onChange,
  style,
  ...rest
}, ref) {
  const n = options.length;
  const [raw, setRaw] = useControlled(value, defaultValue, onChange);
  const sel = n ? Math.max(0, Math.min(Number(raw ?? 0), n - 1)) : 0;
  const { box, rect } = useTrackActive(sel, [n, pill, inverse]);

  const keyNav = (e: KeyboardEvent) => {
    if (disabled) return;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir || !n) return;
    e.preventDefault();
    const next = (sel + dir + n) % n;
    setRaw(next);
    const btns = box.current?.querySelectorAll('button');
    btns?.[next]?.focus();
  };

  return (
    <div
      {...passThrough(rest)}
      ref={(el) => {
        box.current = el;
        setRef(ref, el);
      }}
      role="radiogroup"
      aria-label={ariaLabel || undefined}
      onKeyDown={keyNav}
      style={{ display: 'inline-flex', gap: 'var(--sp-05)', position: 'relative', ...style }}
    >
      <span
        data-pill="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${rect ? rect.left : 0}px`,
          width: `${rect ? rect.w : 36}px`,
          borderRadius: pill ? 'var(--r-full)' : '8px',
          background: inverse ? 'var(--inverse-bg)' : 'var(--bg-active)',
          opacity: rect ? '1' : '0',
          transition: 'left .35s var(--ease-spring), width .35s var(--ease-spring)',
          pointerEvents: 'none',
        }}
      />
      {options.map((o, j) => {
        const icon = typeof o === 'object' ? (o.icon ?? '') : '';
        const label = typeof o === 'string' ? o : (o.label ?? '');
        const title = typeof o === 'object' ? (o.title ?? '') : '';
        const active = j === sel;
        return (
          <button
            key={j}
            data-opt="true"
            data-hit="xs"
            data-track-item=""
            data-inverse={inverse ? 'true' : undefined}
            // нативный disabled: убирает из таба, озвучивает состояние и снимает ховер с прессом
            disabled={disabled}
            role="radio"
            aria-checked={active}
            aria-label={icon ? title || label || icon : undefined}
            tabIndex={active ? 0 : -1}
            data-tooltip={title || undefined}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              if (disabled) return;
              setRaw(j);
            }}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'var(--control-h-s)',
              minWidth: 'var(--control-h-s)',
              padding: icon ? '0' : pill ? '0 var(--sp-4)' : '0 var(--sp-3)',
              border: 'none',
              borderRadius: pill ? 'var(--r-full)' : '8px',
              // пока пилюля не измерена, активная опция несёт фон сама — иначе выбор мигает
              background: active && !rect ? (inverse ? 'var(--inverse-bg)' : 'var(--bg-active)') : 'transparent',
              color: disabled
                ? 'var(--text-disabled)'
                : active
                  ? inverse
                    ? 'var(--inverse-text)'
                    : 'var(--text-primary)'
                  : inverse
                    ? 'var(--text-secondary)'
                    : 'var(--text-tertiary)',
              fontFamily: 'var(--font-ui)',
              fontWeight: pill ? 'var(--fw-medium)' : 'var(--fw-regular)',
              fontSize: 'var(--fs-m)',
              lineHeight: 'var(--lh-ui)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {icon ? <Icon name={icon as IconName} size={16} /> : <span style={{ position: 'relative', top: '1px' }}>{label}</span>}
          </button>
        );
      })}
    </div>
  );
});
