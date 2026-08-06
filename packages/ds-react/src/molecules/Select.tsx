import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Icon, type IconName } from '../lib/Icon.js';
import { Layer } from '../lib/Layer.js';
import { anchorTo, type Anchored } from '../lib/anchor.js';
import { useReducedMotion } from '../lib/hooks.js';

export type SelectOption = string | { value: string; label?: string; icon?: IconName; disabled?: boolean };

/**
 * Почему изменилось открытое состояние. Приём взят у Base UI: причина — часть контракта,
 * а не догадка потребителя. Без неё «закрывать по Escape, но не по клику мимо» нельзя
 * написать иначе как подняв состояние наверх ради одного запрета.
 */
export type SelectReason = 'trigger' | 'item' | 'escape' | 'outside' | 'blur';

export interface SelectProps extends PassThrough {
  options?: SelectOption[];
  /** Значение выбранной опции, а не её номер — см. комментарий у компонента. */
  value?: string;
  defaultValue?: string;
  /** Текст, пока не выбрано ничего. Пустой строкой выбор не подменяем. */
  placeholder?: string;
  /** Имя поля: без него нет ни FormData, ни нативной проверки required. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Значение видно, менять нельзя. В отличие от disabled остаётся в табе и в форме. */
  readOnly?: boolean;
  invalid?: boolean;
  /** Имя для скринридера, когда подпись лежит СНАРУЖИ компонента. */
  ariaLabel?: string;
  /** Ссылка на подпись, а не её копия. */
  ariaLabelledBy?: string;
  /** Связь с описанием и сообщением об ошибке. */
  describedBy?: string;
  /** Иконка слева в поле — как у Input. */
  icon?: IconName | '';
  open?: boolean;
  defaultOpen?: boolean;
  onChange?: (value: string) => void;
  onOpenChange?: (open: boolean, reason: SelectReason) => void;
  style?: CSSProperties;
}

interface Norm {
  value: string;
  label: string;
  icon: IconName | '';
  disabled: boolean;
}

const norm = (o: SelectOption): Norm =>
  typeof o === 'string'
    ? { value: o, label: o, icon: '', disabled: false }
    : { value: o.value, label: o.label ?? o.value, icon: o.icon ?? '', disabled: !!o.disabled };

/** Сколько опций видно без прокрутки. Дальше список прокручивается внутри себя. */
const VISIBLE = 7;
const ITEM_H = 36;
/** Буфер набора живёт столько же, сколько у нативного селекта и у Base UI. */
const TYPE_RESET = 750;

