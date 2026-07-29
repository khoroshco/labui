/* Инвариант: валидация есть только там, где значение можно НЕ дать или дать неверно.
 *
 * У ChoiceRow всегда есть выбранная опция — валидации нет вовсе. У SwitchRow нет «неверно»,
 * есть последствие выбора — предупреждение, но не ошибка. У острова валидации нет в принципе:
 * она принадлежит ряду, у которого есть значение («весь остров ошибочен» был второй,
 * оторванной от значений валидацией и требовал внутреннего пропа tint).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/lib/dc.mjs';
import { mount } from './harness.mjs';

const api = JSON.parse(readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const propsOf = (name) => new Map(api.components.find((c) => c.name === name).props.map((p) => [p.name, p]));

test('ошибку можно показать только там, где значение можно дать неверно', () => {
  for (const name of ['InputRow', 'CheckboxRow']) {
    const level = propsOf(name).get('msgLevel');
    assert.ok(level, `${name}: у ряда со значением обязан быть msgLevel`);
    assert.match(level.type, /danger/, `${name}: снятая галочка и пустое поле — законное «неверно»`);
  }
});

test('SwitchRow предупреждает, но не ошибается', () => {
  const level = propsOf('SwitchRow').get('msgLevel');
  assert.ok(level, 'предупреждение у переключателя есть');
  assert.doesNotMatch(
    level.type,
    /danger/,
    'у переключателя нет «неверно» — есть последствие выбора; ошибка тут означала бы, ' +
      'что положение тумблера бывает недопустимым само по себе'
  );
});

test('у ChoiceRow и острова валидации нет вовсе', () => {
  for (const name of ['ChoiceRow', 'Island']) {
    const props = propsOf(name);
    for (const p of ['msg', 'msgLevel', 'invalid', 'tint']) {
      assert.equal(props.has(p), false, `${name}: проп «${p}» вернул бы вторую валидацию`);
    }
  }
});

test('components.json не расходится с кодом по составу валидации', () => {
  const manual = JSON.parse(readFileSync(path.join(ROOT, 'components.json'), 'utf8'));
  for (const name of manual.composition.noValidation.components) {
    assert.equal(propsOf(name).has('msg'), false, `${name} записан как «без валидации», а msg объявлен`);
  }
  for (const name of manual.composition.warnOnly.components) {
    assert.doesNotMatch(propsOf(name).get('msgLevel').type, /danger/, `${name} записан как «только предупреждение»`);
  }
});

test('невалидным ряд становится только от danger', () => {
  const warn = mount('InputRow', { msg: 'Осторожно', msgLevel: 'warn' }).vals();
  assert.equal(warn.invalid, false, 'предупреждение не красит ряд ошибкой');
  assert.equal(warn.invalidAttr, 'false');

  const danger = mount('InputRow', { msg: 'Пусто', msgLevel: 'danger' }).vals();
  assert.equal(danger.invalid, true, 'ошибка обязана дойти до контрола: один красный на ряд');
  assert.equal(danger.invalidAttr, 'true');

  assert.equal(danger.msg, 'Пусто', 'текст сообщения ряд отдаёт вниз как есть');
  assert.equal(danger.msgLevel, 'danger');
});

test('ряд отдаёт наверх фокус и потерю фокуса — на них экран строит показ ошибки', () => {
  // Сам тайминг (ошибка только после blur, новая — не во время ввода, уже стоявшая остаётся,
  // гаснет при валидном значении) принадлежит экрану: в ДС результат валидации ПРИХОДИТ
  // пропсами. Обязанность системы — дать экрану точки, в которых он это решает.
  const seen = [];
  const m = mount('InputRow', { onFocus: () => seen.push('focus'), onBlur: () => seen.push('blur') });
  m.vals().focusCb();
  m.vals().blurCb();
  assert.deepEqual(seen, ['focus', 'blur']);

  const silent = mount('InputRow', {});
  assert.doesNotThrow(() => {
    silent.vals().focusCb();
    silent.vals().blurCb();
  }, 'без колбэков ряд не должен падать: экран вправе не следить за фокусом');
});
