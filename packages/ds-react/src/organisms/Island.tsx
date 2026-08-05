import { Children, forwardRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { ActionRow } from '../molecules/ActionRow.js';
import { CheckboxRow } from '../molecules/CheckboxRow.js';
import { ChoiceRow } from '../molecules/ChoiceRow.js';
import { InputRow } from '../molecules/InputRow.js';
import { SwitchRow } from '../molecules/SwitchRow.js';
import type { MsgLevel } from '../molecules/RowMsg.js';
import type { OptionItem } from '../atoms/OptionGroup.js';
import type { ButtonVariant } from '../atoms/Button.js';

/**
 * Общее у всех рядов: то, что остров умеет для каждого независимо от типа.
 *
 * `id`, `className` и `data-*` уезжают на КОРЕНЬ ряда, а не в никуда: без них
 * продуктовая форма не может ни проскроллить к невалидному полю, ни повесить на
 * конкретный ряд свой тест — приходится идти в DOM запросом мимо контракта.
 */
interface RowCommon extends PassThrough {
  /** Устойчивый ключ ряда. Без него ключом служит позиция, и состояние переезжает при сортировке. */
  key?: string;
  label?: string;
  /** Раскрывашка ⓘ у лейбла: текст плюс необязательная картинка-инструкция. */
  info?: string;
  /** Картинка-инструкция внутри раскрывашки — работает вместе с info. */
  infoImage?: string;
  disabled?: boolean;
}

/** Ряд с текстовым вводом. */
export interface IslandTextRow extends RowCommon {
  type?: 'text';
  value?: string | number;
  placeholder?: string;
  /** Имя поля для FormData и автозаполнения. */
  name?: string;
  /** Набор значений для кнопки-циклера единиц. */
  options?: string[];
  optionIndex?: number;
  maxLength?: number;
  nums?: boolean;
  /** Значение заменяется скелетоном (после 320 мс), ввод блокируется сразу. */
  loading?: boolean;
  msg?: string;
  msgLevel?: MsgLevel;
  onInput?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onOptionChange?: (index: number, option: string) => void;
}

/** Ряд с группой опций. */
export interface IslandSegmentedRow extends RowCommon {
  type: 'segmented';
  options?: (string | OptionItem)[];
  value?: number;
  onChange?: (index: number) => void;
}

/** Ряд-переключатель: мгновенная настройка. */
export interface IslandToggleRow extends RowCommon {
  type: 'toggle';
  subtitle?: string;
  checked?: boolean;
  msg?: string;
  msgLevel?: MsgLevel;
  onChange?: (checked: boolean) => void;
}

/** Ряд с галочкой: выбор или согласие, часть отправляемых данных. */
export interface IslandCheckboxRow extends RowCommon {
  type: 'checkbox';
  subtitle?: string;
  checked?: boolean;
  msg?: string;
  msgLevel?: MsgLevel;
  onChange?: (checked: boolean) => void;
}

/** Ряд-действие: кнопка по центру. */
export interface IslandActionRow extends RowCommon {
  type: 'action';
  variant?: ButtonVariant;
  loading?: boolean;
  onClick?: () => void;
}

/**
 * Конфиг одного ряда. Тип решает, каким рядом он станет — и РАЗМЕЧЕННЫМ объединением, а
 * не мешком необязательных полей.
 *
 * Прежний мешок пропускал бессмыслицу молча: `{ type: 'toggle', maxLength: 60,
 * optionIndex: 7 }` проходил проверку типов, половина полей у переключателя не значила
 * ничего. И мешал законному коду: `onChange` был объединением двух функциональных типов,
 * поэтому вывод параметра не работал вовсе — каждый обработчик приходилось аннотировать
 * руками, а `(index: number) => …` на ряду-переключателе компилировался и падал в рантайме.
 */
export type IslandRow =
  | IslandTextRow
  | IslandSegmentedRow
  | IslandToggleRow
  | IslandCheckboxRow
  | IslandActionRow;

export interface IslandProps extends PassThrough {
  rows?: IslandRow[];
  /** Ряды, которых нет в конфиге: остров даёт им ту же обёртку-маунт, что и своим. */
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * Чистый контейнер: углы, фон, сепараторы (рисует ds.css по хуку data-island — пресс ряда
 * их не двигает) и сборка рядов из конфига.
 *
 * Валидации у острова НЕТ вовсе: она принадлежит ряду, у которого есть значение. Режим
 * «весь остров ошибочен» был второй, оторванной от значений валидацией.
 *
 * Колбэки уходят вниз РОВНО те, что дал конфиг: подстановка noop сделала бы их «всегда
 * есть», ряд форвардил бы их дальше, и атом встал бы в управляемый режим со значением из
 * статичного конфига — то есть без хозяина, и замер.
 */
export const Island = forwardRef<HTMLDivElement, IslandProps>(function Island({ rows = [], children, style,
  ...rest
}, ref) {
  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      data-island="true"
      style={{
        display: rows.length || Children.count(children) ? 'flex' : 'none',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-m)',
        overflow: 'hidden',
        transition: 'background .2s ease',
        ...style,
      }}
    >
      {rows.map((r, i) => {
        // Ключ ряда: индекс прилипает к ПОЗИЦИИ, и при вставке или сортировке черновик
        // неуправляемого поля, галочка и открытая ⓘ переезжают на соседний ряд. Даём
        // потребителю канал key; без него остаётся прежнее поведение.
        const rowKey = r.key ?? `${r.type ?? 'text'}:${r.label ?? ''}:${i}`;
        // Каналы наружу (id, className, data-*, aria-*) уезжают на КОРЕНЬ ряда: без них
        // форма не может ни проскроллить к невалидному полю, ни пометить конкретный ряд.
        const { key: _k, type: _t, label, info, infoImage, disabled, ...rest } = r as IslandRow & Record<string, unknown>;
        const common = { disabled: !!disabled, info: info ?? '', infoImage: infoImage ?? '', ...passThrough(rest) };
        // Ряд живёт в обёртке-маунте, а не прямым ребёнком острова. Обёртка не декорация:
        // сепаратор и тон ховера рисуются ИМЕННО на ней (ds.css), поэтому пресс ряда их не
        // двигает, а край не двоится на возврате.
        const wrap = (node: ReactElement) => <div key={rowKey}>{node}</div>;

        // ПРАВИЛО КОМПОЗИЦИИ. В React признак управляемости — ЗНАЧЕНИЕ, поэтому ряд отдаёт
        // значение вниз ТОЛЬКО если получил колбэк; иначе отдаёт его как НАЧАЛЬНОЕ.
        // Без этого конфиг { type:'toggle', checked:true } без onChange делал ряд мёртвым:
        // контрол показывал ровно переданное, а менять его было нечем.
        if (r.type === 'segmented') {
          return wrap(
            <ChoiceRow
              {...common}
              label={label ?? ''}
              options={(r.options ?? []) as OptionItem[]}
              value={r.onChange ? r.value : undefined}
              defaultValue={r.onChange ? undefined : r.value}
              onChange={r.onChange}
            />
          );
        }
        if (r.type === 'toggle') {
          return wrap(
            <SwitchRow
              {...common}
              label={label ?? ''}
              subtitle={r.subtitle ?? ''}
              checked={r.onChange ? r.checked : undefined}
              defaultChecked={r.onChange ? undefined : r.checked}
              msg={r.msg ?? ''}
              msgLevel={r.msgLevel === 'danger' ? 'warn' : (r.msgLevel ?? 'ok')}
              onChange={r.onChange}
            />
          );
        }
        if (r.type === 'checkbox') {
          return wrap(
            <CheckboxRow
              {...common}
              label={label ?? ''}
              subtitle={r.subtitle ?? ''}
              checked={r.onChange ? r.checked : undefined}
              defaultChecked={r.onChange ? undefined : r.checked}
              msg={r.msg ?? ''}
              msgLevel={r.msgLevel ?? 'ok'}
              onChange={r.onChange}
            />
          );
        }
        if (r.type === 'action') {
          return wrap(
            <ActionRow
              {...common}
              label={label ?? ''}
              variant={r.variant ?? 'primary'}
              loading={!!r.loading}
              onClick={r.onClick}
            />
          );
        }
        return wrap(
          <InputRow
            {...common}
            label={label ?? ''}
            value={String(r.value ?? '')}
            name={r.name}
            placeholder={r.placeholder ?? ''}
            options={r.options}
            optionIndex={r.optionIndex}
            maxLength={r.maxLength}
            nums={!!r.nums}
            loading={!!r.loading}
            msg={r.msg ?? ''}
            msgLevel={r.msgLevel ?? 'ok'}
            onInput={r.onInput}
            onFocus={r.onFocus}
            onBlur={r.onBlur}
            onOptionChange={r.onOptionChange}
          />
        );
      })}
      {/* Дети — рядом с конфигом, а не вместо него. Конфиг покрывает пять типовых рядов;
          всё остальное (дата, поиск с подсказками, сумма с курсом) потребитель приносит
          сам, и остров обязан дать ему ту же обёртку-маунт: иначе сепараторы и радиусы
          крайних рядов придётся воспроизводить копированием ds.css.
          Раньше children молча выбрасывались, причём проверку типов это ПРОХОДИЛО. */}
      {Children.map(children, (child) => (child == null ? null : <div>{child}</div>))}
    </div>
  );
});
