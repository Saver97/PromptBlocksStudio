'use strict';

// Transient view state. Searching a block never changes its prompt or undo history.
const BlockSearch = (() => {
  const queries = new Map();
  const key = block => JSON.stringify([scheme().id, block.id]);

  function matcher(query) {
    return query ? new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu') : null;
  }

  function highlight(target, text, pattern) {
    const parts = document.createDocumentFragment();
    let end = 0, count = 0;
    if (pattern) {
      for (const match of text.matchAll(pattern)) {
        parts.append(text.slice(end, match.index), el('mark', 'block-find-hit', match[0]));
        end = match.index + match[0].length;
        count++;
      }
    }
    parts.append(text.slice(end));
    target.replaceChildren(parts);
    return count;
  }

  // Textareas only support plain text. Paint match backgrounds over the native
  // editor so selection, IME composition, clipboard and undo still use the field.
  class FindSurface extends HTMLElement {
    connectedCallback() {
      this.field = this.querySelector('textarea,input');
      this.paint = this.querySelector('.block-find-paint');
      this.observer = new ResizeObserver(() => this.align());
      this.observer.observe(this.field);
      this.field.addEventListener('scroll', this);
      this.align();
    }
    disconnectedCallback() {
      this.observer?.disconnect();
      this.field?.removeEventListener('scroll', this);
    }
    handleEvent() {
      this.paint.scrollTop = this.field.scrollTop;
      this.paint.scrollLeft = this.field.scrollLeft;
    }
    align() {
      const field = this.field, layer = this.paint;
      if (!field.clientWidth || layer.hidden) return;
      const css = getComputedStyle(field);
      for (const prop of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing',
        'wordSpacing','textAlign','textIndent','tabSize','direction','padding','wordBreak']) {
        layer.style[prop] = css[prop];
      }
      Object.assign(layer.style, {
        left: field.offsetLeft + field.clientLeft + 'px', top: field.offsetTop + field.clientTop + 'px',
        width: field.clientWidth + 'px', height: field.clientHeight + 'px'
      });
      if (field.tagName === 'INPUT') {
        layer.style.whiteSpace = 'pre';
        layer.style.lineHeight = field.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) + 'px';
      }
      this.handleEvent();
    }
  }
  customElements.define('block-find-surface', FindSurface);

  function paintField(field, pattern) {
    let surface = field.closest('block-find-surface');
    if (!surface && !pattern) return 0;
    if (!surface) {
      surface = document.createElement('block-find-surface');
      const layer = el('span', 'block-find-paint');
      layer.setAttribute('aria-hidden', 'true');
      // Mount the completed surface in one step (connectedCallback needs both children).
      const anchor = document.createComment('find');
      field.before(anchor);
      surface.append(field, layer);
      anchor.replaceWith(surface);
    }
    const layer = surface.querySelector('.block-find-paint');
    const count = highlight(layer, field.value, pattern);
    layer.hidden = !count;
    if (count) {
      layer.append('\u200b'); // Preserve a final empty line at the bottom scroll position.
      if (surface.isConnected) surface.align();
    }
    return count;
  }

  function searchBar(initial, draw) {
    const bar = el('div', 'block-find-bar'), input = el('input'), status = el('small', 'muted');
    input.type = 'search';
    input.placeholder = '输入要查找的文字';
    input.setAttribute('aria-label', '搜索本块文字');
    status.setAttribute('role', 'status');
    input.value = initial;
    const refresh = () => {
      const count = draw(input.value, matcher(input.value));
      status.textContent = input.value ? count + ' 处匹配' : '';
    };
    input.oninput = refresh;
    input.onkeydown = event => {
      if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
    };
    bar.append(input, status);
    return {bar, input, refresh};
  }

  function attach(card, actions, block) {
    const id = key(block);
    function toggle() {
      if (queries.has(id)) queries.delete(id);
      else queries.set(id, '');
      renderBlocks();
      const current = document.querySelector('[data-block-id="'+CSS.escape(block.id)+'"]');
      (current?.querySelector('.block-find-bar input') || current?.querySelector('.block-find-toggle'))?.focus();
    }
    const button = btn('搜索', '搜索块 '+block.name, toggle, 'block-find-toggle');
    button.setAttribute('aria-expanded', String(queries.has(id)));
    actions.children[0].after(button);
    if (!queries.has(id)) return;
    const {bar, refresh} = searchBar(queries.get(id), (query, pattern) => {
      queries.set(id, query);
      let count = 0;
      for (const text of card.querySelectorAll('.prose-source,.prose-english')) {
        count += highlight(text, text.textContent, pattern);
      }
      for (const chip of card.querySelectorAll('.edit-token')) {
        chip.querySelector('.block-find-alias')?.remove();
        const label = chip.textContent;
        count += highlight(chip, label, pattern);
        if (pattern && chip.title !== label && chip.title.match(pattern)) {
          const alias = el('span', 'block-find-alias');
          count += highlight(alias, chip.title, pattern);
          chip.append(alias);
        }
      }
      for (const field of card.querySelectorAll('textarea')) count += paintField(field, pattern);
      return count;
    });
    actions.after(bar);
    card.querySelector('textarea')?.addEventListener('input', refresh);
    refresh();
  }

  function editor(block, fields) {
    const {bar, refresh} = searchBar(queries.get(key(block)) || '', (_, pattern) =>
      fields.reduce((count, field) => count + paintField(field, pattern), 0));
    // Keep the original initial focus on the name/text field.
    const firstGroup = fields[0].closest('.translation-pair') || fields[0].closest('label');
    firstGroup.before(bar);
    for (const field of fields) field.addEventListener('input', refresh);
    refresh();
  }
  return {attach, editor, isOpen: block => queries.has(key(block)), close: block => queries.delete(key(block))};
})();
