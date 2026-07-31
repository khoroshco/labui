import type { CSSProperties } from 'react';
import { passThrough, type PassThrough } from './passthrough.js';
import { ICONS, type IconName } from './icons.generated.js';

export type { IconName };

export interface IconProps extends PassThrough {
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
export function Icon({ name, size = 16, label, style,
  ...rest
}: IconProps) {
  const px = typeof size === 'number' ? `${size}px` : size;
  // Имена приходят и из данных (конфиг рядов, JSON), поэтому неизвестное имя обязано
  // оставить пустое место, а не уронить рендер: у веб-компонента g-icon было так же.
  const raw = ICONS[name];
  const svg = raw ? raw.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ') : '';
  const aria = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <span
      {...passThrough(rest)}
      {...aria}
      style={{ display: 'inline-flex', width: px, height: px, flex: 'none', ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
