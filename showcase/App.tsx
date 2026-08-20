/* Витрина: единственный источник истины по составу и правилам.
 *
 * Структура — перенос DC-версии один в один: шапка, переключатель уровней по центру,
 * боковая навигация с нумерацией, разделы в том же порядке и с той же прозой. Это
 * миграция, а не редизайн: пока две реализации существуют одновременно, сравнивать их
 * можно только когда они показывают одно и то же.
 *
 * Состав компонентов приезжает из контракта (api.react.json), а контракт выводится из
 * исходников — рукописных списков компонентов и пропсов здесь нет по построению.
 */
import { useEffect, useState } from 'react';
import * as DS from '../packages/ds-react/src/index';
import api from '../api.react.json';
import { BadgeNote, EridIsland, IslandBuilder, IslandRowsNote, ModalDemo, ToastNote, ToastStack } from './Live';
import { Playground, type ComponentSpec } from './Playground';
import { Primitives } from './Primitives';
import { PinCanvas, Tooltip } from './Scenes';
import { LEVELS, SECTIONS, type Section } from './sections';

const registry = DS as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;
const specs = api.components as unknown as ComponentSpec[];
const byName = new Map(specs.map((c) => [c.name, c]));

const num = (i: number) => String(i + 1).padStart(2, '0');

/* Живые демонстрации по разделам. Плейграунд крутит пропсы, а это — поведение во времени:
   сборка острова, очередь тостов, правило показа ошибки. Статичным примером не показать. */
const LIVE: Record<string, () => JSX.Element> = {
  island: () => (
    <>
      <IslandRowsNote />
      <IslandBuilder />
      <EridIsland />
    </>
  ),
  toast: () => (
    <>
      <ToastNote />
      <ToastStack />
    </>
  ),
  badge: BadgeNote,
  modal: ModalDemo,
};

function SectionBody({ section }: { section: Section }) {
  if (section.component) {
    const spec = byName.get(section.component);
    const Component = registry[section.component];
    if (!spec || !Component) return null;
    const Live = LIVE[section.id];
    return (
      <div style={{ display: 'grid', gap: 'var(--sp-6)' }}>
        <Playground spec={spec} Component={Component} sectionId={section.id} />
        {Live ? <Live /> : null}
      </div>
    );
  }
  if (section.id === 'tooltip') return <Tooltip />;
  if (section.id === 'pincanvas') return <PinCanvas />;
  return <Primitives id={section.id} icons={api.icons} components={specs} />;
}

export function App() {
  const [level, setLevel] = useState(LEVELS[0]!);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const sections = SECTIONS.filter((s) => s.level === level);

  return (
    <>
      <header
        className="sb-head"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: 'var(--sp-3) var(--sp-5)',
          background: 'var(--bg-base)',
          borderBottom: '0.5px solid var(--border-subtle)',
        }}
      >
        <b style={{ fontSize: 'var(--fs-l)', fontWeight: 'var(--fw-black)', letterSpacing: 'var(--ls-heading)' }}>
          Banner&nbsp;Lab
        </b>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>витрина · {specs.length} компонентов</span>

        <span style={{ margin: '0 auto' }}>
          <DS.Segments options={LEVELS} value={LEVELS.indexOf(level)} onChange={(i: number) => setLevel(LEVELS[i]!)} />
        </span>

        <DS.Button
          label={theme === 'dark' ? 'Светлая' : 'Тёмная'}
          icon={theme === 'dark' ? 'sun' : 'moon'}
          variant="secondary"
          size="s"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      </header>

      <div className="sb-shell">
        <nav style={{ position: 'sticky', top: 72, alignSelf: 'start', display: 'grid', gap: 'var(--sp-1)', maxHeight: 'calc(100vh - 96px)', overflow: 'auto' }}>
          <div
            style={{
              fontSize: 'var(--fs-l)',
              fontWeight: 'var(--fw-medium)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--sp-2)',
            }}
          >
            {level}
          </div>
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                display: 'flex',
                gap: 'var(--sp-25)',
                padding: 'var(--sp-1) 0',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: 'var(--fs-s)',
              }}
            >
              <span data-nums="true" style={{ color: 'var(--text-tertiary)', minWidth: 20 }}>
                {num(i)}
              </span>
              {s.title}
            </a>
          ))}
        </nav>

        <main style={{ display: 'grid', gap: 'var(--sp-8)', minWidth: 0 }}>
          {sections.map((s) => (
            <section key={s.id} id={s.id} style={{ display: 'grid', gap: 'var(--sp-4)', scrollMarginTop: 96 }}>
              <div style={{ display: 'grid', gap: 'var(--sp-2)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-3)' }}>
                <h2
                  style={{
                    margin: 0,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--sp-2)',
                    fontSize: 'var(--fs-h2)',
                    fontWeight: 'var(--fw-black)',
                    letterSpacing: 'var(--ls-heading)',
                  }}
                >
                  {s.heading ?? s.title}
                  {s.note ? (
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-regular)', letterSpacing: 'normal', color: 'var(--text-tertiary)' }}>
                      {s.note}
                    </span>
                  ) : null}
                </h2>
                <p style={{ margin: 0, maxWidth: 'var(--measure-text)', color: 'var(--text-body)', lineHeight: 'var(--lh-text)' }}>
                  {s.intro}
                </p>
              </div>
              <SectionBody section={s} />
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
