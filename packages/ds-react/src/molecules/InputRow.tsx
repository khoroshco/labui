import { useState, type CSSProperties, type MouseEvent } from 'react';
import { CycleButton } from '../atoms/CycleButton';
import { Input } from '../atoms/Input';
import { Skeleton } from '../atoms/Skeleton';
import { caretToEnd, useSpin } from '../lib/hooks';
import { RowInfo } from './RowInfo';
import { RowLabel } from './RowLabel';
import { RowMsg, type MsgLevel } from './RowMsg';

export interface InputRowProps {
  label?: string;
  value?: string;
  placeholder?: string;
  /** Любой набор значений для кнопки-циклера, не только единицы. */
  options?: string[];
  optionIndex?: number;
  maxLength?: number;
  /** Табличные цифры по явному хуку: моношрифта в системе нет. */
  nums?: boolean;
  loading?: boolean;
  disabled?: boolean;
  msg?: string;
  msgLevel?: MsgLevel;
  info?: string;
  infoImage?: string;
  onInput?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onOptionChange?: (index: number, option: string) => void;
  style?: CSSProperties;
}

/** Ряд с текстовым вводом: лейбл слева, значение справа, необязательный циклер единиц. */
export function InputRow({
  label = '',
  value = '',
  placeholder = '',
  options,
  optionIndex = 0,
  maxLength,
  nums = false,
  loading = false,
  disabled = false,
  msg = '',
  msgLevel = 'ok',
  info = '',
  infoImage = '',
  onInput,
  onFocus,
  onBlur,
  onOptionChange,
  style,
}: InputRowProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const spin = useSpin(loading);
  const hasInfo = !!info;
  const open = hasInfo && infoOpen;
  const invalid = msgLevel === 'danger';
  const hasCycle = Array.isArray(options) && options.length > 0;

  /** Каретка в конец при клике по пустой зоне ряда: ряд ведёт в поле, а не в никуда. */
  const focusEnd = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT') return;
    const input = e.currentTarget.querySelector('input');
    if (input) {
      e.preventDefault();
      input.focus();
      caretToEnd(input);
    }
  };

  return (
    <div
      data-row="true"
      // тон невалидного ряда рисует обёртка-маунт по data-invalid (ds.css)
      data-invalid={invalid ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      onMouseDown={focusEnd}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '0 var(--sp-4)', cursor: 'text', ...style }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-3)',
          height: 'var(--row-h)',
        }}
      >
        <RowLabel label={label} hasInfo={hasInfo} open={open} onToggle={() => setInfoOpen((v) => !v)} style={{ flex: 'none' }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-15)', flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          {spin ? (
            <span style={{ display: 'inline-flex', animation: 'ds-fade .25s ease' }}>
              <Skeleton shape="line" width="96px" />
            </span>
          ) : (
            <>
              <span data-nums={nums ? 'true' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex' }}>
                <Input
                  bare
                  align="right"
                  ariaLabel={label}
                  value={value}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  invalid={invalid}
                  disabled={disabled}
                  onInput={onInput}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  style={{ width: '100%' }}
                />
              </span>
              {hasCycle ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <CycleButton options={options} defaultValue={optionIndex} disabled={disabled} onChange={onOptionChange} />
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>
      <RowInfo open={open} text={info} image={infoImage} />
      <RowMsg text={msg} level={msgLevel} />
    </div>
  );
}
