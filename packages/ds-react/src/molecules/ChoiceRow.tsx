import { forwardRef, useId, useState, type CSSProperties, type MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { OptionGroup, type OptionItem } from '../atoms/OptionGroup.js';
import { RowInfo } from './RowInfo.js';
import { RowLabel } from './RowLabel.js';

export interface ChoiceRowProps extends PassThrough {
  label?: string;
  options?: OptionItem[];
  value?: number;
  defaultValue?: number;
  disabled?: boolean;
  /** Раскрывашка ⓘ у лейбла: текст плюс необязательная картинка-инструкция. */
  info?: string;
  /** Картинка-инструкция внутри раскрывашки — работает вместе с info. */
  infoImage?: string;
  onChange?: (index: number) => void;
  style?: CSSProperties;
}

/**
 * Ряд с группой опций. Валидации нет вовсе: выбранная опция есть всегда, дать неверное
 * значение нечем.
 *
 * Колбэк уходит вниз ТОЛЬКО если ряд получил свой: иначе группа встаёт в управляемый
 * режим без хозяина и замирает.
 */
export const ChoiceRow = forwardRef<HTMLDivElement, ChoiceRowProps>(function ChoiceRow({
  label = '',
  options = [],
  value,
  defaultValue = 0,
  disabled = false,
  info = '',
  infoImage = '',
  onChange,
  style,
  ...rest
}, ref) {
  const [infoOpen, setInfoOpen] = useState(false);
  // Имя группы. Без него диктор говорит «Растр, переключатель, 1 из 2» — а ЧЕГО, неизвестно:
  // лейбл ряда лежит в двух узлах и группе неизвестен. axe этого не ловит, имя у radiogroup
  // формально необязательно. Приём взят у Base UI: RadioGroup берёт aria-labelledby у
  // подписи поля, а не копирует её текстом.
  const labelId = `${useId()}-label`;
  const hasInfo = !!info;
  const open = hasInfo && infoOpen;

  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      data-row="true"
      data-disabled={disabled ? 'true' : 'false'}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: '0 var(--sp-15) 0 var(--sp-4)', ...style }}
    >
      <div
        data-press={hasInfo && !disabled ? 'true' : undefined}
        // клик по ряду не занят действием: при наличии ⓘ он открывает подсказку
        onClick={hasInfo && !disabled ? () => setInfoOpen((v) => !v) : undefined}
        style={{
          display: 'flex',
          height: 'var(--row-h)',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-3)',
          cursor: hasInfo && !disabled ? 'pointer' : 'default',
        }}
      >
        <RowLabel labelId={labelId} label={label} hasInfo={hasInfo} open={open} onToggle={() => setInfoOpen((v) => !v)} style={{ flex: 'none' }} />
        {/* Ряд 52px, группа 36px: сверху и снизу оставалось по 8px ничьей зоны, и клик
            туда доставался ряду. Зона контрола растянута на высоту ряда и клики наружу
            не пускает — промах мимо опции не делает чужого действия. */}
        <span
          onClick={(e: MouseEvent) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', cursor: 'default' }}
        >
          <OptionGroup
            ariaLabelledBy={labelId}
            options={options}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            onChange={onChange}
          />
        </span>
      </div>
      <span style={{ display: 'block', paddingRight: 'var(--sp-25)' }}>
        <RowInfo open={open} text={info} image={infoImage} />
      </span>
    </div>
  );
});
