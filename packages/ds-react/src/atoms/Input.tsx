import { useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { Icon, type IconName } from '../lib/Icon.js';

export interface InputProps {
  value?: string;
  defaultValue?: string;
  /** Имя для скринридера, когда подпись лежит СНАРУЖИ компонента. */
  ariaLabel?: string;
  placeholder?: string;
  /** Аффиксы — только у field-режима. */
  icon?: IconName | '';
  prefix?: string;
  suffix?: string;
  clearable?: boolean;
  /** Жёсткий предел на нативном поле; счётчика нет — предел ощущается остановкой ввода. */
  maxLength?: number;
  invalid?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
  /** Голый ввод для рядов: обвязкой владеет ряд. */
  bare?: boolean;
  onEnter?: () => void;
  onEscape?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onInput?: (value: string) => void;
  style?: CSSProperties;
}

/**
 * Поле ввода. Текстовый ввод — единственный контрол, который ВСЕГДА ведёт своё значение:
 * набор обязан быть живым, даже когда родитель ещё не принял его. Значение сверху
 * задаёт начальное и перекрывает своё, когда приходит новым.
 */
export function Input({
  value,
  defaultValue = '',
  ariaLabel,
  placeholder = '',
  icon = '',
  prefix = '',
  suffix = '',
  clearable = false,
  maxLength,
  invalid = false,
  disabled = false,
  align,
  bare = false,
  onEnter,
  onEscape,
  onFocus,
  onBlur,
  onInput,
  style,
}: InputProps) {
  // Текстовый ввод — единственный контрол, который ВСЕГДА ведёт своё значение: набор
  // обязан быть живым, даже когда родитель ещё не принял его. Строгая управляемость
  // (`value ?? own`) делала поле мёртвым, если проп пришёл без onInput, — ровно то, что
  // нашло ревью и что противоречит ADR 0011.
  const [own, setOwn] = useState(value ?? defaultValue);
  const seen = useRef(value);
  if (value !== undefined && value !== seen.current) {
    // проп изменился сверху — он перекрывает черновик (так очищается поле после отправки)
    seen.current = value;
    setOwn(value);
  }
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLLabelElement | null>(null);
  const val = own;
  const isFocused = focused && !disabled;
  const lim = Number(maxLength) || 0;

  /** Перезапуск анимации: тот же animation-name сам себя не рестартует. */
  const shake = () => {
    const el = box.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'ds-shake .3s var(--ease-inout)';
  };

  const set = (next: string) => {
    setOwn(next);
    onInput?.(next);
  };

  // Оптика по ФАКТУ содержимого: у цифр нет выносных, их пятно сидит выше прозы. Но если
  // на строке есть префикс или суффикс — сдвиг обязан быть общим, иначе разъезжается
  // базовая линия внутри поля («$ 100»).
  const numeric = /\d/.test(String(val)) && !/[a-zA-Zа-яёА-ЯЁ]/.test(String(val));
  const optical = numeric && !(prefix || suffix) ? '1.2px' : '0.5px';

  const showClear = !bare && clearable && !!val && !disabled;
  const font = 'var(--font-ui)';
  const fs = 'var(--fs-m)';

  return (
    <label
      ref={box}
      // data-field — хук ds.css: пресс поля, forced-colors и общие переходы
      data-field={bare ? undefined : 'true'}
      data-disabled={disabled ? 'true' : 'false'}
      data-invalid={invalid ? 'true' : 'false'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        width: '100%',
        height: bare ? 'auto' : 'var(--control-h-s)',
        padding: bare ? '0' : '0 12px',
        background: bare ? 'transparent' : disabled ? 'var(--bg-hover)' : 'var(--bg-surface)',
        border: bare
          ? 'none'
          : disabled
            ? '1px solid transparent'
            : `1px solid ${invalid ? 'var(--danger)' : isFocused ? 'var(--accent)' : 'var(--border-subtle)'}`,
        boxShadow: !bare && isFocused && !invalid ? 'inset 0 0 0 1px var(--accent)' : 'none',
        borderRadius: bare ? '0' : 'var(--r-s)',
        cursor: disabled ? 'not-allowed' : 'text',
        pointerEvents: bare && disabled ? 'none' : 'auto',
        transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease, transform .35s var(--ease-spring)',
        ...style,
      }}
    >
      {!bare && icon ? (
        <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)', flex: 'none' }}>
          <Icon name={icon as IconName} size={14} />
        </span>
      ) : null}
      {!bare && prefix ? (
        <span
          style={{
            fontSize: fs,
            fontFamily: font,
            fontWeight: 'var(--fw-regular)',
            color: 'var(--text-tertiary)',
            flex: 'none',
            position: 'relative',
            top: '0.5px',
          }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        value={val}
        disabled={disabled}
        aria-label={ariaLabel || undefined}
        aria-invalid={invalid ? true : undefined}
        placeholder={placeholder}
        maxLength={lim > 0 ? lim : undefined}
        onChange={(e) => set(e.target.value)}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') onEnter?.();
          if (e.key === 'Escape') onEscape?.();
          // Попытка ввести символ в заполненное поле: браузер молча отбрасывает его и
          // события не даёт — ловим саму попытку.
          if (!lim || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
          const el = e.target as HTMLInputElement;
          if (el.selectionStart !== el.selectionEnd) return;
          if ((el.value ?? '').length < lim) return;
          shake();
        }}
        onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
          if (!lim) return;
          const el = e.target as HTMLInputElement;
          const sel = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0);
          const add = e.clipboardData?.getData('text') ?? '';
          if ((el.value ?? '').length - sel + add.length > lim) shake();
        }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          flex: 1,
          minWidth: 0,
          outline: 'none',
          // состояния текста: placeholder — tertiary (::placeholder в ds.css), введённое —
          // primary, disabled — text-disabled
          color: disabled ? 'var(--text-disabled)' : invalid ? 'var(--danger)' : 'var(--text-primary)',
          fontFamily: font,
          fontWeight: 'var(--fw-regular)',
          fontSize: fs,
          lineHeight: 'var(--lh-ui)',
          textAlign: align ?? (bare ? 'right' : 'left'),
          position: 'relative',
          top: optical,
          cursor: 'inherit',
          transition: 'color .2s ease',
        }}
      />
      {!bare && suffix ? (
        <span
          style={{
            fontSize: fs,
            fontFamily: font,
            fontWeight: 'var(--fw-regular)',
            color: 'var(--text-tertiary)',
            flex: 'none',
            position: 'relative',
            top: '0.5px',
          }}
        >
          {suffix}
        </span>
      ) : null}
      {showClear ? (
        <button
          data-tap="true"
          data-tooltip="Очистить"
          aria-label="Очистить"
          onMouseDown={(e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            set('');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: 'none',
            background: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            flex: 'none',
            animation: 'ds-fade .15s ease',
          }}
        >
          <Icon name="xmark" size={14} />
        </button>
      ) : null}
    </label>
  );
}
