/* Разделы примитивов — по одному на секцию, как в DC-витрине.
 *
 * Числа и цвета читаются ИЗ БРАУЗЕРА (getComputedStyle по реальному узлу), а не пишутся
 * рядом с образцом. Иначе специмен рано или поздно расходится с tokens.css и дизайнер
 * копирует несуществующее значение — так уже было.
 */
import { useEffect, useState } from 'react';
import { Badge, Icon } from '../packages/ds-react/src/index';
import { A11Y, AXES, DURATIONS, SHADOWS, TEXT_LEVELS, TOKEN_LAYERS, UX_RULES } from './content';
import { COLOR_GROUPS, FONT_SCALE, FONT_WEIGHTS, KEYFRAMES, MOTION_PRINCIPLES, TYPE_STYLES } from './demoData';
import type { ComponentSpec } from './Playground';

const SEMANTIC = [
  ['--accent', 'акцент бренда'],
  ['--on-accent', 'текст на акценте'],
  ['--ok', 'успех'],
  ['--warn', 'предупреждение'],
  ['--danger', 'ошибка'],
  ['--info', 'информация'],
];
const SURFACES = [
  ['--bg-base', 'полотно страницы'],
  ['--bg-surface', 'поверхность острова'],
  ['--bg-float', 'плавающая поверхность'],
  ['--bg-hover', 'ховер ряда'],
  ['--bg-active', 'нажатое'],
  ['--border-subtle', 'сепаратор'],
];
const TYPE = [
  ['--fs-display', 'H1 · Black'],
  ['--fs-h1', 'H2 · Black'],
  ['--fs-h3', 'H3 · Medium 18'],
  ['--fs-l', 'H4 · Medium 16'],
  ['--fs-m', 'Body · Regular 14'],
  ['--fs-s', 'мелкий'],
  ['--fs-xs', 'служебный'],
];
const SPACES = ['--sp-05', '--sp-1', '--sp-15', '--sp-2', '--sp-25', '--sp-3', '--sp-35', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8'];
const RADII = ['--r-s', '--r-m', '--r-l', '--r-full'];
const HEIGHTS = ['--control-h-xs', '--control-h-s', '--control-h-m', '--control-h-l'];
// Эти два НЕ ступени шкалы, и в старой витрине они стояли отдельными строками с подписями:
// склеить их со ступенями — ровно та ошибка, от которой предостерегает проза раздела.
const APART: [string, string][] = [
  ['--row-h', 'высота ряда острова — не ступень шкалы, даже когда числа совпадают'],
  ['--touch-target', 'минимум для тача: мелкие контролы добирают его невидимой зоной'],
];
const EASES = ['--ease-out', '--ease-in', '--ease-inout', '--ease-spring'];

/** Прочитать вычисленные значения: число в специмене обязано быть правдой. */
function useComputed(tokens: string[]) {
  const [map, setMap] = useState<Record<string, string>>({});
  // Тема меняет ЗНАЧЕНИЯ при тех же именах — значит пробу надо повторять на каждое
  // переключение, иначе раздел «Цвет» показывает числа прошлой темы.
  const theme = document.documentElement.getAttribute('data-theme');
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const out: Record<string, string> = {};
    for (const t of tokens) {
      probe.style.setProperty('--probe', `var(${t})`);
      out[t] = getComputedStyle(probe).getPropertyValue('--probe').trim();
    }
    document.body.removeChild(probe);
    setMap(out);
  }, [tokens.join(), theme]);
  return map;
}

const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 'var(--sp-25)' }) as const;
const muted = { color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' } as const;
const card = { background: 'var(--bg-surface)', borderRadius: 'var(--r-m)', padding: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-2)' } as const;
const rowsBox = { ...card, gap: 0 } as const;
const rowLine = (i: number) => ({ borderTop: i ? '0.5px solid var(--border-subtle)' : 'none', padding: 'var(--sp-25) 0' }) as const;

const Swatch = ({ token, why }: { token: string; why: string }) => (
  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
    <span
      style={{
        width: 32,
        height: 32,
        flex: 'none',
        borderRadius: 'var(--r-s)',
        background: `var(${token})`,
        boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
      }}
    />
    <span style={{ display: 'grid' }}>
      <code>{token}</code>
      <span style={muted}>{why}</span>
    </span>
  </div>
);

const Sub = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
    <h4 style={{ margin: 0, fontSize: 'var(--fs-l)', fontWeight: 'var(--fw-medium)' }}>{title}</h4>
    {children}
  </div>
);

