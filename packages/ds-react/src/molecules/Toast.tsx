import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { collapsedProps } from '../lib/collapsed.js';
import { useReducedMotion } from '../lib/hooks.js';
import { Button } from '../atoms/Button.js';
import { Icon, type IconName } from '../lib/Icon.js';

export type ToastLevel = 'info' | 'ok' | 'warn' | 'danger';

export interface ToastProps extends PassThrough {
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
  duration = 8000,
  onAction,
  onClose,
  onTimeout,
  style,
  ...rest
}: ToastProps) {
  const [entered, setEntered] = useState(false);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [hovered, setHovered] = useState(false);
  const startX = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(t);
  }, []);

  /* ТАЙМЕР ВЕДЁТ JS, А НЕ АНИМАЦИЯ.
   *
   * Раньше автозакрытие висело на `animationend` полосы, то есть клоком была анимация.
   * Под prefers-reduced-motion глобальное правило гасит анимации до 0.01 мс — полоса
   * добегала мгновенно, и тост исчезал сразу же. Настройка «поменьше движения» отбирала
   * не движение, а содержание: сообщение уровня danger было нечитаемым в принципе.
   *
   * Полоса осталась ПОКАЗАНИЕМ времени, а не его источником. Пауза под курсором есть у
   * обоих: у полосы правилом ds.css, у отсчёта — состоянием ниже.
   */
  const fire = useRef<(() => void) | undefined>(undefined);
  fire.current = onTimeout ?? onClose;
  const total = Number(duration) || 0;
  const left = useRef(total);
  const seenDuration = useRef(duration);
  if (duration !== seenDuration.current) {
    // новая длительность сверху начинает отсчёт заново, а не доигрывает старый остаток
    seenDuration.current = duration;
    left.current = Number(duration) || 0;
  }

  useEffect(() => {
    if (!total || !fire.current || !entered || leaving || hovered || drag) return;
    const from = performance.now();
    const t = setTimeout(() => fire.current?.(), left.current);
    return () => {
      clearTimeout(t);
      // Остаток запоминаем: пауза не должна ни обнулять отсчёт, ни начинать его заново —
      // иначе тост под курсором живёт вечно, а после ухода курсора — полный срок ещё раз.
      left.current = Math.max(0, left.current - (performance.now() - from));
    };
  }, [total, entered, leaving, hovered, drag]);

  const m = LEVELS[level] ?? LEVELS.info;
  const shown = entered && !leaving;
  const dismiss = onClose ?? onTimeout ?? null;
  const critical = level === 'danger' || level === 'warn';

  const finishDrag = () => {
    if (!drag) return;
    if (Math.abs(dx) > 80 && dismiss) {
      // dx не сбрасываем: тост схлопнется со смещением, без отскока
      setDrag(false);
      dismiss();
    } else {
      setDrag(false);
      setDx(0);
    }
  };

  return (
    <div
      {...passThrough(rest)}
      // Уходящий тост не берёт фокус: 250 мс схлопывания он ещё виден, и таб успевал
      // попасть на его кнопку действия — то есть на кнопку, которой сейчас не станет.
      // Только на выходе: до входа тост инертным не делаем, иначе живая область могла бы
      // не озвучить сообщение в момент появления.
      {...collapsedProps(leaving)}
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
          // Пауза под курсором. У полосы она в ds.css (animation-play-state), у отсчёта —
          // здесь: сообщение читают именно сейчас, и уезжать оно не должно (WCAG 2.2.1).
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
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
          onPointerUp={() => finishDrag()}
          // отмена указателя — тот же жест: если тост уже утянут за порог, он закрывается
          onPointerCancel={() => finishDrag()}
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
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '2px',
                transformOrigin: 'left',
                background: m.color,
                opacity: 0.55,
                // Полоса — показание таймера, а не сам таймер. Под reduced-motion она
                // стоит на месте: убегающая линия и есть то движение, которого просили не
                // делать, — а факт «время идёт» несёт сам тост, который никуда не исчез.
                animationName: reduced ? 'none' : 'ds-toast-fill',
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
