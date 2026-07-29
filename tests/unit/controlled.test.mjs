/* Инвариант: управление состоянием контролов ЕДИНОЕ (CLAUDE.md).
 *
 *   пришёл колбэк → состоянием владеет родитель, контрол показывает ровно переданное значение;
 *   колбэка нет   → контрол ведёт своё, а проп работает начальным.
 *
 * Замерзший контрол ловили здесь трижды; последний раз — Tabs, у которого кламп считал
 * вкладки по пустому props.options и возвращал ноль при живых кликах.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from './harness.mjs';

const ev = () => ({ preventDefault() {}, stopPropagation() {}, detail: 0, key: ' ' });

/** Шесть контролов системы: как читать показанное значение и как его сменить изнутри. */
const CONTROLS = [
  {
    name: 'Toggle',
    prop: 'checked',
    off: false,
    on: true,
    callback: 'onChange',
    shown: (v) => v.ariaChecked === 'true',
    expect: { off: false, on: true },
    fire: (v) => v.toggle(ev()),
  },
  {
    name: 'Checkbox',
    prop: 'checked',
    off: false,
    on: true,
    callback: 'onChange',
    shown: (v) => v.ariaChecked === 'true',
    expect: { off: false, on: true },
    fire: (v) => v.toggle(ev()),
  },
  {
    name: 'Disclosure',
    prop: 'open',
    off: false,
    on: true,
    callback: 'onToggle',
    shown: (v) => v.ariaExpanded === 'true',
    expect: { off: false, on: true },
    fire: (v) => v.toggle(ev()),
  },
  {
    name: 'OptionGroup',
    prop: 'value',
    off: 0,
    on: 1,
    extra: { options: ['Первая', 'Вторая', 'Третья'] },
    callback: 'onChange',
    shown: (v) => v.opts.findIndex((o) => o.checked === 'true'),
    expect: { off: 0, on: 1 },
    fire: (v) => v.opts[1].pick(ev()),
  },
  {
    name: 'Tabs',
    prop: 'value',
    off: 0,
    on: 1,
    callback: 'onChange',
    shown: (v) => v.tabs.findIndex((t) => t.selected === 'true'),
    expect: { off: 0, on: 1 },
    fire: (v) => v.tabs[1].pick(ev()),
  },
  {
    name: 'CycleButton',
    prop: 'value',
    off: 0,
    on: 1,
    extra: { options: ['PX', 'REM'] },
    callback: 'onChange',
    shown: (v) => v.current,
    expect: { off: 'PX', on: 'REM' },
    fire: (v) => v.cycle(ev()),
  },
];

for (const c of CONTROLS) {
  const props = (extra) => ({ [c.prop]: c.off, ...(c.extra ?? {}), ...extra });
  // Ожидания записаны явно, а не выведены тем же кодом: иначе сломанный кламп
  // «показал бы» одно и то же в обеих ветках, и тест зеленел бы на замерзшем контроле.
  const shownOff = () => c.expect.off;
  const shownOn = () => c.expect.on;

  test(`${c.name}: без колбэка ведёт своё состояние`, () => {
    const m = mount(c.name, props());
    assert.deepEqual(c.shown(m.vals()), shownOff(), 'исходное значение — из пропа');
    c.fire(m.vals());
    assert.deepEqual(
      c.shown(m.vals()),
      shownOn(),
      'клик без колбэка обязан менять показанное значение — иначе контрол заморожен'
    );
  });

  test(`${c.name}: без колбэка проп работает начальным`, () => {
    const m = mount(c.name, props());
    c.fire(m.vals());
    m.set({ [c.prop]: c.off }); // родитель прислал старое значение
    assert.deepEqual(
      c.shown(m.vals()),
      shownOn(),
      'у неуправляемого контрола проп — начальное значение, а не постоянный источник'
    );
  });

  test(`${c.name}: с колбэком показывает ровно переданное значение`, () => {
    const calls = [];
    const m = mount(c.name, props({ [c.callback]: (...a) => calls.push(a) }));
    c.fire(m.vals());
    assert.equal(calls.length, 1, 'колбэк обязан быть вызван ровно один раз');
    assert.deepEqual(
      c.shown(m.vals()),
      shownOff(),
      'значением владеет родитель: пока проп не изменился, показ не меняется'
    );
    assert.equal(m.selfUpdates, 0, 'управляемый контрол не держит собственного состояния');
  });

  test(`${c.name}: с колбэком следует за пропом`, () => {
    const m = mount(c.name, props({ [c.callback]: () => {} }));
    m.set({ [c.prop]: c.on });
    assert.deepEqual(c.shown(m.vals()), shownOn(), 'новый проп обязан доехать до показа');
  });
}
