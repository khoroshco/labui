/* Примитивы: то, из чего собрано всё остальное. Цвет, набор, размеры, движение, иконки.
 *
 * Числа и цвета читаются ИЗ БРАУЗЕРА (getComputedStyle по реальному узлу), а не пишутся
 * рядом с образцом. Иначе специмен рано или поздно расходится с tokens.css и дизайнер
 * копирует несуществующее значение — так уже было.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../packages/ds-react/src/index';

const COLORS = [
  ['--bg-base', 'фон страницы'],
  ['--bg-surface', 'поверхность острова'],
  ['--bg-float', 'плавающая поверхность'],
  ['--bg-hover', 'ховер ряда'],
  ['--bg-active', 'нажатое'],
  ['--text-primary', 'заголовок, значение'],
  ['--text-body', 'наборный текст'],
  ['--text-secondary', 'подчинённое'],
  ['--text-tertiary', 'служебное'],
  ['--text-disabled', 'выключенное'],
  ['--accent', 'акцент'],
  ['--on-accent', 'текст на акценте'],
  ['--ok', 'успех'],
  ['--warn', 'предупреждение'],
  ['--danger', 'ошибка'],
  ['--info', 'информация'],
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

const SIZES = [
  '--sp-05', '--sp-1', '--sp-15', '--sp-2', '--sp-25', '--sp-3', '--sp-35', '--sp-4',
  '--sp-5', '--sp-6', '--sp-7', '--sp-8', '--r-s', '--r-m', '--r-l',
  '--control-h-xs', '--control-h-s', '--control-h-m', '--control-h-l', '--row-h', '--touch-target',
];

const MOTION = ['--ease-out', '--ease-in', '--ease-inout', '--ease-spring'];

/** Прочитать вычисленные значения токенов: число в специмене обязано быть правдой. */
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
  }, [tokens]);
  return map;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
    <h3 style={{ margin: 0, fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-medium)' }}>{title}</h3>
    {children}
  </section>
);

const label = { color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' } as const;

export function Primitives({ icons }: { icons: string[] }) {
  const sizes = useComputed(SIZES);

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-7)' }}>
      <Section title="Цвет">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-2)' }}>
          {COLORS.map(([token, why]) => (
            <div key={token} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-s)',
                  background: `var(${token})`,
                  boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
                  flex: 'none',
                }}
              />
              <span style={{ display: 'grid' }}>
                <code style={{ fontSize: 'var(--fs-s)' }}>{token}</code>
                <span style={label}>{why}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Типографика">
        <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          {TYPE.map(([token, why]) => (
            <div key={token} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
              <span style={{ fontSize: `var(${token})`, lineHeight: 'var(--lh-heading)' }}>Съешь ещё этих мягких булок</span>
              <code style={label}>{token}</code>
              <span style={label}>{why}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Размеры">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--sp-2)' }}>
          {SIZES.map((token) => (
            <div key={token} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
              <span style={{ width: `var(${token})`, height: 8, background: 'var(--accent)', borderRadius: 2, flex: 'none' }} />
              <code style={{ fontSize: 'var(--fs-s)' }}>{token}</code>
              <span style={label} data-nums="true">
                {sizes[token] || '—'}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Движение">
        <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          {MOTION.map((token) => (
            <div key={token} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
              <span
                style={{
                  width: 180,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--bg-active)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
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
              <code style={{ fontSize: 'var(--fs-s)' }}>{token}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Иконки (${icons.length})`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--sp-2)' }}>
          {icons.map((name) => (
            <div key={name} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
              <Icon name={name as never} size={20} />
              <span style={{ ...label, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
