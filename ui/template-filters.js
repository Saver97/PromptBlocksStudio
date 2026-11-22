'use strict';

const TemplateFilters = (() => {
  const purposes = ['角色', '动作与姿势', '表情与视线', '镜头与构图', '服装', '场景', '光照', '画风', '公共基础', '负面约束', '完整组合', '自由补充'];
  const common = '通用 / 未指定 IP';
  const ipTags = new Map();
  const characterIPs = new Map();
  for (const preset of Blocks.characterPresets) {
    if (!preset.identityTags) continue;
    const band = ['Ave Mujica', 'MyGO!!!!!'].includes(preset.group);
    const ip = band ? 'BanG Dream!' : preset.group;
    characterIPs.set(preset.label, ip);
    const series = preset.identityTags.split(', ')[1];
    for (const alias of [series, ip, preset.group]) ipTags.set(alias.toLowerCase(), ip);
  }
  ipTags.set('崩坏星穹铁道', '崩坏·星穹铁道');
  ipTags.set('丘丘人', '原神');
  ipTags.set('hilichurl', '原神');

  function inferPurpose(t) {
    if (t.role === '完整组合') return t.role;
    if (characterIPs.has(t.name)) return '角色';
    if (/特写|近景|中景|远景|俯视|仰视|平视|镜头|构图|景别/.test(t.name)) return '镜头与构图';
    if (/表情|神色|微笑|害羞|目光|视线/.test(t.name)) return '表情与视线';
    if (/画风|画师|水彩|插画/.test(t.name) || t.role === '画师串') return '画风';
    if (t.role !== '自由补充') return t.role;
    if (/浴室|室内|街景|庭院/.test(t.name)) return '场景';
    if (/动作|姿势|坐姿|站姿|牵手|拥抱|奔跑|倒吊|缚|抓|踩|舔|亲|插入|后入|女上位|口交|榨乳|遛狗/.test(t.name)) return '动作与姿势';
    return '自由补充';
  }

  function classify(t) {
    const purpose = t.catalogPurpose || inferPurpose(t);
    if (t.catalogIP) return {purpose, ips:[t.catalogIP]};
    const ips = new Set();
    const known = characterIPs.get(t.name);
    if (known) ips.add(known);
    const text = [t.name, ...t.positive.map(v => v.text), t.positiveText, t.positiveSource,
      ...(t.characters || []).map(c => c.identityTags)].join(' ').toLowerCase().replaceAll('_', ' ');
    for (const [alias, ip] of ipTags) {
      if (text.includes(alias)) ips.add(ip);
    }
    return {purpose, ips:ips.size ? [...ips] : [common]};
  }

  function options(id, label, values) {
    const select = $(id), previous = select.value;
    const items = ['', ...values];
    if (items.length === select.options.length && items.every((v,i) => select.options[i].value === v)) return;
    select.replaceChildren(...items.map(v => new Option(v || label, v)));
    select.value = items.includes(previous) ? previous : '';
  }

  function list(templates, query) {
    const rows = templates.map(t => ({t, ...classify(t)}));
    options('templatePurpose', '全部用途', new Set(rows.map(r => r.purpose)));
    const purpose = $('templatePurpose').value;
    const relevant = rows.filter(r => !purpose || r.purpose === purpose);
    options('templateIP', '全部 IP 出处', new Set(relevant.flatMap(r => r.ips)));
    const ip = $('templateIP').value;
    return relevant.filter(r => (!ip || r.ips.includes(ip)) && (!query || norm([
      r.t.name, r.purpose, ...r.ips, r.t.role, r.t.positiveText, r.t.negativeText, r.t.positiveSource,
      r.t.negativeSource, ...r.t.positive.map(v => v.text), ...r.t.negative.map(v => v.text)
    ].join(' ')).includes(query)));
  }

  function edit(t) {
    let purpose, ip;
    modal('组合分类 · ' + t.name, body => {
      const inferred = classify({...t, catalogIP:'', catalogPurpose:''});
      purpose = selectField(body, '组合用途', [['', '自动 · ' + inferred.purpose], ...purposes.map(v => [v,v])], t.catalogPurpose || '');
      ip = field(body, 'IP 出处', t.catalogIP || '');
      ip.placeholder = inferred.ips.join(' / ');
    }, () => commit(() => {
      t.catalogPurpose = purpose.value;
      t.catalogIP = ip.value.trim();
    }));
  }
  return {list, edit};
})();
