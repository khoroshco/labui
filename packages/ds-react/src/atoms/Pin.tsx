import { useEffect, useState, type CSSProperties } from 'react';

export interface PinProps {
  number?: number;
  author?: string;
  src?: string;
  resolved?: boolean;
  hasReply?: boolean;
  style?: CSSProperties;
}

/**
 * Капля как в Figma: острый угол снизу-слева — точка привязки к объекту. Активный пин
 * акцентный, решённый гаснет.
 *
 * Капля сама себе поверхность: фото, инициалы и номер живут в одной форме с ОДНОЙ обводкой.
 * Обводка — box-shadow, а не border: border съедал бы 1.5px внутреннего размера и ломал
 * радиус угла привязки.
 */
export function Pin({ number = 1, author = '', src = '', resolved, hasReply, style }: PinProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  const usePhoto = !!src && !broken;
  const name = author.trim();
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] ?? '')
        .join('')
        .toUpperCase()
    : '';
  // без фото и без автора пин показывает свой номер в треде
  const text = initials || String(number);

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: '32px',
        height: '32px',
        flex: 'none',
        animation: 'pin-pop .3s var(--ease-spring)',
        transformOrigin: 'bottom left',
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '50% 50% 50% 4px',
          background: resolved ? 'var(--bg-active)' : 'var(--accent)',
          color: resolved ? 'var(--text-tertiary)' : 'var(--on-accent)',
          boxShadow: `0 0 0 1.5px ${resolved ? 'var(--border-strong)' : 'var(--inverse-bg)'}, var(--shadow-sm)`,
          fontWeight: 'var(--fw-medium)',
          fontSize: initials ? 'var(--fs-xs)' : 'var(--fs-s)',
          letterSpacing: initials ? 'var(--ls-pill)' : 'normal',
          transition: 'background .2s ease, color .2s ease, box-shadow .2s ease',
        }}
      >
        {usePhoto ? (
          <img
            src={src}
            alt=""
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span
            style={{ position: 'relative', top: '0.5px', marginRight: initials ? 'calc(-1 * var(--ls-pill))' : '0' }}
          >
            {text}
          </span>
        )}
      </span>
      {hasReply ? (
        <span
          // хук forced-colors: точка непрочитанного — случай, когда цвет и есть информация
          data-dot="true"
          style={{
            position: 'absolute',
            top: '-3px',
            right: '-3px',
            width: 'var(--dot-unread)',
            height: 'var(--dot-unread)',
            borderRadius: '50%',
            background: 'var(--info)',
            boxShadow: '0 0 0 2px var(--bg-canvas)',
            animation: 'ds-appear .3s var(--ease-spring)',
          }}
        />
      ) : null}
    </span>
  );
}
