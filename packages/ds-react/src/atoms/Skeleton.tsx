import type { CSSProperties } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';

export interface SkeletonProps extends PassThrough {
  shape?: 'line' | 'rect' | 'circle';
  width?: string;
  height?: string;
  style?: CSSProperties;
}

/** Скелетон: место контента, пока контента нет. Пульсация — кейфрейм ds-pulse из ds.css. */
export function Skeleton({ shape = 'line', width, height, style,
  ...rest
}: SkeletonProps) {
  const w = width ?? (shape === 'circle' ? '24px' : shape === 'line' ? '140px' : '100%');
  const h = height ?? (shape === 'line' ? '12px' : shape === 'circle' ? (width ?? '24px') : '64px');
  const r = shape === 'circle' ? '50%' : shape === 'rect' ? 'var(--r-s)' : 'var(--r-full)';
  return (
    <span
      {...passThrough(rest)}
      style={{
        display: 'block',
        width: w,
        height: h,
        borderRadius: r,
        background: 'var(--bg-active)',
        animation: 'ds-pulse 1.4s ease-in-out infinite',
        flex: 'none',
        ...style,
      }}
    />
  );
}
