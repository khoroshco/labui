import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from '../atoms/Avatar';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';

export interface PinComposerProps {
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
export function PinComposer({
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
}: PinComposerProps) {
  const [text, setText] = useState(value);
  const root = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<Element | null>(null);

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

  const send = () => {
    const t = text;
    setText('');
    onSend?.(t);
  };

  return (
    <div
      ref={root}
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
}
