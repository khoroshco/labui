import type { CSSProperties } from 'react';
import { Icon, type IconName } from '../lib/Icon';

export type BadgeVariant = 'solid' | 'soft' | 'quiet';
export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

export interface BadgeProps {
  label?: string;
  icon?: IconName | '';
  nums?: boolean;
  variant?: BadgeVariant;
  tone?: BadgeTone;
  style?: CSSProperties;
}

/**
 * Ярлык КОРОТКОЙ информации: значение, формат, статус одним-двумя словами. Перенос строк
 * запрещён — если текст не помещается в строку, это не бейдж, а текст или сообщение.
 *
 * Две ортогональные оси: variant — вес подачи, tone — семантика. Тон работает с любым
 * вариантом; бизнес-сущности своих вариантов не получают (ярлык erid — это quiet + nums,
 * а слово «erid» приходит в label).
 */
const TONES: Record<BadgeTone, { c: string; dim: string; solidBg: string; solidFg: string; quiet: string }> = {
  neutral: { c: 'var(--text-secondary)', dim: 'var(--bg-active)', solidBg: 'var(--inverse-bg)', solidFg: 'var(--inverse-text)', quiet: 'var(--text-tertiary)' },
  ok: { c: 'var(--ok)', dim: 'var(--ok-dim)', solidBg: 'var(--ok)', solidFg: 'var(--on-tone)', quiet: 'var(--ok)' },
  warn: { c: 'var(--warn)', dim: 'var(--warn-dim)', solidBg: 'var(--warn)', solidFg: 'var(--on-tone)', quiet: 'var(--warn)' },
  danger: { c: 'var(--danger)', dim: 'var(--danger-dim)', solidBg: 'var(--danger)', solidFg: 'var(--on-tone)', quiet: 'var(--danger)' },
  info: { c: 'var(--info)', dim: 'var(--info-dim)', solidBg: 'var(--info)', solidFg: 'var(--on-tone)', quiet: 'var(--info)' },
};

export function Badge({ label = '', icon, nums, variant = 'soft', tone = 'neutral', style }: BadgeProps) {
  const t = TONES[tone] ?? TONES.neutral;
  const quiet = variant === 'quiet';
  const solid = variant === 'solid';
  return (
    <span
      data-nums={nums ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        height: 'var(--control-h-xs)',
        // quiet не занимает своей поверхности — стоит прямо в строке текста
        padding: quiet ? '0' : '0 var(--sp-15)',
        background: quiet ? 'transparent' : solid ? t.solidBg : t.dim,
        color: quiet ? t.quiet : solid ? t.solidFg : t.c,
        border: 'none',
        borderRadius: 'var(--r-s)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 'var(--fw-medium)',
        lineHeight: 'var(--lh-ui)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--ls-eyebrow)',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {icon ? <Icon name={icon as IconName} size={12} style={{ flex: 'none' }} /> : null}
      <span style={{ position: 'relative', top: '0.5px', marginRight: 'calc(-1 * var(--ls-eyebrow))' }}>{label}</span>
    </span>
  );
}
