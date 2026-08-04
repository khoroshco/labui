import type { CSSProperties, MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Icon } from '../lib/Icon.js';

export interface RowLabelProps extends PassThrough {
  label?: string;
  subtitle?: string;
  /** Только факт наличия подсказки; сам текст живёт у ряда. */
  hasInfo?: boolean;
  /** Состоянием раскрытия владеет родитель: компонент лишь рисует поворот ⓘ и высоту. */
  open?: boolean;
  onToggle?: () => void;
  style?: CSSProperties;
}

/** Лейбл ряда с необязательной ⓘ. Раскрытием подсказки владеет ряд. */
export function RowLabel({ label = '', subtitle = '', hasInfo = false, open = false, onToggle, style,
  ...rest
}: RowLabelProps) {
  return (
    <span
      {...passThrough(rest)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        minWidth: 0,
        position: 'relative',
        // компенсация масс: двухстрочный блок оптически заваливается вверх — опускаем на 1px
        top: subtitle ? '1px' : '0',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-15)' }}>
        <span
          style={{
            fontSize: 'var(--fs-m)',
            lineHeight: 'var(--lh-ui)',
            color: 'var(--text-secondary)',
            position: 'relative',
            top: '0.5px',
          }}
        >
          {label}
        </span>
        {hasInfo ? (
          <button
            data-tap="true"
            aria-expanded={open}
            aria-label={open ? 'Скрыть подсказку' : 'Показать подсказку'}
            // ⓘ сам гасит всплытие: действие ряда (фокус, флип) не должно дёргаться
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle?.();
            }}
            onMouseDown={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              background: 'none',
              color: open ? 'var(--text-primary)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color .15s ease, transform .35s var(--ease-spring)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <Icon name="circle-info" size={14} />
          </button>
        ) : null}
      </span>
      {subtitle ? (
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 'var(--fw-regular)',
            color: 'var(--text-tertiary)',
            lineHeight: 'var(--lh-ui)',
          }}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}