/** Шкала кеглей, начертания и стили набора. Числа читаются из движка: переписанные руками
 *  рано или поздно расходятся с tokens.css, и дизайнер копирует несуществующее. */
function Typography() {
  const scale = useComputed([...FONT_SCALE]);
  const weights = useComputed([...FONT_WEIGHTS.map(([t]) => t)]);
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Sub title="Шкала кеглей">
        <div style={rowsBox}>
          {FONT_SCALE.map((token, i) => (
            <div key={token} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1fr auto 2fr', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
              <code>{token}</code>
              <span style={muted} data-nums="true">{scale[token] || '—'}</span>
              <span style={{ fontSize: `var(${token})`, lineHeight: 'var(--lh-heading)' }}>Аа Bb 123</span>
            </div>
          ))}
        </div>
      </Sub>

      <Sub title="Начертания">
        <div style={rowsBox}>
          {FONT_WEIGHTS.map(([token, role], i) => (
            <div key={token} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1fr auto 2fr', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
              <code>{token}</code>
              <span style={muted} data-nums="true">{weights[token] || '—'}</span>
              <span style={{ fontWeight: `var(${token})` }}>{role}</span>
            </div>
          ))}
        </div>
      </Sub>

      <Sub title="Стили набора">
        <div style={rowsBox}>
          {TYPE_STYLES.map((t, i) => (
            <div key={t.name} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 2fr', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
              <span style={{ display: 'grid', gap: 2 }}>
                <b style={{ fontWeight: 'var(--fw-medium)' }}>{t.name}</b>
                <span style={muted}>{t.role}</span>
              </span>
              <span
                style={{
                  fontSize: t.fs,
                  fontWeight: t.fw,
                  lineHeight: t.lh,
                  letterSpacing: t.ls,
                  textTransform: t.caps as React.CSSProperties['textTransform'],
                  color: t.color,
                  maxWidth: t.measure === 'none' ? undefined : t.measure,
                }}
              >
                {t.sample}
              </span>
            </div>
          ))}
        </div>
      </Sub>
    </div>
  );
}


/** Шахматная подложка: без неё не видно, что у токена есть альфа. */
const CHECKER = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--bg-active) 0 4px, transparent 4px 8px)',
} as const;

/**
 * Цвет: две независимые оси. Значения ЧИТАЮТСЯ из движка и перечитываются при смене темы —
 * вводная проза раздела обещает ровно это («переключите тему и смотрите, как меняются
 * числа при тех же именах»), и обещание должно быть правдой.
 */
function Color() {
  const levels = TEXT_LEVELS.map((t) => t.token);
  const swatches = COLOR_GROUPS.flatMap((g) => g.items.map((i) => i.token));
  const value = useComputed([...levels, ...swatches]);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Sub title="Уровни яркости текста">
        <div style={rowsBox}>
          {TEXT_LEVELS.map((t, i) => (
            <div key={t.token} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1fr auto 2fr', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
              <span style={{ color: t.css }}>{t.token}</span>
              <span style={muted} data-nums="true">{value[t.token] || '—'}</span>
              <span style={muted}>{t.role}</span>
            </div>
          ))}
        </div>
        <div style={{ ...card, background: 'var(--bg-hover)' }}>
          <b style={{ fontWeight: 'var(--fw-medium)' }}>Инвариант: выключенное — потолок яркости</b>
          <span style={{ color: 'var(--text-secondary)' }}>
            Ни один элемент внутри выключенного не может быть ярче <code>--text-disabled</code> — включая
            плейсхолдер и семантические цвета. Выключенное не должно быть заметнее доступного.
          </span>
        </div>
      </Sub>

      {COLOR_GROUPS.map((g) => (
        <Sub key={g.title} title={g.title}>
          <div style={grid(220)}>
            {g.items.map((it) => (
              <div key={it.token} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                <span style={{ ...CHECKER, width: 32, height: 32, flex: 'none', borderRadius: 'var(--r-s)' }}>
                  <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', background: it.css, boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }} />
                </span>
                <span style={{ display: 'grid', minWidth: 0 }}>
                  <span>{it.name}</span>
                  <code style={muted}>{it.token}</code>
                  <span style={muted} data-nums="true">{value[it.token] || '—'}</span>
                </span>
              </div>
            ))}
          </div>
        </Sub>
      ))}
    </div>
  );
}

