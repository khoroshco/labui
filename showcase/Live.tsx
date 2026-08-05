/* ЖИВЫЕ ДЕМОНСТРАЦИИ: то, что нельзя показать статичным примером.
 *
 * Плейграунд крутит пропсы одного компонента. Но часть системы живёт не в пропсах, а в
 * ПОВЕДЕНИИ во времени: очередь тостов, правило показа ошибки, сборка острова из рядов.
 * Такое видно только руками, и в DC-витрине эти демонстрации были — их вёл рантайм своим
 * скриптом. При переезде на React перенесли декларативную часть, а живую нет.
 *
 * Каждая демонстрация здесь — обычный потребитель системы: она собрана из компонентов
 * пакета и не рисует ничего своего. Витрина обязана быть первым потребителем, иначе она
 * перестаёт ловить то, что ловит потребитель.
 */
import { useRef, useState } from 'react';
import { Button, Island, Toast, type IslandRow, type ToastLevel } from '../packages/ds-react/src/index';

/** Заголовок живого блока: он не раздел, а врезка внутри него. */
function Head({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-1)' }}>
      <b style={{ fontSize: 'var(--fs-l)', fontWeight: 'var(--fw-medium)' }}>{title}</b>
      <p style={{ margin: 0, maxWidth: 'var(--measure-text)', color: 'var(--text-body)', lineHeight: 'var(--lh-text)' }}>
        {note}
      </p>
    </div>
  );
}

// ── Конструктор рядов острова ────────────────────────────────────────────────

type Kind = NonNullable<IslandRow['type']>;

const DEFAULTS: Record<Kind, IslandRow> = {
  text: { type: 'text', label: 'Новое поле', value: '', placeholder: 'Значение' },
  segmented: { type: 'segmented', label: 'Выравнивание', options: ['Лево', 'Центр', 'Право'], value: 1 },
  toggle: { type: 'toggle', label: 'Запекать в растр', checked: true },
  checkbox: { type: 'checkbox', label: 'Применить ко всем форматам', checked: false },
  action: { type: 'action', label: 'Извлечь сцену', variant: 'primary' },
};

const SEED: IslandRow[] = [
  { type: 'text', label: 'Название', value: 'Осенний сейл', placeholder: 'Название кампании' },
  { type: 'text', label: 'erid', value: '2Vtzqx', nums: true, placeholder: 'Токен' },
  { type: 'toggle', label: 'Запекать в растр', checked: true },
];

const KINDS: Kind[] = ['text', 'segmented', 'toggle', 'checkbox', 'action'];

