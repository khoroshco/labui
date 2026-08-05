import { useCallback, forwardRef, useEffect, useRef, useState, type CSSProperties } from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Avatar } from '../atoms/Avatar.js';
import { Button } from '../atoms/Button.js';
import { Input } from '../atoms/Input.js';

export interface PinComposerProps extends PassThrough {
  author?: string;
  authorSrc?: string;
  placeholder?: string;
  value?: string;
  maxLength?: number;
  /** Режим ряда внутри карточки: без своей капсулы, поверхностью владеет родитель. */
  bare?: boolean;
  autofocus?: boolean;
  sendLabel?: string;
  onSend?: (text: string) => void;
  onCancel?: () => void;
  style?: CSSProperties;
}

/** Композер комментария: поле и круглая кнопка-стрелка. Enter отправляет, Esc отменяет. */
export const PinComposer = forwardRef<HTMLDivElement, PinComposerProps>(function PinComposer({
  author = '',
  authorSrc = '',
  placeholder = 'Комментарий…',
  value = '',
  maxLength,
  bare = false,
  autofocus = true,
  sendLabel = 'Отправить · Enter',
  onSend,
  onCancel,
  style,
  ...rest
}, ref) {
  const [text, setText] = useState(value);
  const root = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<Element | null>(null);

  // ADR 0011: набор обязан быть живым, но пришедшее СВЕРХУ значение перекрывает черновик —
  // так родитель подставляет заготовку и очищает поле после отправки. Без этой сверки
  // useState забирал value ровно один раз, при монтировании, и второй раз проп не доезжал
  // вовсе: композер выглядел управляемым и им не был. Точно так же устроен Input.
  const seen = useRef(value);
  if (value !== seen.current) {
    seen.current = value;
    setText(value);
  }

  // Композер появляется ради ввода — поле активно сразу. В витринах фокус не крадём.
  useEffect(() => {
    if (!autofocus) return;
    prevFocus.current = document.activeElement;
    root.current?.querySelector('input')?.focus({ preventScroll: true });
    return () => {
      const prev = prevFocus.current as HTMLElement | null;
      // возврат фокуса тому, у кого его забрали — только если он всё ещё внутри композера
      if (prev?.focus && root.current?.contains(document.activeElement)) {
        try {
          prev.focus({ preventScroll: true });
        } catch {
          /* элемент мог исчезнуть вместе с экраном */
        }
      }
    };
  }, [autofocus]);

  /**
   * Отправка. Пустая строка — НЕ сообщение: у пинов это «передумал», и по правилу сценария
   * пустая отправка удаляет пустой пин. Раньше наружу уходило onSend(''), и экран получал
   * сообщение без текста — пин оставался на канвасе с пустым тредом.
   */
  const send = () => {
    const t = text.trim();
    setText('');
    if (t) onSend?.(t);
    else onCancel?.();
  };

  // Слитый ref МЕМОИЗИРОВАН. Инлайновый колбэк пересоздаётся на каждый рендер, и React
  // честно зовёт старый с null, а новый с узлом — наружу уезжала череда «узел, null,
  // узел». Для react-hook-form (заявленная причина, по которой ref вообще прокинут)
  // ref(null) снимает поле с учёта: оно «размонтировалось» на каждое нажатие клавиши.
  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      root.current = el;
      setRef(ref, el);
    },
    [ref]
  );
  return (
    <div
      {...passThrough(rest)}
      ref={mergedRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        background: bare ? 'transparent' : 'var(--bg-float)',
        border: bare ? 'none' : '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-full)',
        boxShadow: bare ? 'none' : 'var(--shadow-lg)',
        padding: bare ? '0 0 0 var(--sp-15)' : '5px 5px 5px var(--sp-35)',
        ...style,
      }}
    >
      {author || authorSrc ? <Avatar author={author} src={authorSrc} size="s" /> : null}
      <span style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        <Input
          bare
          align="left"
          placeholder={placeholder}
          value={text}
          maxLength={maxLength}
          onInput={setText}
          onEnter={send}
          onEscape={() => {
            setText('');
            onCancel?.();
          }}
          style={{ width: '100%' }}
        />
      </span>
      <Button icon="arrow-right" size="s" variant="primary" tooltip={sendLabel} onClick={send} />
    </div>
  );
});
