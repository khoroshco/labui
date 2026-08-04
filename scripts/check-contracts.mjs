/* НЕЗАВИСИМАЯ сверка двух контрактов: эталона и React.
 *
 * Зачем отдельный гейт. Контракт React собирает `build-api-react.mjs` своим разбором
 * TypeScript — регекспами, потому что второй компилятор в репозиторий заводить нельзя
 * (ADR 0006). Любой разбор регекспами теряет пропсы на законных формах записи: перенос
 * строки внутри union, многострочный колбэк, хвостовой комментарий, `readonly`. Теряет
 * МОЛЧА: в контракте просто становится на один канал меньше, а собственные самопроверки
 * генератора («не пусто», «больше двух пропсов») этого не замечают.
 *
 * Проверка здесь не смотрит в исходники вовсе. Она сравнивает два ГОТОВЫХ контракта,
 * собранных РАЗНЫМИ парсерами из разных источников: `api.json` — из разметки эталона,
 * `api.react.json` — из TypeScript. Пропавший проп виден как расхождение, и спрятаться
 * ему негде: чтобы обмануть эту сверку, оба разбора должны ошибиться одинаково.
 *
 * Расхождения по существу (осознанные отличия React-версии) перечислены ниже поимённо —
 * каждое с причиной. Список закрытый: он и есть мера того, насколько две реализации
 * разошлись, и растёт он только решением человека.
 */
import fs from 'node:fs';
import path from 'node:path';
import { report, ROOT } from './lib/dc.mjs';

const dc = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.json'), 'utf8'));
const react = JSON.parse(fs.readFileSync(path.join(ROOT, 'api.react.json'), 'utf8'));
const migrated = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/ds-react/migrated.json'), 'utf8')).components;

/**
 * Осознанные расхождения контрактов. Ключ — «Компонент.проп», значение — причина.
 * Запись обязана быть правдой: если проп появился или исчез с обеих сторон, гейт
 * покраснеет на устаревшей строке.
 */
const KNOWN = {
  'Button.type': 'нет в эталоне: без него браузерный дефолт submit отправляет форму потребителя, а переопределить это было нечем',
};

const problems = [];
const reactByName = new Map(react.components.map((c) => [c.name, c]));

for (const c of dc.components) {
  if (!migrated.includes(c.name)) continue;
  const r = reactByName.get(c.name);
  if (!r) {
    problems.push(`${c.name}: компонент помечен перенесённым, но в api.react.json его нет`);
    continue;
  }
  const there = new Set(r.props.map((p) => p.name));
  for (const p of c.props) {
    if (there.has(p.name)) continue;
    const key = `${c.name}.${p.name}`;
    if (KNOWN[key]) continue;
    problems.push(
      `${key}: есть в контракте эталона и потерян в React-контракте. Либо проп не перенесён, ` +
        `либо разбор TypeScript его не увидел — второе опаснее, потому что в коде он есть`
    );
  }
}

// Осознанные расхождения обязаны воспроизводиться: строка, переставшая быть правдой,
// выглядит как истина и живёт вечно.
for (const [key, why] of Object.entries(KNOWN)) {
  const [name, prop] = key.split('.');
  const inDc = dc.components.find((c) => c.name === name)?.props.some((p) => p.name === prop);
  const inReact = reactByName.get(name)?.props.some((p) => p.name === prop);
  if (inDc && !inReact) continue; // расхождение на месте
  if (!inDc && inReact) continue; // обратное расхождение — тоже описано этой строкой
  problems.push(`расхождение «${key}» больше не воспроизводится (${why}) — вычеркни строку из scripts/check-contracts.mjs`);
}

// Страховка от тихой пустоты: сверять нечего — значит контракт собрался не из того места.
if (react.components.length < 20) problems.push(`в React-контракте ${react.components.length} компонентов — он собрался не из того места`);

process.exit(report('два контракта против друг друга', problems));
