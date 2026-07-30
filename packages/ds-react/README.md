# @banner-lab/ds

Компоненты дизайн-системы Banner Lab на React. 27 компонентов: атомы, ряды, остров.

```bash
npm i @banner-lab/ds @banner-lab/tokens
```

```tsx
import '@banner-lab/tokens/tokens.css';
import '@banner-lab/ds/ds.css';
import { Island, Slider } from '@banner-lab/ds';

<Island rows={[
  { type: 'text', label: 'Название', value: name, onInput: setName },
  { type: 'toggle', label: 'Запекать в растр', checked: raster, onChange: setRaster },
  { type: 'action', label: 'Выгрузить', onClick: run },
]} />
<Slider label="Охранное поле" value={pad} onChange={setPad} min={0} max={64} snapStep={8} unit="px" />
```

Тема — атрибутом на корне: базовая тёмная, светлая — `data-theme="light"`.

## Что нужно знать

- **Управляемость определяется значением.** Передан `value` / `checked` — значением владеет родитель, и компонент показывает ровно переданное. Передан только `defaultValue` / `defaultChecked` — компонент ведёт своё. `Input` и `Slider` особые: набор и перетаскивание всегда живые.
- **Ряды живут в острове.** `Island` собирает их из конфига `rows` и владеет углами, фоном и сепараторами. `Slider` и `Disclosure` — вне острова, отдельной стопкой.
- **Колбэк уходит вниз только настоящий.** Не подставляйте пустые функции в конфиг рядов: контрол встанет в управляемый режим со значением из статичного конфига и замрёт.
- **`ds.css` обязателен.** В нём то, что инлайном не выражается: фокус, пресс, тултипы, `forced-colors`, `prefers-reduced-motion`, кейфреймы и сепараторы острова.

## Происхождение

Компоненты перенесены с формата Design Component через паритетный харнесс: каждый воспроизводит замороженный эталон (`ds-reference-v0`) пиксель в пиксель в обеих темах. Решения по переносу — в `docs/adr/` репозитория: стили инлайном (0010), идиома управления (0011), сам харнесс (0012).
