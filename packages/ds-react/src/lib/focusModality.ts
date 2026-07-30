/**
 * Помечает `<html data-modality="kb|mouse">`: фокус-кольца показываются только после
 * клавиатуры, залётный фокус мышью кольца не даёт.
 *
 * Это не украшение и не опция: ВСЕ правила фокуса в `ds.css` обусловлены
 * `html[data-modality="kb"]`. Без этого атрибута у потребителя нет ни одного видимого
 * индикатора фокуса — то есть провал WCAG 2.4.7. Поэтому пакет ставит его сам при импорте,
 * а не просит подключить отдельный скрипт (ревью нашло ровно эту дыру).
 */
let installed = false;

export function installFocusModality(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const set = (m: 'kb' | 'mouse') => document.documentElement.setAttribute('data-modality', m);
  set('mouse');
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') set('kb');
    },
    true
  );
  window.addEventListener('pointerdown', () => set('mouse'), true);
}
