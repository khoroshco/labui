import { useState, type CSSProperties, type MouseEvent } from 'react';
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
  info?: string;
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
export function ChoiceRow({
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
}: ChoiceRowProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const hasInfo = !!info;
  const open = hasInfo && infoOpen;

  return (
    <div
      {...passThrough(rest)}
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
        <RowLabel label={label} hasInfo={hasInfo} open={open} onToggle={() => setInfoOpen((v) => !v)} style={{ flex: 'none' }} />
        {/* Ряд 52px, группа 36px: сверху и снизу оставалось по 8px ничьей зоны, и клик
            туда доставался ряду. Зона контрола растянута на высоту ряда и клики наружу
            не пускает — промах мимо опции не делает чужого действия. */}
        <span
          onClick={(e: MouseEvent) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', cursor: 'default' }}
        >
          <OptionGroup
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
}
