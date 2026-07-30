import type { CSSProperties, ReactElement } from 'react';
import { ActionRow } from '../molecules/ActionRow.js';
import { CheckboxRow } from '../molecules/CheckboxRow.js';
import { ChoiceRow } from '../molecules/ChoiceRow.js';
import { InputRow } from '../molecules/InputRow.js';
import { SwitchRow } from '../molecules/SwitchRow.js';
import type { MsgLevel } from '../molecules/RowMsg.js';
import type { OptionItem } from '../atoms/OptionGroup.js';
import type { ButtonVariant } from '../atoms/Button.js';

/** Конфиг одного ряда острова. Тип решает, каким рядом он станет. */
export interface IslandRow {
  type?: 'text' | 'segmented' | 'toggle' | 'checkbox' | 'action';
  label?: string;
  value?: string | number;
  placeholder?: string;
  options?: (string | OptionItem)[];
  optionIndex?: number;
  maxLength?: number;
  nums?: boolean;
  subtitle?: string;
  checked?: boolean;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  msg?: string;
  msgLevel?: MsgLevel;
  info?: string;
  infoImage?: string;
  onInput?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Тип зависит от ряда: индекс опции у segmented, включённость у toggle и checkbox.
   *  `never` в параметре принимал любую функцию из-за контравариантности и не гарантировал
   *  ничего — здесь честное объединение. */
  onChange?: ((index: number) => void) | ((checked: boolean) => void);
  onClick?: () => void;
  onOptionChange?: (index: number, option: string) => void;
}

export interface IslandProps {
  rows?: IslandRow[];
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
export function Island({ rows = [], style }: IslandProps) {
  return (
    <div
      data-island="true"
      style={{
        display: rows.length ? 'flex' : 'none',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-m)',
        overflow: 'hidden',
        transition: 'background .2s ease',
        ...style,
      }}
    >
      {rows.map((r, i) => {
        const type = r.type ?? 'text';
        // ПРАВИЛО КОМПОЗИЦИИ. В React признак управляемости — ЗНАЧЕНИЕ, поэтому ряд отдаёт
        // значение вниз ТОЛЬКО если получил колбэк; иначе отдаёт его как НАЧАЛЬНОЕ.
        // Без этого конфиг вида { type:'toggle', checked:true } без onChange делал ряд
        // мёртвым: контрол показывал ровно переданное, а менять его было нечем — ряд
        // подсвечивался, продавливался, озвучивал role=switch и не переключался.
        const common = { disabled: !!r.disabled, info: r.info ?? '', infoImage: r.infoImage ?? '' };
        // Ряд живёт в обёртке-маунте, а не прямым ребёнком острова. Обёртка не декорация:
        // сепаратор и тон ховера рисуются ИМЕННО на ней (ds.css), поэтому пресс ряда их не
        // двигает, а край не двоится на возврате. В DC-версии обёртку давал рантайм.
        const wrap = (node: ReactElement) => <div key={i}>{node}</div>;
        if (type === 'segmented') {
          return wrap(
            <ChoiceRow
              {...common}
              label={r.label ?? ''}
              options={(r.options ?? []) as OptionItem[]}
              // Значение вниз — только вместе с колбэком (см. комментарий у owned ниже)
              value={r.onChange ? (r.value as number | undefined) : undefined}
              defaultValue={r.onChange ? undefined : (r.value as number | undefined)}
              onChange={r.onChange as ((i: number) => void) | undefined}
            />
          );
        }
        if (type === 'toggle') {
          return wrap(
            <SwitchRow
              {...common}
              label={r.label ?? ''}
              subtitle={r.subtitle ?? ''}
              checked={r.onChange ? r.checked : undefined}
              defaultChecked={r.onChange ? undefined : r.checked}
              msg={r.msg ?? ''}
              msgLevel={r.msgLevel === 'danger' ? 'warn' : (r.msgLevel ?? 'ok')}
              onChange={r.onChange as ((v: boolean) => void) | undefined}
            />
          );
        }
        if (type === 'checkbox') {
          return wrap(
            <CheckboxRow
              {...common}
              label={r.label ?? ''}
              subtitle={r.subtitle ?? ''}
              checked={r.onChange ? r.checked : undefined}
              defaultChecked={r.onChange ? undefined : r.checked}
              msg={r.msg ?? ''}
              msgLevel={r.msgLevel ?? 'ok'}
              onChange={r.onChange as ((v: boolean) => void) | undefined}
            />
          );
        }
        if (type === 'action') {
          return wrap(
            <ActionRow
              label={r.label ?? ''}
              variant={r.variant ?? 'primary'}
              loading={!!r.loading}
              disabled={!!r.disabled}
              onClick={r.onClick}
            />
          );
        }
        return wrap(
          <InputRow
            {...common}
            label={r.label ?? ''}
            value={String(r.value ?? '')}
            placeholder={r.placeholder ?? ''}
            options={type === 'text' ? (r.options as string[] | undefined) : undefined}
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
    </div>
  );
}
