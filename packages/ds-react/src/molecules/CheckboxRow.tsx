import { forwardRef, useId, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Checkbox } from '../atoms/Checkbox.js';
import { useControlled } from '../lib/hooks.js';
import { RowInfo } from './RowInfo.js';
import { RowLabel } from './RowLabel.js';
import { RowMsg, type MsgLevel } from './RowMsg.js';

export interface CheckboxRowProps extends PassThrough {
  label?: string;
  subtitle?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  /** Раскрывашка ⓘ у лейбла: текст плюс необязательная картинка-инструкция. */
  info?: string;
  /** Картинка-инструкция внутри раскрывашки — работает вместе с info. */
  infoImage?: string;
  /** Предупреждение о последствии выбора — не «неверно», а «вот что будет». */
  msg?: string;
  msgLevel?: MsgLevel;
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

/**
 * Ряд-чекбокс: ВЫБОР или согласие, часть формы. Снятая галочка — законное «нет», которое
 * можно потребовать исправить, поэтому здесь есть полная валидация, включая danger.
 * Отдельно от SwitchRow, потому что различие не в виде контрола, а в смысле.
 */
export const CheckboxRow = forwardRef<HTMLDivElement, CheckboxRowProps>(function CheckboxRow({
  label = '',
  subtitle = '',
  checked,
  defaultChecked = false,
  disabled = false,
  info = '',
  infoImage = '',
  msg = '',
  msgLevel = 'ok',
  onChange,
  style,
  ...rest
}, ref) {
  const [on, setOn] = useControlled(checked, defaultChecked, onChange);
  const [infoOpen, setInfoOpen] = useState(false);
  // Сообщение и подсказка СВЯЗЫВАЮТСЯ с носителем роли. Раньше они были просто текстом
  // рядом: вернувшись в ряд, диктор говорил «выключено» и молчал о том, почему ряд красный.
  // Ссылку на закрытую ⓘ не даём — она под inert, и диктор прочёл бы то, чего нет.
  const uid = useId();
  const msgId = `${uid}-msg`;
  const infoId = `${uid}-info`;
  const hasInfo = !!info;
  const open = hasInfo && infoOpen;
  const isError = msgLevel === 'danger';

  const fromInfo = (e: MouseEvent | null) =>
    !!(e && e.target && (e.target as HTMLElement).closest?.('button[aria-expanded]'));

  const flip = (e: MouseEvent | null) => {
    if (disabled || fromInfo(e)) return;
    // Фокус НЕ снимаем. Раньше мышиный клик уводил его в body, и следующий Tab начинал
    // обход с начала документа. Кольцо и так закрыто двумя замками: правилом
    // html[data-modality="kb"] в ds.css и тем, что :focus-visible на div[tabindex] от
    // мышиного клика не срабатывает вовсе.
    setOn(!on);
  };

  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      data-row="true"
      data-invalid={isError ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      tabIndex={disabled ? -1 : 0}
      role="checkbox"
      aria-describedby={[msg ? msgId : '', open ? infoId : ''].filter(Boolean).join(' ') || undefined}
      aria-checked={on}
      aria-disabled={disabled}
      aria-invalid={isError ? true : undefined}
      onKeyDown={(e: KeyboardEvent) => {
        // То же, что у SwitchRow: событие вложенной ⓘ всплывает в ряд, и без этой строки
        // Enter на подсказке переключал галочку, а подсказку не открывал вовсе.
        if (e.target !== e.currentTarget) return;
        // Enter НЕ наш. У нативного чекбокса он отправляет форму, а переключает пробел;
        // перехватывая обе клавиши и гася событие, ряд забирал у формы потребителя
        // отправку с клавиатуры. Правило подсмотрено у Base UI, где ради него написан
        // отдельный блок: Enter гасит активацию и кликает сабмиттер формы.
        if (e.key === ' ') {
          e.preventDefault();
          flip(null);
        }
      }}
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={flip}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 var(--sp-4)',
        cursor: 'pointer',
        ...style,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'var(--row-h)',
          gap: 'var(--sp-3)',
          padding: `${subtitle ? '7px' : '0'} 0`,
        }}
      >
        <RowLabel label={label} subtitle={subtitle} hasInfo={hasInfo} open={open} onToggle={() => setInfoOpen((v) => !v)} />
        {/* рамка чекбокса краснеет тем же --danger, что сообщение — один красный на ряд */}
        <Checkbox bare checked={on} invalid={isError} disabled={disabled} />
      </span>
      <RowInfo id={infoId} open={open} text={info} image={infoImage} />
      <RowMsg id={msgId} text={msg} level={msgLevel} />
    </div>
  );
});
