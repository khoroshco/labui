import { forwardRef, type CSSProperties } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { OptionGroup } from '../atoms/OptionGroup.js';

export interface SegmentsProps extends PassThrough {
  options?: string[];
  value?: number;
  defaultValue?: number;
  onChange?: (index: number) => void;
  style?: CSSProperties;
}

/** Тонкая обёртка над OptionGroup (pill + inverse): поведение скользящей пилюли живёт в одном месте. */
export const Segments = forwardRef<HTMLDivElement, SegmentsProps>(function Segments({ options, value, defaultValue = 0, onChange, style,
  ...rest
}, ref) {
  return (
    <div
      {...passThrough(rest)}
      ref={ref}
      style={{
        display: 'inline-flex',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-full)',
        padding: 'var(--sp-1)',
        ...style,
      }}
    >
      <OptionGroup
        pill
        inverse
        options={options ?? ['Все', 'С пометками', 'Готовые']}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
      />
    </div>
  );
});
