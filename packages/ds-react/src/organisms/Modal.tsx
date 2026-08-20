import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Layer } from '../lib/Layer.js';
import { collapsedProps } from '../lib/collapsed.js';
import { useControlledState, useIsoLayoutEffect, useReducedMotion } from '../lib/hooks.js';
import { Button } from '../atoms/Button.js';

/** Почему закрылось. Причина — часть контракта, а не догадка потребителя. */
export type ModalReason = 'confirm' | 'cancel' | 'close' | 'escape' | 'backdrop';

export interface ModalProps extends PassThrough {
  open?: boolean;
  defaultOpen?: boolean;
  /** Заголовок. Он же имя окна для скринридера — без него окно безымянно. */
  label?: string;
  /** Подзаголовок: одна фраза о последствии. Он же описание окна. */
  subtitle?: string;
  children?: ReactNode;
  size?: 's' | 'm' | 'l';
  /** Подтверждающее действие. Кнопку рисует ПОДПИСЬ: задал подпись — значит нужна кнопка. */
  confirmLabel?: string;
  /** Отмена — собственное действие окна: закрывает и без колбэка. */
  cancelLabel?: string;
  /** Семантика ПОДТВЕРЖДЕНИЯ: удаление — danger. Иерархию кнопка выбирает сама.
   *  Имя с приставкой не случайно: голое `tone` читалось бы как «тон окна», а красит оно
   *  ровно одну кнопку. Тот же разбор, что запретил плоский actionVariant у EmptyState —
   *  только там действие одно, а здесь их два. */
  confirmTone?: 'ok' | 'danger';
  /** Подтверждение ждёт ответа сервера: кнопка со спиннером, окно не закрывается само.
   *  Тоже с приставкой: `loading` в словаре системы означает «содержимое заменяется
   *  скелетоном», а здесь это состояние одной кнопки. */
  confirmLoading?: boolean;
  /**
   * Escape и клик по подложке закрывают окно. `false` — решение обязательно, и роль
   * меняется на alertdialog: это разные вещи, а не оттенок одной.
   */
  dismissible?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onOpenChange?: (open: boolean, reason: ModalReason) => void;
  style?: CSSProperties;
}

const WIDTH = { s: '380px', m: '520px', l: '760px' } as const;
/** Длительность ухода: столько окно ещё живёт в DOM после закрытия. */
const EXIT = 220;

/** Что можно сфокусировать табом. Скрытое и inert сюда не попадает. */
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  // Редактор, встроенный фрейм и медиа с контролами тоже берут таб. Без них липкая
  // панель редактора внутри окна выпадала из ловушки — то есть становилась недостижимой
  // с клавиатуры ИЛИ выпускала фокус наружу, смотря что стояло рядом.
  '[contenteditable]:not([contenteditable="false"])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
].join(',');

/**
 * Видимость меряется СЛЕДСТВИЕМ — есть ли у элемента рамки, — а не признаком.
 * `offsetParent !== null` выглядит той же проверкой и ложен для `position: fixed`:
 * по спецификации у фиксированного элемента offsetParent пуст. Липкая кнопка «Применить»
 * в углу окна из-за этого выпадала из ловушки целиком.
 */
const tabbables = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => !el.hasAttribute('inert') && !el.closest('[inert]') && el.getClientRects().length > 0
  );

/* ФОН ВЫКЛЮЧАЕТСЯ ОДНИМ РЕЕСТРОМ НА ВСЕ ОКНА, а не каждым окном по отдельности.
 *
 * Личный снимок у каждой копии ломал страницу необратимо ровно так же, как ломал её
 * личный снимок замка прокрутки. Два окна, закрытые одним коммитом: React выполняет все
 * очистки подряд, первая снимает атрибуты, вторая возвращает ЗАПОМНЕННОЕ ЕЮ — то есть
 * `inert` и `aria-hidden`, поставленные первой. Окон нет, а страница не берёт ни таб, ни
 * указатель, ни диктора. До перезагрузки.
 *
 * Реестр решает и второе: соседи ПЕРЕСМАТРИВАЮТСЯ на каждое изменение, поэтому тост или
 * чужой портал, появившийся в body уже после открытия, тоже выключается — раньше он
 * оставался живым и мог лечь поверх подложки.
 *
 * Живым остаётся слой ВЕРХНЕГО окна: у вложенных окон нижнее выключается вместе с фоном.
 */
