/**
 * Привязка всплывающего к якорю: куда его поставить и какой высоты пустить.
 *
 * Мера — не «снизу, если влезает», а СКОЛЬКО МЕСТА ЕСТЬ с каждой стороны. Разница видна
 * ровно там, где ошибаются: список из двадцати опций не влезает НИКУДА, и правило «не
 * влезло снизу — рисуем сверху» переносит его туда, где места ещё меньше. Поэтому сторона
 * выбирается по бóльшему запасу, а высота обрезается по нему же — список получает
 * прокрутку, а не уезжает за край экрана.
 *
 * Координаты — в системе `position: fixed`, то есть от вьюпорта: слой лежит в портале на
 * body, и прокрутка страницы его не двигает (см. lib/Layer.tsx). Пересчитывать при
 * прокрутке и ресайзе обязан вызывающий — здесь только арифметика, без подписок.
 */
export interface Anchored {
  /** Координаты для `position: fixed`. */
  top: number;
  left: number;
  /** Ширина якоря: выпадашка по умолчанию ровно под ним, как у нативного селекта. */
  width: number;
  /** Потолок высоты: остаток до края экрана минус поле. Больше — только прокрутка внутри. */
  maxHeight: number;
  /** Куда раскрылось. Наружу — чтобы анимация росла ИЗ якоря, а не в него. */
  side: 'top' | 'bottom';
}

/** Зазор между якорем и всплывающим. */
const GAP = 6;
/** Поле до края экрана: всплывающее не должно касаться границы вьюпорта. */
const EDGE = 8;

export function anchorTo(anchor: DOMRect, wantHeight: number, viewport = { w: window.innerWidth, h: window.innerHeight }): Anchored {
  const below = viewport.h - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  // Снизу — предпочтение: так открывается нативный селект, и взгляд не прыгает. Наверх
  // уходим, только когда там ЗАМЕТНО просторнее: качели на разнице в пару пикселей дают
  // выпадашку, которая при каждом открытии оказывается с другой стороны.
  const side: 'top' | 'bottom' = below >= wantHeight || below >= above - 24 ? 'bottom' : 'top';
  const room = side === 'bottom' ? below : above;
  const height = Math.max(0, Math.min(wantHeight, room));

  // Горизонталь: держим ширину якоря, но не даём вылезти за поле экрана — узкий контрол
  // у правого края иначе уводит выпадашку за границу.
  const width = anchor.width;
  const left = Math.min(Math.max(EDGE, anchor.left), Math.max(EDGE, viewport.w - width - EDGE));

  return {
    top: side === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - height,
    left,
    width,
    maxHeight: height,
    side,
  };
}
