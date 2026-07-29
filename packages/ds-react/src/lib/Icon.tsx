import type { CSSProperties } from 'react';
import { ICONS, type IconName } from './icons.generated';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number | string;
  /** Смысловой иконке — имя; без него иконка декоративна и скрыта от скринридера. */
  label?: string;
  style?: CSSProperties;
}

/**
 * Замена веб-компонента g-icon. Разметка та же: инлайновый svg, цвет из currentColor,
 * по умолчанию декоративна. Отличие одно — svg приходит из сборки, а не по сети:
 * несуществующее имя теперь не компилируется, а не рисует пустоту.
 */
export function Icon({ name, size = 16, label, style }: IconProps) {
  const px = typeof size === 'number' ? `${size}px` : size;
  const svg = ICONS[name].replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
  const aria = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <span
      {...aria}
      style={{ display: 'inline-flex', width: px, height: px, flex: 'none', ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
