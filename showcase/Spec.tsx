/* Разделы-объяснения: слои токенов, доступность, словарь осей, UX-writing, состав.
 *
 * Проза перенесена из DC-версии дословно (showcase/content.ts) — она объясняет решения,
 * и переписывать её «своими словами» значит потерять причину. Всё выводимое из кода
 * (состав, статусы, уровни) приходит из контракта и здесь не дублируется.
 */
import { Badge } from '../packages/ds-react/src/index';
import { A11Y, AXES, TOKEN_LAYERS, UX_RULES } from './content';
import type { ComponentSpec } from './Playground';

const H = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <h3 style={{ margin: 0, fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-medium)', display: 'flex', gap: 'var(--sp-2)', alignItems: 'baseline' }}>
    {children}
    {note ? <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-regular)' }}>{note}</span> : null}
  </h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: 0, color: 'var(--text-body)', maxWidth: 'var(--measure-text)', lineHeight: 'var(--lh-text)' }}>{children}</p>
);

const card = {
  background: 'var(--bg-surface)',
  borderRadius: 'var(--r-m)',
  padding: 'var(--sp-4)',
  display: 'grid',
  gap: 'var(--sp-2)',
} as const;

export function Spec({ components }: { components: ComponentSpec[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-7)' }}>
      <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <H note="tokens.css">Токены и темы</H>
        <P>
          Цвет проходит три слоя. Компоненты пишут только про средний — алиасы. Ниже один и тот же цвет
          прослежен от сырого значения до темы.
        </P>
        {TOKEN_LAYERS.map((l) => (
          <div key={l.n} style={card}>
            <div style={{ display: 'flex', gap: 'var(--sp-25)', alignItems: 'center' }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  flex: 'none',
                  borderRadius: '50%',
                  background: l.swatch,
                  boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
                }}
              />
              <b style={{ fontWeight: 'var(--fw-medium)' }}>{l.name}</b>
            </div>
            <P>{l.desc}</P>
            <code style={{ color: 'var(--text-tertiary)' }}>{l.code}</code>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <H note="ds.css">Доступность</H>
        <P>
          Роль, имя и клавиатура — часть компонента, а не то, что доклеивает экран. Кольцо фокуса рисуется
          тенью, чтобы не менять размер элемента, и появляется только в клавиатурной модальности: залётный
          фокус от мыши кольца не даёт. Под prefers-reduced-motion уходят крупные перемещения и пружины, а
          цветовые переходы и кольцо остаются — они несут смысл, а не украшают.
        </P>
        <div style={{ ...card, gap: 0 }}>
          {A11Y.map(([comp, aria, keys], i) => (
            <div
              key={comp}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 2fr 1fr',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-25) 0',
                borderTop: i ? '0.5px solid var(--border-subtle)' : 'none',
                fontSize: 'var(--fs-s)',
              }}
            >
              <b style={{ fontWeight: 'var(--fw-medium)' }}>{comp}</b>
              <span style={{ color: 'var(--text-secondary)' }}>{aria}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{keys}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <H note="имена осей в пропсах">Словарь</H>
        <P>Три слова про разное — путать их нельзя, иначе один и тот же проп начинает значить два разных факта.</P>
        {AXES.map(([name, text]) => (
          <div key={name} style={card}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{name}</b>
            <P>{text}</P>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <H>UX-writing</H>
        <P>
          Тон и формат текста в компонентах. Правило одно на всё: подпись говорит, что случится, а не как
          устроен интерфейс.
        </P>
        {UX_RULES.map((u) => (
          <div key={u.title} style={card}>
            <b style={{ fontWeight: 'var(--fw-medium)' }}>{u.title}</b>
            <P>{u.text}</P>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <H note="из контракта">Состав</H>
        <P>
          Зрелость по уровням. beta — API может ещё уточниться: меняя такой компонент, проверьте вызовы в
          продуктовых экранах. stable трогаем только с бампом версии.
        </P>
        <div style={{ ...card, gap: 0 }}>
          {components.map((c, i) => (
            <div
              key={c.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 1fr 2fr',
                gap: 'var(--sp-3)',
                alignItems: 'center',
                padding: 'var(--sp-2) 0',
                borderTop: i ? '0.5px solid var(--border-subtle)' : 'none',
                fontSize: 'var(--fs-s)',
              }}
            >
              <b style={{ fontWeight: 'var(--fw-medium)' }}>{c.name}</b>
              <span style={{ color: 'var(--text-tertiary)' }}>{c.level}</span>
              <span>
                <Badge label={c.status} variant="quiet" tone={c.status === 'stable' ? 'ok' : 'warn'} />
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>
                {c.mounts.length ? `монтирует: ${c.mounts.join(', ')}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
