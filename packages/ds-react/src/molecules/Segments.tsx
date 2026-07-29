import type { CSSProperties } from 'react';
import { OptionGroup } from '../atoms/OptionGroup';

export interface SegmentsProps {
  options?: string[];
  value?: number;
  defaultValue?: number;
  onChange?: (index: number) => void;
  style?: CSSProperties;
}

/** Тонкая обёртка над OptionGroup (pill + inverse): поведение скользящей пилюли живёт в одном месте. */
export function Segments({ options, value, defaultValue = 0, onChange, style }: SegmentsProps) {
  return (
    <div
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
}
