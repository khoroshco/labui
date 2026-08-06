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
  type MouseEvent,
  type ReactNode,
} from 'react';
import { setRef } from '../lib/refs.js';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Layer } from '../lib/Layer.js';
import { useControlledState, useReducedMotion } from '../lib/hooks.js';
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
  /** Семантика подтверждения: удаление — danger. Иерархию кнопка выбирает сама. */
  tone?: 'ok' | 'danger';
  /** Подтверждение ждёт ответа сервера: кнопка со спиннером, окно не закрывается само. */
  loading?: boolean;
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
const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const tabbables = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => !el.hasAttribute('inert') && !el.closest('[inert]') && el.offsetParent !== null
  );

/** Сколько окон открыто: прокрутку страницы возвращает последнее закрывшееся, а не первое. */
let locks = 0;

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
  tone,
  loading = false,
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
  const reduced = useReducedMotion();

  useEffect(() => {
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
  useLayoutEffect(() => {
    if (!mounted) return;
    returnTo.current = (document.activeElement as HTMLElement) ?? null;
  }, [mounted]);

  // ── фон выключается: inert + aria-hidden соседям по body ─────────────────────
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    const node = popup.current;
    const touched: { el: Element; inert: string | null; hidden: string | null }[] = [];
    for (const el of Array.from(document.body.children)) {
      if (node && el.contains(node)) continue;
      touched.push({ el, inert: el.getAttribute('inert'), hidden: el.getAttribute('aria-hidden') });
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    }
    return () => {
      for (const t of touched) {
        // Возвращаем ПРЕЖНЕЕ значение, а не снимаем атрибут: у соседа он мог быть свой —
        // вложенное окно как раз этот случай, и снятие «починило» бы фон под ним.
        if (t.inert === null) t.el.removeAttribute('inert');
        else t.el.setAttribute('inert', t.inert);
        if (t.hidden === null) t.el.removeAttribute('aria-hidden');
        else t.el.setAttribute('aria-hidden', t.hidden);
      }
    };
  }, [mounted]);

  // ── прокрутка страницы заперта ──────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    locks++;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    if (locks === 1) {
      const bar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      // Компенсация ширины полосы: без неё страница под окном дёргается при открытии.
      if (bar > 0) body.style.paddingRight = `${bar}px`;
    }
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPad;
      }
    };
  }, [mounted]);

  // ── фокус внутрь: ровно тогда, когда узел появился ──────────────────────────
  useEffect(() => {
    if (!popupEl) return;
    const first = tabbables(popupEl)[0];
    // Если внутри нет ни одного интерактивного элемента, фокус берёт само окно: иначе он
    // остаётся снаружи, в выключённой странице, и следующий Tab начинает обход с начала.
    (first ?? popupEl).focus({ preventScroll: true });
  }, [popupEl]);

  // ── фокус назад: отдельным эффектом, чтобы не сработать на появление узла ────
  useEffect(() => {
    if (!mounted) return;
    return () => {
      // Фокус возвращается ТУДА, ОТКУДА ПРИШЁЛ. Без этого следующий Tab начинает обход
      // документа с начала — человек нажимает Tab и оказывается в шапке сайта.
      const back = returnTo.current;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [mounted]);

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
          zIndex: 80,
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
            if (!dismissible) return;
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
          }}
        />
        <div
          {...passThrough(rest)}
          ref={mergedRef}
          // Уходящее окно фокуса не берёт: 220 мс оно ещё видно, и таб успевал попасть
          // на кнопку, которой сейчас не станет.
          {...(leaving ? ({ inert: '' } as Record<string, string>) : {})}
          // Отменяемое — dialog; обязательное решение — alertdialog. Это разные вещи:
          // второе диктор объявляет как требующее ответа, а не как «открылось окно».
          role={dismissible ? 'dialog' : 'alertdialog'}
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
            maxWidth: WIDTH[size] ?? WIDTH.m,
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-4)',
            padding: 'var(--sp-5)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-l)',
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
                  style={{ flex: 'none', marginRight: 'calc(-1 * var(--sp-2))', marginTop: 'calc(-1 * var(--sp-1))' }}
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
                <Button label={confirmLabel} variant="primary" tone={tone} loading={loading} onClick={() => onConfirm?.()} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Layer>
  );
});
