import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * На сервере useLayoutEffect не выполняется и печатает предупреждение на КАЖДЫЙ рендер.
 * Подменяем его на useEffect там, где DOM'а нет: на клиенте поведение не меняется, а
 * SSR-лог потребителя перестаёт быть красным.
 */
const useIsoLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Управляемый и неуправляемый режим — ОДНОЙ идиомой на все контролы.
 *
 * В DC-версии признаком управляемости было наличие колбэка. В React общепринято другое:
 * значение задано (`value` / `checked`) — контрол управляемый, задано только `defaultValue` —
 * ведёт своё. Схемы близки, но не тождественны, и потребитель-React ждёт именно вторую;
 * решение принято одно на все шесть контролов (docs/adr/0011), иначе худший исход —
 * разные правила в разных компонентах.
 *
 * Инвариант тот же, что был: пока значение приходит сверху, контрол показывает РОВНО его.
 */
/**
 * Режим управления БЕЗ колбэка: значение, свой сеттер и признак «владеет родитель».
 *
 * Нужен там, где колбэк не сводится к `(next) => void`: у селекта и модалки он несёт ещё
 * и ПРИЧИНУ изменения (`onOpenChange(open, reason)`). Пока этой развилки не было, оба
 * компонента переписывали идиому у себя — и переписывали не целиком: фиксация режима
 * приезжала, а предупреждение о смене режима терялось. Одна реализация на всех — и
 * теряться нечему.
 */
export function useControlledState<T>(value: T | undefined, defaultValue: T): [T, (next: T) => void, boolean] {
  // Режим фиксируется на МОНТИРОВАНИИ и больше не пересчитывается — см. useControlled ниже.
  const { current: controlled } = useRef(value !== undefined);
  const [own, setOwn] = useState<T>(controlled ? (value as T) : defaultValue);
  const seen = useRef(value);
  if (controlled && value !== undefined && value !== seen.current) {
    seen.current = value;
    setOwn(value);
  }
  const current = controlled ? (value ?? own) : own;

  if (process.env.NODE_ENV !== 'production') {
    const now = value !== undefined;
    if (now !== controlled) {
      console.warn(
        `[@khoroshco/ds] Контрол сменил режим управления: был ${controlled ? 'управляемым' : 'неуправляемым'}, ` +
          `стал ${now ? 'управляемым' : 'неуправляемым'}. Режим фиксируется на монтировании — ` +
          `выберите один: value + onChange либо defaultValue.`
      );
    }
  }

  // Сеттер сам знает, что управляемому контролу своё состояние трогать нельзя: иначе
  // каждый вызывающий обязан помнить об этом, а забыть достаточно одному.
  const set = useCallback(
    (next: T) => {
      if (!controlled) setOwn(next);
    },
    [controlled]
  );
  return [current, set, controlled];
}

export function useControlled<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void
): [T, (next: T) => void, boolean] {
  // Режим фиксируется на МОНТИРОВАНИИ и больше не пересчитывается. Пока он вычислялся
  // каждый рендер, потребитель, у которого значение однажды стало undefined (условный
  // рендер, сброс формы, `?? undefined` в маппинге), получал не «контрол повёл своё», а
  // «контрол показал defaultValue, замороженный при монтировании» — состояние, которого
  // не было ни у кого на экране. Приём взят у Base UI (useControlled).
  const { current: controlled } = useRef(value !== undefined);
  const [own, setOwn] = useState<T>(controlled ? (value as T) : defaultValue);
  // Управляемый контрол, оставшийся без значения, продолжает показывать последнее
  // пришедшее сверху, а не откатывается назад: это ближе к правде, чем любой из дефолтов.
  const seen = useRef(value);
  if (controlled && value !== undefined && value !== seen.current) {
    seen.current = value;
    setOwn(value);
  }
  const current = controlled ? (value ?? own) : own;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setOwn(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );

  if (process.env.NODE_ENV !== 'production') {
    // Смена режима — почти всегда ошибка потребителя, и молча она проявляется как
    // «контрол перестал слушаться» или «контрол потерял значение».
    const now = value !== undefined;
    if (now !== controlled) {
      console.warn(
        `[@khoroshco/ds] Контрол сменил режим управления: был ${controlled ? 'управляемым' : 'неуправляемым'}, ` +
          `стал ${now ? 'управляемым' : 'неуправляемым'}. Режим фиксируется на монтировании — ` +
          `выберите один: value + onChange либо defaultValue.`
      );
    }
  }

  return [current, set, controlled];
}

/** prefers-reduced-motion: крупные перемещения и пружины заменяются фейдами. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Анти-мерцание лоадера. Факт загрузки приходит пропсом сразу — клики блокируются
 * немедленно, — но визуал показывается только если загрузка длится дольше 320 мс,
 * а появившийся лоадер живёт минимум 450 мс: иначе он мигает на исчезновении.
 */
export function useSpin(loading: boolean, { delay = 320, minVisible = 450 } = {}): boolean {
  const [spin, setSpin] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (loading && !spin) {
      // условие «&& !spin» обязательно: иначе эффект каждые 320 мс переставлял таймер и
      // заново писал shownAt, и отсчёт минимальной видимости не начинался никогда
      t = setTimeout(() => {
        shownAt.current = Date.now();
        setSpin(true);
      }, delay);
    } else if (!loading && spin) {
      const left = Math.max(0, minVisible - (Date.now() - shownAt.current));
      t = setTimeout(() => setSpin(false), left);
    }
    return () => clearTimeout(t);
  }, [loading, spin, delay, minVisible]);
  // Возвращаем именно spin: `loading && spin` гасило лоадер в тот же миг, что и загрузку,
  // то есть правило «появившийся лоадер живёт минимум 450 мс» не работало вовсе.
  return spin;
}

/**
 * Скользящая подложка активной опции (пилюля OptionGroup, подчёркивание Tabs).
 * Меряем позицию активного ребёнка и отдаём прямоугольник — подложка едет к нему
 * пружиной, а не телепортируется.
 */
export function useTrackActive(index: number, deps: unknown[] = []) {
  const box = useRef<HTMLElement | null>(null);
  const [rect, setRect] = useState<{ left: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('[data-track-item]');
    const item = items[index];
    if (!item) return;
    const b = el.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    const next = { left: r.left - b.left, w: r.width };
    setRect((cur) => (cur && cur.left === next.left && cur.w === next.w ? cur : next));
  }, [index]);

  // Мерим после КАЖДОГО рендера: эталон делал это в componentDidUpdate. Зависимость
  // только от индекса пропускала смену подписей — вкладка вырастала, подложка оставалась
  // прежней ширины.
  useIsoLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    // Наблюдаем и контейнер, и сами элементы: у Tabs контейнер блочный и его ширина от
    // подписей не зависит — без наблюдения за элементами подчёркивание оставалось прежним,
    // когда вкладка вырастала.
    ro.observe(el);
    for (const item of el.querySelectorAll('[data-track-item]')) ro.observe(item);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { box, rect, measure };
}

/** Курсор в конец поля — при программном фокусе значение не должно выделяться целиком. */
export function caretToEnd(el: HTMLInputElement | null) {
  if (!el) return;
  const n = el.value.length;
  try {
    el.setSelectionRange(n, n);
  } catch {
    /* поля без выделения (number) — не беда */
  }
}
