import { useEffect, useState, type CSSProperties } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';

export interface AvatarProps extends PassThrough {
  /** Проп называется author, а не name: name зарезервировано под имя компонента. */
  author?: string;
  /** Фото заполняет каплю целиком; битая ссылка падает на инициалы. */
  src?: string;
  size?: 's' | 'm' | 'l' | 'xl';
  /** Аватар AI — всегда фирменный градиент, а не фото и не инициалы. */
  ai?: boolean;
  inverse?: boolean;
  bare?: boolean;
  style?: CSSProperties;
}

const SIZES = {
  s: { px: 24, fs: 'var(--fs-xs)' },
  m: { px: 32, fs: 'var(--fs-s)' },
  l: { px: 48, fs: 'var(--fs-h3)' },
  xl: { px: 64, fs: 'var(--fs-h2)' },
} as const;

/** Аватар: фото (src заполняет круг) → инициалы из author → AI (фирменный градиент). */
export function Avatar({ author = '', src = '', size = 's', ai, inverse, bare, style,
  ...rest
}: AvatarProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  const conf = SIZES[size] ?? SIZES.m;
  const name = author.trim();
  // В 24px две капсовые буквы с трекингом читаются как пятно, а ниже 11px кегль не опускаем:
  // маленький аватар показывает ОДНУ букву и без трекинга.
  const oneLetter = size === 's';
  // битая ссылка не оставляет пустой круг — падаем на инициалы
  const useImg = !!src && !broken;
  const initials = ai
    ? 'AI'
    : name
        .split(/\s+/)
        .slice(0, oneLetter ? 1 : 2)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase() || '—';

  return (
    <span
      {...passThrough(rest)}
      data-ai-grad={ai ? 'true' : undefined}
      role="img"
      aria-label={ai ? 'AI' : name || 'Аватар'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${conf.px}px`,
        height: `${conf.px}px`,
        borderRadius: '50%',
        background: ai ? 'var(--ai-grad)' : inverse ? 'var(--inverse-bg)' : 'var(--bg-active)',
        // inverse — аватар на инверсной подложке: круг тёмный, значит текст на нём СВЕТЛЫЙ
        color: ai ? 'var(--on-ai)' : inverse ? 'var(--inverse-text)' : 'var(--text-primary)',
        // bare — рамкой владеет родитель (капля пина), своей у аватара нет: иначе обводка в обводке
        border: bare || ai || inverse ? 'none' : '1px solid var(--border-strong)',
        overflow: 'hidden',
        flex: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {useImg ? (
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span
          style={{
            position: 'relative',
            // оптический центр: капс-инициалы чуть ниже геометрического, сдвиг растёт с размером
            top: `${Math.max(0.5, Math.round(conf.px * 0.03 * 2) / 2)}px`,
            fontSize: conf.fs,
            fontWeight: 'var(--fw-medium)',
            // трекинг только там, где букв две; иначе он сдвигает единственную букву влево
            letterSpacing: oneLetter ? 'normal' : 'var(--ls-pill)',
            marginRight: oneLetter ? '0' : 'calc(-1 * var(--ls-pill))',
          }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
