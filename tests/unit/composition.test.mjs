/* Инвариант композиции (CLAUDE.md): ряд передаёт колбэк вниз ТОЛЬКО если получил свой,
 * а владея значением — обязан передать и значение.
 *
 * Нарушение выглядит одинаково в обе стороны: атом встаёт в управляемый режим без хозяина
 * и замирает. Ловили трижды, последний раз — в конфиге острова, где noop-подстановка делала
 * колбэки «всегда есть».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { components } from '../../scripts/lib/dc.mjs';
import { mount } from './harness.mjs';

const ev = () => ({ preventDefault() {}, stopPropagation() {}, detail: 0 });

/** Контрол → каким атрибутом ему передают значение. */
const VALUE_ATTR = {
  Toggle: ['checked'],
  Checkbox: ['checked'],
  OptionGroup: ['value'],
  Tabs: ['value'],
  CycleButton: ['value'],
  Disclosure: ['open'],
};
const CALLBACK_ATTR = { 'on-change': true, 'on-toggle': true };

test('вкладывая контрол с колбэком, родитель передаёт и значение', () => {
  const problems = [];
  for (const c of components()) {
    for (const tag of c.template.match(/<dc-import\s[^>]*>/g) ?? []) {
      const name = /name="([^"]+)"/.exec(tag)?.[1];
      const wants = VALUE_ATTR[name];
      if (!wants) continue;
      const passesCallback = Object.keys(CALLBACK_ATTR).some((a) => tag.includes(`${a}=`));
      const passesValue = wants.some((a) => tag.includes(`${a}=`));
      if (passesCallback && !passesValue) {
        problems.push(`${c.file}: ${name} получает колбэк, но не получает ${wants.join('/')}`);
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('ChoiceRow передаёт колбэк вниз только получив свой', () => {
  const without = mount('ChoiceRow', { options: ['А', 'Б'], value: 0 }).vals();
  assert.equal(
    typeof without.change,
    'undefined',
    'без своего колбэка ряд не имеет права делать группу управляемой — ей некому подчиняться'
  );
  const wrapped = mount('ChoiceRow', { options: ['А', 'Б'], value: 0, onChange: () => {} }).vals();
  assert.equal(typeof wrapped.change, 'function', 'получив колбэк, ряд обязан прокинуть его вниз');
  assert.equal(without.value, 0, 'значение ряд передаёт всегда — это его контент');
});

for (const row of ['SwitchRow', 'CheckboxRow']) {
  test(`${row}: без колбэка ведёт своё состояние`, () => {
    const m = mount(row, { checked: false });
    assert.equal(m.vals().on, false);
    m.vals().flip(ev());
    assert.equal(m.vals().on, true, 'ряд сам себе контрол: без хозяина он владеет значением');
  });

  test(`${row}: с колбэком показывает ровно переданное значение`, () => {
    const seen = [];
    const m = mount(row, { checked: false, onChange: (v) => seen.push(v) });
    m.vals().flip(ev());
    assert.deepEqual(seen, [true], 'колбэк обязан получить новое значение');
    assert.equal(
      m.vals().on,
      false,
      'родитель мог смену отклонить — ряд не имеет права показывать её как принятую'
    );
    m.set({ checked: true });
    assert.equal(m.vals().on, true, 'принял — значит проп приехал, и только тогда меняется показ');
  });
}

test('Island отдаёт вниз ровно те колбэки, что дал конфиг', () => {
  const noop = () => {};
  const m = mount('Island', {
    rows: [
      { type: 'toggle', label: 'С колбэком', checked: true, onChange: noop },
      { type: 'toggle', label: 'Без колбэка', checked: true },
    ],
  });
  const [withCb, withoutCb] = m.vals().rowList;
  assert.equal(typeof withCb.onChange, 'function');
  assert.equal(
    typeof withoutCb.onChange,
    'undefined',
    'подстановка noop сделала бы колбэк «всегда есть»: ряд форвардит его вниз, ' +
      'атом встаёт в управляемый режим со значением из статичного конфига и замирает'
  );
  assert.equal(withoutCb.checked, true, 'значение из конфига доезжает до ряда в любом случае');
});
