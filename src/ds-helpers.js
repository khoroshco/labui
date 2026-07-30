/* Banner Lab — общие хелперы-поведения (без визуала). Загружается в helmet тех компонентов,
   что их используют. Убирает дублирование логики между компонентами (см. аудит ДС). */
(() => {
  // ── Анти-мерцание лоадера ──────────────────────────────────────────────
  // Факт загрузки приходит пропсом сразу (ввод блокируется немедленно), но ВИЗУАЛ
  // лоадера показываем только если загрузка длится дольше SHOW_DELAY, а показавшись —
  // держим минимум MIN_VISIBLE (не мигает на исчезновении). Одна реализация на Button, InputRow, …
  const SHOW_DELAY = 320, MIN_VISIBLE = 450;
  window.DSSpin = function (host) {
    // host: { isLoading:()=>bool, getSpin:()=>bool, setSpin:(bool)=>void }
    let showT = null, hideT = null, shownAt = 0;
    return {
      sync() {
        if (host.isLoading()) {
          if (hideT) { clearTimeout(hideT); hideT = null; }
          if (!showT && !host.getSpin()) {
            showT = setTimeout(() => { showT = null; if (host.isLoading()) { shownAt = performance.now(); host.setSpin(true); } }, SHOW_DELAY);
          }
        } else {
          if (showT) { clearTimeout(showT); showT = null; }
          if (host.getSpin() && !hideT) {
            const left = Math.max(0, MIN_VISIBLE - (performance.now() - shownAt));
            if (!left) { host.setSpin(false); return; }
            hideT = setTimeout(() => { hideT = null; if (!host.isLoading()) host.setSpin(false); }, left);
          }
        }
      },
      dispose() { clearTimeout(showT); clearTimeout(hideT); },
    };
  };

  // ── Скользящая подложка (пилюля / подчёркивание) ───────────────────────
  // Активный дочерний <button> измеряется, ResizeObserver держит геометрию актуальной.
  // Одна реализация на OptionGroup и Tabs (и всё, что скользит подложкой к активной кнопке).
  window.dsTrackActive = function (host) {
    // host: { box:()=>el, index:()=>number, onRect:(rect|null)=>void }
    let ro = null;
    const measure = () => {
      const box = host.box(); if (!box) return;
      const b = box.querySelectorAll('button')[host.index()];
      host.onRect(b ? { left: b.offsetLeft, w: b.offsetWidth } : null);
    };
    // Наблюдать надо и сами кнопки, а не только контейнер: у Tabs контейнер блочный и его
    // ширина от подписей не зависит. Первое измерение попадает на подменный шрифт (Unica
    // грузится асинхронно), кнопка потом сужается — а контейнер нет, поэтому перемеры не
    // случалось никогда и подчёркивание оставалось на 6px шире вкладки. У OptionGroup
    // контейнер по содержимому, там ширина менялась и баг не проявлялся.
    const observeAll = () => {
      const box = host.box(); if (!box || !ro) return;
      ro.observe(box);
      for (const b of box.querySelectorAll('button')) ro.observe(b);
    };
    return {
      mount() { measure(); ro = new ResizeObserver(measure); observeAll(); },
      update() { observeAll(); measure(); },
      unmount() { if (ro) ro.disconnect(); },
    };
  };

  // ── Каретка текстового поля ────────────────────────────────────────────
  const caretEnd = (inp) => { inp.focus(); const L = inp.value.length; inp.setSelectionRange(L, L); };
  window.dsCaretEnd = caretEnd;
  // клик по пустой зоне поля (слева от прижатого вправо текста) → каретка в конец.
  // Одна реализация на Input и InputRow.
  window.dsCaretFromClick = function (inp, e, pad = 6) {
    const cs = getComputedStyle(inp);
    const ctx = (window.__dsMeasureCtx ??= document.createElement('canvas').getContext('2d'));
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const textLeft = inp.getBoundingClientRect().right - ctx.measureText(inp.value).width;
    if (e.clientX < textLeft - pad) { e.preventDefault(); caretEnd(inp); }
  };

  // ── prefers-reduced-motion для JS-анимаций ─────────────────────────────
  // CSS уже уважает настройку (ds.css); JS-анимации (Slider-желе, скольжение) читают этот флаг.
  window.dsReducedMotion = () =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
})();

