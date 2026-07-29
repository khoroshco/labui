import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Button } from '../atoms/Button';
import { Icon, type IconName } from '../lib/Icon';

export type ToastLevel = 'info' | 'ok' | 'warn' | 'danger';

export interface ToastProps {
  text?: string;
  level?: ToastLevel;
  actionLabel?: string;
  /** Экран ставит leaving и удаляет тост примерно через 320 мс. */
  leaving?: boolean;
  gap?: number;
  duration?: number;
  onAction?: () => void;
  onClose?: () => void;
  onTimeout?: () => void;
  style?: CSSProperties;
}

const LEVELS: Record<ToastLevel, { icon: IconName; color: string }> = {
  info: { icon: 'circle-info', color: 'var(--info)' },
  ok: { icon: 'circle-check-fill', color: 'var(--ok)' },
  warn: { icon: 'triangle-exclamation-fill', color: 'var(--warn)' },
  danger: { icon: 'circle-exclamation-fill', color: 'var(--danger)' },
};

/**
 * Тост: эфемерное сообщение. Таймер ведёт сам тост (заливка 0→100%), стек и очередь —
 * ответственность экрана.
 *
 * Вход и выход — ОДИН механизм (переход обёртки): раньше поверх него крутилась ещё и
 * css-анимация, и два движения боролись за transform.
 */
export function Toast({
  text = '',
  level = 'info',
  actionLabel = '',
  leaving = false,
  gap = 0,
  duration = 0,
  onAction,
  onClose,
  onTimeout,
  style,
}: ToastProps) {
  const [entered, setEntered] = useState(false);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(t);
  }, []);

  const m = LEVELS[level] ?? LEVELS.info;
  const shown = entered && !leaving;
  const dismiss = onClose ?? onTimeout ?? null;
  const critical = level === 'danger' || level === 'warn';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: shown ? '1fr' : '0fr',
        opacity: shown ? '1' : '0',
        transform: leaving ? 'translateY(6px) scale(.97)' : entered ? 'none' : 'translateY(10px) scale(.97)',
        transition: leaving
          ? 'grid-template-rows .25s var(--ease-in), opacity .2s ease, transform .25s var(--ease-in)'
          : 'grid-template-rows .32s var(--ease-out), opacity .28s ease .05s, transform .4s var(--ease-spring)',
        ...style,
      }}
    >
      <div style={{ overflow: shown ? 'visible' : 'hidden', minHeight: 0, paddingTop: `${Number(gap) || 0}px` }}>
        <div
          // критичные уровни звучат сразу; role=alert сам подразумевает assertive
          role={critical ? 'alert' : 'status'}
          aria-live={critical ? undefined : 'polite'}
          data-toast="true"
          // swipe-to-dismiss: тянется за указателем, дальше 80px — закрытие, иначе пружинный возврат
          onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
            if ((e.target as HTMLElement).closest('button')) return;
            startX.current = e.clientX;
            setDrag(true);
            setDx(0);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* захват указателя не критичен */
            }
          }}
          onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
            if (drag) setDx(e.clientX - startX.current);
          }}
          onPointerUp={() => {
            if (!drag) return;
            if (Math.abs(dx) > 80 && dismiss) {
              // dx не сбрасываем: тост схлопнется со смещением, без отскока
              setDrag(false);
              dismiss();
            } else {
              setDrag(false);
              setDx(0);
            }
          }}
          onPointerCancel={() => {
            setDrag(false);
            setDx(0);
          }}
          style={{
            transform: `translateX(${dx}px)`,
            opacity: String(1 - Math.min(Math.abs(dx) / 240, 0.6)),
            transition: drag ? 'none' : 'transform .35s var(--ease-spring), opacity .2s ease',
            touchAction: 'pan-y',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-25)',
            width: 'fit-content',
            maxWidth: 'min(420px, calc(100vw - var(--sp-6)))',
            minHeight: 'var(--touch-target)',
            padding: 'var(--sp-25) var(--sp-35)',
            background: 'var(--bg-float)',
            borderRadius: 'var(--r-m)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {duration && (onTimeout ?? onClose) ? (
            <span
              data-toast-fill="true"
              onAnimationEnd={() => (onTimeout ?? onClose)?.()}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '2px',
                transformOrigin: 'left',
                background: m.color,
                opacity: 0.55,
                animationName: 'ds-toast-fill',
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards',
                animationDuration: `${Number(duration) || 0}ms`,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          <span style={{ display: 'inline-flex', color: m.color, flex: 'none', position: 'relative' }}>
            <Icon name={m.icon} size={16} />
          </span>
          <span style={{ fontSize: 'var(--fs-m)', lineHeight: 'var(--lh-ui)', color: 'var(--text-primary)', position: 'relative', top: '0.5px' }}>
            {text}
          </span>
          {actionLabel ? (
            <Button label={actionLabel} variant="ghost" size="xs" onClick={onAction} style={{ marginLeft: 'var(--sp-05)', flex: 'none' }} />
          ) : null}
          {onClose ? (
            <Button icon="xmark" variant="ghost" size="xs" tooltip="Скрыть" onClick={onClose} style={{ flex: 'none' }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