export function Primitives({ id, icons, components }: { id: string; icons: string[]; components: ComponentSpec[] }) {
  const sizes = useComputed([...SPACES, ...RADII, ...HEIGHTS, ...APART.map(([t]) => t)]);

  if (id === 'tokenlayers') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {TOKEN_LAYERS.map((l) => (
          <div key={l.n} style={card}>
            <div style={{ display: 'flex', gap: 'var(--sp-25)', alignItems: 'center' }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  flex: 'none',
                  borderRadius: '50%',
                  background: 'var(--accent-dim)',
                  color: 'var(--text-primary)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 'var(--fs-xs)',
                }}
                data-nums="true"
              >
                {l.n}
              </span>
              <span style={{ width: 20, height: 20, flex: 'none', borderRadius: 'var(--r-s)', background: l.swatch, boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }} />
              <b style={{ fontWeight: 'var(--fw-medium)' }}>{l.name}</b>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>{l.desc}</span>
            <code style={{ color: 'var(--text-tertiary)' }}>{l.code}</code>
          </div>
        ))}
        <div style={{ ...card, background: 'var(--bg-hover)' }}>
          <b style={{ fontWeight: 'var(--fw-medium)' }}>Приём двух каналов</b>
          <span style={{ color: 'var(--text-secondary)' }}>
            Весь текст, границы и наложения выведены из двух «чернильных» каналов — <code>--ink</code> и{' '}
            <code>--danger-dim</code> — через запись <code>rgb(var(--ink) / .48)</code>. Поэтому светлая
            тема переопределяет два токена вместо двенадцати.
          </span>
        </div>
      </div>
    );
  }

  if (id === 'color') {
    return <Color />;
  }

  if (id === 'type') {
    return <Typography />;
  }

  if (id === 'space' || id === 'radius' || id === 'controlh') {
    const list = id === 'space' ? SPACES : id === 'radius' ? RADII : HEIGHTS;
    const shown = (token: string) => {
      const v = sizes[token] || '—';
      // капсула — не число: в старой витрине здесь стояла бесконечность
      return token === '--r-full' && parseFloat(v) > 100 ? '∞' : v;
    };
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div style={grid(220)}>
        {list.map((token) => (
          <div key={token} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <span
              style={
                id === 'radius'
                  ? { width: 32, height: 32, flex: 'none', background: 'var(--bg-active)', borderRadius: `var(${token})` }
                  : id === 'controlh'
                    ? { width: 8, height: `var(${token})`, flex: 'none', background: 'var(--accent)', borderRadius: 2 }
                    : { width: `var(${token})`, height: 8, flex: 'none', background: 'var(--accent)', borderRadius: 2 }
              }
            />
            <code>{token}</code>
            <span style={muted} data-nums="true">
              {shown(token)}
            </span>
          </div>
        ))}
      </div>
      {id === 'controlh' ? (
        <div style={rowsBox}>
          {APART.map(([token, why], i) => (
            <div key={token} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 'var(--sp-3)', alignItems: 'center' }}>
              <code>{token}</code>
              <span style={muted} data-nums="true">{sizes[token] || '—'}</span>
              <span style={muted}>{why}</span>
            </div>
          ))}
          <div style={{ ...rowLine(2), display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <code>--focus-ring</code>
            <span style={{ width: 24, height: 24, borderRadius: 'var(--r-s)', background: 'var(--bg-active)', boxShadow: 'var(--focus-ring)' }} />
            <span style={muted}>кольцо фокуса — тенью, чтобы не менять размер элемента</span>
          </div>
        </div>
      ) : null}
      </div>
    );
  }

  if (id === 'shadow') {
    return (
      <div style={grid(220)}>
        {SHADOWS.map((sh) => (
          <div key={sh.token} style={{ display: 'grid', gap: 'var(--sp-2)', justifyItems: 'center' }}>
            <span style={{ width: 96, height: 56, borderRadius: 'var(--r-m)', background: 'var(--bg-float)', boxShadow: sh.css }} />
            <code style={muted}>{sh.token}</code>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'motion') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
        <Sub title="Кривые">
          <span style={{ color: 'var(--text-secondary)' }}>
            Пружина посчитана из физики затухающего колебания: овершут около 4% — ровно столько, чтобы
            движение читалось живым и не выглядело шатким.
          </span>
          <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {EASES.map((token) => (
              <div key={token} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                <span style={{ width: 180, height: 6, borderRadius: 3, background: 'var(--bg-active)', position: 'relative', overflow: 'hidden' }}>
                  <span
                    style={{
                      position: 'absolute',
                      insetBlock: 0,
                      width: 24,
                      borderRadius: 3,
                      background: 'var(--accent)',
                      animation: `sb-slide 2.4s var(${token}) infinite`,
                    }}
                  />
                </span>
                <code>{token}</code>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Длительности">
          <span style={{ color: 'var(--text-secondary)' }}>
            Токен один — <code>--dur-base</code>, и нужен он только для сквозной смены темы. Остальные
            длительности остаются литералами у места: они зависят от размера объекта, а не от системы.
          </span>
          <div style={rowsBox}>
            {DURATIONS.map(([what, ms], i) => (
              <div key={what} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--sp-3)' }}>
                <span>{what}</span>
                <span style={muted} data-nums="true">{ms}</span>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Кейфреймы">
          <span style={{ color: 'var(--text-secondary)' }}>
            Именованные анимации системы. Кривая и длительность задаются на месте — кейфрейм отвечает
            только за то, что именно меняется.
          </span>
          <div style={rowsBox}>
            {KEYFRAMES.map(([name, desc], i) => (
              <div key={name} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '160px 40px 1fr', gap: 'var(--sp-3)', alignItems: 'center' }}>
                <code>{name}</code>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 'var(--r-s)',
                    background: 'var(--accent)',
                    animation: `${name} 1.8s var(--ease-out) infinite`,
                  }}
                />
                <span style={muted}>{desc}</span>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Принципы">
          <div style={grid(280)}>
            {MOTION_PRINCIPLES.map(([title, items]) => (
              <div key={title} style={card}>
                <b style={{ fontWeight: 'var(--fw-medium)' }}>{title}</b>
                {items.map((it, n) => (
                  <span key={n} style={{ display: 'flex', gap: 'var(--sp-2)', color: 'var(--text-secondary)' }}>
                    <span style={muted} data-nums="true">{n + 1}</span>
                    {it}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Sub>
      </div>
    );
  }

  if (id === 'icons') {
    return (
      <div style={grid(140)}>
        {icons.map((name) => (
          <div key={name} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <Icon name={name as never} size={20} />
            <span style={{ ...muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'a11y') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={rowsBox}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr 1fr', gap: 'var(--sp-3)', paddingBottom: 'var(--sp-2)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', letterSpacing: 'var(--ls-eyebrow)', color: 'var(--text-tertiary)' }}>
          <span>Компонент</span>
          <span>Роль / ARIA</span>
          <span>Клавиатура</span>
        </div>
        {A11Y.map(([comp, aria, keys], i) => (
          <div key={comp} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1.1fr 2fr 1fr', gap: 'var(--sp-3)', fontSize: 'var(--fs-s)' }}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{comp}</b>
            <span style={{ color: 'var(--text-secondary)' }}>{aria}</span>
            <span style={muted}>{keys}</span>
          </div>
        ))}
      </div>
      <div style={{ ...card, background: 'var(--bg-hover)' }}>
        <b style={{ fontWeight: 'var(--fw-medium)' }}>Windows High Contrast</b>
        <span style={{ color: 'var(--text-secondary)' }}>
          В режиме <code>forced-colors</code> система вырезает тени и градиенты: кольцо фокуса
          становится <code>outline Highlight</code>, состояния — системными цветами. Градиент AI из
          подмены исключён намеренно: он сам является смыслом, а не украшением.
        </span>
      </div>
      </div>
    );
  }

  if (id === 'vocab') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {AXES.map(([name, text]) => (
          <div key={name} style={card}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{name}</b>
            <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'uxwriting') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {UX_RULES.map((u) => (
          <div key={u.title} style={card}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{u.title}</b>
            <span style={{ color: 'var(--text-secondary)' }}>{u.text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'statusmatrix') {
    const LEVEL_RU: Record<string, string> = { atoms: 'Атом', molecules: 'Молекула', organisms: 'Организм' };
    return (
      <div style={rowsBox}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 2fr', gap: 'var(--sp-3)', paddingBottom: 'var(--sp-2)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', letterSpacing: 'var(--ls-eyebrow)', color: 'var(--text-tertiary)' }}>
          <span>Компонент</span>
          <span>Уровень</span>
          <span>Статус</span>
          <span>Монтирует</span>
        </div>
        {components.map((c, i) => (
          <div key={c.name} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 2fr', gap: 'var(--sp-3)', alignItems: 'center', fontSize: 'var(--fs-s)' }}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{c.name}</b>
            <span style={muted}>{LEVEL_RU[c.level] ?? c.level}</span>
            <span>
              <Badge label={c.status} variant="quiet" tone={c.status === 'stable' ? 'ok' : 'warn'} />
            </span>
            <span style={muted}>{c.mounts.length ? `монтирует: ${c.mounts.join(', ')}` : ''}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
