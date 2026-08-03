/* Разделы примитивов — по одному на секцию, как в DC-витрине.
 *
 * Числа и цвета читаются ИЗ БРАУЗЕРА (getComputedStyle по реальному узлу), а не пишутся
 * рядом с образцом. Иначе специмен рано или поздно расходится с tokens.css и дизайнер
 * копирует несуществующее значение — так уже было.
 */
import { useEffect, useState } from 'react';
import { Badge, Icon } from '../packages/ds-react/src/index';
import { A11Y, AXES, DURATIONS, SHADOWS, TEXT_LEVELS, TOKEN_LAYERS, UX_RULES } from './content';
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
const HEIGHTS = ['--control-h-xs', '--control-h-s', '--control-h-m', '--control-h-l', '--row-h', '--touch-target'];
const EASES = ['--ease-out', '--ease-in', '--ease-inout', '--ease-spring'];

/** Прочитать вычисленные значения: число в специмене обязано быть правдой. */
function useComputed(tokens: string[]) {
  const [map, setMap] = useState<Record<string, string>>({});
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
  }, [tokens.join()]);
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

export function Primitives({ id, icons, components }: { id: string; icons: string[]; components: ComponentSpec[] }) {
  const sizes = useComputed([...SPACES, ...RADII, ...HEIGHTS]);

  if (id === 'tokenlayers') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {TOKEN_LAYERS.map((l) => (
          <div key={l.n} style={card}>
            <div style={{ display: 'flex', gap: 'var(--sp-25)', alignItems: 'center' }}>
              <span style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', background: l.swatch, boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }} />
              <b style={{ fontWeight: 'var(--fw-medium)' }}>{l.name}</b>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>{l.desc}</span>
            <code style={{ color: 'var(--text-tertiary)' }}>{l.code}</code>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'color') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
        <div style={rowsBox}>
          {TEXT_LEVELS.map((t, i) => (
            <div key={t.token} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
              <span style={{ color: t.css }}>{t.token}</span>
              <span style={muted}>{t.role}</span>
            </div>
          ))}
        </div>
        <div style={grid(200)}>
          {SEMANTIC.map(([t, why]) => (
            <Swatch key={t} token={t!} why={why!} />
          ))}
        </div>
        <div style={grid(200)}>
          {SURFACES.map(([t, why]) => (
            <Swatch key={t} token={t!} why={why!} />
          ))}
        </div>
      </div>
    );
  }

  if (id === 'type') {
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {TYPE.map(([token, why]) => (
          <div key={token} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
            <span style={{ fontSize: `var(${token})`, lineHeight: 'var(--lh-heading)' }}>Съешь ещё этих мягких булок</span>
            <code style={muted}>{token}</code>
            <span style={muted}>{why}</span>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'space' || id === 'radius' || id === 'controlh') {
    const list = id === 'space' ? SPACES : id === 'radius' ? RADII : HEIGHTS;
    return (
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
              {sizes[token] || '—'}
            </span>
          </div>
        ))}
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
      <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
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
        <div style={rowsBox}>
          {DURATIONS.map(([what, ms], i) => (
            <div key={what} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--sp-3)' }}>
              <span>{what}</span>
              <span style={muted} data-nums="true">
                {ms}
              </span>
            </div>
          ))}
        </div>
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
      <div style={rowsBox}>
        {A11Y.map(([comp, aria, keys], i) => (
          <div key={comp} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1.1fr 2fr 1fr', gap: 'var(--sp-3)', fontSize: 'var(--fs-s)' }}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{comp}</b>
            <span style={{ color: 'var(--text-secondary)' }}>{aria}</span>
            <span style={muted}>{keys}</span>
          </div>
        ))}
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
    return (
      <div style={rowsBox}>
        {components.map((c, i) => (
          <div key={c.name} style={{ ...rowLine(i), display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 2fr', gap: 'var(--sp-3)', alignItems: 'center', fontSize: 'var(--fs-s)' }}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{c.name}</b>
            <span style={muted}>{c.level}</span>
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
