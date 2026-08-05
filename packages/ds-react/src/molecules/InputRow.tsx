import { forwardRef, useId, useState, type CSSProperties, type MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { CycleButton } from '../atoms/CycleButton.js';
import { Input } from '../atoms/Input.js';
import { Skeleton } from '../atoms/Skeleton.js';
import { caretToEnd, useSpin } from '../lib/hooks.js';
import { RowInfo } from './RowInfo.js';
import { RowLabel } from './RowLabel.js';
import { RowMsg, type MsgLevel } from './RowMsg.js';

export interface InputRowProps extends PassThrough {
  label?: string;
  value?: string;
  /** Имя поля для FormData и автозаполнения. */
  name?: string;
  placeholder?: string;
  /** Любой набор значений для кнопки-циклера, не только единицы. */
  options?: string[];
  optionIndex?: number;
  maxLength?: number;
  /** Табличные цифры по явному хуку: моношрифта в системе нет. */
  nums?: boolean;
  /** Значение заменяется скелетоном (после 320 мс), ввод блокируется сразу. */
  loading?: boolean;
  disabled?: boolean;
  /** Предупреждение о последствии выбора — не «неверно», а «вот что будет». */
  msg?: string;
  msgLevel?: MsgLevel;
  /** Раскрывашка ⓘ у лейбла: текст плюс необязательная картинка-инструкция. */
  info?: string;
  /** Картинка-инструкция внутри раскрывашки — работает вместе с info. */
  infoImage?: string;
  onInput?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onOptionChange?: (index: number, option: string) => void;
  style?: CSSProperties;
}

/** Ряд с текстовым вводом: лейбл слева, значение справа, необязательный циклер единиц. */
export const InputRow = forwardRef<HTMLDivElement, InputRowProps>(function InputRow({
  label = '',
  value = '',
  name,
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
  ...rest
}, ref) {
  const [infoOpen, setInfoOpen] = useState(false);
  // Сообщение валидации СВЯЗЫВАЕТСЯ с полем. Без aria-describedby скринридер на возврате
  // в поле говорит «erid, недопустимое значение» и не говорит ПОЧЕМУ: текст ошибки лежит
  // рядом в разметке и полю неизвестен. Подсказка ⓘ связывается тем же способом.
  const uid = useId();
  const msgId = `${uid}-msg`;
  const infoId = `${uid}-info`;
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
    if (target.tagName === 'INPUT') {
      // Клик внутри поля, но левее правого края текста: каретка обязана уйти в конец
      // значения, а не встать в позицию 0 — иначе ввод пойдёт ПЕРЕД значением.
      const input = target as HTMLInputElement;
      const r = input.getBoundingClientRect();
      const ctx = document.createElement('canvas').getContext('2d');
      const cs = getComputedStyle(input);
      if (ctx) {
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const textRight = r.right - parseFloat(cs.paddingRight || '0');
        const textLeft = textRight - ctx.measureText(input.value).width;
        if (e.clientX < textLeft) {
          e.preventDefault();
          input.focus();
          caretToEnd(input);
        }
      }
      return;
    }
    const input = e.currentTarget.querySelector('input');
    if (input) {
      e.preventDefault();
      input.focus();
      caretToEnd(input);
    }
  };

  return (
    <div
      {...passThrough(rest)}
      ref={ref}
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
                  name={name}
                  describedBy={[msg ? msgId : '', open ? infoId : ''].filter(Boolean).join(' ')}
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
                  {/* value, а не defaultValue: до первого клика циклер обязан уважать
                      проп — иначе внешнее переключение единиц он игнорирует. */}
                  <CycleButton
                    options={options}
                    // Значение вниз — только вместе с колбэком. Управляемый контрол
                    // показывает РОВНО переданное, поэтому value без onChange его
                    // замораживает: менять его будет нечем.
                    value={onOptionChange ? optionIndex : undefined}
                    defaultValue={onOptionChange ? undefined : optionIndex}
                    disabled={disabled}
                    onChange={onOptionChange}
                  />
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>
      <RowInfo id={infoId} open={open} text={info} image={infoImage} />
      <RowMsg id={msgId} text={msg} level={msgLevel} />
    </div>
  );
});
