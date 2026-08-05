/* Разбор TypeScript не имеет права терять проп МОЛЧА.
 *
 * Компилятора в репозитории нет намеренно (ADR 0006), пропсы читаются регекспами — и
 * такой разбор теряет объявление на любой форме записи, которую не предусмотрели. Теряет
 * тихо: в контракте просто становится на один канал меньше, а все гейты зелёные, потому
 * что сверяют контракт с самим собой.
 *
 * Здесь перечислены ЗАКОННЫЕ формы, каждая из которых однажды роняла разбор. Проверка
 * дешёвая и не ходит в браузер: разбирается строка, а не компонент.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interfacesOf, splitTop } from '../../scripts/lib/tsx.mjs';

const wrap = (members) => `export interface ProbeProps {\n${members}\n}\n`;
const names = (members) => interfacesOf(wrap(members))[0].declared.map((d) => d.name);

const FORMS = {
  'однострочный проп': '  a?: string;',
  'многострочный union': "  a?:\n    | 'one'\n    | 'two';",
  'union с ведущей чертой в строку': "  a?: | 'one' | 'two';",
  'многострочный колбэк': '  a?: (\n    id: string\n  ) => void;',
  'многострочный объектный тип': '  a?: {\n    id: string;\n  };',
  'хвостовой комментарий': '  a?: string; // почему так',
  readonly: '  readonly a?: string;',
  'необязательный метод': '  a?(): void;',
  'дженерик со скобками': '  a?: Record<string, { id: string }>;',
};

for (const [what, member] of Object.entries(FORMS)) {
  test(`разбор видит проп: ${what}`, () => {
    assert.deepEqual(names(member), ['a'], `форма «${what}» теряет проп молча`);
  });
}

test('соседний проп не страдает от формы предыдущего', () => {
  for (const [what, member] of Object.entries(FORMS)) {
    assert.deepEqual(names(`${member}\n  b?: string;`), ['a', 'b'], `после «${what}» теряется сосед`);
  }
});

test('индексная сигнатура — не проп', () => {
  assert.deepEqual(names('  [key: string]: unknown;\n  a?: string;'), ['a']);
});

test('подсказка ⓘ переживает многострочный JSDoc', () => {
  const [iface] = interfacesOf(wrap('  /**\n   * Первая строка\n   * и вторая.\n   */\n  a?: string;'));
  assert.match(iface.declared[0].doc ?? '', /Первая строка и вторая/);
});

test('splitTop не считает стрелку скобкой', () => {
  // «=>» в значении по умолчанию уводил глубину в минус, и следующий проп переставал
  // отделяться: дефолт терялся, а гейт краснел на ДРУГОМ пропе.
  assert.deepEqual(
    splitTop('a = () => {}, b, c = 1').map((x) => x.trim()),
    ['a = () => {}', 'b', 'c = 1']
  );
});
