'use strict';

// Transient view state. Searching a block never changes its prompt or undo history.
const BlockSearch = (() => {
  const queries = new Map();
  const traitFilters = new Set();
  const key = block => JSON.stringify([scheme().id, block.id]);

  // WD14 反推换角色时最常需要剔除的原角色特征：发型发色、瞳色瞳孔、兽耳/角/翼、脸部特征及内置角色/作品名。
  const TRAIT_EN = /\b(hair|twintails?|ponytail|braids?|bun|double bun|hair bun|bob cut|hime cut|bangs?|fringe|ahoge|sidelocks|hair intakes|hair ribbon|hairpin|hair ornament|hairclip|hairband|headband|hairbow|hair bow|hair flower|eyes?|heterochromia|pupils?|eyebrows?|eyelashes|eyepatch|blindfold|glasses|animal ears|cat ears|fox ears|dog ears|wolf ears|rabbit ears|bunny ears|elf ears|pointy ears|horse ears|cow ears|mouse ears|rat ears|horns?|halo|wings?|tail|beauty mark|mole|freckles|fang|fangs|tan|dark skin|pale skin|blue skin|grey skin|pointed ears)\b/i;
  const TRAIT_ZH = /长发|短发|直发|卷发|波波头|双马尾|马尾|麻花辫|编发|发髻|刘海|呆毛|发饰|发夹|发带|发箍|发簪|发梢|挑染|眼睛|瞳|异色瞳|竖瞳|眼罩|猫耳|狐耳|犬耳|兔耳|狼耳|鼠耳|精灵耳|兽耳|双角|机械角|光环|翅膀|尾巴|泪痣|雀斑|虎牙/;
  let presetIdentitySet = null;
  function isCharacterTrait(token) {
    if (!presetIdentitySet && typeof Blocks !== 'undefined' && Array.isArray(Blocks.characterPresets)) {
      presetIdentitySet = new Set();
      for (const preset of Blocks.characterPresets) {
        if (preset.name) presetIdentitySet.add(norm(preset.name));
        if (preset.label) presetIdentitySet.add(norm(preset.label));
        for (const tag of Blocks.identityTokens(preset)) presetIdentitySet.add(norm(tag));
      }
    }
    const text = token.text || '', label = token.label || '';
    const normalized = norm(text);
    if (presetIdentitySet?.has(normalized)) return true;
    return TRAIT_EN.test(normalized) || TRAIT_ZH.test(label);
  }

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
      if (queries.has(id)) { queries.delete(id); traitFilters.delete(id); }
      else queries.set(id, '');
      renderBlocks();
      const current = document.querySelector('[data-block-id="'+CSS.escape(block.id)+'"]');
      (current?.querySelector('.block-find-bar input') || current?.querySelector('.block-find-toggle'))?.focus();
    }
    const button = btn('搜索', '搜索块 '+block.name, toggle, 'block-find-toggle');
    button.setAttribute('aria-expanded', String(queries.has(id)));
    actions.children[0].after(button);
    if (!queries.has(id)) return;
    let matchedTokens = [];
    let batchDisable = null, batchRemove = null, traitBtn = null;
    const {bar, input, refresh} = searchBar(queries.get(id), (query, pattern) => {
      queries.set(id, query);
      const useTraits = block.kind !== 'prose' && traitFilters.has(id);
      let count = 0;
      matchedTokens = [];
      for (const text of card.querySelectorAll('.prose-source,.prose-english')) {
        count += highlight(text, text.textContent, pattern);
      }
      for (const chipEl of card.querySelectorAll('.token')) {
        delete chipEl.dataset.filterHit;
        const editBtn = chipEl.querySelector('.edit-token');
        if (!editBtn) continue;
        editBtn.querySelector('.block-find-alias')?.remove();
        const side = chipEl.dataset.tokenSide;
        const idx = Number(chipEl.dataset.tokenIndex);
        const tok = side && block[side] ? block[side][idx] : null;
        const label = tok ? (tok.label || tok.text) : editBtn.textContent;
        const rawText = tok ? tok.text : '';
        let hit = false;
        if (pattern) {
          const labelHits = highlight(editBtn, label, pattern);
          count += labelHits;
          if (labelHits > 0) hit = true;
          if (rawText && rawText !== label && rawText.match(pattern)) {
            const alias = el('span', 'block-find-alias');
            count += highlight(alias, rawText, pattern);
            editBtn.append(alias);
            hit = true;
          }
        } else {
          editBtn.textContent = label;
        }
        if (useTraits && tok && isCharacterTrait(tok)) {
          if (!hit) count++;
          hit = true;
          chipEl.dataset.filterHit = '1';
        }
        if (hit && tok) matchedTokens.push({side, token: tok});
      }
      for (const field of card.querySelectorAll('textarea')) count += paintField(field, pattern);
      if (batchDisable && batchRemove) {
        const enabledHits = matchedTokens.filter(m => m.token.enabled).length;
        batchDisable.disabled = !enabledHits;
        batchRemove.disabled = !matchedTokens.length;
        batchDisable.textContent = enabledHits ? `停用命中 (${enabledHits})` : '停用命中';
        batchRemove.textContent = matchedTokens.length ? `移除命中 (${matchedTokens.length})` : '移除命中';
      }
      return count;
    });
    if (block.kind !== 'prose') {
      const batch = el('div', 'block-find-actions');
      traitBtn = btn('筛外貌/角色词', '一键筛选原角色姓名、发型发色、瞳色、兽耳等外貌词条', () => {
        if (traitFilters.has(id)) traitFilters.delete(id);
        else traitFilters.add(id);
        traitBtn.setAttribute('aria-pressed', String(traitFilters.has(id)));
        traitBtn.classList.toggle('active', traitFilters.has(id));
        refresh();
        const status = bar.querySelector('small');
        if (!input.value && traitFilters.has(id)) status.textContent = matchedTokens.length + ' 个外貌/角色词';
      }, 'block-find-trait');
      traitBtn.setAttribute('aria-pressed', String(traitFilters.has(id)));
      traitBtn.classList.toggle('active', traitFilters.has(id));
      batchDisable = btn('停用命中', '停用当前命中的所有词条（可撤销）', () => {
        const targets = matchedTokens.filter(m => m.token.enabled);
        if (!targets.length) return;
        commit(() => { for (const {token} of targets) token.enabled = false; }, {scope: 'block', blockId: block.id});
        toast(`已停用 ${targets.length} 个命中词条，可撤销`);
      });
      batchRemove = btn('移除命中', '从本块移除当前命中的所有词条（可撤销）', () => {
        const targets = new Set(matchedTokens.map(m => m.token));
        if (!targets.size) return;
        const count = targets.size;
        commit(() => {
          block.positive = block.positive.filter(t => !targets.has(t));
          block.negative = block.negative.filter(t => !targets.has(t));
        }, {scope: 'block', blockId: block.id});
        toast(`已移除 ${count} 个命中词条，可撤销`);
      }, 'danger-action');
      batch.append(traitBtn, batchDisable, batchRemove);
      bar.append(batch);
    }
    actions.after(bar);
    card.querySelector('textarea')?.addEventListener('input', refresh);
    refresh();
    if (block.kind !== 'prose' && !input.value && traitFilters.has(id)) {
      const status = bar.querySelector('small');
      if (status) status.textContent = matchedTokens.length + ' 个外貌/角色词';
    }
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
  return {attach, editor, isCharacterTrait, isOpen: block => queries.has(key(block)), close: block => { const id = key(block); queries.delete(id); traitFilters.delete(id); }};
})();