const openModals: HTMLElement[] = [];
let bgSnapshot: { el: Element; inert: string | null; hidden: string | null }[] | null = null;

function applyBackground() {
  if (typeof document === 'undefined') return;
  const top = openModals[openModals.length - 1] ?? null;
  if (!top) {
    for (const t of bgSnapshot ?? []) {
      // Возвращаем ПРЕЖНЕЕ значение, а не снимаем атрибут: у соседа он мог быть свой.
      if (t.inert === null) t.el.removeAttribute('inert');
      else t.el.setAttribute('inert', t.inert);
      if (t.hidden === null) t.el.removeAttribute('aria-hidden');
      else t.el.setAttribute('aria-hidden', t.hidden);
    }
    bgSnapshot = null;
    return;
  }
  if (!bgSnapshot) {
    bgSnapshot = [...document.body.children].map((el) => ({
      el,
      inert: el.getAttribute('inert'),
      hidden: el.getAttribute('aria-hidden'),
    }));
  }
  for (const el of [...document.body.children]) {
    if (el.contains(top)) {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
      continue;
    }
    el.setAttribute('inert', '');
    el.setAttribute('aria-hidden', 'true');
  }
}

/* ЗАМОК ПРОКРУТКИ — ОДИН НА ВСЕ ОКНА, и снимок прежних значений тоже ОДИН.
 *
 * Пока снимок брала каждая копия, вложенные окна ломали страницу необратимо: A ставит
 * `hidden` и запоминает пустую строку, B монтируется поверх и запоминает уже `hidden`;
 * A закрывается первой (обычный порядок для «подтвердите» поверх формы) — счётчик 1,
 * восстановления нет; закрывается B — счётчик 0, и она возвращает ТО, ЧТО ЗАПОМНИЛА
 * САМА: `overflow:hidden` и пустую полосу справа. Страница остаётся мёртвой до F5.
 */
let locks = 0;
let lockedOverflow = '';
let lockedPad = '';

