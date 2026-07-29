/* Гейт: значения приходят из токенов, а не из литералов.
 *
 * Правило из CLAUDE.md: цвет, изинг, вес и интерлиньяж в компоненте — только токеном;
 * примитивы --c-* / --k-* компонентам недоступны, они пишут только про слой алиасов.
 * Это правило переживёт и миграцию на React (ROADMAP §3.4): оно про источник значений,
 * а не про способ доставки стилей.
 *
 * Что НЕ считается нарушением и почему:
 *   — оптические компенсации и геометрия (top:1.2px, Toggle 36×21, капля Pin 32) — они
 *     контекстны, зависят от кегля и формы набора, в шкалу не сводятся (CLAUDE.md);
 *   — длительности анимаций — тюнингованные литералы у места;
 *   — витрина: она документирует примитивы и обязана показывать сырые значения;
 *   — @font-face в ds.css: font-weight там объявляет ДИАПАЗОН начертания, а не вес текста.
 */
import fs from 'node:fs';
import path from 'node:path';
import { components, report, ROOT } from './lib/dc.mjs';

const RULES = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, what: 'литеральный цвет' },
  { re: /\brgba?\(/g, what: 'литеральный цвет rgb()' },
  { re: /\bhsla?\(/g, what: 'литеральный цвет hsl()' },
  { re: /cubic-bezier\(/g, what: 'литеральный изинг' },
  { re: /font-weight:\s*[0-9]/g, what: 'литеральный вес' },
  { re: /line-height:\s*[0-9.]/g, what: 'литеральный интерлиньяж' },
  { re: /var\(\s*--c-/g, what: 'примитив --c-* напрямую' },
  { re: /var\(\s*--k-/g, what: 'примитив --k-* напрямую' },
];

const problems = [];

for (const c of components()) {
  // helmet — ссылки на файлы, стилей там нет; проверяем шаблон и логику
  const body = c.template + c.logic;
  for (const { re, what } of RULES) {
    for (const m of body.matchAll(re)) {
      const line = body.slice(0, m.index).split('\n').length;
      problems.push(`${c.file}:${line} — ${what}: ${JSON.stringify(m[0])}`);
    }
  }
}

// ds.css живёт по тем же правилам в части цвета и движения: это глобальные состояния
// системы, а не место для «просто подкрасить».
const dsCss = fs.readFileSync(path.join(ROOT, 'src/ds.css'), 'utf8').replace(/@font-face\s*\{[^}]*\}/g, '');
for (const { re, what } of RULES.slice(0, 4)) {
  for (const m of dsCss.matchAll(re)) {
    const line = dsCss.slice(0, m.index).split('\n').length;
    problems.push(`src/ds.css:~${line} — ${what}: ${JSON.stringify(m[0])}`);
  }
}

process.exit(report('токены вместо литералов', problems));
