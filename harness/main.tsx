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

document.documentElement.setAttribute('data-theme', theme);

const registry = DS as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;
const Component = registry[name];
const root = createRoot(document.getElementById('dc-root')!);

if (!Component) {
  root.render(<div style={{ padding: 16, color: 'var(--danger)' }}>Нет компонента «{name}»</div>);
} else {
  root.render(
    <div className="sc-host">
      <Component {...props} />
    </div>
  );
}
