import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { CycleButton } from '../atoms/CycleButton';
import { useReducedMotion } from '../lib/hooks';

export interface SliderProps {
  label?: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Единицы переключаемые (циклер) ИЛИ просто слово — вместе никогда. */
  options?: string[];
  optionIndex?: number;
  disabled?: boolean;
  /** Магнит: значение липнет к кратным при ПЕРЕТАСКИВАНИИ. */
  snapStep?: number;
  onChange?: (value: number) => void;
  onOptionChange?: (index: number, option: string) => void;
  style?: CSSProperties;
}

/**
 * Слайдер — сам себе ряд и живёт ВНЕ острова.
 *
 * Магнит принадлежит ПЕРЕТАСКИВАНИЮ, то есть неточному вводу. Клавиатура и ручной ввод
 * точны: значение ложится ровно туда, куда его поставили, иначе шаг мельче силы магнита
 * не двигает ползунок вообще.
 */
export function Slider({
  label = '',
  value,
  defaultValue = 0,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  options,
  optionIndex = 0,
  disabled = false,
  snapStep = 0,
  onChange,
  onOptionChange,
  style,
}: SliderProps) {
  const num = (x: unknown, d: number) => {
    const n = Number(x);
    return isNaN(n) ? d : n;
  };
  const d = { min: num(min, 0), max: num(max, 100), step: num(step, 1) || 1, snap: num(snapStep, 0) };

  // Перетаскивание и клавиатура обязаны быть живыми, поэтому значение своё всегда, а
  // новый проп его перекрывает. Старт — от min: иначе при min=10 слайдер объявляет
  // aria-valuenow=0 при aria-valuemin=10, то есть ARIA вне диапазона.
  const [own, setOwn] = useState(() => value ?? defaultValue ?? num(min, 0));
  const [edit, setEdit] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const el = useRef<HTMLDivElement | null>(null);
  const fillEl = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const over = useRef(0);
  const vel = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const raf = useRef<number | null>(null);
  const spring = useRef({ s: 0, v: 0 });
  const fillSpring = useRef<{ p: number; v: number; t: number } | null>(null);
  const reduced = useReducedMotion();

  const seen = useRef(value);
  if (value !== undefined && value !== seen.current) {
    seen.current = value;
    setOwn(num(value, d.min));
  }
  const v = Math.min(d.max, Math.max(d.min, own));
  const fillPct = ((v - d.min) / (d.max - d.min)) * 100;

  const set = useCallback(
    (raw: number, exact?: boolean) => {
      let next = Math.min(d.max, Math.max(d.min, Math.round(raw / d.step) * d.step));
      if (d.snap && !exact) {
        // магнит: липнет к кратным snap; на таче зона шире
        const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
        const pull = Math.max(0.6, d.snap / 3) * (coarse ? 2 : 1); // сила магнита — константа ДС, не проп
        const near = Math.round(next / d.snap) * d.snap;
        if (Math.abs(next - near) <= pull) next = Math.min(d.max, Math.max(d.min, near));
      }
      setOwn(next);
      onChange?.(next);
    },
    [d.max, d.min, d.snap, d.step, onChange]
  );

  /** Желе на перетаскивании и пружинная заливка. Под reduced-motion — сразу по значению. */
  const loop = useCallback(() => {
    if (raf.current) return;
    if (reduced) {
      if (el.current) {
        el.current.style.transform = '';
        el.current.style.transformOrigin = '';
      }
      if (fillEl.current) {
        const frac = Math.max(0, Math.min(1, fillPct / 100));
        fillEl.current.style.width = frac >= 0.999 ? '100%' : `calc((100% - 28px) * ${frac.toFixed(5)} + 22px)`;
      }
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      let done = false;
      try {
        const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
        last = now;
        vel.current *= 0.88;
        const n = Math.max(-1, Math.min(1, vel.current / 3));
        const target = dragging.current ? Math.max(-1, Math.min(1, over.current + n * Math.abs(n) * 0.55)) : 0;
        const sp = spring.current;
        const k = dragging.current ? 260 : 200;
        const dmp = dragging.current ? 2 * Math.sqrt(k) : 15;
        sp.v += (k * (target - sp.s) - dmp * sp.v) * dt;
        sp.s += sp.v * dt;
        if (el.current) {
          const a = Math.min(1, Math.abs(sp.s));
          const ease = a * a * (3 - 2 * a);
          el.current.style.transformOrigin = sp.s >= 0 ? 'left center' : 'right center';
          el.current.style.transform = `scaleX(${(1 + 0.05 * ease).toFixed(4)}) scaleY(${(1 - 0.06 * ease).toFixed(4)})`;
        }
        // заливка догоняет значение пружиной, с киком от энергии жеста
        let fillsActive = false;
        if (fillEl.current) {
          const t = fillPct;
          const fs = (fillSpring.current ??= { p: t, v: 0, t });
          if (t !== fs.t) {
            fs.v += (t - fs.t) * 9;
            fs.t = t;
          }
          const amp = Math.min(1, Math.abs(t - fs.p) / 40);
          fs.v += (320 * (t - fs.p) - (26 - 9 * amp) * fs.v) * dt;
          fs.p += fs.v * dt;
          if (Math.abs(t - fs.p) > 0.03 || Math.abs(fs.v) > 0.03) fillsActive = true;
          else {
            fs.p = t;
            fs.v = 0;
          }
          const frac = Math.max(0, Math.min(1, fs.p / 100));
          fillEl.current.style.width = frac >= 0.999 ? '100%' : `calc((100% - 28px) * ${frac.toFixed(5)} + 22px)`;
        }
        if (!fillsActive && !dragging.current && Math.abs(sp.s) < 0.002 && Math.abs(sp.v) < 0.002) {
          sp.s = 0;
          sp.v = 0;
          if (el.current) {
            el.current.style.transform = '';
            el.current.style.transformOrigin = '';
          }
          done = true;
        }
      } catch {
        done = true;
      }
      raf.current = done ? null : requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [fillPct, reduced]);

  useEffect(() => {
    loop();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [loop, v]);

  const fromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const r = el.current?.getBoundingClientRect();
    if (!r) return;
    set(d.min + ((e.clientX - r.left) / r.width) * (d.max - d.min));
  };

  const editing = edit !== null;
  const numText = editing ? (edit as string) : String(d.step % 1 ? v.toFixed(1) : v);
  const hasCycle = Array.isArray(options) && options.length > 0;

  return (
    <div
      ref={el}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* захват указателя не критичен */
        }
        lastX.current = e.clientX;
        lastT.current = performance.now();
        dragging.current = true;
        over.current = 0;
        vel.current = 0;
        fromEvent(e);
        forceTick((n) => n + 1);
        loop();
      }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        if (!dragging.current) return;
        fromEvent(e);
        const r = el.current?.getBoundingClientRect();
        if (r) {
          const past = e.clientX < r.left ? e.clientX - r.left : e.clientX > r.right ? e.clientX - r.right : 0;
          over.current = Math.sign(past) * Math.min(1, Math.sqrt(Math.abs(past)) / 12);
        }
        const now = performance.now();
        const dtMs = Math.max(1, now - lastT.current);
        lastT.current = now;
        const dx = e.clientX - lastX.current;
        lastX.current = e.clientX;
        vel.current = vel.current * 0.65 + (dx / dtMs) * 0.35;
      }}
      onPointerUp={() => {
        dragging.current = false;
        over.current = 0;
        vel.current = 0;
        forceTick((n) => n + 1);
      }}
      style={{
        position: 'relative',
        height: 'var(--row-h)',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-m)',
        overflow: 'hidden',
        cursor: disabled ? 'not-allowed' : 'ew-resize',
        userSelect: 'none',
        touchAction: 'none',
        ...style,
      }}
    >
      {/* Слайдер как ВИДЖЕТ — отдельный слой: у роли slider не может быть фокусируемых
          потомков, а в ряду их двое (поле значения и циклер единиц). */}
      <div
        data-slider="true"
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label={label}
        aria-disabled={disabled}
        aria-valuemin={d.min}
        aria-valuemax={d.max}
        aria-valuenow={v}
        aria-valuetext={`${d.step % 1 ? v.toFixed(1) : v}${unit ? ` ${unit}` : ''}`}
        onKeyDown={(e: KeyboardEvent) => {
          if (disabled) return;
          const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          if (e.shiftKey) {
            // Shift с магнитом — прыжок по кратным; без магнита — крупный шаг
            if (d.snap) {
              const next = dir > 0 ? Math.floor(v / d.snap + 1) * d.snap : Math.ceil(v / d.snap - 1) * d.snap;
              set(next, true);
            } else set(v + dir * d.step * 10, true);
          } else set(v + dir * d.step, true);
        }}
        style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none' }}
      />
      <div
        ref={fillEl}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: v >= d.max ? '100%' : `calc((100% - 28px) * ${((v - d.min) / (d.max - d.min)).toFixed(4)} + 22px)`,
          background: 'var(--bg-active)',
          borderRadius: 'var(--r-m)',
        }}
      />
      <div
        data-ticks="true"
        style={{ position: 'absolute', left: 'var(--sp-35)', right: 'var(--sp-35)', top: '50%', height: 0, pointerEvents: 'none' }}
      >
        {d.snap
          ? Array.from({ length: Math.floor((d.max - d.min) / d.snap) + 1 }, (_, i) => {
              const dv = d.min + i * d.snap;
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${(((dv - d.min) / (d.max - d.min)) * 100).toFixed(1)}%`,
                    top: 0,
                    height: dv === v ? '14px' : '7px',
                    transform: 'translate(-0.5px, -50%)',
                    width: '1px',
                    background: dv === v ? 'var(--text-primary)' : dv <= v ? 'var(--border-strong)' : 'var(--border)',
                    transition: 'background .15s ease, height .15s ease',
                  }}
                />
              );
            })
          : null}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--sp-4)',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 'var(--fs-m)',
            lineHeight: 'var(--lh-ui)',
            // как лейбл ряда: подпись на ступень тише значения
            color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
            position: 'relative',
            top: '0.5px',
          }}
        >
          {label}
        </span>
        <span
          onPointerDown={(e: PointerEvent) => e.stopPropagation()}
          style={{
            display: 'flex',
            // с пилюлей выравниваем боксы по центрам, с единицами-словом — по базовой линии
            alignItems: hasCycle ? 'center' : 'baseline',
            gap: '4px',
            position: 'relative',
            top: hasCycle ? '0px' : '0.5px',
            pointerEvents: disabled ? 'none' : 'auto',
          }}
        >
          <input
            data-nums="true"
            data-optical="num"
            value={numText}
            disabled={disabled}
            aria-label={`${label || 'Значение'} — ввод значения`}
            onChange={(e) => (disabled ? null : setEdit(e.target.value))}
            onBlur={() => {
              const n = parseFloat((edit ?? '').replace(',', '.'));
              // ручной ввод точен: магнит принадлежит только перетаскиванию
              if (!isNaN(n)) set(n, true);
              setEdit(null);
            }}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setEdit(null);
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              // значение слайдера — такой же контент, как значение в ряду: первичный цвет
              color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
              fontSize: 'var(--fs-m)',
              lineHeight: 'var(--lh-ui)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 'var(--fw-regular)',
              position: 'relative',
              top: hasCycle ? '1.2px' : '0px',
              textAlign: 'right',
              outline: 'none',
              width: `${Math.max(1, numText.length)}ch`,
              minWidth: '1ch',
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
          {hasCycle ? (
            <span
              style={{
                pointerEvents: disabled ? 'none' : 'auto',
                display: 'flex',
                alignItems: 'center',
                alignSelf: 'center',
                marginLeft: '2px',
              }}
            >
              <CycleButton options={options} value={optionIndex} disabled={disabled} onChange={onOptionChange} />
            </span>
          ) : null}
          {!hasCycle && unit ? (
            <span
              style={{
                fontSize: 'var(--fs-m)',
                lineHeight: 'var(--lh-ui)',
                // единица — служебное при значении, своей ступенью тише
                color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
              }}
            >
              {unit}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
