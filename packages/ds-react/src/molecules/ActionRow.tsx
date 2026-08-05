import { forwardRef, type CSSProperties } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Button, type ButtonVariant } from '../atoms/Button.js';

export interface ActionRowProps extends PassThrough {
  label?: string;
  variant?: ButtonVariant;
  /** Значение заменяется скелетоном (после 320 мс), ввод блокируется сразу. */
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

/** Ряд-действие: кнопка по центру острова. */
export const ActionRow = forwardRef<HTMLDivElement, ActionRowProps>(function ActionRow({ label = '', variant = 'primary', loading = false, disabled = false, onClick, style,
  ...rest
}, ref) {
  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      data-row="true"
      data-disabled={disabled ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'var(--row-h)',
        padding: '0 var(--sp-3)',
        ...style,
      }}
    >
      <Button label={label} size="s" variant={variant} loading={loading} disabled={disabled} onClick={onClick} />
    </div>
  );
});
