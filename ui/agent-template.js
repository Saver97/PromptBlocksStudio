'use strict';
// Versioned interchange format. Parsing is local, deterministic and has no API calls.
const AgentTemplate = (() => {
  const marker = 'prompt-blocks-template';
  const fail = (path, message) => { throw Error(path + '：' + message); };
  function object(value, path, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '需要对象');
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(path + '.' + key, '未知字段，请对照模板');
    return value;
  }
  function text(value, path, fallback = '', required = false) {
    if (value === undefined) value = fallback;
    if (typeof value !== 'string') fail(path, '需要文本');
    if (required && !value.trim()) fail(path, '不能为空');
    return value;
  }
  function list(value, path, limit) {
    if (!Array.isArray(value) || value.length > limit) fail(path, '需要数组，最多 ' + limit + ' 项');
    return value;
  }
  function boolean(value, path, fallback = true) {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') fail(path, '需要 true 或 false');
    return value;
  }
  function weight(value, path) {
    if (value === undefined) return 1;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 20) fail(path, '权重必须为 -20～20 的数字');
    return value;
  }
  function pair(value, path) {
    if (value === undefined) return {zh: '', en: ''};
    object(value, path, ['zh', 'en']);
    return {zh: text(value.zh, path + '.zh'), en: text(value.en, path + '.en')};
  }
  function tags(value, path) {
    return list(value ?? [], path, 5000).map((item, i) => {
      const at = path + '[' + i + ']';
      if (typeof item === 'string') return token(text(item, at, '', true), lookup.get(norm(item))?.label || item);
      object(item, at, ['text', 'label', 'weight', 'enabled']);
      const raw = text(item.text, at + '.text', '', true);
      return token(raw, text(item.label, at + '.label', lookup.get(norm(raw))?.label || raw),
        weight(item.weight, at + '.weight'), boolean(item.enabled, at + '.enabled'));
    });
  }
  function parameters(value = {}) {
    const keys = ['width', 'height', 'steps', 'cfg', 'seed', 'denoise', 'sampler_name', 'scheduler'];
    object(value, 'parameters', keys);
    const result = {};
    for (const [key, v] of Object.entries(value)) {
      const at = 'parameters.' + key;
      if (['sampler_name', 'scheduler'].includes(key)) result[key] = text(v, at, '', true);
      else if (key === 'seed' && typeof v === 'string') {
        if (!/^\d+$/.test(v) || BigInt(v) > 18446744073709551615n) fail(at, '种子字符串须为 0～18446744073709551615 的十进制整数');
        result[key] = v;
      } else {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail(at, '需要非负数字');
        if (['width', 'height', 'steps', 'seed'].includes(key) && !Number.isSafeInteger(v)) fail(at, '需要安全范围内的整数；大种子请用字符串');
        if (['width', 'height', 'steps'].includes(key) && !v) fail(at, '必须大于零');
        if (key === 'denoise' && v > 1) fail(at, '重绘幅度应在 0～1 之间');
        result[key] = v;
      }
    }
    return result;
  }
  function parse(raw) {
    if (typeof raw !== 'string' || raw.length > 1000000) fail('模板', '内容必须为文本，最多 100 万字符');
    let source = raw.replace(/^\uFEFF/, '').trim();
    const fence = source.match(/^```(?:json|promptblocks)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
    if (fence) source = fence[1].trim();
    let data;
    try { data = JSON.parse(source); } catch (e) { fail('JSON 格式', '请粘贴完整 JSON 或单个 JSON 代码块，不包含说明文字。' + e.message); }
    object(data, '模板', ['format', 'version', 'name', 'characters', 'blocks', 'parameters', 'models', 'notes', 'autoIdentity', 'autoIntroduce']);
    if (data.format !== marker) fail('format', '必须为 "' + marker + '"');
    if (data.version !== 1) fail('version', '当前只支持数字 1');
    const p = Blocks.scheme(text(data.name, 'name', '', true));
    p.autoIdentity = boolean(data.autoIdentity, 'autoIdentity');
    p.autoIntroduce = boolean(data.autoIntroduce, 'autoIntroduce');
    p.notes = text(data.notes, 'notes');
    p.parameters = parameters(data.parameters);
    object(data.models ?? {}, 'models', ['unet_name', 'clip_name', 'vae_name']);
    p.models = Object.fromEntries(Object.entries(data.models || {}).map(([key, v]) => [key, text(v, 'models.' + key)]));
    p.characters = list(data.characters ?? [], 'characters', 32).map((c, i) => {
      const at = 'characters[' + i + ']';
      object(c, at, ['alias', 'name', 'gender', 'identityTags', 'description']);
      const alias = text(c.alias, at + '.alias', '', true).trim().toUpperCase();
      const identity = list(c.identityTags ?? [], at + '.identityTags', 100).map((v, n) => text(v, at + '.identityTags[' + n + ']', '', true));
      const description = pair(c.description, at + '.description');
      return {alias, name: text(c.name, at + '.name', '', true), gender: text(c.gender, at + '.gender', 'unknown'),
        identityTags: identity.join(', '), description: description.en, sourceDescription: description.zh,
        translatedFrom: description.en.trim() ? description.zh : ''};
    });
    Blocks.validateCharacters(p.characters);
    const known = new Set(p.characters.map(c => c.alias));
    p.blocks = list(data.blocks, 'blocks', 100).map((b, i) => {
      const at = 'blocks[' + i + ']';
      object(b, at, ['type', 'name', 'role', 'positive', 'negative', 'weight', 'enabled']);
      if (!['tags', 'prose'].includes(b.type)) fail(at + '.type', '只能是 tags（标签）或 prose（自然语言）');
      const role = text(b.role, at + '.role', '自由补充');
      if (!Blocks.roles.includes(role)) fail(at + '.role', '未知类型，可用：' + Blocks.roles.join('、'));
      const out = b.type === 'tags' ? Blocks.block(text(b.name, at + '.name', '', true), role, tags(b.positive, at + '.positive'), tags(b.negative, at + '.negative')) : Blocks.prose(text(b.name, at + '.name', '', true));
      out.role = role; out.enabled = boolean(b.enabled, at + '.enabled'); out.weight = weight(b.weight, at + '.weight');
      if (b.type === 'prose') {
        if (out.weight !== 1) fail(at + '.weight', '自然语言块不支持整块权重，请用 1');
        for (const side of ['positive', 'negative']) {
          const content = pair(b[side], at + '.' + side);
          for (const [lang, value] of Object.entries(content)) {
            for (const alias of Blocks.aliases(value)) if (!known.has(alias)) fail(at + '.' + side + '.' + lang, '未定义角色 {{' + alias + '}}');
            if (/[{}]/.test(value.replace(/\{\{\s*[A-Za-z][A-Za-z0-9_]{0,15}\s*\}\}/g, ''))) fail(at + '.' + side + '.' + lang, '占位符格式错误，请使用 {{A}}');
          }
          if (content.zh.trim() && content.en.trim() && JSON.stringify(Blocks.aliases(content.zh).sort()) !== JSON.stringify(Blocks.aliases(content.en).sort())) fail(at + '.' + side, '中英文角色占位符及出现次数不一致');
          out[side + 'Source'] = content.zh; out[side + 'Text'] = content.en;
          out[side + 'TranslatedFrom'] = content.en.trim() ? content.zh : '';
        }
      } else {
        for (const t of [...out.positive, ...out.negative]) if (/\{\{/.test(t.text)) fail(at, '角色占位符请放在 prose 自然语言块，不放在标签中');
      }
      return out;
    });
    if (!p.blocks.length) fail('blocks', '至少需要一个块');
    Blocks.validate({version: 2, schemes: [p], activeSchemeId: p.id, templates: [], favorites: [], format: 'comfy'});
    return p;
  }
  const example = {
    format: marker, version: 1, name: '双人看书示例',
    characters: [
      {alias: 'A', name: 'Alice', gender: 'female', identityTags: [], description: {zh: '成年女性，黑色短发、棕色眼睛', en: 'an adult woman with short black hair and brown eyes'}},
      {alias: 'B', name: 'Betty', gender: 'female', identityTags: [], description: {zh: '成年女性，棕色长发、蓝色眼睛', en: 'an adult woman with long brown hair and blue eyes'}}
    ],
    blocks: [
      {type: 'tags', name: '画质与构图', role: '公共基础', positive: ['best quality', '2girls', 'upper body'], negative: [], weight: 1},
      {type: 'tags', name: '服装', role: '服装', positive: ['casual clothes'], negative: []},
      {type: 'tags', name: '场景与光照', role: '场景', positive: ['library', {text: 'soft lighting', weight: 1.1}], negative: []},
      {type: 'prose', name: '双人动作', role: '自由补充', positive: {zh: '{{A}} 站在左边，{{B}} 站在右边。{{B}} 双手捧着打开的书，{{A}} 用右手食指指向书页。', en: '{{A}} stands on the left, and {{B}} stands on the right. {{B}} holds an open book with both hands. {{A}} points to the page with her right index finger.'}, negative: {zh: '', en: ''}},
      {type: 'tags', name: '负面约束', role: '负面约束', positive: [], negative: ['low quality', 'bad anatomy', 'extra fingers', 'text', 'watermark']}
    ], parameters: {}, models: {}, notes: ''
  };
  const instructions = `请把我的生图需求整理为 PromptBlocksStudio 模板。只输出一个完整 JSON 代码块，不要输出解释。工具仅按 JSON 字段本地解析，不使用 LLM 识别结构。
规则：
1. format 固定为 "prompt-blocks-template"，version 固定为数字 1。按用户需求改 name、characters 和 blocks；下面是结构示例，不是要求照搬的画面。
2. 将公共标签、服装、场景、光照、画师串、负面约束拆成独立 blocks；保持用户指定的角色、动作、接触关系和镜头，不自行改剧情。标签不能保证人物区域绑定。
3. type=tags 时 positive/negative 必须是数组。每项是一个完整标签字符串，或 {"text":"soft lighting","weight":1.1}。不要把一整串逗号提示词放入一个数组项，不要在字符串中内嵌 SD/NAI 权重语法。未知词也照常保留。可选 label 是中文显示名，enabled 为布尔值。块 weight 默认 1，与词权重相乘。
4. type=prose 时 positive/negative 是 {"zh":"中文原文","en":"对应英文"}；整段保留，不能拆成标签。中英文 {{A}}/{{B}} 出现次数必须一致。角色代号先在 characters 定义；不要省略双花括号。自然语言块 weight 必须为 1 或省略。
5. 角色字段为 alias（A、B 等）、name（输出姓名）、gender（unknown/female/male/other）、identityTags（英文身份标签数组）、description（zh/en 外貌）。只填已知身份，不捏造身份标签。角色身份与固定外貌会自动拼入输出，无需在其他块重复。没有角色时 characters=[]。
6. role 仅可用：自由补充、公共基础、角色、服装、场景、光照、画师串、负面约束、完整组合。
7. parameters 可含 width、height、steps、cfg、seed、denoise、sampler_name、scheduler；models 可含 unet_name、clip_name、vae_name。未知参数和模型省略，不猜。大于 9007199254740991 的种子必须写为十进制字符串；宽高和步数为正整数，denoise 为 0～1，权重为 -20～20。
8. 不添加 id、API Key 或其他字段；不输出注释、尾随逗号。没有内容的标签用 []，没有内容的自然语言用 {"zh":"","en":""}。可选 notes 记录说明。只有中文也可导入，但工具会提示英文尚未完成。

结构示例：
\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`

我的生图需求：
（在这里补充需求）`;
  function serialize(p) {
    // Do not silently mark a stale translation as aligned in the interchange format.
    for (const b of p.blocks.filter(b => b.kind === 'prose')) for (const side of ['positive', 'negative']) {
      if (b[side + 'Source']?.trim() && b[side + 'Text']?.trim() && b[side + 'TranslatedFrom'] !== b[side + 'Source']) fail(b.name, '中英文尚未同步，请先校对后再复制当前方案模板');
    }
    for (const c of p.characters || []) if (c.sourceDescription?.trim() && c.description?.trim() && c.translatedFrom !== c.sourceDescription) fail('角色 ' + c.alias, '中英文外貌尚未同步');
    const data = {format: marker, version: 1, name: p.name, autoIdentity: p.autoIdentity !== false, autoIntroduce: p.autoIntroduce !== false,
      characters: (p.characters || []).map(c => ({alias: c.alias, name: c.name, gender: c.gender || 'unknown', identityTags: Blocks.identityTokens(c), description: {zh: c.sourceDescription || '', en: c.description || ''}})),
      blocks: p.blocks.map(b => ({type: b.kind === 'prose' ? 'prose' : 'tags', name: b.name, role: b.role, weight: b.weight, enabled: b.enabled,
        positive: b.kind === 'prose' ? {zh: b.positiveSource || '', en: b.positiveText || ''} : b.positive.map(t => ({text: t.text, label: t.label, weight: t.weight, enabled: t.enabled})),
        negative: b.kind === 'prose' ? {zh: b.negativeSource || '', en: b.negativeText || ''} : b.negative.map(t => ({text: t.text, label: t.label, weight: t.weight, enabled: t.enabled}))})),
      parameters: p.parameters || {}, models: p.models || {}, notes: p.notes || ''};
    const result = JSON.stringify(data, null, 2);
    parse(result); // Always produce a document the importer accepts.
    return result;
  }
  return {parse, serialize, example, instructions};
})();

