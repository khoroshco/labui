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
  const [pins, setPins] = useState<{ x: number; y: number; text?: string; resolved?: boolean; reply?: string }[]>([
    { x: 28, y: 34, text: 'Логотип уезжает за охранное поле на мобильном.' },
  ]);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  // Панель канваса: показывать пины, видны ли решённые, очистка. Это ответственность
  // ЭКРАНА, а не компонента — Pin про своё состояние знает, про режим просмотра нет.
  const [show, setShow] = useState(true);
  const [withResolved, setWithResolved] = useState(true);
  const visible = (p: { resolved?: boolean }) => show && (withResolved || !p.resolved);

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
      {pins.map((p, i) => (visible(p) ? (
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
                resolved={p.resolved}
                messages={[
                  { author: 'Марина Ковалёва', text: p.text },
                  // Ответ AI — обычное сообщение треда с автором-роботом: отдельного
                  // режима у карточки нет, потому что тред один и тот же.
                  ...(p.reply ? [{ author: 'AI', text: p.reply, ai: true }] : []),
                ]}
                onResolve={() => {
                  setPins((list) => list.map((it, k) => (k === i ? { ...it, resolved: !it.resolved } : it)));
                  setOpen(null);
                }}
                onClose={() => setOpen(null)}
                onSend={(text: string) => {
                  setPins((list) => list.map((it, k) => (k === i ? { ...it, reply: text } : it)));
                  setOpen(null);
                }}
              />
            </span>
          ) : null}
        </span>
      ) : null))}
      {/* Панель канваса. Режим просмотра — ответственность ЭКРАНА: Pin знает про своё
          состояние и не знает, показывают ли его сейчас. */}
      <span
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 'var(--sp-3)', insetInlineEnd: 'var(--sp-3)', display: 'flex', gap: 'var(--sp-15)' }}
      >
        <Button
          label={show ? 'Пины видны' : 'Пины скрыты'}
          icon={show ? 'eye' : 'eye-slash'}
          variant="secondary"
          size="xs"
          onClick={() => setShow((v) => !v)}
        />
        <Button
          label="Решённые"
          icon={withResolved ? 'check' : 'xmark'}
          variant="ghost"
          size="xs"
          onClick={() => setWithResolved((v) => !v)}
        />
        <Button
          label="Очистить"
          icon="trash-bin"
          variant="ghost"
          tone="danger"
          size="xs"
          onClick={() => {
            setPins([]);
            setOpen(null);
            setDraft(null);
          }}
        />
        <Button
          label={`Отправить в AI · ${pins.filter((x) => !x.resolved && x.text).length}`}
          variant="primary"
          size="xs"
          onClick={() =>
            setPins((list) => list.map((x) => (x.resolved || !x.text ? x : { ...x, reply: 'Поправил охранное поле и перевыгрузил формат.' })))
          }
        />
      </span>
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
