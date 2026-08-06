/* Разделы витрины, у которых нет своего компонента.
 *
 * Tooltip — не компонент, а атрибут `data-tooltip` со стилем в ds.css: подпись к элементу,
 * у которого нет своей надписи. «Пины на канвасе» — экранный сценарий из трёх компонентов,
 * а не четвёртый компонент. Оба раздела были в DC-витрине и обязаны быть здесь: без них
 * тултип выглядит незадокументированным, а сценарий постановки пина — несуществующим.
 */
import { useState } from 'react';
import { Button, Pin as PinDrop, PinCard, PinComposer, type PinMessage } from '../packages/ds-react/src/index';

/** Пин канваса: точка привязки, своё сообщение и СПИСОК ответов. */
interface Pin {
  x: number;
  y: number;
  key?: string;
  text?: string;
  resolved?: boolean;
  replies: PinMessage[];
}

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

/**
 * Сценарий: клик по полотну ставит пин с композером, тред открывается по клику на пин.
 *
 * Проза раздела обещала пять вещей, которых сцена не делала. Каждая — не украшение,
 * а поведение, которое потребитель скопирует к себе:
 *   — «решённый пин гаснет» — проп `resolved` в Pin не передавался вовсе;
 *   — точка непрочитанного ответа зажигалась от СВОЕГО первого сообщения, а не от ответа;
 *   — «у правого края карточка отражается влево» — она всегда стояла по левому краю и
 *     уезжала под обрез канваса: у правого края от композера были видны аватар и буква;
 *   — «наведение даёт превью» — превью не было, хотя PinCard умеет variant='preview';
 *   — ответ человека подписывался «AI», и слот был ОДИН: второй ответ затирал первый.
 */
export function PinCanvas() {
  const [pins, setPins] = useState<Pin[]>([
    { x: 28, y: 34, text: 'Логотип уезжает за охранное поле на мобильном.', replies: [] },
  ]);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Панель канваса: показывать пины, видны ли решённые, очистка. Это ответственность
  // ЭКРАНА, а не компонента — Pin про своё состояние знает, про режим просмотра нет.
  const [show, setShow] = useState(true);
  const [withResolved, setWithResolved] = useState(true);
  const visible = (p: Pin) => show && (withResolved || !p.resolved);
  const patch = (i: number, next: Partial<Pin>) => setPins((list) => list.map((it, k) => (k === i ? { ...it, ...next } : it)));

  return (
    <div
      onClick={(e) => {
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPins((p) => [
          ...p,
          { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100, replies: [] },
        ]);
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
      {pins.map((p, i) => {
        if (!visible(p)) return null;
        // ОТРАЖЕНИЕ У КРАЯ. Карточка растёт из точки привязки, и у правого края расти
        // вправо некуда: канвас режет её overflow'ом. Порог — не «половина», а место
        // под саму карточку: 360px на канвасе шириной около 900 это примерно 40%.
        const flip = p.x > 58;
        const side = flip ? { right: 0 } : { left: 0 };
        return (
          <span key={p.key ?? i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%` }} onClick={(e) => e.stopPropagation()}>
            {/* Клик слушает обёртка: у Pin нет собственного onClick, и переданный проп
                молча терялся — тред не открывался никогда. */}
            <span
              // Хуки сцены: они нужны гейту, чтобы отличить каплю от карточки, а превью
              // от треда — у самих компонентов такого признака нет и заводить его им
              // незачем. Это разметка ЭКРАНА, как и всё остальное в сценарии.
              data-scene-pin={String(i)}
              onClick={() => {
                setOpen(open === i ? null : i);
                setHover(null);
              }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              style={{ display: 'inline-block', cursor: 'pointer' }}
            >
              <PinDrop number={i + 1} resolved={p.resolved} hasReply={p.replies.length > 0} />
            </span>
            {draft === i ? (
              <span data-scene-composer="" style={{ position: 'absolute', top: 'calc(100% + 8px)', ...side, width: 320, display: 'block' }}>
                <PinComposer
                  author="Марина Ковалёва"
                  onSend={(text: string) => {
                    patch(i, { text });
                    setDraft(null);
                  }}
                  onCancel={() => {
                    setPins((list) => list.filter((_, k) => k !== i));
                    setDraft(null);
                  }}
                />
              </span>
            ) : null}
            {/* Превью по наведению: только текст первого сообщения, без действий. Открытый
                тред его перебивает — двух карточек над одним пином быть не должно. */}
            {hover === i && open !== i && draft !== i && p.text ? (
              <span data-scene-preview="" style={{ position: 'absolute', top: 'calc(100% + 8px)', ...side, width: 280, display: 'block', pointerEvents: 'none' }}>
                <PinCard variant="preview" author="Марина Ковалёва" messages={[{ author: 'Марина Ковалёва', text: p.text }]} />
              </span>
            ) : null}
            {open === i && p.text ? (
              <span data-scene-thread="" style={{ position: 'absolute', top: 'calc(100% + 8px)', ...side, width: 360, display: 'block' }}>
                <PinCard
                  author="Марина Ковалёва"
                  resolved={p.resolved}
                  messages={[
                    { author: 'Марина Ковалёва', text: p.text },
                    // Ответы — СПИСОК, а не одно поле: второй ответ не имеет права затирать
                    // первый. Автора несёт сама запись, поэтому ответ человека и подписан
                    // человеком: раньше любой ответ рендерился как «AI».
                    ...p.replies,
                  ]}
                  onResolve={() => {
                    patch(i, { resolved: !p.resolved });
                    setOpen(null);
                  }}
                  onClose={() => setOpen(null)}
                  onSend={(text: string) => {
                    patch(i, { replies: [...p.replies, { author: 'Пётр Соколов', text }] });
                  }}
                />
              </span>
            ) : null}
          </span>
        );
      })}
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
            setPins((list) =>
              list.map((x) =>
                x.resolved || !x.text
                  ? x
                  : { ...x, replies: [...x.replies, { author: 'AI', text: 'Поправил охранное поле и перевыгрузил формат.', ai: true }] }
              )
            )
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