/**
 * Модальное окно: решение, без которого дальше нельзя.
 *
 * Это не «поверхность для чего угодно», а прерывание: пока окно открыто, остальной
 * страницы для человека не существует — ни для указателя, ни для таба, ни для диктора.
 * Отсюда всё устройство ниже, и каждый пункт оплачен известным дефектом чужих модалок.
 *
 * ФОН ВЫКЛЮЧАЕТСЯ ЦЕЛИКОМ. Соседям по body ставится `inert` и `aria-hidden`: без первого
 * таб уходит в страницу под окном и человек правит форму, которой не видно; без второго
 * скринридер читает всё подряд, потому что визуальное перекрытие ему не сообщает ничего.
 * `aria-modal` одного этого не делает — на него полагаться нельзя.
 *
 * ФОКУС ЗАПЕРТ И ВОЗВРАЩАЕТСЯ. Tab у последнего элемента идёт на первый, Shift+Tab у
 * первого — на последний. При открытии фокус уходит на первый интерактивный элемент, а
 * если такого нет — на само окно (иначе он остаётся снаружи, в выключенной странице, и
 * следующий Tab начинает обход документа с начала). При закрытии возвращается ровно туда,
 * откуда пришёл: кнопка, которой окно открыли, — единственное место, где человек ждёт его
 * найти.
 *
 * ВЫХОД АНИМИРОВАН, ЗНАЧИТ УЗЕЛ ЖИВЁТ ДОЛЬШЕ ПРОПА. Окно снимается из DOM не по `open`,
 * а после ухода — иначе выход схлопывается мгновенно, а правило системы говорит «выход
 * всегда анимирован». На это время окно становится `inert`: 220 мс оно ещё видно, и таб
 * успевал попасть на кнопку, которой сейчас не станет (тот же дефект был у уходящего
 * тоста).
 *
 * ПРОКРУТКА СТРАНИЦЫ ЗАПЕРТА, и компенсируется ширина полосы прокрутки: без компенсации
 * страница под окном дёргается на её ширину в момент открытия.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. У Base UI неотменяемое окно — ОТДЕЛЬНЫЙ компонент (AlertDialog), и
 * разница выражена сужением типа: у него физически нет пропа «закрывается кликом мимо».
 * Приём отличный, но состав системы не расширяется без решения владельца, поэтому у нас
 * это `dismissible` — с тем же следствием для роли (`alertdialog`) и того же поведения.
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal({
  open: openProp,
  defaultOpen = false,
  label = '',
  subtitle = '',
  children,
  size = 'm',
  confirmLabel = '',
  cancelLabel = '',
  confirmTone,
  confirmLoading = false,
  dismissible = true,
  onConfirm,
  onCancel,
  onOpenChange,
  style,
  ...rest
}, ref) {
  // Режим управления фиксируется на монтировании — общее правило системы (ADR 0011),
  // и реализация та же, что у всех контролов: смена режима предупреждает в консоли.
  const [open, setOwnOpen] = useControlledState(openProp, defaultOpen);

  const reactId = useId();
  const titleId = `${reactId}-title`;
  const descId = `${reactId}-desc`;
  const popup = useRef<HTMLDivElement | null>(null);
  // Узел окна живёт в СОСТОЯНИИ, а не только в ref: слой монтируется на кадр позже
  // открытия (портал ждёт, пока станет известен document.body — см. lib/Layer.tsx), и
  // эффект, зависевший от «окно смонтировано», отрабатывал по пустому ref. Фокус
  // оставался на <body>, Escape до обработчика не доходил, ловушка таба не работала.
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const returnHome = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (confirmLabel && !onConfirm) {
      console.warn(
        `Modal: у кнопки «${confirmLabel}» нет onConfirm — нажатие не сделает ничего. ` +
          'Подтверждение закрывает окно САМО только через onOpenChange: ответа сервера ждут с loading.'
      );
    }
  }, [confirmLabel, onConfirm]);

  // Узел живёт дольше пропа: 220 мс ухода. `shown` — то, что видно; `mounted` — то, что в DOM.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Кадр между вставкой и включением: без него переход не с чего начинать, и окно
      // появляется без анимации.
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    if (!mounted) return;
    setShown(false);
    const t = setTimeout(() => setMounted(false), EXIT);
    return () => clearTimeout(t);
  }, [open, mounted]);

  /* УХОДЯЩЕЕ окно — это `mounted && !open`, а не «ещё не показано».
   *
   * Разница стоила рабочей модалки. Пока inert стоял по признаку «не показано», он
   * оказывался и на ПЕРВОМ кадре открытия — том самом, на котором окно ищет, куда
   * поставить фокус. Внутри inert фокусировать нечего: фокус оставался на <body>, Escape
   * до обработчика окна не доходил, ловушка таба не работала. Снаружи это выглядело как
   * «окно открылось и ни на что не реагирует».
   */
  const leaving = mounted && !open;

  const close = useCallback(
    (reason: ModalReason) => {
      setOwnOpen(false);
      onOpenChange?.(false, reason);
    },
    [setOwnOpen, onOpenChange]
  );

  /* КТО ОТКРЫЛ — запоминаем ДО того, как фон станет inert.
   *
   * Порядок здесь не стилистический. Как только соседу по body ставится `inert`, браузер
   * снимает фокус со всего, что внутри, — то есть с кнопки, которой окно и открыли. Эффект,
   * читавший activeElement после этого, получал <body>, и «вернуть фокус туда, откуда
   * пришли» возвращало его в никуда. Layout-эффект выполняется раньше любого обычного,
   * поэтому кнопка запоминается ещё живой.
   */
  useIsoLayoutEffect(() => {
    // Зависимость — ОТКРЫТИЕ, а не присутствие в DOM: узел живёт ещё 220 мс после
    // закрытия, и цикл «закрыли-открыли» внутри этого срока `mounted` не сбрасывал —
    // окно второго шага мастера возвращало фокус на кнопку первого.
    if (!open) return;
    const el = (document.activeElement as HTMLElement) ?? null;
    // `<body>` открывашкой не бывает: окно, открытое таймером, ответом сервера или просто
    // `defaultOpen`, «возвращало» бы фокус в никуда — а это и есть «обход документа с
    // начала», от которого возврат и защищает.
    returnTo.current = el && el !== document.body ? el : null;
    // Запасной адрес возврата: узел, который переживёт исчезновение самой открывашки.
    // Кнопка «Удалить» стоит в ряду списка, ряд исчезает вместе с записью — и возвращать
    // фокус становится некуда, а `<body>` означает «обход документа с начала».
    returnHome.current = (returnTo.current?.closest('[data-row], [data-island], main, form') as HTMLElement) ?? null;
  }, [open]);

  /* ФОН ВЫКЛЮЧЕН, ПОКА ОКНО ОТКРЫТО, а не пока оно в DOM.
   *
   * Разница в 220 мс ухода, и она решающая: `inert` не даёт СФОКУСИРОВАТЬ ничего внутри,
   * поэтому вернуть фокус на кнопку-открывашку, пока фон ещё выключен, физически нельзя —
   * попытка молча не срабатывает, и фокус остаётся на `<body>`. Уходящее окно к этому
   * времени само `inert`, так что «два живых слоя» не возникает: живой ровно один.
   */
  useEffect(() => {
    if (!open || !popupEl) return;
    openModals.push(popupEl);
    applyBackground();
    return () => {
      const i = openModals.indexOf(popupEl);
      if (i >= 0) openModals.splice(i, 1);
      applyBackground();
    };
  }, [open, popupEl]);

  // ── прокрутка страницы заперта ──────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const body = document.body;
    if (locks === 0) {
      lockedOverflow = body.style.overflow;
      lockedPad = body.style.paddingRight;
      const bar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      // Компенсация ширины полосы: без неё страница под окном дёргается при открытии.
      if (bar > 0) body.style.paddingRight = `${bar}px`;
    }
    locks++;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        body.style.overflow = lockedOverflow;
        body.style.paddingRight = lockedPad;
      }
    };
  }, [mounted]);

  // ── фокус внутрь: ровно тогда, когда узел появился ──────────────────────────
  useEffect(() => {
    // `open` в зависимостях обязателен: цикл «закрыли-открыли» внутри 220 мс ухода узел
    // не пересоздаёт, и эффект по одному только [popupEl] не переотрабатывал — окно
    // открывалось мёртвым, с фокусом на <body>, без Escape и без ловушки таба.
    if (!popupEl || !open) return;
    const first = tabbables(popupEl)[0];
    // Если внутри нет ни одного интерактивного элемента, фокус берёт само окно: иначе он
    // остаётся снаружи, в выключённой странице, и следующий Tab начинает обход с начала.
    (first ?? popupEl).focus({ preventScroll: true });
  }, [popupEl, open]);

  /* ФОКУС НАЗАД — В МОМЕНТ НАЧАЛА УХОДА, а не при размонтировании.
   *
   * Уходящее окно получает `inert`, и браузер тут же снимает с него фокус на `<body>`.
   * Пока возврат стоял в очистке эффекта, эти 220 мс фокус лежал в никуда: Tab в это
   * время начинал обход документа с начала — ровно тот дефект, от которого окно и
   * защищается. Проверка «уходящее окно inert» его не видела: она смотрит на атрибут.
   */
  const restoreFocus = useCallback(() => {
    const back = returnTo.current;
    const alive = back && document.contains(back) ? back : returnHome.current;
    if (!alive || !document.contains(alive) || alive === document.body) return;
    if (alive !== back && alive.tabIndex < 0) alive.tabIndex = -1;
    alive.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!mounted || open) return;
    restoreFocus();
  }, [mounted, open, restoreFocus]);

  // Родителя размонтировали с открытым окном — обычное дело для `{open && <Modal/>}` и
  // для смены вкладки. Эффект выше в этом случае не исполняется вовсе, и фокус остаётся
  // на `<body>`: следующий Tab начинает обход документа с начала.
  useEffect(() => () => restoreFocus(), [restoreFocus]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (!dismissible) return;
      // Гасим всплытие: под окном может стоять свой обработчик Escape (тост, выпадашка),
      // и одно нажатие не должно закрывать два разных.
      e.stopPropagation();
      e.preventDefault();
      close('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const node = popup.current;
    if (!node) return;
    const list = tabbables(node);
    if (!list.length) {
      // Фокусировать нечего — держим его на самом окне, иначе Tab уводит в выключённый фон.
      e.preventDefault();
      node.focus({ preventScroll: true });
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const activeEl = document.activeElement;
    if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (activeEl === first || activeEl === node)) {
      e.preventDefault();
      last.focus();
    }
  };

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      popup.current = el;
      setPopupEl(el);
      setRef(ref, el);
    },
    [ref]
  );

  if (!mounted) return null;

  // Кнопку рисует ПОДПИСЬ, а не колбэк. У PinCard правило обратное («нет колбэка — нет
  // кнопки»), но там оно про РОЛЬ: у зрителя без права решать кнопки «Решено» быть не
  // должно. Здесь подпись и есть намерение — «Удалить» без обработчика это опечатка в
  // коде потребителя, и прятать кнопку значит прятать ошибку. Поэтому кнопка есть, а об
  // ошибке говорим прямо, как Checkbox говорит про отсутствующее имя.
  const showConfirm = !!confirmLabel;
  const showCancel = !!cancelLabel;
  const hasFooter = showConfirm || showCancel;

  return (
    <Layer>
      <div
        // Подложка и окно — один узел портала: так «выключить соседей по body» имеет
        // ровно одно исключение, а не два, которые могут разъехаться.
        data-modal-root="true"
        style={{
          position: 'fixed',
          inset: 0,
          // dvh, а не растяжка по inset: layout viewport на iOS виртуальная клавиатура не
          // уменьшает, и подвал с кнопками оказывался под ней без возможности доскроллить.
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sp-4)',
          // Прокрутка ЗДЕСЬ, а не внутри окна: высокое окно на низком экране должно
          // прокручиваться целиком, вместе с заголовком, а не прятать его над полем зрения.
          overflowY: 'auto',
        }}
      >
        <div
          data-modal-backdrop="true"
          // Подложка декоративна: имя и роль несёт окно. Клик по ней — закрытие, но для
          // клавиатуры и диктора её нет вовсе.
          aria-hidden="true"
          onClick={(e: MouseEvent) => {
            // Уходящее окно уже закрыто: без этой проверки клик в те же 220 мс присылал
            // ВТОРОЕ закрытие с причиной «backdrop» и съедал клик, адресованный странице.
            if (!dismissible || !open) return;
            e.stopPropagation();
            close('backdrop');
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay)',
            opacity: shown ? '1' : '0',
            transition: `opacity ${shown ? '.24s' : '.2s'} ${shown ? 'var(--ease-out)' : 'var(--ease-in)'}`,
            cursor: dismissible ? 'pointer' : 'default',
            pointerEvents: open ? 'auto' : 'none',
          }}
        />
        <div
          {...passThrough(rest)}
          ref={mergedRef}
          // Уходящее окно фокуса не берёт: 220 мс оно ещё видно, и таб успевал попасть
          // на кнопку, которой сейчас не станет.
          {...collapsedProps(leaving)}
          // Отменяемое — dialog; обязательное решение — alertdialog. Это разные вещи:
          // второе диктор объявляет как требующее ответа, а не как «открылось окно».
          role={dismissible ? 'dialog' : 'alertdialog'}
          data-modal="true"
          aria-modal="true"
          aria-labelledby={label ? titleId : undefined}
          aria-describedby={subtitle ? descId : undefined}
          // Окно фокусируемо программно, но не табом: это точка возврата, когда внутри
          // нет ни одного интерактивного элемента.
          tabIndex={-1}
          onKeyDown={onKey}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: WIDTH[size],
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-4)',
            padding: 'var(--sp-5)',
            // Плавающая поверхность — --bg-float, как у тоста и карточки пина: в тёмной
            // теме высоту выражает ступень яркости, и окно, выключающее вообще всё, не
            // может стоять ТЕМНЕЕ всплывающего тоста. Радиус --r-m — тот же, что у всех
            // поверхностей системы: правила «радиус растёт с размером» в ней нет, а
            // остров бывает шире окна.
            background: 'var(--bg-float)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-m)',
            boxShadow: 'var(--shadow-lg)',
            outline: 'none',
            opacity: shown ? '1' : '0',
            // Вход пружиной снизу, выход короче и вниз — асимметрия входа и выхода.
            // Под reduced-motion остаётся только прозрачность.
            transform: reduced ? 'none' : shown ? 'none' : 'translateY(8px) scale(.97)',
            transition: reduced
              ? `opacity ${shown ? '.24s' : '.18s'} ease`
              : shown
                ? 'opacity .24s ease, transform .4s var(--ease-spring)'
                : 'opacity .18s ease, transform .2s var(--ease-in)',
            ...style,
          }}
        >
          {label || dismissible ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                {label ? (
                  <h2
                    id={titleId}
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 'var(--fw-medium)',
                      fontSize: 'var(--fs-h3)',
                      lineHeight: 'var(--lh-heading)',
                      letterSpacing: 'var(--ls-heading)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {label}
                  </h2>
                ) : null}
                {subtitle ? (
                  <p
                    id={descId}
                    style={{
                      margin: 0,
                      maxWidth: 'var(--measure-narrow)',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 'var(--fw-regular)',
                      fontSize: 'var(--fs-m)',
                      lineHeight: 'var(--lh-text)',
                      // Абзац, который нужно прочесть, — это содержание, а не подпись контрола.
                      color: 'var(--text-body)',
                    }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
              {dismissible ? (
                <Button
                  icon="xmark"
                  variant="ghost"
                  size="s"
                  tooltip="Закрыть"
                  onClick={() => close('close')}
                  // Кнопка 36×36 центруется по ПЕРВОЙ СТРОКЕ заголовка (18px × 1.2 ≈ 21.6px):
                  // сдвиг вверх на полразницы, иначе икс читается съехавшим к базовой линии.
                  style={{ flex: 'none', marginRight: 'calc(-1 * var(--sp-25))', marginTop: 'calc(-1 * var(--sp-2))' }}
                />
              ) : null}
            </div>
          ) : null}

          {children ? <div style={{ minWidth: 0 }}>{children}</div> : null}

          {hasFooter ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              {showCancel ? (
                <Button
                  label={cancelLabel}
                  variant="secondary"
                  onClick={() => {
                    onCancel?.();
                    close('cancel');
                  }}
                />
              ) : null}
              {showConfirm ? (
                <Button label={confirmLabel} variant="primary" tone={confirmTone} loading={confirmLoading} onClick={() => onConfirm?.()} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Layer>
  );
});
