/* Плейграунд компонента: сам компонент плюс панель ВСЕХ его пропсов.
 *
 * Панель — это обычный остров дизайн-системы, а не своя вёрстка: витрина обязана быть
 * первым потребителем системы, иначе она перестаёт ловить то, что ловит потребитель.
 * Ряды панели строятся из контракта (api.react.json), поэтому новый проп появляется в
 * плейграунде сам, а исчезнувший — исчезает. Рукописных списков пропсов здесь нет.
 */
import { useState } from 'react';
import * as DS from '../packages/ds-react/src/index';
import { Badge, Disclosure, Island, type IconName, type IslandRow } from '../packages/ds-react/src/index';
import { EXAMPLES } from './examples';
import { DEMO, WIDTH } from './demo';

export interface PropSpec {
  name: string;
  type: string;
  options: string[] | null;
  editor: 'enum' | 'icon' | 'boolean' | 'int' | 'text' | null;
  default?: unknown;
  callback?: boolean;
  info?: string;
}

export interface ComponentSpec {
  name: string;
  level: string;
  status: string;
  props: PropSpec[];
  mounts: string[];
  mountedBy: string[];
}

interface Props {
  spec: ComponentSpec;
  Component: React.ComponentType<Record<string, unknown>>;
  /** id раздела витрины: под ним лежат статичные примеры */
  sectionId: string;
}

const registry = DS as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;

export function Playground({ spec, Component, sectionId }: Props) {
  const demo = DEMO[spec.name] ?? {};
  const [state, setState] = useState<Record<string, unknown>>(() => ({ ...demo }));

  const value = (p: PropSpec) => state[p.name] ?? p.default;
  const set = (name: string, v: unknown) => setState((s) => ({ ...s, [name]: v }));

  // Ряды панели — из контракта. Пропсы со сложным значением (массив, объект, колбэк)
  // контрол не получают: их задаёт демо-набор, и подменять их полем ввода нечем.
  const rows: IslandRow[] = spec.props
    .filter((p) => p.editor && !p.callback)
    .map((p): IslandRow => {
      const common = { label: p.name, info: p.info ?? '' };
      if (p.editor === 'boolean') {
        return { ...common, type: 'toggle', checked: !!value(p), onChange: (v: boolean) => set(p.name, v) };
      }
      if (p.editor === 'enum' && p.options) {
        const idx = Math.max(0, p.options.indexOf(String(value(p) ?? '')));
        return {
          ...common,
          type: 'segmented',
          options: p.options,
          value: idx,
          onChange: (i: number) => set(p.name, p.options?.[i]),
        };
      }
      if (p.editor === 'icon') {
        // Короткий набор, а не все 56: в контроле-ряду они не помещаются, и в DC-витрине
        // здесь тоже стоял выбранный список. Полная галерея живёт в разделе «Иконки».
        const list: (IconName | '—')[] = ['—', 'plus', 'xmark', 'check', 'gear', 'arrow-right', 'trash-bin', 'ellipsis'];
        // Значение пропа приходит из состояния витрины, то есть нетипизированным: сверяем
        // строку со строкой, а не притворяемся, что это уже имя иконки.
        const current = String(value(p) || '—');
        const idx = Math.max(0, list.findIndex((n) => n === current));
        return {
          ...common,
          type: 'segmented',
          options: list.map((n) =>
            n === '—' ? { icon: 'square-dashed' as IconName, title: 'без иконки' } : { icon: n, title: n }
          ),
          value: idx,
          onChange: (i: number) => set(p.name, list[i] === '—' ? '' : list[i]),
        };
      }
      return {
        ...common,
        type: 'text',
        value: String(value(p) ?? ''),
        nums: p.editor === 'int',
        onInput: (v: string) => set(p.name, p.editor === 'int' ? Number(v) || 0 : v),
      };
    });

  /* Колбэки к тем значениям, которыми крутит панель.
   *
   * Плейграунд — потребитель системы, а не альбом картинок, и живёт по тем же правилам:
   * контрол, получивший значение сверху, обязан получить и колбэк, иначе он замирает
   * (ADR 0011). Для модалки это уже не неудобство, а ЛОВУШКА: открытое окно делает фон
   * inert, вместе с панелью, — закрыть его стало бы нечем. Связь выводится из контракта,
   * а не пишется списком: появился компонент с той же парой — он подключён сам.
   */
  const has = (n: string) => spec.props.some((p) => p.name === n);
  const wired: Record<string, unknown> = {};
  if (has('onOpenChange')) wired.onOpenChange = (o: boolean) => set('open', o);
  if (has('onToggle')) wired.onToggle = (o: boolean) => set('open', o);
  if (has('onInput')) wired.onInput = (v: unknown) => set('value', v);
  if (has('onChange')) wired.onChange = (v: unknown) => set(has('checked') ? 'checked' : 'value', v);
  // Подтверждение в витрине просто закрывает окно: настоящее действие знает только
  // потребитель, а кнопка без обработчика — это ошибка вызова, и компонент о ней говорит.
  if (has('onConfirm')) wired.onConfirm = () => set('open', false);

  const passed = { ...demo, ...wired, ...state };

  const examples = EXAMPLES[sectionId] ?? [];

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)' }}>
        <Badge label={spec.status} variant="quiet" tone={spec.status === 'stable' ? 'ok' : 'warn'} />
        {spec.mounts.length ? (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>монтирует: {spec.mounts.join(', ')}</span>
        ) : null}
      </div>

      {/* Демо и панель пропсов РЯДОМ, как в DC-витрине: щёлкая проп, видишь результат, а
          не прокручиваешь к нему. На узком экране колонки схлопываются в одну. */}
      <div className="sb-play">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '140px',
            padding: 'var(--sp-5)',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--r-m)',
          }}
        >
          <div style={{ width: WIDTH[spec.name] ?? 'auto', maxWidth: '100%' }}>
            <Component {...passed} />
          </div>
        </div>
        {rows.length ? <Island rows={rows} /> : <span />}
      </div>

      {examples.length ? (
        <Disclosure label="Примеры" count={examples.length}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', padding: 'var(--sp-3) 0' }}>
            {examples.map((ex, i) => {
              const C = registry[ex.c];
              if (!C) return null;
              const wide = ex.c === 'Island' || ex.c === 'Toast' || ex.c === 'EmptyState';
              return (
                <div key={i} style={{ width: wide ? '100%' : 'auto', maxWidth: '100%' }}>
                  <C {...(ex.p as Record<string, unknown>)} />
                </div>
              );
            })}
          </div>
        </Disclosure>
      ) : null}
    </div>
  );
}
