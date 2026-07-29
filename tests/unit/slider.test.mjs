/* Инвариант: магнит слайдера принадлежит ПЕРЕТАСКИВАНИЮ — неточному вводу (CLAUDE.md).
 *
 * Клавиатура и ручной ввод точны: значение ложится ровно туда, куда его поставили.
 * Иначе шаг мельче силы магнита не двигает ползунок вообще — стрелка нажимается,
 * значение возвращается на кратное, и контрол выглядит сломанным.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from './harness.mjs';

const key = (k, shift = false) => ({ key: k, shiftKey: shift, preventDefault() {}, stopPropagation() {} });
const slider = (props) => mount('Slider', { min: 0, max: 64, step: 1, snapStep: 8, value: 24, ...props });

test('перетаскивание: значение липнет к кратному snapStep', () => {
  const s = slider();
  s.instance.set(25); // не точный ввод — это тянут мышью
  assert.equal(s.instance.cur(), 24, 'в зоне магнита значение обязано лечь на кратное');
});

test('перетаскивание: вне зоны магнита значение остаётся своим', () => {
  const s = slider();
  s.instance.set(28);
  assert.equal(s.instance.cur(), 28, 'сила магнита — не «всегда кратное»: между узлами значение своё');
});

test('точный ввод игнорирует магнит', () => {
  const s = slider();
  s.instance.set(25, true);
  assert.equal(s.instance.cur(), 25, 'exact — это ручной ввод и клавиатура, там значение точно');
});

test('стрелка с шагом мельче силы магнита двигает ползунок', () => {
  const s = slider(); // step=1, snapStep=8 → сила магнита ≈ 2.67, шаг в неё помещается целиком
  s.vals().key(key('ArrowRight'));
  assert.equal(s.instance.cur(), 25, 'иначе стрелка нажимается, а ползунок стоит — залипание на кратном');
  s.vals().key(key('ArrowLeft'));
  assert.equal(s.instance.cur(), 24);
});

test('Shift со стрелкой прыгает по кратным магнита', () => {
  const s = slider({ value: 25 });
  s.vals().key(key('ArrowRight', true));
  assert.equal(s.instance.cur(), 32, 'Shift при магните — переход к следующему узлу');
});

test('ручной ввод значения точен и обрезается по границам', () => {
  const s = slider();
  const v = s.vals();
  v.valDown?.({ preventDefault() {}, stopPropagation() {} });
  s.instance.setState({ edit: { text: '25' } });
  s.vals().valBlur();
  assert.equal(s.instance.cur(), 25, 'введённое руками значение не притягивается к кратному');

  s.instance.setState({ edit: { text: '999' } });
  s.vals().valBlur();
  assert.equal(s.instance.cur(), 64, 'значение выше максимума обрезается по максимуму');
});

test('колбэк получает то же значение, что показано', () => {
  const seen = [];
  const s = slider({ onChange: (v) => seen.push(v) });
  s.instance.set(25);
  s.instance.set(25, true);
  assert.deepEqual(seen, [24, 25], 'что показано, то и уехало наверх — иначе экран и ползунок расходятся');
});
