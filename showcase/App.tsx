/* Витрина: единственный источник истины по составу и правилам.
 *
 * Состав приезжает из контракта (api.react.json), а контракт выводится из исходников —
 * рукописных списков компонентов и пропсов здесь нет по построению. Раньше витрина была
 * DC-страницей и держала список руками; он расходился с кодом дважды, и оба раза это
 * замечал не человек, а гейт.
 */
import { useEffect, useState } from 'react';
import * as DS from '../packages/ds-react/src/index';
import api from '../api.react.json';
import { Playground, type ComponentSpec } from './Playground';
import { Primitives } from './Primitives';
import { Spec } from './Spec';

const LEVEL_RU: Record<string, string> = {
  primitives: 'Примитивы',
  spec: 'Правила',
  atoms: 'Атомы',
  molecules: 'Молекулы',
  organisms: 'Организмы',
};

const registry = DS as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;
const specs = api.components as unknown as ComponentSpec[];
const LEVELS = ['primitives', 'spec', ...api.levels];

export function App() {
  const [level, setLevel] = useState<string>(() => location.hash.slice(1) || 'primitives');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    location.hash = level;
  }, [level]);

  const shown = specs.filter((c) => c.level === level);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--sp-6) var(--sp-5) var(--sp-8)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-black)', letterSpacing: 'var(--ls-heading)' }}>
          Banner Lab DS
        </h1>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
          {specs.length} компонентов · {api.package}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <DS.Segments
            options={['Тёмная', 'Светлая']}
            value={theme === 'dark' ? 0 : 1}
            onChange={(i: number) => setTheme(i === 0 ? 'dark' : 'light')}
          />
        </span>
      </header>

      <nav style={{ marginBottom: 'var(--sp-6)' }}>
        <DS.Tabs
          options={LEVELS.map((l) => [
            LEVEL_RU[l] ?? l,
            l === 'primitives' || l === 'spec' ? '' : String(specs.filter((c) => c.level === l).length),
          ])}
          value={LEVELS.indexOf(level)}
          onChange={(i: number) => setLevel(LEVELS[i] ?? 'primitives')}
        />
      </nav>

      <main style={{ display: 'grid', gap: 'var(--sp-8)' }}>
        {level === 'primitives' ? (
          <Primitives icons={api.icons} />
        ) : level === 'spec' ? (
          <Spec components={specs} />
        ) : (
          shown.map((spec) => {
            const Component = registry[spec.name];
            if (!Component) return null;
            return (
              <section key={spec.name} id={spec.name}>
                <Playground spec={spec} Component={Component} icons={api.icons} />
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
