/* Стенд для логики компонентов без браузера.
 *
 * DC-компонент — это класс с renderVals(): вся логика уже отделена от разметки, поэтому
 * её можно вызвать напрямую. Стенд поднимает класс из .dc.html с заглушкой DCLogic и
 * повторяет ровно то, что делает рантайм: значения для шаблона это {...props, ...renderVals()}.
 *
 * Тесты здесь про ЛОГИКУ (управляемость, валидация, магнит слайдера). Всё, что про пиксели,
 * вычисленные стили, хит-зоны и ARIA, живёт в tests/visual и tests/a11y — там браузер.
 */
import { components } from '../../scripts/lib/dc.mjs';

const classes = new Map();

function classFor(name) {
  if (classes.has(name)) return classes.get(name);
  const c = components().find((c) => c.name === name);
  if (!c) throw new Error(`нет компонента «${name}»`);

  // Заглушка базового класса: то же, что даёт рантайм, и ничего сверх.
  class DCLogic {
    constructor(props) {
      this.props = props ?? {};
    }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = { ...this.state, ...next };
      this.__renders = (this.__renders ?? 0) + 1;
    }
  }
  // window нужен обработчикам (dsTrackActive и родня) — в renderVals его никто не трогает.
  // dsReducedMotion здесь true осознанно: без браузера нет requestAnimationFrame, а ветка
  // reduced-motion как раз считает значение сразу и без пружин. Логика от этого не меняется —
  // меняется только то, чем её показывают, а показ проверяют визуальные тесты.
  const windowStub = { dsReducedMotion: () => true };
  const factory = new Function(
    'DCLogic',
    'StreamableLogic',
    'window',
    'React',
    `${c.logic}\n;return typeof Component !== 'undefined' ? Component : undefined;`
  );
  const Cls = factory(DCLogic, DCLogic, windowStub, {});
  if (typeof Cls !== 'function') throw new Error(`${name}: в файле нет class Component extends DCLogic`);
  classes.set(name, Cls);
  return Cls;
}

/** Дефолты из data-props — то, с чем компонент приходит к потребителю. */
export function defaults(name) {
  const c = components().find((c) => c.name === name);
  return Object.fromEntries(
    Object.entries(c.props)
      .filter(([, m]) => m.default !== undefined)
      .map(([k, m]) => [k, m.default])
  );
}

/**
 * Смонтировать компонент со своими пропсами (дефолты подставляются, как в рантайме).
 * `vals()` — то, что увидит шаблон; `set()` — новые пропсы от родителя.
 */
export function mount(name, props = {}, { withDefaults = true } = {}) {
  const Cls = classFor(name);
  const inst = new Cls({ ...(withDefaults ? defaults(name) : {}), ...props });
  return {
    instance: inst,
    get props() {
      return inst.props;
    },
    vals() {
      return { ...inst.props, ...(inst.renderVals() ?? {}) };
    },
    set(patch) {
      inst.props = { ...inst.props, ...patch };
      return this;
    },
    /** Сколько раз компонент менял собственное состояние. */
    get selfUpdates() {
      return inst.__renders ?? 0;
    },
  };
}
