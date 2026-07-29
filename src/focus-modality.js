/* Помечает <html data-modality="kb|mouse"> — фокус-кольца показываем только после клавиатуры */
(() => {
  const set = (m) => document.documentElement.setAttribute('data-modality', m);
  set('mouse');
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') set('kb');
  }, true);
  window.addEventListener('pointerdown', () => set('mouse'), true);
})();
