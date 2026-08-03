import type { CSSProperties, MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { collapsedProps } from '../lib/collapsed.js';

export interface RowInfoProps extends PassThrough {
  open?: boolean;
  text?: string;
  /** Строка с «/» или расширением — реальная картинка, иначе плейсхолдер. */
  image?: string;
  style?: CSSProperties;
}

const IS_URL = /\/|\.(png|jpe?g|webp|gif|svg)/i;

/** Раскрывашка подсказки ряда: grid-rows с пружиной, без прозрачности у выхода. */
export function RowInfo({ open = false, text = '', image = '', style,
  ...rest
}: RowInfoProps) {
  const isUrl = !!image && IS_URL.test(image);
  return (
    <span
      {...passThrough(rest)}
      // закрытая подсказка не читается скринридером и не берёт указатель — см. collapsedProps
      {...collapsedProps(!open)}
      // клик по раскрытой подсказке не должен дёргать действие ряда
      onClick={(e: MouseEvent) => e.stopPropagation()}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        // асимметрия входа и выхода: выход короче и тише. Выход — ОДИН жест: фейд идёт
        // ровно столько же, сколько схлопывание, иначе текст пропадает на середине,
        // а пустая коробка дозакрывается рывком.
        transition: open
          ? 'grid-template-rows .35s var(--ease-out)'
          : 'grid-template-rows .22s var(--ease-in)',
        cursor: 'default',
        ...style,
      }}
    >
      <span style={{ overflow: 'hidden', minHeight: 0, display: 'block' }}>
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-25)',
            padding: 'var(--sp-05) 0 var(--sp-35)',
            opacity: open ? '1' : '0',
            transition: open ? 'opacity .3s ease .1s' : 'opacity .22s var(--ease-in)',
          }}
        >
          {image && isUrl ? (
            <img
              src={image}
              style={{
                display: 'block',
                width: '100%',
                height: '160px',
                objectFit: 'cover',
                borderRadius: 'var(--r-s)',
                background: 'var(--bg-hover)',
              }}
            />
          ) : null}
          {image && !isUrl ? (
            <span
              style={{
                display: 'flex',
                width: '100%',
                height: '160px',
                borderRadius: 'var(--r-s)',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'repeating-linear-gradient(45deg, var(--bg-hover) 0 10px, transparent 10px 20px)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 'var(--fs-xs)', lineHeight: 'var(--lh-ui)', color: 'var(--text-tertiary)' }}>
                {image}
              </span>
            </span>
          ) : null}
          <span
            style={{
              display: 'block',
              fontSize: 'var(--fs-s)',
              fontWeight: 'var(--fw-regular)',
              color: 'var(--text-secondary)',
              lineHeight: 'var(--lh-text)',
              textWrap: 'pretty' as CSSProperties['textWrap'],
            }}
          >
            {text}
          </span>
        </span>
      </span>
    </span>
  );
}