export function IslandBuilder() {
  const [rows, setRows] = useState<IslandRow[]>(() => SEED.map((r, i) => ({ ...r, key: `seed-${i}` })));
  const seq = useRef(0);

  // Приведение честное: правка относится к ряду, тип которого уже известен по позиции.
  // Само это место — довод в пользу размеченного объединения: раньше Partial<IslandRow>
  // принимал что угодно, и «maxLength у переключателя» проходило без единого замечания.
  const patch = (i: number, p: Record<string, unknown>) =>
    setRows((list) => list.map((r, j) => (j === i ? ({ ...r, ...p } as IslandRow) : r)));
  const move = (i: number, d: number) =>
    setRows((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  // Ряд острова управляется ЗНАЧЕНИЕМ (ADR 0011): раз конструктор владеет конфигом, он
  // обязан отдавать вниз и колбэк — иначе ряд встанет в управляемый режим без хозяина.
  const live: IslandRow[] = rows.map((r, i) => {
    if (r.type === 'segmented') return { ...r, onChange: (v: number) => patch(i, { value: v }) };
    if (r.type === 'toggle' || r.type === 'checkbox')
      return { ...r, onChange: (v: boolean) => patch(i, { checked: v }) };
    if (r.type === 'action') return { ...r, onClick: () => patch(i, { label: 'Готово' }) };
    return { ...r, onInput: (v: string) => patch(i, { value: v }) };
  });

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <Head
        title="Конструктор рядов"
        note="Остров собирается из конфига и не знает, что внутри рядов. Добавьте ряд, переставьте, удалите — геометрия углов, сепараторы и тон зоны под рядом пересчитываются сами, потому что принадлежат острову, а не рядам."
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-15)' }}>
        {KINDS.map((k) => (
          <Button
            key={k}
            label={k}
            icon="plus"
            variant="secondary"
            size="s"
            onClick={() => {
              seq.current += 1;
              setRows((list) => [...list, { ...DEFAULTS[k], key: `${k}-${seq.current}` }]);
            }}
          />
        ))}
        <Button label="Сбросить" variant="ghost" size="s" onClick={() => setRows(SEED.map((r, i) => ({ ...r, key: `seed-${i}` })))} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--sp-3)', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)' }}>
        <div style={{ display: 'grid', gap: 'var(--sp-2)', alignContent: 'start' }}>
          <Island rows={live} />
          {!rows.length ? (
            <span style={{ fontSize: 'var(--fs-s)', color: 'var(--text-tertiary)' }}>
              Рядов нет — остров не рисует ничего: пустой контейнер это не поверхность, а отсутствие содержимого.
            </span>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 'var(--sp-1)', alignContent: 'start' }}>
          {rows.map((r, i) => (
            <div key={r.key ?? i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-15)' }}>
              <span style={{ fontSize: 'var(--fs-s)', color: 'var(--text-secondary)', minWidth: 90 }}>{r.type}</span>
              <span data-nums="true" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', minWidth: 20 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <Button icon="chevron-up" size="xs" variant="ghost" tooltip="Выше" onClick={() => move(i, -1)} />
              <Button icon="chevron-down" size="xs" variant="ghost" tooltip="Ниже" onClick={() => move(i, 1)} />
              <Button
                icon="trash-bin"
                size="xs"
                variant="ghost"
                tone="danger"
                tooltip="Удалить ряд"
                onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Живой тост: очередь и выход ──────────────────────────────────────────────

interface Live {
  id: number;
  text: string;
  level: ToastLevel;
  actionLabel?: string;
  leaving?: boolean;
}

const PRESETS: Omit<Live, 'id'>[] = [
  { text: '12 форматов готовы к выгрузке', level: 'ok' },
  { text: 'Block: вес 412 КБ — площадка отклонит', level: 'danger', actionLabel: 'Открыть' },
  { text: 'Ревизия r15 собирается…', level: 'info' },
  { text: 'erid не заполнен у 3 форматов', level: 'warn', actionLabel: 'Показать' },
];

/** Сколько тостов экран показывает разом. Остальные ЖДУТ: важное не теряется. */
const ON_SCREEN = 8;

export function ToastStack() {
  const [shown, setShown] = useState<Live[]>([]);
  const [queue, setQueue] = useState<Omit<Live, 'id'>[]>([]);
  const seq = useRef(0);

  const push = (t: Omit<Live, 'id'>) => {
    seq.current += 1;
    const item = { ...t, id: seq.current };
    setShown((list) => {
      if (list.filter((x) => !x.leaving).length >= ON_SCREEN) {
        setQueue((q) => [...q, t]);
        return list;
      }
      return [...list, item];
    });
  };

  // Выход — ОДИН жест: тост схлопывается по высоте и гаснет, и только потом уходит из
  // списка. Удалить сразу значит оборвать движение на середине и дёрнуть стек.
  const dismiss = (id: number) => {
    setShown((list) => list.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => {
      setShown((list) => list.filter((x) => x.id !== id));
      setQueue((q) => {
        if (!q.length) return q;
        push(q[0]!);
        return q.slice(1);
      });
    }, 320);
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <Head
        title="Стек и очередь"
        note="Стек, позиционирование и очередь — ответственность экрана, а не компонента. На экране до восьми тостов; остальные ждут своей очереди и не теряются. Выход — один жест: тост схлопывается по высоте и только потом уходит из списка."
      />
      <div style={{ display: 'flex', gap: 'var(--sp-15)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button label="Показать тост" variant="secondary" size="s" onClick={() => push(PRESETS[seq.current % PRESETS.length]!)} />
        <Button
          label="Сразу десять"
          variant="ghost"
          size="s"
          onClick={() => {
            for (let i = 0; i < 10; i++) push(PRESETS[i % PRESETS.length]!);
          }}
        />
        {queue.length ? (
          <span data-nums="true" style={{ fontSize: 'var(--fs-s)', color: 'var(--text-tertiary)' }}>
            в очереди: {queue.length}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 0, justifyItems: 'start' }}>
        {shown.map((t) => (
          <Toast
            key={t.id}
            text={t.text}
            level={t.level}
            actionLabel={t.actionLabel ?? ''}
            leaving={t.leaving}
            gap={8}
            duration={6000}
            onClose={() => dismiss(t.id)}
            onTimeout={() => dismiss(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Валидация erid: punish late, reward early ────────────────────────────────

const VALID = /^[A-Za-z0-9]{11,}$/;

export function EridIsland() {
  const [text, setText] = useState('2VtzqxkKfBd');
  const [touched, setTouched] = useState(true);
  const [focused, setFocused] = useState(false);
  // «Держим» ошибку, с которой пришли в поле: пока её не исправили, она остаётся видимой.
  const [hold, setHold] = useState(false);

  const raw: 'ok' | 'warn' | 'danger' = !text.trim() ? 'warn' : VALID.test(text.trim()) ? 'ok' : 'danger';
  // ПРАВИЛО: punish late, reward early. Во время набора ошибку не показываем — человек ещё
  // не закончил. Но если поле УЖЕ было невалидным, ошибка остаётся на глазах, пока её не
  // исправят: иначе она мигает при каждом клике в поле. Награда же приходит сразу —
  // как только значение стало верным, сообщение исчезает, не дожидаясь потери фокуса.
  const level = focused ? (hold && raw !== 'ok' ? raw : 'ok') : touched ? raw : 'ok';

  const rows: IslandRow[] = [
    { key: 'name', type: 'text', label: 'Кампания', value: 'Осенний сейл', onInput: () => {} },
    {
      key: 'erid',
      type: 'text',
      label: 'erid',
      value: text,
      nums: true,
      placeholder: 'токен маркировки',
      msgLevel: level,
      msg:
        level === 'warn'
          ? 'Без erid формат получит пометку «требует внимания» на приёмке'
          : level === 'danger'
            ? 'Токен — латиница и цифры, минимум 11 символов'
            : '',
      onInput: setText,
      onFocus: () => {
        setFocused(true);
        setHold(touched && raw !== 'ok');
      },
      onBlur: () => {
        setTouched(true);
        setFocused(false);
      },
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <Head
        title="Когда показывать ошибку"
        note="Правило одно на всю систему: punish late, reward early. Во время набора ошибку не показываем — человек ещё не закончил. Но если поле уже было невалидным, сообщение остаётся на глазах, пока его не исправят, иначе оно мигает при каждом клике. Награда приходит сразу: верное значение гасит ошибку, не дожидаясь потери фокуса. Сотрите токен, уйдите из поля, вернитесь."
      />
      <div style={{ width: 380, maxWidth: '100%' }}>
        <Island rows={rows} />
      </div>
    </div>
  );
}

// ── Прозаические врезки внутри разделов ──────────────────────────────────────

/** Карточка-врезка: правило, которое нельзя вывести из кода, но нужно прочесть у места. */
function Note({ title, tone, items }: { title: string; tone?: 'ok' | 'danger'; items: string[] }) {
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-m)', padding: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-2)' }}>
      <span
        style={{
          fontSize: 'var(--fs-m)',
          fontWeight: 'var(--fw-medium)',
          lineHeight: 'var(--lh-heading)',
          color: tone === 'ok' ? 'var(--ok)' : tone === 'danger' ? 'var(--danger)' : 'var(--text-primary)',
        }}
      >
        {title}
      </span>
      <ul
        style={{
          margin: 0,
          paddingInlineStart: 'var(--sp-4)',
          fontSize: 'var(--fs-s)',
          fontWeight: 'var(--fw-regular)',
          color: 'var(--text-secondary)',
          lineHeight: 'var(--lh-loose)',
        }}
      >
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function BadgeNote() {
  return (
    <Note
      title="Когда бейдж, а когда текст"
      items={[
        'Бейдж — одно-два слова или значение: «300×250», «148 КБ», «block». Перенос строк запрещён.',
        'Фраза или объяснение — это текст, а не бейдж: длинная подпись в капсуле читается хуже, чем строкой.',
        'Бизнес-сущности своего варианта не получают: ярлык erid — это variant=quiet + nums, а слово «erid» приходит в label от вызывающего.',
        'Вес подачи несёт variant, семантику — tone, и работают они в любой комбинации.',
      ]}
    />
  );
}

export function ToastNote() {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <Note
        title="Когда тост"
        tone="ok"
        items={[
          'Итог фонового или асинхронного действия: «12 форматов выгружены», «Ревизия собирается».',
          'Событие вне текущего фокуса — сеть пропала, автосохранение прошло, что-то завершилось.',
          'Сообщение эфемерно и не требует решения прямо сейчас; максимум одно действие.',
          'Можно спокойно пропустить — потеря тоста ничего не ломает.',
        ]}
      />
      <Note
        title="Когда НЕ тост"
        tone="danger"
        items={[
          'Ошибка ввода в поле — RowMsg у поля, рядом с причиной.',
          'Постоянно пустая или несобравшаяся область — EmptyState на месте контента.',
          'Нужно решение до продолжения (удалить, перезаписать) — модалка с явным выбором.',
          'Критическая блокировка экрана или долгий статус — баннер, а не исчезающий тост.',
          'Больше одного действия или длинный текст — тосту такое не по размеру.',
        ]}
      />
    </div>
  );
}

export function IslandRowsNote() {
  return (
    <Note
      title="Сигнатура rows"
      items={[
        'type: text | segmented | toggle | checkbox | action — тип решает, каким рядом станет запись.',
        'key — устойчивый ключ ряда. Без него ключом служит позиция, и при сортировке черновик, галочка и открытая ⓘ переезжают на соседа.',
        'label, value, options, checked — содержимое; info и infoImage — подсказка ⓘ; msg и msgLevel — сообщение валидации.',
        'Колбэк уходит вниз ровно тот, что дал конфиг: значение без колбэка замораживает контрол (ADR 0011).',
      ]}
    />
  );
}
