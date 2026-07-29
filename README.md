# Banner Lab DS

Дизайн-система Banner Lab: 27 компонентов, токены, витрина-спека. Код рабочий, а не мокапы — открывается в браузере и уже соблюдает свои правила.

Весь код здесь пишет AI, ревью человеком нет. Поэтому надёжность держится не на внимательности, а на автоматике: гейты в CI блокируют мёрж при любом красном.

## Запуск

```
npm ci
npm run dev
```

Витрина откроется на `http://localhost:5173/`. Нужен Node из `.nvmrc`.

## Что где лежит

```
CLAUDE.md            конституция системы — правила и инварианты, читается автоматически
ROADMAP.md           что делаем после переезда: DTCG-токены, api.json, миграция на React
src/                 tokens.css, ds.css, хелперы, рантайм, шрифты, иконки
  atoms/             Button, Input, Checkbox, Toggle, CycleButton, OptionGroup, Badge, Skeleton, Avatar, Pin
  molecules/         RowLabel, RowInfo, RowMsg, InputRow, ChoiceRow, SwitchRow, CheckboxRow, ActionRow,
                     Slider, Disclosure, Segments, Tabs, Toast, PinCard, PinComposer
  organisms/         Island, EmptyState
storybook/           Storybook.dc.html — единственный источник истины по составу и правилам
tests/               smoke, unit, a11y, visual
docs/                handoff (план переезда), process, brief
```

Раскладка по уровням — для читателя. Рантайм монтирует компоненты по **плоскому** пространству имён (`/Button.dc.html`, `/tokens.css`, `/svgs/*`), это делает дев-сервер; подробности и следствия — в `CLAUDE.md`, раздел «Репозиторий».

## Публикация

Публикуются **только токены** (`@banner-lab/tokens`). Компоненты на текущем DC-рантайме не публикуются: у системы ноль потребителей, и публикация создала бы связанность, из-за которой миграция на React стала бы согласованным мажором во всех сервисах вместо сравнения с эталоном. Причина и план — `ROADMAP.md`.

## Правки

Читай `CLAUDE.md` → меняй в `src/` → `npm run verify` локально → PR. Никогда не редактируй `support.js` (сгенерированный рантайм) и не обновляй визуальные снапшоты, не посмотрев на диффы.