async function copyAgentText(value) {
  try { if (native) await window.pywebview.api.copy(value); else await navigator.clipboard.writeText(value); toast('已复制'); }
  catch (e) { toast('复制失败：' + e.message); }
}
function openAgentImport() {
  let input, preview, parsed, timer;
  const refresh = () => {
    parsed = null; preview.replaceChildren(); $('modalConfirm').disabled = true; $('modalError').textContent = '';
    if (!input.value.trim()) { preview.append(el('p', 'muted', '粘贴 Agent 返回的 JSON 后，这里会预览方案和分块。')); return; }
    try {
      parsed = AgentTemplate.parse(input.value);
      preview.append(el('h3', '', parsed.name), el('p', 'muted', `${parsed.blocks.length} 个块 · ${parsed.characters.length} 个角色 · 导入后可撤销`));
      for (const c of parsed.characters) preview.append(el('p', '', '{{' + c.alias + '}} → ' + c.name));
      for (const b of parsed.blocks) {
        const row = el('div', 'template-block-preview');
        row.append(el('strong', '', `${b.name} · ${b.kind === 'prose' ? '自然语言' : b.role}${b.enabled ? '' : ' · 已停用'}`));
        for (const side of ['positive', 'negative']) {
          const content = b.kind === 'prose' ? [b[side + 'Source'], b[side + 'Text']].filter(Boolean).join('\n') : b[side].map(t => t.text + (t.weight !== 1 ? ' ×' + t.weight : '') + (t.enabled ? '' : '（停用）')).join(', ');
          if (content) row.append(el('p', '', (side === 'positive' ? '正面：' : '负面：') + content));
        }
        preview.append(row);
      }
      if (Object.keys(parsed.parameters).length || Object.keys(parsed.models).length) preview.append(el('p', '', '参数 / 模型：' + JSON.stringify({...parsed.parameters, ...parsed.models})));
      if (parsed.notes) preview.append(el('p', '', '备注：' + parsed.notes));
      const result = Blocks.assemble(parsed, state.format);
      for (const warning of [...result.errors, ...result.warnings]) preview.append(el('p', 'warning', warning));
      $('modalConfirm').disabled = false;
    } catch (e) { $('modalError').textContent = e.message; }
  };
  modal('按模板分块导入', body => {
    $('modal').classList.add('agent-template-dialog');
    body.append(el('p', '', '把模板发给其他 Agent，生成后将完整 JSON 粘贴回来。按格式本地读取，导入为新方案。'));
    const actions = el('div', 'actions template-actions');
    actions.append(btn('复制给 Agent 的模板', '复制给 Agent 的模板', () => copyAgentText(AgentTemplate.instructions)),
      btn('复制当前方案模板', '复制当前方案模板', () => { try { copyAgentText(AgentTemplate.serialize(scheme())); } catch (e) { $('modalError').textContent = e.message; } }));
    body.append(actions);
    const grid = el('div', 'template-import-grid'), left = el('div', 'template-import-input');
    input = field(left, '粘贴模板 JSON', '', 'textarea'); input.spellcheck = false; input.placeholder = '{"format":"prompt-blocks-template","version":1,…}';
    input.oninput = () => { parsed = null; $('modalConfirm').disabled = true; clearTimeout(timer); timer = setTimeout(refresh, 150); };
    preview = el('div', 'template-import-preview'); preview.setAttribute('aria-label', '模板分块预览');
    grid.append(left, preview); body.append(grid); refresh();
    $('modal').addEventListener('close', () => { clearTimeout(timer); $('modal').classList.remove('agent-template-dialog'); }, {once: true});
  }, () => {
    clearTimeout(timer); refresh(); if (!parsed) return false;
    commit(() => {
      const p = parsed, original = p.name; let n = 1;
      while (state.schemes.some(s => s.name === p.name)) p.name = original + ' · 导入 ' + n++;
      state.schemes.push(p); state.activeSchemeId = p.id; selectedId = p.blocks[0].id;
    });
    toast('已按模板导入 ' + parsed.blocks.length + ' 个块，可撤销');
  }, '导入为新方案');
}
