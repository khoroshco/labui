import { useCallback, forwardRef, type CSSProperties, type KeyboardEvent } from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { useControlled, useTrackActive } from '../lib/hooks.js';

/** Вкладка: подпись и необязательный счётчик. */
export type TabItem = [label: string, count?: string];

export interface TabsProps extends PassThrough {
  /** Набор не задан вовсе — лента показывает демонстрационный. Пустой массив — это данные
   *  («вкладок нет»), и придумывать за них компонент не имеет права. */
  options?: TabItem[];
  value?: number;
  defaultValue?: number;
  onChange?: (index: number) => void;
  style?: CSSProperties;
}

const DEFAULT_TABS: TabItem[] = [
  ['Все форматы', '18'],
  ['Требуют внимания', '4'],
];

/**
 * Ленты вкладок. Подчёркивание едет к активной (общий трекер, как пилюля OptionGroup),
 * а не телепортируется.
 *
 * Список вкладок ОДИН на компонент: и разметка, и кламп берут его отсюда. Когда запасной
 * набор жил отдельно, кламп считал по пустому списку и замораживал контрол при живых кликах.
 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs({ options, value, defaultValue = 0, onChange, style,
  ...rest
}, ref) {
  // Демо-набор — только когда набора НЕТ. Раньше его подставлял и пустой массив: у
  // потребителя список ещё не загрузился, а лента уверенно показывала «Все форматы 18».
  const items = Array.isArray(options) ? options : DEFAULT_TABS;
  const [raw, setRaw] = useControlled(value, defaultValue, onChange);
  const n = items.length;
  const active = n ? Math.max(0, Math.min(Number(raw ?? 0), n - 1)) : 0;
  const { box, rect } = useTrackActive(active, [n]);

  const keyNav = (e: KeyboardEvent) => {
    // Модификатор означает системное сочетание: Ctrl+стрелка — вкладки браузера,
    // Alt+стрелка — история. preventDefault не глядя на них съедал и то, и другое.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? 'home' : e.key === 'End' ? 'end' : 0;
    if (!dir || !n) return; // без вкладок переключать нечего, а % 0 даёт NaN
    e.preventDefault();
    const next = dir === 'home' ? 0 : dir === 'end' ? n - 1 : (active + (dir as number) + n) % n;
    setRaw(next);
    box.current?.querySelectorAll('button')[next]?.focus();
  };

  // Слитый ref МЕМОИЗИРОВАН. Инлайновый колбэк пересоздаётся на каждый рендер, и React
  // честно зовёт старый с null, а новый с узлом — наружу уезжала череда «узел, null,
  // узел». Для react-hook-form (заявленная причина, по которой ref вообще прокинут)
  // ref(null) снимает поле с учёта: оно «размонтировалось» на каждое нажатие клавиши.
  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      box.current = el;
      setRef(ref, el);
    },
    [ref]
  );
  return (
    <div
      {...passThrough(rest)}
      ref={mergedRef}
      role="tablist"
      onKeyDown={keyNav}
      style={{ display: 'flex', gap: 'var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', position: 'relative', ...style }}
    >
      <span
        style={{
          position: 'absolute',
          bottom: '-1px',
          height: '2px',
          left: `${rect ? rect.left : 0}px`,
          width: `${rect ? rect.w : 0}px`,
          background: 'var(--text-primary)',
          opacity: rect ? '1' : '0',
          transition: 'left .35s var(--ease-spring), width .35s var(--ease-spring)',
          pointerEvents: 'none',
        }}
      />
      {items.map((it, i) => {
        const [label, count] = Array.isArray(it) ? it : [it as unknown as string, ''];
        const selected = i === active;
        return (
          <button
            type="button"
            key={i}
            data-hit="l"
            data-tab="true"
            data-track-item=""
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setRaw(i)}
            style={{
              padding: '0 0 var(--sp-3)',
              background: 'none',
              border: 'none',
              // пока подчёркивание не измерено, активная вкладка несёт линию сама
              borderBottom: `2px solid ${selected && !rect ? 'var(--text-primary)' : 'transparent'}`,
              color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 'var(--fw-medium)',
              fontSize: 'var(--fs-m)',
              lineHeight: 'var(--lh-ui)',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--sp-15)', whiteSpace: 'nowrap' }}>
              {label}
              {count ? (
                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', lineHeight: 'var(--lh-ui)' }}>{count}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
});
