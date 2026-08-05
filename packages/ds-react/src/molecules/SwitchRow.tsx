import { forwardRef, useId, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Toggle } from '../atoms/Toggle.js';
import { useControlled } from '../lib/hooks.js';
import { RowInfo } from './RowInfo.js';
import { RowLabel } from './RowLabel.js';
import { RowMsg } from './RowMsg.js';

export interface SwitchRowProps extends PassThrough {
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
  /** У переключателя нет «неверно» — есть последствие выбора. Поэтому только ok и warn. */
  msgLevel?: 'ok' | 'warn';
  onChange?: (checked: boolean) => void;
  style?: CSSProperties;
}

/**
 * Ряд-переключатель: мгновенная настройка. Ряд САМ себе контрол — role, aria-checked,
 * tabindex и клавиатура у него собственные, а корень — div: вложенный label порождал бы
 * второе активационное событие с другим target, мимо гейта ⓘ.
 */
export const SwitchRow = forwardRef<HTMLDivElement, SwitchRowProps>(function SwitchRow({
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

  // Клик по ⓘ не должен дёргать действие ряда: ряд сам игнорирует клики из раскрывашки,
  // а не надеется, что дочерний маунт погасит всплытие.
  const fromInfo = (e: MouseEvent | null) =>
    !!(e && e.target && (e.target as HTMLElement).closest?.('button[aria-expanded]'));

  const flip = (e: MouseEvent | null) => {
    if (disabled || fromInfo(e)) return;
    // Фокус НЕ снимаем. Раньше мышиный клик уводил его в body, и следующий Tab начинал
    // обход с начала документа. Кольцо и так закрыто двумя замками: правилом
    // html[data-modality="kb"] в ds.css и тем, что :focus-visible на div[tabindex] от
    // мышиного клика не срабатывает вовсе. Base UI по той же причине фокус не трогает.
    setOn(!on);
  };

  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      data-row="true"
      data-disabled={disabled ? 'true' : 'false'}
      tabIndex={disabled ? -1 : 0}
      role="switch"
      aria-describedby={[msg ? msgId : '', open ? infoId : ''].filter(Boolean).join(' ') || undefined}
      aria-checked={on}
      aria-disabled={disabled}
      onKeyDown={(e: KeyboardEvent) => {
        // Клавиатура вложенной кнопки принадлежит ЕЙ. Событие с ⓘ всплывает сюда, и без
        // этой строки Enter на подсказке делал ровно наоборот: ряд переключался, а
        // подсказка не открывалась — preventDefault ниже отменял активацию самой кнопки.
        // Мышиный путь ряд у себя фильтрует (fromInfo), клавиатурный фильтровать забыли.
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
        <Toggle bare checked={on} disabled={disabled} />
      </span>
      <RowInfo id={infoId} open={open} text={info} image={infoImage} />
      {/* У тоггла ОШИБКИ не бывает: оба состояния валидны. Но предупреждение бывает —
          оно говорит не «неверно», а «вот последствие выбора». */}
      <RowMsg id={msgId} text={msg} level={msgLevel === 'ok' ? 'ok' : 'warn'} />
    </div>
  );
});
