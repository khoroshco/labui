import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { passThrough, type PassThrough } from '../lib/passthrough.js';
import { Avatar } from '../atoms/Avatar.js';
import { Button } from '../atoms/Button.js';
import { PinComposer } from './PinComposer.js';

/** Автор сообщения называется author — как у Avatar, PinComposer и самой карточки.
 *  Поле name осталось принимаемым: так его звал эталон, ломать чужой конфиг не за что. */
export type PinMessage =
  | { ai: true; text: string }
  | { ai?: false; text: string; author?: string; name?: string; src?: string };

export interface PinCardProps extends PassThrough {
  messages?: PinMessage[];
  variant?: 'thread' | 'preview';
  /** Решённый пин гаснет, но не исчезает: контекст обсуждения остаётся на месте. */
  resolved?: boolean;
  author?: string;
  onClick?: () => void;
  onResolve?: (resolved: boolean) => void;
  onSend?: (text: string) => void;
  onClose?: () => void;
  style?: CSSProperties;
}

/**
 * Тред у пина в языке островов: сообщения — ряды с сепараторами, композер — нижний ряд.
 * Вариант preview (ховер) показывает только текст первого сообщения, кламп в три строки.
 *
 * Это поповер, а не модалка: жёсткий focus-trap был бы регрессом (из Tab не выйти).
 * Клавиатурный выход — Esc и клик мимо; возврат фокуса делает PinComposer.
 */
export function PinCard({
  messages = [],
  variant = 'thread',
  resolved = false,
  author = '',
  onClick,
  onResolve,
  onSend,
  onClose,
  style,
  ...rest
}: PinCardProps) {
  const isPreview = variant === 'preview';
  const hasResolve = !!onResolve && !isPreview;
  const hasComposer = !!onSend && !isPreview && !resolved;

  return (
    <div
      {...passThrough(rest)}
      tabIndex={isPreview ? undefined : -1}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape' && onClose) {
          e.stopPropagation();
          onClose();
        }
      }}
      onClick={onClick}
      data-press="true"
      // Плавающая поверхность: отделена от полотна ТЕНЬЮ, а Windows High Contrast её
      // вырезает — карточка сливалась с тем, что под ней. По этому хуку ds.css возвращает
      // ей край границей, которую режим переживает. У эталона хука нет: он заморожен.
      data-float="true"
      style={{
        position: 'relative',
        width: isPreview ? 'max-content' : 'auto',
        maxWidth: '100%',
        background: 'var(--bg-float)',
        borderRadius: 'var(--r-m)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        cursor: 'pointer',
        opacity: resolved ? '.55' : '1',
        transition: 'opacity .2s ease',
        ...style,
      }}
    >
      {isPreview ? (
        <div
          style={{
            padding: 'var(--sp-35) var(--sp-4) var(--sp-35) var(--sp-35)',
            maxWidth: '280px',
            fontSize: 'var(--fs-m)',
            fontWeight: 'var(--fw-regular)',
            color: 'var(--text-primary)',
            lineHeight: 'var(--lh-text)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as CSSProperties['WebkitBoxOrient'],
            overflow: 'hidden',
          }}
        >
          {messages.length ? (messages[0]?.text ?? '') : ''}
        </div>
      ) : (
        <>
          {hasResolve ? (
            <span style={{ position: 'absolute', top: 'var(--sp-2)', right: 'var(--sp-2)', zIndex: 2 }}>
              <Button
                icon={resolved ? 'circle-check-fill' : 'circle-check'}
                variant="ghost"
                size="xs"
                // tone — только ok|danger; «нет тона» это отсутствие тона, а не строка
                tone={resolved ? 'ok' : undefined}
                tooltip={resolved ? 'Вернуть' : 'Решено'}
                onClick={() => onResolve?.(!resolved)}
              />
            </span>
          ) : null}
          {messages.map((m, i) => {
            const isAi = !!m.ai;
            const name = 'ai' in m && m.ai ? '' : ((m as { author?: string; name?: string }).author ?? (m as { name?: string }).name ?? '');
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-25)',
                  padding: 'var(--sp-3) var(--sp-4)',
                  paddingRight: i === 0 && hasResolve ? 'var(--touch-target)' : 'var(--sp-4)',
                  borderTop: i === 0 ? 'none' : '0.5px solid var(--border-subtle)',
                  animation: 'ds-fade .3s ease',
                }}
              >
                <Avatar author={name} src={'src' in m ? (m.src ?? '') : ''} ai={isAi} size="s" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', minWidth: 0, flex: 1 }}>
                  {isAi ? (
                    <span
                      // хук forced-colors: подпись AI набрана градиентом, и это её смысл
                      data-ai-grad="true"
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 'var(--fw-medium)',
                        lineHeight: 'var(--lh-ui)',
                        letterSpacing: 'var(--ls-caps-s)',
                        // всё от имени AI — всегда в фирменном градиенте
                        background: 'var(--ai-grad)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }}
                    >
                      AI
                    </span>
                  ) : null}
                  {!isAi && name ? (
                    <span
                      style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 'var(--fw-regular)',
                        lineHeight: 'var(--lh-ui)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {name}
                    </span>
                  ) : null}
                  <div
                    style={{
                      fontSize: 'var(--fs-m)',
                      fontWeight: 'var(--fw-regular)',
                      color: isAi ? 'var(--text-secondary)' : 'var(--text-primary)',
                      lineHeight: 'var(--lh-text)',
                      textWrap: 'pretty' as CSSProperties['textWrap'],
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })}
          {hasComposer ? (
            <div
              onClick={(e: MouseEvent) => e.stopPropagation()}
              style={{ borderTop: '0.5px solid var(--border-subtle)', padding: 'var(--sp-2)', cursor: 'default' }}
            >
              <PinComposer bare placeholder="Ответить…" author={author} onSend={onSend} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
