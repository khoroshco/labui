import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { useIsoLayoutEffect } from '../lib/hooks.js';

export interface TextareaProps extends PassThrough {
  value?: string;
  defaultValue?: string;
  /** Имя для скринридера, когда подпись лежит СНАРУЖИ компонента. */
  ariaLabel?: string;
  /** Имя поля: без него нет ни FormData, ни автозаполнения. */
  name?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
  /** Связь с описанием и сообщением об ошибке: их рисует ряд, а знать о них — полю. */
  describedBy?: string;
  placeholder?: string;
  /** Сколько строк поле занимает ПУСТЫМ: минимальная высота, ниже которой оно не садится. */
  rows?: number;
  /** Потолок роста. Дальше поле не растёт, а прокручивается внутри себя. */
  maxRows?: number;
  /** Жёсткий предел на нативном поле; счётчика нет — предел ощущается остановкой ввода. */
  maxLength?: number;
  /** Рамка краснеет тем же --danger, что и сообщение ряда. */
  invalid?: boolean;
  disabled?: boolean;
  /** Голый ввод для рядов: обвязкой владеет ряд. */
  bare?: boolean;
  onInput?: (value: string) => void;
  /** Cmd/Ctrl+Enter. Одинокий Enter в многострочном поле — перевод строки, и он не наш. */
  onSubmit?: () => void;
  onEscape?: () => void;
  /** Событие отдаётся целиком: библиотеки форм читают из него target и type. */
  onFocus?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  style?: CSSProperties;
}

/**
 * Многострочный ввод. Родня Input и живёт по тем же правилам поля: та же поверхность,
 * та же рамка фокуса, тот же отказ ввода при упоре в предел.
 *
 * Отличий по существу три, и все три — следствие того, что строк больше одной.
 *
 * 1. ПОЛЕ РАСТЁТ ПОД СОДЕРЖИМОЕ. Нативная textarea этого не умеет: она стоит фиксированной
 *    высоты и прокручивается внутри, то есть человек правит текст в щели на три строки,
 *    не видя, что написал. Рост — единственная причина, по которой этот компонент вообще
 *    существует отдельно от нативного тега; иначе хватило бы `render={<textarea/>}`, как
 *    делает Base UI. Потолок обязателен: без него поле на длинном тексте выдавливает
 *    кнопку отправки за экран.
 *
 * 2. ENTER — ПЕРЕВОД СТРОКИ, А НЕ ОТПРАВКА. Клавиша принадлежит полю, забирать её нельзя
 *    (то же правило, что у Enter в чекбоксе). Отправка — Cmd/Ctrl+Enter: это сочетание
 *    браузеру не принадлежит и в многострочном вводе давно стало общим местом.
 *
 * 3. ОПТИКИ СДВИГА НЕТ. У Input текст сидит на 0.5px ниже, потому что строка одна и её
 *    центруют в боксе контрола. Здесь строк несколько, центровать нечего, а сдвиг сместил
 *    бы весь абзац относительно рамки.
 *
 * Интерлиньяж — --lh-text, а не --lh-ui: это наборный текст, который читают, а не подпись
 * контрола (docs/design-system.md).
 */
