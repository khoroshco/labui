import { forwardRef, type CSSProperties } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Button } from '../atoms/Button.js';
import { Icon, type IconName } from '../lib/Icon.js';

export interface EmptyStateProps extends PassThrough {
  variant?: 'empty' | 'error';
  label?: string;
  subtitle?: string;
  icon?: IconName | '';
  actionLabel?: string;
  onAction?: () => void;
  style?: CSSProperties;
}

/**
 * Заглушка НА МЕСТЕ контента, когда показывать нечего. Занимает место списка, не всплывает
 * поверх: эфемерное событие — это Toast, а не пустой экран.
 *
 * Вид кнопки принадлежит EmptyState (secondary), иконку выбирает вариант: в пустом экране
 * действие всегда одно, и выбирать иерархию снаружи нечего — это был бы Button, переписанный
 * пропсами наружу.
 */
const VARIANTS = {
  empty: { icon: 'picture' as IconName, bg: 'var(--bg-hover)', color: 'var(--text-tertiary)', action: 'plus' as IconName },
  error: { icon: 'circle-exclamation' as IconName, bg: 'var(--danger-dim)', color: 'var(--danger)', action: 'arrows-rotate-right' as IconName },
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState({
  variant = 'empty',
  label = '',
  subtitle = '',
  icon = '',
  actionLabel = '',
  onAction,
  style,
  ...rest
}, ref) {
  const v = VARIANTS[variant] ?? VARIANTS.empty;
  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-7) var(--sp-5)',
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: 'var(--r-full)',
          background: v.bg,
          color: v.color,
          flex: 'none',
        }}
      >
        <Icon name={(icon || v.icon) as IconName} size={24} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-15)', maxWidth: 'var(--measure-narrow)' }}>
        <div
          style={{
            fontSize: 'var(--fs-l)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--text-primary)',
            lineHeight: 'var(--lh-ui)',
            textWrap: 'pretty' as CSSProperties['textWrap'],
          }}
        >
          {label}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 'var(--fs-m)',
              fontWeight: 'var(--fw-regular)',
              color: 'var(--text-secondary)',
              lineHeight: 'var(--lh-text)',
              textWrap: 'pretty' as CSSProperties['textWrap'],
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {actionLabel ? (
        <span style={{ marginTop: 'var(--sp-1)' }}>
          <Button label={actionLabel} icon={v.action} variant="secondary" size="s" onClick={onAction} />
        </span>
      ) : null}
    </div>
  );
});
