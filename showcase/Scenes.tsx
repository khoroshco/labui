/* Разделы витрины, у которых нет своего компонента.
 *
 * Tooltip — не компонент, а атрибут `data-tooltip` со стилем в ds.css: подпись к элементу,
 * у которого нет своей надписи. «Пины на канвасе» — экранный сценарий из трёх компонентов,
 * а не четвёртый компонент. Оба раздела были в DC-витрине и обязаны быть здесь: без них
 * тултип выглядит незадокументированным, а сценарий постановки пина — несуществующим.
 */
import { useState } from 'react';
import { Button, Pin, PinCard, PinComposer } from '../packages/ds-react/src/index';

const frame = {
  display: 'flex',
  gap: 'var(--sp-4)',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--sp-6)',
  background: 'var(--bg-surface)',
  borderRadius: 'var(--r-m)',
} as const;

export function Tooltip() {
  return (
    <div style={frame}>
      <Button icon="gear" variant="ghost" tooltip="Настройки формата" />
      <Button icon="trash-bin" variant="ghost" tone="danger" tooltip="Удалить" />
      <Button icon="arrow-down-to-line" variant="secondary" tooltip="Выгрузить" />
      <Button icon="lock" variant="ghost" disabled tooltip="Выключенное подсказку не показывает" />
      {/* Главное демо раздела: тултип — АТРИБУТ, а не компонент, и работает на чём угодно. */}
      <span data-tooltip="Работает на любом элементе" style={{ color: 'var(--text-secondary)', borderBottom: '1px dashed var(--border-subtle)' }}>
        просто текст с подсказкой
      </span>
    </div>
  );
}

/** Сценарий: клик по полотну ставит пин с композером, тред открывается по клику на пин. */
export function PinCanvas() {
  const [pins, setPins] = useState<{ x: number; y: number; text?: string }[]>([
    { x: 28, y: 34, text: 'Логотип уезжает за охранное поле на мобильном.' },
  ]);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<number | null>(null);

  return (
    <div
      onClick={(e) => {
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPins((p) => [...p, { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 }]);
        setDraft(pins.length);
        setOpen(null);
      }}
      style={{
        position: 'relative',
        height: 320,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-m)',
        overflow: 'hidden',
        cursor: 'crosshair',
      }}
    >
      {pins.map((p, i) => (
        <span key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%` }} onClick={(e) => e.stopPropagation()}>
          {/* Клик слушает обёртка: у Pin нет собственного onClick, и переданный проп
              молча терялся — тред не открывался никогда. */}
          <span onClick={() => setOpen(open === i ? null : i)} style={{ display: 'inline-block', cursor: 'pointer' }}>
            <Pin number={i + 1} hasReply={!!p.text} />
          </span>
          {draft === i ? (
            <span style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 320, display: 'block' }}>
              <PinComposer
                author="Марина Ковалёва"
                onSend={(text: string) => {
                  setPins((list) => list.map((it, k) => (k === i ? { ...it, text } : it)));
                  setDraft(null);
                }}
                onCancel={() => {
                  setPins((list) => list.filter((_, k) => k !== i));
                  setDraft(null);
                }}
              />
            </span>
          ) : null}
          {open === i && p.text ? (
            <span style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 360, display: 'block' }}>
              <PinCard
                author="Марина Ковалёва"
                messages={[{ author: 'Марина Ковалёва', text: p.text }]}
                onClose={() => setOpen(null)}
                onSend={() => setOpen(null)}
              />
            </span>
          ) : null}
        </span>
      ))}
      <span
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: 'var(--sp-3)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--fs-xs)',
        }}
      >
        кликните по полотну, чтобы поставить пин
      </span>
    </div>
  );
}
