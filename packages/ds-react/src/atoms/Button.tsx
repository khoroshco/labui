import type { CSSProperties, MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Icon, type IconName } from '../lib/Icon.js';
import { useSpin } from '../lib/hooks.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent';
export type ButtonSize = 'xs' | 's' | 'm' | 'l';
export type ButtonTone = 'default' | 'ok' | 'danger';

export interface ButtonProps extends PassThrough {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Семантика поверх иерархии: тон работает с любым вариантом. */
  tone?: ButtonTone;
  icon?: IconName | '';
  iconRight?: IconName | '';
  /** Соло-иконке обязателен: он же даёт имя для скринридера. */
  tooltip?: string;
  /** По умолчанию button: внутри формы кнопка не должна отправлять её случайно. */
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Значение заменяется скелетоном (после 320 мс), ввод блокируется сразу. */
  loading?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

const SIZES = {
  xs: { h: '28px', fs: 'var(--fs-s)', padX: 10, iconPad: 8, icon: 12 },
  s: { h: 'var(--control-h-s)', fs: 'var(--fs-s)', padX: 12, iconPad: 9, icon: 14 },
  m: { h: 'var(--control-h-m)', fs: 'var(--fs-m)', padX: 16, iconPad: 13, icon: 14 },
  l: { h: 'var(--control-h-l)', fs: 'var(--fs-m)', padX: 20, iconPad: 16, icon: 18 },
} as const;

// ховеры вариантов живут в ds.css по хуку data-btn — здесь только базовый вид
const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: 'var(--inverse-bg)', fg: 'var(--inverse-text)', border: 'none' },
  secondary: { bg: 'transparent', fg: 'var(--text-primary)', border: '1px solid var(--border)' },
  ghost: { bg: 'transparent', fg: 'var(--text-secondary)', border: 'none' },
  accent: { bg: 'var(--accent)', fg: 'var(--on-accent)', border: 'none' },
};
const TONES = {
  ok: { c: 'var(--ok)', dim: 'var(--ok-dim)', on: 'var(--on-tone)' },
  danger: { c: 'var(--danger)', dim: 'var(--danger-dim)', on: 'var(--on-tone)' },
} as const;

export function Button({
  label = '',
  variant = 'primary',
  size = 'm',
  tone = 'default',
  icon = '',
  iconRight = '',
  tooltip = '',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  style,
  ...rest
}: ButtonProps) {
  // анти-мерцание: клики блокируются сразу, спиннер живёт по таймингам ДС
  const spin = useSpin(loading);
  const s = SIZES[size] ?? SIZES.m;

  let v = VARIANTS[variant] ?? VARIANTS.primary;
  const t = tone === 'ok' || tone === 'danger' ? TONES[tone] : null;
  if (t) {
    if (variant === 'primary' || variant === 'accent') v = { ...v, bg: t.c, fg: t.on, border: 'none' };
    else if (variant === 'secondary') v = { ...v, fg: t.c, border: `1px solid ${t.c}` };
    else v = { ...v, fg: t.c };
  }

  const iconOnly = !!icon && !label;
  // компенсация масс: у иконки боковой отступ меньше текстового
  const padL = icon ? s.iconPad : s.padX;
  const padR = iconRight ? s.iconPad : s.padX;
  const contentOp = spin && !icon ? '0' : '1';
  const spinner = (
    <span style={{ display: 'inline-flex', flex: 'none', animation: 'ds-appear .3s var(--ease-spring)' }}>
      <span
        style={{
          width: `${s.icon}px`,
          height: `${s.icon}px`,
          border: '1.5px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'ds-spin .8s linear infinite',
        }}
      />
    </span>
  );

  return (
    <button
      {...passThrough(rest)}
      // Без type браузерный дефолт — submit: кнопка внутри <form> отправляет её. Значение
      // «button» безопасно по умолчанию, а submit потребитель просит явно.
      type={type}
      // На таче соло-иконка мелких размеров не дотягивает до 44px: хук data-tap расширяет
      // зону нажатия, не меняя вида.
      data-tap={iconOnly && (size === 'xs' || size === 's') ? 'true' : undefined}
      data-btn={variant}
      // Атрибут пишется ВСЕГДА, включая 'default': ds.css ловит само его наличие
      // ([data-btn="primary"][data-tone]:hover), и без него у самой частой кнопки системы
      // другой ховер — 0.88 вместо brightness(1.08).
      data-tone={tone}
      data-busy={loading ? 'true' : undefined}
      disabled={disabled}
      onClick={loading ? undefined : onClick}
      data-tooltip={disabled ? undefined : tooltip || undefined}
      // Имя кнопки — ОДИН источник: есть подпись, имя из неё; нет — из тултипа.
      aria-label={label ? undefined : tooltip || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-15)',
        height: s.h,
        width: iconOnly ? s.h : 'auto',
        padding: iconOnly ? '0' : `0 ${padR}px 0 ${padL}px`,
        // Выключенное не может быть заметнее доступного: приглушённую поверхность получают
        // только варианты, у которых своя поверхность ЕСТЬ.
        background: disabled ? (v.bg === 'transparent' ? 'transparent' : 'var(--bg-hover)') : v.bg,
        color: disabled ? 'var(--text-disabled)' : v.fg,
        // рамка secondary — его форма, а не подсветка: гаснет цветом, но остаётся
        border: disabled ? (v.border === 'none' ? 'none' : '1px solid var(--border-subtle)') : v.border,
        borderRadius: 'var(--r-full)',
        fontFamily: 'var(--font-ui)',
        fontWeight: 'var(--fw-medium)',
        fontSize: s.fs,
        cursor: disabled ? 'not-allowed' : loading ? 'progress' : 'pointer',
        flex: 'none',
        position: 'relative',
        ...style,
      }}
    >
      {spin && icon ? spinner : null}
      {icon && !spin ? <Icon name={icon as IconName} size={iconOnly ? s.icon + 2 : s.icon} /> : null}
      {label ? (
        <span style={{ position: 'relative', top: '1px', opacity: contentOp, transition: 'opacity .15s ease' }}>{label}</span>
      ) : null}
      {iconRight && !iconOnly ? (
        <Icon name={iconRight as IconName} size={13} style={{ opacity: contentOp, transition: 'opacity .15s ease' }} />
      ) : null}
      {spin && !icon ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'ds-appear .3s var(--ease-spring)',
          }}
        >
          <span
            style={{
              width: `${s.icon}px`,
              height: `${s.icon}px`,
              border: '1.5px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'ds-spin .8s linear infinite',
            }}
          />
        </span>
      ) : null}
    </button>
  );
}
