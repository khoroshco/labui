import { useRef, type CSSProperties } from 'react';
import { Icon } from '../lib/Icon';

export type MsgLevel = 'ok' | 'warn' | 'danger';

export interface RowMsgProps {
  text?: string;
  level?: MsgLevel;
  style?: CSSProperties;
}

/**
 * Сообщение валидации ряда. Открыто только у warn и danger: ok означает «сообщения нет».
 *
 * Выход — жест ОДНОГО сообщения: пока полоса схлопывается, она обязана выглядеть так же,
 * как выглядела открытой. Поэтому последний показанный уровень и текст запоминаются:
 * иначе ok проваливался в ветку danger и на 200 мс краснел, а текст исчезал мгновенно.
 */
export function RowMsg({ text = '', level = 'ok', style }: RowMsgProps) {
  const open = !!text && (level === 'danger' || level === 'warn');
  const shownLevel = useRef<MsgLevel>('danger');
  const shownMsg = useRef('');
  if (open) {
    shownLevel.current = level;
    shownMsg.current = text;
  }
  const shown = open ? level : shownLevel.current;
  const isWarn = shown === 'warn';

  return (
    <span
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: open ? 'grid-template-rows .3s var(--ease-out)' : 'grid-template-rows .2s var(--ease-in)',
        ...style,
      }}
    >
      <span style={{ overflow: 'hidden', minHeight: 0, display: 'block' }}>
        <span
          // ошибка озвучивается при появлении; закрытое сообщение живой областью быть
          // перестаёт — иначе уходящий текст переозвучивался бы после исправления
          role={!open ? 'presentation' : level === 'danger' ? 'alert' : 'status'}
          aria-live={!open ? 'off' : level === 'danger' ? 'assertive' : 'polite'}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--sp-15)',
            padding: '0 0 var(--sp-3)',
            fontSize: 'var(--fs-s)',
            fontWeight: 'var(--fw-regular)',
            color: isWarn ? 'var(--warn)' : 'var(--danger)',
            lineHeight: 'var(--lh-ui)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', height: '16px', flex: 'none', position: 'relative', top: '-1px' }}>
            <Icon name={isWarn ? 'triangle-exclamation-fill' : 'circle-exclamation-fill'} size={12} />
          </span>
          {open ? text : shownMsg.current}
        </span>
      </span>
    </span>
  );
}
