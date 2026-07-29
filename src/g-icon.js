/* <g-icon name="magnifier" size="16"> — инлайнит SVG из svgs/, цвет = currentColor.
   Семантика: по умолчанию декоративна (aria-hidden). Смысловой иконке — атрибут label:
   <g-icon name="circle-check" label="Готово"> → role="img" + aria-label. */
(() => {
  if (customElements.get('g-icon')) return;
  const cache = {};
  class GIcon extends HTMLElement {
    static get observedAttributes() { return ['name', 'size', 'label']; }
    attributeChangedCallback() { this._render(); this._aria(); }
    connectedCallback() { this._render(); this._aria(); }
    _aria() {
      const label = this.getAttribute('label');
      if (label) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', label); this.removeAttribute('aria-hidden'); }
      else { this.setAttribute('aria-hidden', 'true'); this.removeAttribute('role'); this.removeAttribute('aria-label'); }
    }
    async _render() {
      const name = this.getAttribute('name');
      const size = this.getAttribute('size') || 16;
      this.style.display = 'inline-flex';
      this.style.width = size + 'px';
      this.style.height = size + 'px';
      this.style.flex = 'none';
      if (!name) return;
      if (!cache[name]) {
        cache[name] = fetch('svgs/' + name + '.svg').then(r => {
          if (!r.ok) { delete cache[name]; return ''; } // не кэшируем неудачу
          return r.text();
        }).catch(() => { delete cache[name]; return ''; });
      }
      const svg = await cache[name];
      if (this.getAttribute('name') !== name || !this.isConnected) return;
      this.innerHTML = svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
    }
  }
  customElements.define('g-icon', GIcon);
})();
