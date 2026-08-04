/* Паритетный харнесс: рендерит React-компонент с теми же пропсами, что у DC-страницы.
 *
 * Адрес: /harness/?c=Button&theme=dark&props=<json>
 * Тест снимает #dc-root и сверяет с эталоном, снятым с DC-версии, — то есть с состоянием
 * системы на теге ds-reference-v0. Расхождение больше порога значит «не мигрировано».
 */
import { createRoot } from 'react-dom/client';
import * as DS from '../packages/ds-react/src/index';

const params = new URLSearchParams(location.search);
const name = params.get('c') ?? '';
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
let props: Record<string, unknown> = {};
try {
  props = JSON.parse(params.get('props') ?? '{}');
} catch {
  props = {};
}

// Функции через границу теста не переносятся, а за колбэком у компонентов спрятаны целые
// ветки разметки: полоса таймера тоста рендерится ТОЛЬКО при onTimeout/onClose. Без этого
// моста такие ветки не видел ни один гейт — они выглядели непроверяемыми, а на деле были
// просто недосягаемыми. Условное обозначение «@fn» превращается в пустой колбэк здесь и
// ровно так же в мосте DC (tests/support/browser.js): один диалект на обе реализации.
// Колбэк ещё и ЗАПИСЫВАЕТСЯ: иначе тест видит только «что нарисовано», а не «что
// произошло и когда». Тосту это принципиально — его дефект был во ВРЕМЕНИ вызова.
for (const [k, v] of Object.entries(props)) {
  if (v !== '@fn') continue;
  props[k] = () => {
    const w = window as unknown as { __calls?: { prop: string; at: number }[] };
    (w.__calls ??= []).push({ prop: k, at: performance.now() });
  };
}

document.documentElement.setAttribute('data-theme', theme);

const registry = DS as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;
const Component = registry[name];
const root = createRoot(document.getElementById('dc-root')!);

function draw() {
  if (!Component) {
    root.render(<div style={{ padding: 16, color: 'var(--danger)' }}>Нет компонента «{name}»</div>);
    return;
  }
  root.render(
    <div className="sc-host">
      <Component {...props} />
    </div>
  );
}

/**
 * Мост «новые пропсы сверху» — ровня __dcSetProps у эталона.
 *
 * Без него гейт видел компонент ровно в одном наборе пропсов: тот, что приехал в адресе.
 * А половина идиомы управления (ADR 0011) — про то, что происходит, когда родитель ПРИСЛАЛ
 * НОВОЕ значение. Проверить это было нечем, и `value`, работающий один раз, прожил
 * незамеченным в PinComposer.
 */
(window as unknown as { __setProps: (patch: Record<string, unknown>) => void }).__setProps = (patch) => {
  props = { ...props, ...patch };
  draw();
};

draw();
