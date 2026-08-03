import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { collapsedProps } from '../lib/collapsed.js';
import { Icon } from '../lib/Icon.js';
import { useControlled } from '../lib/hooks.js';

export interface DisclosureProps extends PassThrough {
  label?: string;
  /** Служебное число у подписи — как счётчики Tabs. */
  count?: number | string;
  variant?: 'eyebrow' | 'plain';
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  onToggle?: (open: boolean) => void;
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * Раскрывашка уровня СЕКЦИИ: заголовок-кнопка и содержимое, которое растёт по высоте.
 * Родня RowInfo, но со своим заголовком и живёт ВНЕ острова, как Slider.
 *
 * Движение взято у RowMsg один в один: grid-rows, вход .3s ease-out, выход короче
 * (.2s ease-in), без прозрачности — содержимое не мигает, а именно раскрывается.
 */
export function Disclosure({
  label = '',
  count,
  variant = 'eyebrow',
  open: openProp,
  defaultOpen = false,
  disabled = false,
  onToggle,
  children,
  style,
  ...rest
}: DisclosureProps) {
  const [rawOpen, setOpen] = useControlled(openProp, defaultOpen, onToggle);
  const open = !disabled && rawOpen;
  const eyebrow = variant === 'eyebrow';
  const hasCount = count !== undefined && count !== null && count !== '';
  const bodyId = useId();

  return (
    <div
      {...passThrough(rest)} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <button
        data-disc={eyebrow ? 'eyebrow' : 'plain'}
        data-disabled={disabled ? 'true' : 'false'}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={bodyId}
        // мгновенное действие мышью не оставляет фокус-кольца; клавиатурный Tab — оставляет
        onMouseDown={(e: MouseEvent) => e.preventDefault()}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          // рубрика жмётся по содержимому, обычный вид — во всю ширину с шевроном у края
          alignSelf: eyebrow ? 'flex-start' : 'stretch',
          width: eyebrow ? 'auto' : '100%',
          justifyContent: 'space-between',
          gap: 'var(--sp-2)',
          minHeight: eyebrow ? 'var(--control-h-xs)' : 'var(--control-h-m)',
          padding: 0,
          border: 'none',
          background: 'none',
          color: disabled ? 'var(--text-disabled)' : open ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-ui)',
          fontWeight: eyebrow ? 'var(--fw-medium)' : 'var(--fw-regular)',
          fontSize: eyebrow ? 'var(--fs-xs)' : 'var(--fs-m)',
          letterSpacing: eyebrow ? 'var(--ls-eyebrow)' : 'normal',
          textTransform: eyebrow ? 'uppercase' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--sp-15)', minWidth: 0 }}>
          {/* хвост трекинга у капса компенсируем, иначе шеврон отъезжает */}
          <span style={{ position: 'relative', top: '0.5px', marginRight: eyebrow ? 'calc(-1 * var(--ls-eyebrow))' : '0px' }}>
            {label}
          </span>
          {hasCount ? (
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 'var(--fw-regular)',
                lineHeight: 'var(--lh-ui)',
                letterSpacing: 'normal',
                color: 'var(--text-tertiary)',
              }}
            >
              {String(count)}
            </span>
          ) : null}
        </span>
        <span
          style={{
            display: 'inline-flex',
            flex: 'none',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform .35s var(--ease-spring)',
          }}
        >
          <Icon name="chevron-down" size={eyebrow ? 12 : 14} />
        </span>
      </button>
      <div
        id={bodyId}
        role="group"
        // свёрнутое содержимое уходит из таба и из дерева доступности — см. collapsedProps
        {...collapsedProps(!open)}
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: open ? 'grid-template-rows .3s var(--ease-out)' : 'grid-template-rows .2s var(--ease-in)',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ paddingTop: eyebrow ? 'var(--sp-25)' : 'var(--sp-2)' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
