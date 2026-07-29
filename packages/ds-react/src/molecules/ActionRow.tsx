import type { CSSProperties } from 'react';
import { Button, type ButtonVariant } from '../atoms/Button';

export interface ActionRowProps {
  label?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

/** Ряд-действие: кнопка по центру острова. */
export function ActionRow({ label = '', variant = 'primary', loading = false, disabled = false, onClick, style }: ActionRowProps) {
  return (
    <div
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
}
