import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Icon, type IconName } from '../lib/Icon.js';
import { Layer } from '../lib/Layer.js';
import { collapsedProps } from '../lib/collapsed.js';
import { anchorTo, type Anchored } from '../lib/anchor.js';
import { useControlledState, useIsoLayoutEffect, useReducedMotion } from '../lib/hooks.js';

export type SelectOption = string | { value: string; label?: string; icon?: IconName; disabled?: boolean };

/**
 * Почему изменилось открытое состояние. Приём взят у Base UI: причина — часть контракта,
 * а не догадка потребителя. Без неё «закрывать по Escape, но не по клику мимо» нельзя
 * написать иначе как подняв состояние наверх ради одного запрета.
 */
export type SelectReason = 'trigger' | 'item' | 'escape' | 'outside' | 'blur' | 'disabled';

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
  /** Справочник ещё едет. Пустой список в это время сказал бы «вариантов нет» — неправду. */
  loading?: boolean;
  /** Имя для скринридера. Роль combobox имя из содержимого НЕ берёт — оно обязательно. */
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
  /** Событие отдаётся целиком: библиотеки форм читают из него target и type. */
  onFocus?: (e: FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (e: FocusEvent<HTMLButtonElement>) => void;
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
/** Уход списка. Короче входа — правило асимметрии; согласован с возвратом шеврона. */
const EXIT = 160;

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
 * же `overflow:hidden` — а им владеет остров по построению. Порядок слоёв считает сам слой:
 * список, открытый внутри модального окна, обязан лечь ПОВЕРХ него.
 *
 * КЛАВИАТУРА повторяет нативный селект, потому что ей уже научены все:
 *   закрытый — ↓/↑ (в том числе с Alt) открывают, Enter/Space открывают, буквы МЕНЯЮТ
 *              значение не открывая (так делает и <select>, и Base UI);
 *   открытый — ↓/↑ ведут подсветку без зацикливания, Home/End в края, PageUp/PageDown на
 *              страницу списка, буквы ищут по префиксу (повтор одной буквы перебирает
 *              совпадения), Enter/Space выбирают, Escape закрывает и возвращает фокус на
 *              поле, Tab закрывает и уходит дальше.
 * Отключённые опции пропускаются везде, где идёт перебор.
 *
 * ФОКУС НАСТОЯЩИЙ, А НЕ aria-activedescendant: подсвеченная опция получает фокус в DOM.
 * Так подсветка и кольцо фокуса — одно и то же событие, и разойтись им негде.
 *
 * ЧТО НАДО ЗНАТЬ ПОТРЕБИТЕЛЮ. «Не выбрано» — это ПУСТАЯ СТРОКА, а не `undefined`: режим
 * управления фиксируется на монтировании (ADR 0011), и `value={data?.currency}` до прихода
 * данных навсегда делает контрол неуправляемым. Поиска по подстроке здесь нет — это
 * Combobox, отдельный компонент; набор с клавиатуры ищет по НАЧАЛУ подписи.
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
  loading = false,
  ariaLabel,
  ariaLabelledBy,
  describedBy,
  icon = '',
  open: openProp,
  defaultOpen = false,
  onChange,
  onOpenChange,
  onFocus,
  onBlur,
  style,
  ...rest
}, ref) {
  // Пересборка списка на каждый рендер перерисовывала бы все опции на каждое движение
  // указателя по нему: на справочнике из двухсот валют это заметный подлаг.
  const items = useMemo(() => options.map(norm), [options]);
  const reactId = useId();
  const listId = `${reactId}-list`;

  // Режим управления фиксируется на монтировании — то же правило и та же реализация, что
  // у остальных контролов (docs/adr/0011). Осей здесь ДВЕ и они независимы: значение и
  // раскрытость; у каждой свой режим, свой дефолт и своё предупреждение о смене режима.
  const [current, setOwnValue, valueControlled] = useControlledState(value, defaultValue);
  const [rawOpen, setOwnOpen] = useControlledState(openProp, defaultOpen);
  const open = rawOpen && !disabled && !readOnly;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Узел списка живёт в СОСТОЯНИИ, а не только в ref: слой монтируется не тем же кадром,
  // что открытие (портал ждёт, пока станет известен document.body), и эффект, зависевший
  // от «список открыт», отрабатывал по пустому ref. Фокус оставался на поле, стрелки
  // уходили обратно в обработчик поля, Enter кликал по кнопке и закрывал список.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const holdList = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    setListEl(el);
  }, []);
  const [at, setAt] = useState<Anchored | null>(null);
  const selected = items.findIndex((o) => o.value === current);
  const [active, setActive] = useState(selected);
  const reduced = useReducedMotion();

  // Узел живёт дольше пропа: выход обязан быть анимирован (правило системы), значит список
  // снимается не в тот же коммит, что `open=false`. `shown` — то, что видно.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    if (!mounted) return;
    setShown(false);
    const t = setTimeout(() => setMounted(false), EXIT);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!ariaLabel && !ariaLabelledBy) {
      console.warn(
        '[@khoroshco/ds] Select без ariaLabel и ariaLabelledBy безымянен для скринридера: ' +
          'роль combobox имя из содержимого не берёт, в отличие от кнопки.'
      );
    }
  }, [ariaLabel, ariaLabelledBy]);

  const setOpen = useCallback(
    (next: boolean, reason: SelectReason) => {
      setOwnOpen(next);
      onOpenChange?.(next, reason);
    },
    [setOwnOpen, onOpenChange]
  );

  // Блокировка ЗАКРЫВАЕТ список по-настоящему, а не маскирует его производной. Пока
  // `open` был выражением `rawOpen && !disabled`, состояние оставалось поднятым: форма
  // ушла в отправку, список пропал, сервер ответил, блокировка снялась — и выпадашка
  // раскрывалась сама собой, без единого действия, с фокусом внутри.
  useEffect(() => {
    if (rawOpen && (disabled || readOnly)) setOpen(false, 'disabled');
  }, [rawOpen, disabled, readOnly, setOpen]);

  const pick = (i: number, reason: SelectReason = 'item') => {
    const o = items[i];
    if (!o || o.disabled) return;
    setOwnValue(o.value);
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

  /* ПОДСВЕТКА ПРИВЯЗАНА К ЗНАЧЕНИЮ, А НЕ К НОМЕРУ.
   *
   * Список приходит с сервера и меняется на глазах: фильтр, догрузка, refetch по возврату
   * в окно. Подсветка — настоящий фокус на узле опции, и как только подсвеченная опция
   * исчезает из массива, React её размонтирует, фокус падает на <body>, а `active`
   * указывает в пустоту: ни один узел не табабелен, стрелки и Enter не делают ничего.
   * Список остаётся открытым и мёртвым — закрыть можно только кликом мимо.
   */
  const activeValue = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const byValue = activeValue.current ? items.findIndex((o) => o.value === activeValue.current) : -1;
    const next = byValue >= 0 ? byValue : selected >= 0 ? selected : step(0, 1);
    if (next !== active) setActive(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, open]);
  useEffect(() => {
    activeValue.current = items[active]?.value ?? null;
  }, [items, active]);

  // ── позиция всплывающего ────────────────────────────────────────────────────
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rows = Math.max(1, Math.min(items.length || 1, VISIBLE));
    const next = anchorTo(el.getBoundingClientRect(), rows * ITEM_H + 8);
    // Сравнение обязательно: прокрутка предка шлёт события пачками, а новый объект в
    // состоянии перерисовывает ВЕСЬ список (на двухстах опциях это встаёт колом).
    setAt((cur) =>
      cur && cur.top === next.top && cur.left === next.left && cur.width === next.width && cur.maxHeight === next.maxHeight
        ? cur
        : next
    );
  }, [items.length]);

  useIsoLayoutEffect(() => {
    if (!mounted) return;
    place();
  }, [mounted, place]);

  useEffect(() => {
    if (!mounted) return;
    // Прокрутка и ресайз двигают якорь, а слой лежит в портале и об этом не знает.
    // Слушаем в фазе перехвата: прокручиваться может любой предок, а не только окно.
    // passive — чтобы не тормозить сам скролл-поток.
    const on = () => place();
    window.addEventListener('scroll', on, { capture: true, passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', on);
    };
  }, [mounted, place]);

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

  /* ФОКУС НА ПОДСВЕЧЕННУЮ ОПЦИЮ.
   *
   * Прокрутка к подсвеченному нужна КЛАВИАТУРЕ. Указателю она вредна: подкрутив список
   * под курсором, мы подставляем под него следующий пункт, тот становится активным,
   * список едет снова — подсветка убегает от курсора, и попасть по нужной опции удаётся
   * с третьего раза. Поэтому источник подсветки запоминается.
   */
  const byKeyboard = useRef(true);
  useEffect(() => {
    if (!open || !listEl) return;
    const el = listEl.querySelectorAll<HTMLElement>('[data-opt-item]')[active];
    if (el) {
      el.focus({ preventScroll: true });
      if (byKeyboard.current) el.scrollIntoView({ block: 'nearest' });
      return;
    }
    // Подсвечивать нечего (пустой список, все опции отключены) — фокус держит сам список,
    // иначе он остаётся снаружи и следующий Tab начинает обход документа с начала.
    listEl.focus({ preventScroll: true });
  }, [open, listEl, active]);

  // ── поиск по набору букв ────────────────────────────────────────────────────
  const typed = useRef('');
  const typedAt = useRef(0);
  /**
   * Поиск по набору. Две тонкости, обе взяты у нативного селекта.
   *
   * ПОВТОР ОДНОЙ БУКВЫ — не запрос «аа», а перебор совпадений на «а». Без этого второе
   * нажатие той же клавиши искало несуществующую подпись и не делало ничего.
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
    const from = Math.max(0, open ? active : selected);
    const skip = next.length === 1 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const i = (from + skip + k) % n;
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
   * нажатие стрелки терялось молча — и это поймал прогон на другой платформе, а не
   * рассуждение.
   */
  const navigate = (e: KeyboardEvent<HTMLElement>): boolean => {
    const n = items.length;
    const to = (i: number) => {
      byKeyboard.current = true;
      if (i >= 0) setActive(i);
    };
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      // Без зацикливания: у нативного селекта край списка — это край, и «прыжок в начало»
      // на длинном перечне читается как потеря места.
      to(step(active + dir, dir));
      return true;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      to(e.key === 'Home' ? step(0, 1) : step(n - 1, -1));
      return true;
    }
    // Страница списка: на двухстах валютах перебор по одной опции — это не навигация.
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      const dir = e.key === 'PageDown' ? 1 : -1;
      const target = Math.max(0, Math.min(n - 1, active + dir * VISIBLE));
      const found = step(target, dir);
      to(found >= 0 ? found : step(target, dir === 1 ? -1 : 1));
      return true;
    }
    return false;
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || readOnly) return;
    // Ctrl и Meta со стрелками принадлежат браузеру (вкладки, история) — их не трогаем.
    // Alt+↓ по вертикали не принадлежит никому: у нативного селекта он открывает список,
    // и APG приводит его же.
    if (e.ctrlKey || e.metaKey) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        byKeyboard.current = true;
        const from = selected >= 0 ? selected : e.key === 'ArrowDown' ? 0 : items.length - 1;
        setActive(step(from, e.key === 'ArrowDown' ? 1 : -1));
        setOpen(true, 'trigger');
        return;
      }
      if (e.altKey) return;
      // Буквы на ЗАКРЫТОМ селекте меняют значение, не открывая список: так ведёт себя
      // нативный <select>, и человек, набравший «евр» в списке валют, ждёт именно этого.
      if (e.key.length === 1 && e.key !== ' ') {
        const i = seek(e.key);
        if (i >= 0) {
          e.preventDefault();
          setOwnValue(items[i].value);
          onChange?.(items[i].value);
        }
      }
      return;
    }
    // Список уже открыт, а фокус ещё на поле — ведём подсветку и выбираем отсюда же.
    if (navigate(e)) return;
    if (e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(active);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // Гасим всплытие: селект часто стоит ВНУТРИ модального окна, у которого свой
      // Escape. События из портала всплывают по дереву React, а не по DOM, поэтому без
      // этого одно нажатие закрывало два слоя — список и окно вместе с заполненной
      // формой. Правило общее: клавишу съедает верхний слой.
      e.stopPropagation();
      setOpen(false, 'escape');
      return;
    }
    if (e.key === 'Tab') setOpen(false, 'blur');
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    if (navigate(e)) return;
    if (e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') {
      // Пробел во время набора принадлежит буферу поиска, а не выбору: в «Нью-Йорк» и
      // «Санкт-Петербург» пробел — обычная буква.
      if (e.key === ' ' && Date.now() - typedAt.current < TYPE_RESET) {
        e.preventDefault();
        const i = seek(' ');
        if (i >= 0) {
          byKeyboard.current = true;
          setActive(i);
        }
        return;
      }
      e.preventDefault();
      pick(active);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // см. тот же случай у поля
      setOpen(false, 'escape');
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      // Tab уводит фокус наружу. Возвращаем его на ПОЛЕ и не гасим событие: браузер
      // продолжит обход оттуда. Без возврата обход шёл бы из портала — то есть из конца
      // документа, — и внутри модального окна фокус уходил бы за пределы его ловушки.
      setOpen(false, 'blur');
      triggerRef.current?.focus();
      return;
    }
    if (e.key.length === 1) {
      const i = seek(e.key);
      if (i >= 0) {
        e.preventDefault();
        byKeyboard.current = true;
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
  const shownText = chosen ? chosen.label : placeholder;
  // Оптика по ФАКТУ содержимого — то же правило, что у Input: у цифр нет выносных, их
  // пятно сидит выше прозы, поэтому числовой набор опускается сильнее. Одинаковая
  // картинка обязана центрироваться одинаково, в каком бы контроле она ни стояла.
  const numeric = /\d/.test(shownText) && !/[a-zA-Zа-яёА-ЯЁ]/.test(shownText);
  const optical = numeric ? '1.2px' : '0.5px';
  const fieldColor = disabled ? 'var(--text-disabled)' : chosen ? 'var(--text-primary)' : 'var(--text-tertiary)';

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
        // Раскрытое поле помечено, потому что фокус в этот момент уехал в портал и
        // :focus-within на кнопке ложен: без этого хука раскрытый селект выглядел бы
        // ровно как селект в покое. Правило — в ds.css.
        data-open={open ? 'true' : 'false'}
        data-readonly={readOnly ? 'true' : undefined}
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
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={() => {
          if (readOnly) return;
          if (open) {
            setOpen(false, 'trigger');
            return;
          }
          byKeyboard.current = false;
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
          border: disabled ? '1px solid transparent' : `1px solid ${invalid ? 'var(--danger)' : 'var(--border-subtle)'}`,
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
          <span style={{ display: 'inline-flex', color: 'var(--text-secondary)', flex: 'none' }}>
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
            top: optical,
          }}
        >
          {shownText}
        </span>
        {/* Шеврон только там, где есть что раскрывать: readOnly обещал бы действие,
            которого нет. */}
        {readOnly ? null : (
          <span
            data-chevron="true"
            style={{
              display: 'inline-flex',
              flex: 'none',
              color: disabled ? 'var(--text-disabled)' : 'var(--text-tertiary)',
              // Тот же жест, что у ⓘ и Disclosure: раскрытое поворачивает шеврон на 180°.
              transform: open ? 'rotate(180deg)' : 'none',
              transition: reduced ? 'none' : `transform ${EXIT}ms var(--ease-out)`,
            }}
          >
            <Icon name="chevron-down" size={14} />
          </span>
        )}
      </button>

      {/* Скрытое НАСТОЯЩЕЕ поле: без него нет ни FormData, ни нативной проверки required.
          Приём взят у Base UI. Спрятано clip-path'ом, а не display:none и не hidden —
          иначе браузеру некуда поставить пузырь «заполните это поле», и отправка формы
          молча не происходит. Фокус с него НЕ отбивается: браузер фокусирует поле именно
          затем, чтобы показать пузырь, и увод фокуса в тот же тик пузырь сбивал бы —
          человек нажимал «Отправить», ничего не происходило и никто не объяснял почему. */}
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

      {mounted && at ? (
        <Layer>
          <div
            ref={holdList}
            id={listId}
            role="listbox"
            data-float="true"
            data-select-list="true"
            tabIndex={-1}
            // Уходящий список фокуса не берёт: 160 мс он ещё виден, и таб успевал попасть
            // на пункт, которого сейчас не станет.
            {...collapsedProps(!shown)}
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
              outline: 'none',
              // Вход растёт ИЗ якоря ПЕРЕХОДОМ, а не кейфреймом: интерактив живёт на
              // transitions ради прерываемости (правило системы), а ds-appear написан для
              // 14-пиксельного спиннера — на панели в 320 точек scale(.5) читается как
              // «прилетело зумом», а не «раскрылось из поля».
              transformOrigin: at.side === 'bottom' ? 'top center' : 'bottom center',
              opacity: shown ? '1' : '0',
              transform: reduced ? 'none' : shown ? 'none' : `translateY(${at.side === 'bottom' ? -4 : 4}px) scale(.97)`,
              transition: reduced
                ? `opacity ${shown ? '.2s' : `${EXIT}ms`} ease`
                : shown
                  ? 'opacity .2s ease, transform .3s var(--ease-spring)'
                  : `opacity ${EXIT}ms ease, transform ${EXIT}ms var(--ease-in)`,
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
                    if (o.disabled || i === active) return;
                    byKeyboard.current = false;
                    setActive(i);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    minHeight: `${ITEM_H}px`,
                    // 4 (поле списка) + 8 = 12 — ровно столько же, сколько до подписи в
                    // самом поле: иначе выбранное значение прыгает вбок при открытии.
                    padding: '0 var(--sp-2)',
                    borderRadius: 'var(--r-s)',
                    background: i === active && !o.disabled ? 'var(--bg-hover)' : 'transparent',
                    color: o.disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 'var(--fw-regular)',
                    fontSize: 'var(--fs-m)',
                    lineHeight: 'var(--lh-ui)',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    // Кольцо БРАУЗЕРА гасим: оно своего, не нашего цвета (замерено —
                    // синий Chrome вместо --focus) и рисуется в любой модальности, а
                    // правило системы говорит
                    // «залётный фокус мышью кольца не даёт». Своё кольцо — inset, в
                    // ds.css по html[data-modality="kb"]: список обрезан overflow'ом, и
                    // наружное всё равно срезалось бы.
                    outline: 'none',
                  }}
                >
                  {o.icon ? (
                    <span style={{ display: 'inline-flex', flex: 'none', color: 'inherit' }}>
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
                      влево относительно соседей, и список дёргается при переборе. Цвет —
                      ступень ниже подписи: маркер не может быть ярче того, что отмечает. */}
                  <span
                    style={{
                      display: 'inline-flex',
                      flex: 'none',
                      color: 'var(--text-secondary)',
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
            {/* Пустой список и загрузка — РАЗНЫЕ сообщения: «вариантов нет» про справочник,
                который ещё едет, — неправда. Плашка объявлена как option: обычный div
                внутри listbox для дерева доступности не существует вовсе, и диктор молчал
                бы там, где человек видит текст. */}
            {items.length === 0 ? (
              <div
                role="option"
                aria-disabled="true"
                aria-selected="false"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: `${ITEM_H}px`,
                  padding: '0 var(--sp-2)',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-m)',
                  lineHeight: 'var(--lh-ui)',
                }}
              >
                {loading ? 'Загружаем…' : 'Ничего нет'}
              </div>
            ) : null}
          </div>
        </Layer>
      ) : null}
    </div>
  );
});