/**
 * Выбор одного значения из перечня. Там, где вариантов два-четыре и все должны быть видны
 * сразу, — OptionGroup; здесь их может быть двести (валюта, часовой пояс, площадка).
 *
 * ЗНАЧЕНИЕ, А НЕ НОМЕР. У OptionGroup, Segments и Tabs `value` — индекс, и имя пропа здесь
 * то же самое (словарь имён един), но ТИП другой, и это осознанно. Селект возит данные, у
 * которых есть собственный идентификатор, а порядок опций меняется на глазах: сортировка,
 * фильтр, догрузка справочника. Индекс при этом молча выбирает другое — не ошибку в коде,
 * а другое значение в форме. У группы из трёх сегментов порядок фиксирован разметкой, и
 * индекс там честен.
 *
 * ВСПЛЫВАЮЩЕЕ ЖИВЁТ В ПОРТАЛЕ (lib/Layer.tsx). Список, оставшийся в потоке, режется первым
 * же `overflow:hidden` — а им владеет остров по построению.
 *
 * КЛАВИАТУРА повторяет нативный селект, потому что ей уже научены все:
 *   закрытый — ↓/↑/Enter/Space открывают (стрелка ещё и говорит, откуда вести подсветку),
 *              буквы МЕНЯЮТ значение не открывая (так делает и <select>, и Base UI);
 *   открытый — ↓/↑ ведут подсветку без зацикливания, Home/End в края, буквы ищут по
 *              префиксу, Enter/Space выбирают, Escape закрывает и возвращает фокус на поле,
 *              Tab закрывает и уходит дальше.
 * Отключённые опции пропускаются везде, где идёт перебор.
 *
 * ФОКУС НАСТОЯЩИЙ, А НЕ aria-activedescendant: подсвеченная опция получает фокус в DOM.
 * Так подсветка и кольцо фокуса — одно и то же событие, и разойтись им негде.
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select({
  options = [],
  value,
  defaultValue = '',
  placeholder = 'Выберите',
  name,
  required = false,
  disabled = false,
  readOnly = false,
  invalid = false,
  ariaLabel,
  ariaLabelledBy,
  describedBy,
  icon = '',
  open: openProp,
  defaultOpen = false,
  onChange,
  onOpenChange,
  style,
  ...rest
}, ref) {
  const items = options.map(norm);
  const reactId = useId();
  const listId = `${reactId}-list`;

  // Режим управления фиксируется на монтировании — то же правило, что у остальных
  // контролов (docs/adr/0011). Здесь две независимые оси: значение и раскрытость.
  const { current: valueControlled } = useRef(value !== undefined);
  const { current: openControlled } = useRef(openProp !== undefined);
  const [ownValue, setOwnValue] = useState(value ?? defaultValue);
  const seenValue = useRef(value);
  if (valueControlled && value !== undefined && value !== seenValue.current) {
    seenValue.current = value;
    setOwnValue(value);
  }
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const current = valueControlled ? (value ?? ownValue) : ownValue;
  const open = (openControlled ? (openProp ?? ownOpen) : ownOpen) && !disabled && !readOnly;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Узел списка живёт в СОСТОЯНИИ, а не только в ref. Причина: слой монтируется не тем же
  // кадром, что открытие, — портал ждёт, пока станет известен document.body (SSR), — и
  // эффект, зависевший от «список открыт», отрабатывал по пустому ref. Фокус оставался на
  // поле, стрелки уходили обратно в обработчик поля, Enter кликал по кнопке и закрывал
  // список. Снаружи это выглядело как «селект открывается и не слушается». Состояние
  // будит эффект РОВНО тогда, когда узел появился, чем бы он ни задерживался.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const holdList = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    setListEl(el);
  }, []);
  const [at, setAt] = useState<Anchored | null>(null);
  const selected = items.findIndex((o) => o.value === current);
  const [active, setActive] = useState(selected);
  const reduced = useReducedMotion();

  const setOpen = useCallback(
    (next: boolean, reason: SelectReason) => {
      if (!openControlled) setOwnOpen(next);
      onOpenChange?.(next, reason);
    },
    [openControlled, onOpenChange]
  );

  const pick = (i: number, reason: SelectReason = 'item') => {
    const o = items[i];
    if (!o || o.disabled) return;
    if (!valueControlled) setOwnValue(o.value);
    onChange?.(o.value);
    setOpen(false, reason);
    triggerRef.current?.focus();
  };

  /** Ближайшая доступная опция в сторону dir, начиная от from включительно. */
  const step = (from: number, dir: 1 | -1): number => {
    for (let i = from; i >= 0 && i < items.length; i += dir) {
      if (!items[i].disabled) return i;
    }
    return -1;
  };

  // ── позиция всплывающего ────────────────────────────────────────────────────
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const want = Math.min(items.length, VISIBLE) * ITEM_H + 8;
    setAt(anchorTo(el.getBoundingClientRect(), want));
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // Прокрутка и ресайз двигают якорь, а слой лежит в портале и об этом не знает.
    // Слушаем в фазе перехвата: прокручиваться может любой предок, а не только окно.
    const on = () => place();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
    };
  }, [open, place]);

  // ── закрытие по клику мимо ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const on = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false, 'outside');
    };
    // pointerdown, а не click: click по элементу, который исчезнет под курсором, до нас
    // может и не дойти.
    document.addEventListener('pointerdown', on, true);
    return () => document.removeEventListener('pointerdown', on, true);
  }, [open, setOpen]);

  // ── фокус на подсвеченную опцию ─────────────────────────────────────────────
  //
  // Зависимость от `ready` обязательна. Первым рендером после открытия списка ЕЩЁ НЕТ:
  // он рисуется только когда посчитана привязка (`at`), а считает её layout-эффект — то
  // есть на кадр позже. Эффект, зависевший только от [open, active], отрабатывал по
  // пустому listRef, фокус оставался на поле, и вся клавиатура списка молча не работала:
  // стрелки уходили обратно в обработчик поля, Enter кликал по кнопке и закрывал список.
  // Снаружи это выглядело как «селект открывается и не слушается».
  useEffect(() => {
    if (!open || !listEl) return;
    const el = listEl.querySelectorAll<HTMLElement>('[data-opt-item]')[active];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, listEl, active]);

  // ── поиск по набору букв ────────────────────────────────────────────────────
  const typed = useRef('');
  const typedAt = useRef(0);
  /**
   * Поиск по набору. Две тонкости, обе взяты у нативного селекта.
   *
   * ПОВТОР ОДНОЙ БУКВЫ — не запрос «аа», а перебор совпадений на «а». Без этого второе
   * нажатие той же клавиши искало несуществующую подпись и не делало ничего: человек
   * жмёт «м», «м», «м», ожидая обойти все города на «м», и остаётся на первом.
   *
   * ОТКУДА ИСКАТЬ. Запрос из ОДНОЙ буквы ищет со СЛЕДУЮЩЕЙ опции — иначе перебор
   * упирается в уже выбранную и стоит. Продолженный набор («мо» после «м») ищет с
   * текущей: иначе «Москва» пропускается ровно тем нажатием, которое её и уточняет.
   */
  const seek = (key: string): number => {
    const now = Date.now();
    const fresh = now - typedAt.current > TYPE_RESET;
    let next = fresh ? key : typed.current + key;
    const repeat = !fresh && next.length > 1 && [...next].every((c) => c.toLowerCase() === key.toLowerCase());
    if (repeat) next = key;
    typed.current = next;
    typedAt.current = now;
    const q = next.toLowerCase();
    const n = items.length;
    if (!n) return -1;
    const from = open ? active : selected;
    const start = Math.max(0, from);
    const step1 = next.length === 1 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const i = (start + step1 + k) % n;
      const o = items[i];
      if (!o.disabled && o.label.toLowerCase().startsWith(q)) return i;
    }
    return -1;
  };

  /**
   * Перебор подсветки. ОДИН на оба обработчика — поля и списка.
   *
   * Своя копия у поля была бы не дублированием, а дырой: между «список открылся» и
   * «фокус доехал до пункта» проходит кадр, и всё, что человек успел нажать за это
   * время, приходит ещё на поле. Пока поле умело только открывать, второе быстрое
   * нажатие стрелки терялось молча.
   */
  const navigate = (e: KeyboardEvent<HTMLElement>): boolean => {
    const n = items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      // Без зацикливания: у нативного селекта край списка — это край, и «прыжок в начало»
      // на длинном перечне читается как потеря места.
      const nextIdx = step(active + dir, dir);
      if (nextIdx >= 0) setActive(nextIdx);
      return true;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const nextIdx = e.key === 'Home' ? step(0, 1) : step(n - 1, -1);
      if (nextIdx >= 0) setActive(nextIdx);
      return true;
    }
    return false;
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || readOnly) return;
    // Модификатор означает системное сочетание браузера: Ctrl+стрелка — вкладки,
    // Alt+стрелка — история. Забирать их нельзя.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const from = selected >= 0 ? selected : e.key === 'ArrowDown' ? 0 : items.length - 1;
        setActive(step(from, e.key === 'ArrowDown' ? 1 : -1));
        setOpen(true, 'trigger');
        return;
      }
      // Буквы на ЗАКРЫТОМ селекте меняют значение, не открывая список: так ведёт себя
      // нативный <select>, и человек, набравший «евр» в списке валют, ждёт именно этого.
      if (e.key.length === 1 && e.key !== ' ') {
        const i = seek(e.key);
        if (i >= 0) {
          e.preventDefault();
          if (!valueControlled) setOwnValue(items[i].value);
          onChange?.(items[i].value);
        }
      }
      return;
    }
    // Список уже открыт, а фокус ещё на поле — ведём подсветку отсюда.
    if (navigate(e)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false, 'escape');
      return;
    }
    // Tab с открытого списка. Обычно фокус в этот момент уже внутри списка и клавишу
    // ловит он; но если фокус почему-то остался на поле, уходящий человек не должен
    // оставить за собой висящую выпадашку.
    if (e.key === 'Tab' && open) setOpen(false, 'blur');
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (navigate(e)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      // Пробел во время набора принадлежит буферу поиска, а не выбору: в «Нью-Йорк» и
      // «Санкт-Петербург» пробел — обычная буква.
      if (e.key === ' ' && Date.now() - typedAt.current < TYPE_RESET) {
        e.preventDefault();
        const i = seek(' ');
        if (i >= 0) setActive(i);
        return;
      }
      e.preventDefault();
      pick(active);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false, 'escape');
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      // Tab уводит фокус наружу — держать открытым нечего. Событие не гасим: уходить
      // человек собрался сам.
      setOpen(false, 'blur');
      return;
    }
    if (e.key.length === 1) {
      const i = seek(e.key);
      if (i >= 0) {
        e.preventDefault();
        setActive(i);
      }
    }
  };

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      setRef(ref, el);
    },
    [ref]
  );

  const chosen = selected >= 0 ? items[selected] : null;
  const fieldColor = disabled
    ? 'var(--text-disabled)'
    : chosen
      ? 'var(--text-primary)'
      : 'var(--text-tertiary)';

  return (
    <div
      {...passThrough(rest)}
      ref={mergedRef}
      // position:relative — не оформление: скрытое нативное поле лежит внутри, и
      // браузерный пузырь «заполните это поле» цепляется именно к нему.
      style={{ position: 'relative', display: 'inline-block', width: '100%', ...style }}
    >
      <button
        ref={triggerRef}
        type="button"
        // data-field — тот же хук ds.css, что у Input: пресс, ховер рамки, кольцо фокуса,
        // граница в forced-colors. Одинаковое выглядит одинаково.
        data-field="true"
        data-select="true"
        data-disabled={disabled ? 'true' : 'false'}
        data-invalid={invalid ? 'true' : 'false'}
        data-open={open ? 'true' : 'false'}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel || undefined}
        aria-labelledby={ariaLabelledBy || undefined}
        aria-describedby={describedBy || undefined}
        aria-invalid={invalid ? true : undefined}
        aria-required={required || undefined}
        aria-readonly={readOnly || undefined}
        disabled={disabled}
        onClick={() => {
          if (readOnly) return;
          if (open) {
            setOpen(false, 'trigger');
            return;
          }
          setActive(selected >= 0 ? selected : step(0, 1));
          setOpen(true, 'trigger');
        }}
        onKeyDown={onTriggerKey}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          width: '100%',
          height: 'var(--control-h-s)',
          padding: '0 12px',
          background: disabled ? 'var(--bg-hover)' : 'var(--bg-surface)',
          border: disabled
            ? '1px solid transparent'
            : `1px solid ${invalid ? 'var(--danger)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--r-s)',
          color: fieldColor,
          fontFamily: 'var(--font-ui)',
          fontWeight: 'var(--fw-regular)',
          fontSize: 'var(--fs-m)',
          lineHeight: 'var(--lh-ui)',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : readOnly ? 'default' : 'pointer',
          transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease, transform .35s var(--ease-spring)',
        }}
      >
        {icon ? (
          <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)', flex: 'none' }}>
            <Icon name={icon as IconName} size={14} />
          </span>
        ) : null}
        {chosen?.icon ? (
          <span style={{ display: 'inline-flex', color: 'inherit', flex: 'none' }}>
            <Icon name={chosen.icon as IconName} size={14} />
          </span>
        ) : null}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            position: 'relative',
            top: '0.5px',
          }}
        >
          {chosen ? chosen.label : placeholder}
        </span>
        <span
          data-chevron="true"
          style={{
            display: 'inline-flex',
            flex: 'none',
            color: disabled ? 'var(--text-disabled)' : 'var(--text-tertiary)',
            // Тот же жест, что у ⓘ и Disclosure: раскрытое поворачивает шеврон на 180°.
            transform: open ? 'rotate(180deg)' : 'none',
            transition: reduced ? 'none' : 'transform .3s var(--ease-spring)',
          }}
        >
          <Icon name="chevron-down" size={14} />
        </span>
      </button>

      {/* Скрытое НАСТОЯЩЕЕ поле: без него нет ни FormData, ни нативной проверки required.
          Приём взят у Base UI. Спрятано clip-path'ом, а не display:none и не hidden —
          иначе браузеру некуда поставить пузырь «заполните это поле», и отправка формы
          молча не происходит. tabIndex=-1 и aria-hidden убирают его из таба и из
          озвучки: имя и роль несёт видимое поле. */}
      {name ? (
        <input
          type="text"
          name={name}
          value={current}
          required={required || undefined}
          disabled={disabled || undefined}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            border: 0,
            clipPath: 'inset(50%)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {open && at ? (
        <Layer>
          <div
            ref={holdList}
            id={listId}
            role="listbox"
            data-float="true"
            aria-label={ariaLabel || undefined}
            aria-labelledby={ariaLabelledBy || undefined}
            onKeyDown={onListKey}
            style={{
              position: 'fixed',
              top: `${at.top}px`,
              left: `${at.left}px`,
              width: `${at.width}px`,
              maxHeight: `${at.maxHeight}px`,
              overflowY: 'auto',
              padding: 'var(--sp-1)',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-m)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 60,
              // Вход растёт ИЗ якоря: снизу — сверху вниз, сверху — снизу вверх.
              transformOrigin: at.side === 'bottom' ? 'top center' : 'bottom center',
              animation: reduced ? 'ds-fade .15s ease' : 'ds-appear .28s var(--ease-out)',
            }}
          >
            {items.map((o, i) => {
              const isSelected = o.value === current;
              return (
                <div
                  key={o.value}
                  data-opt-item=""
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => pick(i)}
                  // Наведение ведёт подсветку — иначе указатель и клавиатура спорят о том,
                  // что выбрано «сейчас», и Enter срабатывает не по тому пункту.
                  onPointerMove={() => {
                    if (!o.disabled && i !== active) setActive(i);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    height: `${ITEM_H}px`,
                    padding: '0 var(--sp-25)',
                    borderRadius: 'var(--r-s)',
                    background: i === active && !o.disabled ? 'var(--bg-hover)' : 'transparent',
                    color: o.disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 'var(--fw-regular)',
                    fontSize: 'var(--fs-m)',
                    lineHeight: 'var(--lh-ui)',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    outline: 'none',
                  }}
                >
                  {o.icon ? (
                    <span style={{ display: 'inline-flex', flex: 'none', color: 'var(--text-secondary)' }}>
                      <Icon name={o.icon as IconName} size={14} />
                    </span>
                  ) : null}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      top: '0.5px',
                    }}
                  >
                    {o.label}
                  </span>
                  {/* Галочка держит место всегда: иначе подпись выбранного пункта уезжает
                      влево относительно соседей, и список дёргается при переборе. */}
                  <span
                    style={{
                      display: 'inline-flex',
                      flex: 'none',
                      color: 'var(--text-primary)',
                      opacity: isSelected ? '1' : '0',
                      transform: isSelected ? 'scale(1)' : 'scale(.6)',
                      transition: reduced ? 'none' : 'transform .3s var(--ease-spring), opacity .15s ease',
                    }}
                  >
                    <Icon name="check" size={14} />
                  </span>
                </div>
              );
            })}
            {items.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: `${ITEM_H}px`,
                  padding: '0 var(--sp-25)',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-m)',
                  lineHeight: 'var(--lh-ui)',
                }}
              >
                Ничего нет
              </div>
            ) : null}
          </div>
        </Layer>
      ) : null}
    </div>
  );
});