export const Textarea = forwardRef<HTMLLabelElement, TextareaProps>(function Textarea({
  value,
  defaultValue = '',
  ariaLabel,
  name,
  autoComplete,
  required = false,
  readOnly = false,
  describedBy,
  placeholder = '',
  rows = 3,
  maxRows = 8,
  maxLength,
  invalid = false,
  disabled = false,
  bare = false,
  onInput,
  onSubmit,
  onEscape,
  onFocus,
  onBlur,
  style,
  ...rest
}, ref) {
  // Ровно та же идиома, что у Input: текстовый ввод ВСЕГДА ведёт своё значение — набор
  // обязан быть живым, даже когда родитель ещё не принял его (ADR 0011). Значение сверху
  // задаёт начальное и перекрывает своё, когда приходит новым.
  const [own, setOwn] = useState(value ?? defaultValue);
  const seen = useRef(value);
  if (value !== undefined && value !== seen.current) {
    seen.current = value;
    setOwn(value);
  }
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLLabelElement | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const val = own;
  const isFocused = focused && !disabled;
  const lim = Number(maxLength) || 0;
  const minRows = Math.max(1, Math.floor(Number(rows) || 1));
  const capRows = Math.max(minRows, Math.floor(Number(maxRows) || minRows));

  /**
   * Рост под содержимое.
   *
   * Высота считается ИЗ scrollHeight, а не из числа переводов строки: строка переносится
   * сама, и «сколько \n» ничего не говорит о том, сколько строк видно. Перед замером
   * высота сбрасывается — иначе scrollHeight никогда не станет меньше уже назначенного,
   * и поле, из которого стёрли текст, останется прежней высоты навсегда.
   *
   * Слой — layout-эффект, а не эффект: между покраской с прежней высотой и следующим
   * кадром поле дёрнулось бы на каждый символ, перешедший на новую строку.
   */
  const measure = useCallback(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const min = line * minRows + pad;
    const max = line * capRows + pad;
    const want = Math.max(min, Math.min(el.scrollHeight, max));
    el.style.height = `${Math.ceil(want)}px`;
    // Прокрутка появляется ровно тогда, когда упёрлись в потолок, — и не раньше: полоса,
    // висящая на непрокручиваемом поле, читается как «здесь ещё что-то есть».
    el.style.overflowY = el.scrollHeight > max + 1 ? 'auto' : 'hidden';
  }, [minRows, capRows]);

  useIsoLayoutEffect(() => {
    measure();
  }, [val, bare, measure]);

  /* ШИРИНА И ШРИФТ БУДЯТ ЗАМЕР ТАК ЖЕ, КАК ЗНАЧЕНИЕ.
   *
   * Высота считается из переноса, а перенос зависит от ширины и от метрик шрифта — но ни
   * то, ни другое не приходит пропсом. Два отказа отсюда, оба тихие. Сузили окно или
   * схлопнули соседнюю панель: текст перетёк на лишнюю строку, `scrollHeight` вырос,
   * высота осталась прежней, а `overflowY` посчитан на старой ширине как `hidden` — хвост
   * просто обрезан, и доскроллить до него нельзя. И второй: первый замер идёт по
   * подменному шрифту, поэтому предзаполненный черновик остаётся обрезанным до первого
   * нажатия клавиши. Тот же приём уже применён в useTrackActive.
   */
  useEffect(() => {
    const el = area.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
    };
  }, [measure]);

  /** Перезапуск анимации отказа: тот же animation-name сам себя не рестартует. */
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

  // Слитый ref МЕМОИЗИРОВАН: инлайновый колбэк пересоздаётся на каждый рендер, и наружу
  // уезжает череда «узел, null, узел» — для react-hook-form это снятие поля с учёта.
  const mergedRef = useCallback(
    (el: HTMLLabelElement | null) => {
      box.current = el;
      setRef(ref, el);
    },
    [ref]
  );

  return (
    <label
      {...passThrough(rest)}
      ref={mergedRef}
      // data-field — хук ds.css: пресс поля, ховер рамки, кольцо фокуса, forced-colors
      data-field={bare ? undefined : 'true'}
      data-disabled={disabled ? 'true' : 'false'}
      data-invalid={invalid ? 'true' : 'false'}
      style={{
        display: 'flex',
        // Сверху, а не по центру: поле растёт вниз, и содержимое обязано стоять на месте.
        alignItems: 'flex-start',
        width: '100%',
        padding: bare ? '0' : 'var(--sp-2) 12px',
        background: bare ? 'transparent' : disabled ? 'var(--bg-hover)' : 'var(--bg-surface)',
        border: bare
          ? 'none'
          : disabled
            ? '1px solid transparent'
            : `1px solid ${invalid ? 'var(--danger)' : isFocused ? 'var(--focus)' : 'var(--border-subtle)'}`,
        boxShadow: !bare && isFocused && !invalid ? 'inset 0 0 0 1px var(--focus)' : 'none',
        borderRadius: bare ? '0' : 'var(--r-s)',
        cursor: disabled ? 'not-allowed' : 'text',
        pointerEvents: bare && disabled ? 'none' : 'auto',
        transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease, transform .35s var(--ease-spring)',
        ...style,
      }}
    >
      <textarea
        ref={area}
        value={val}
        rows={minRows}
        disabled={disabled}
        name={name}
        autoComplete={autoComplete}
        required={required || undefined}
        readOnly={readOnly || undefined}
        aria-label={ariaLabel || undefined}
        aria-describedby={describedBy || undefined}
        aria-invalid={invalid ? true : undefined}
        placeholder={placeholder}
        maxLength={lim > 0 ? lim : undefined}
        onChange={(e) => set(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            if (!onSubmit) return;
            e.preventDefault();
            onSubmit();
            return;
          }
          if (e.key === 'Escape' && onEscape) {
            // Гасим всплытие: поле часто стоит ВНУТРИ модального окна, у которого свой
            // Escape. Без этого одно нажатие и очищало поле, и закрывало окно вместе с
            // набранным текстом. Клавишу съедает верхний слой — тот, кто её обработал.
            e.stopPropagation();
            onEscape();
            return;
          }
          // Попытка ввести символ в заполненное поле: браузер молча отбрасывает его и
          // события не даёт — ловим саму попытку. Enter здесь тоже символ: он занимает
          // место в значении, и упереться в предел переводом строки можно ровно так же.
          if (!lim || e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key.length !== 1 && e.key !== 'Enter') return;
          const el = e.target as HTMLTextAreaElement;
          if (el.selectionStart !== el.selectionEnd) return;
          if ((el.value ?? '').length < lim) return;
          shake();
        }}
        onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
          if (!lim) return;
          const el = e.target as HTMLTextAreaElement;
          const sel = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0);
          const add = e.clipboardData?.getData('text') ?? '';
          if ((el.value ?? '').length - sel + add.length > lim) shake();
        }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          flex: 1,
          minWidth: 0,
          outline: 'none',
          // Тянуть угол нельзя: высотой владеет содержимое, а ручная растяжка её перебивает
          // и оставляет поле в размере, который больше не соответствует тексту.
          resize: 'none',
          display: 'block',
          // Ошибку несут рамка и сообщение ряда, а НЕ сам набор: здесь это абзац в
          // несколько строк, то есть содержание, и его уровень яркости — text-primary.
          // (У Input то же место работает иначе только потому, что там значение короткое
          // и оно само и есть ошибка.) Плюс --danger на бумаге даёт 4.09:1 при норме 4.5.
          color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 'var(--fw-regular)',
          fontSize: 'var(--fs-m)',
          // Наборный текст, а не подпись контрола: интерлиньяж абзаца.
          lineHeight: 'var(--lh-text)',
          cursor: 'inherit',
          transition: 'color .2s ease',
        }}
      />
    </label>
  );
});
