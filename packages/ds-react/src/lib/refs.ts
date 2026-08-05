import type { MutableRefObject, Ref } from 'react';

/**
 * Отдать узел ВНЕШНЕМУ ref, не отнимая его у своего.
 *
 * У пяти компонентов корень уже держит собственный ref: OptionGroup и Tabs меряют им
 * скользящую подложку, Slider крутит желе, Input перезапускает анимацию отказа, PinComposer
 * ставит автофокус. Просто заменить его пришедшим сверху нельзя — компонент перестанет
 * работать; просто проигнорировать пришедший тоже нельзя — потребитель получит пустой ref
 * и полезет в DOM запросом мимо контракта. Поэтому оба.
 */
export function setRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (!ref) return;
  if (typeof ref === 'function') ref(node);
  else (ref as MutableRefObject<T | null>).current = node;
}
