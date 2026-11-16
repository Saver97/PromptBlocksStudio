'use strict';
const Blocks = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const roles = ['自由补充','公共基础','角色','服装','场景','光照','画师串','负面约束','完整组合'];
  // Optional generic examples, never installed as a user's saved scheme.
  const characterPresets = [
    {label:'示例角色 Alice',shortName:'Alice',name:'Alice',identityTags:'',gender:'female',sourceDescription:'成年女性，黑色短发、棕色眼睛',description:'an adult woman with short black hair and brown eyes'},
    {label:'示例角色 Betty',shortName:'Betty',name:'Betty',identityTags:'',gender:'female',sourceDescription:'成年女性，棕色长发、蓝色眼睛',description:'an adult woman with long brown hair and blue eyes'}
  ];
  function upgradeCharacters(list) {
    // Upgrade only untouched built-in identities; preserve custom names and appearance.
    return (list||[]).map(c=>{const preset=characterPresets.find(x=>x.shortName===c.name&&x.description===c.description);
      return preset&&c.identityTags===undefined?{...c,name:preset.name,identityTags:preset.identityTags,gender:c.gender??preset.gender}:copy(c);});
  }
  function identityTokens(c) {return (c.identityTags||'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);}
  function proseWarnings(text,characters,source='') {
    const used=[...new Set(aliases(text))].map(a=>(characters||[]).find(c=>c.alias===a)).filter(Boolean),warnings=[];
    if(used.length&&used.every(c=>c.gender==='female')&&/\b(he|him|his|himself)\b/i.test(text))warnings.push('引用的角色均设为女性，但译文出现 he / him / his，请核对指代；不会自动替换。');
    if(used.length>1&&/\b(she|her|hers|he|him|his|they|their)\b/i.test(text))warnings.push('多人描述中含代词，可能指代不清。动作主体、接触对象建议直接写 {{A}} / {{B}}。');
    if(/\breached? out to the (left|right) hand\b/i.test(text))warnings.push('“reach out to the … hand”可能把“伸出自己的手”译成“伸向另一只手”，请核对动作。');
    if(used.length>1&&/牵|握|\b(hold|holds|holding|held)\b/i.test(source+' '+text)&&/手|\bhands?\b/i.test(source+' '+text)&&!/另一只手|其余.*手|剩下.*手|\b(other|remaining|free)(?: left| right)? hands?\b/i.test(source+' '+text))warnings.push('牵手描述可补充其余手的位置，减少模型自由发挥；这只是检查提示。');
    return warnings;
  }
  function block(name='自由补充', role='自由补充', positive=[], negative=[]) {
    return {id:id(),name,role,enabled:true,weight:1,collapsed:false,positive:copy(positive),negative:copy(negative)};
  }
  function scheme(name='新方案') {return {id:id(),name,blocks:[block()],characters:[],parameters:{},models:{},notes:''};}
  function prose(name='自然语言描述') {return {...block(name),kind:'prose',positiveText:'',negativeText:'',positiveSource:'',negativeSource:''};}
  const aliases = text => [...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_]{0,15})\s*\}\}/g)].map(m=>m[1].toUpperCase());
  function validateCharacters(list) {if(list===undefined)return;if(!Array.isArray(list))throw Error('角色定义格式无效');const used=new Set();for(const c of list){if(!c||typeof c.alias!=='string'||!/^[A-Z][A-Z0-9_]{0,15}$/.test(c.alias)||used.has(c.alias)||typeof c.name!=='string'||!c.name.trim()||typeof c.description!=='string'||typeof (c.sourceDescription??'')!=='string'||typeof (c.translatedFrom??'')!=='string'||typeof (c.identityTags??'')!=='string'||!['unknown','female','male','other'].includes(c.gender??'unknown')||/[{}]/.test(c.name+c.description+(c.identityTags||'')))throw Error('角色代号必须唯一，名字、身份标签和描述不能嵌套变量，性别选项须有效');used.add(c.alias);}}
  function languageFields(b) {return {kind:b.kind||'tags',positiveText:b.positiveText||'',negativeText:b.negativeText||'',positiveSource:b.positiveSource||'',negativeSource:b.negativeSource||'',positiveTranslatedFrom:b.positiveTranslatedFrom||'',negativeTranslatedFrom:b.negativeTranslatedFrom||''};}
  function validate(s) {
    if(s?.theme!==undefined&&!['forest','midnight','violet','ember','paper','mist'].includes(s.theme))throw Error('未知配色');
    if(!s || s.version!==2 || !Array.isArray(s.schemes) || !s.schemes.length || !Array.isArray(s.templates) || !Array.isArray(s.favorites) || !['comfy','nai','plain'].includes(s.format)) throw Error('不是有效的分块版工作区');
    const ids=new Set();
    function identity(x){if(!x || typeof x.id!=='string' || !x.id || ids.has(x.id) || typeof x.name!=='string' || !x.name.trim())throw Error('名称或编号无效、重复');ids.add(x.id);}
    function tokens(items){if(!Array.isArray(items)||items.some(t=>!t||typeof t.text!=='string'||!t.text.trim()||typeof t.label!=='string'||!Number.isFinite(t.weight)||Math.abs(t.weight)>20||typeof t.enabled!=='boolean'))throw Error('词条或权重无效');}
    function content(b){tokens(b.positive);tokens(b.negative);if(!roles.includes(b.role))throw Error('未知内容块类型');if(b.kind!==undefined&&!['tags','prose'].includes(b.kind))throw Error('未知内容格式');for(const key of ['positiveText','negativeText','positiveSource','negativeSource','positiveTranslatedFrom','negativeTranslatedFrom'])if(b[key]!==undefined&&typeof b[key]!=='string')throw Error('自然语言内容格式无效');if(b.kind==='prose'&&(b.positive.length||b.negative.length))throw Error('自然语言块不能混入拆分标签');validateCharacters(b.characters);}
    for(const p of s.schemes){identity(p);if(!Array.isArray(p.blocks))throw Error('方案内容无效');for(const b of p.blocks){identity(b);content(b);if(typeof b.enabled!=='boolean'||typeof b.collapsed!=='boolean'||!Number.isFinite(b.weight)||Math.abs(b.weight)>20)throw Error('块状态或权重无效');}if(p.parameters!=null&&(typeof p.parameters!=='object'||Array.isArray(p.parameters)))throw Error('参数格式无效');}
    for(const p of s.schemes){validateCharacters(p.characters);for(const key of ['autoIntroduce','autoIdentity'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('角色自动补充开关无效');}
    for(const t of s.templates){identity(t);content(t);if(t.weight!==undefined&&(!Number.isFinite(t.weight)||Math.abs(t.weight)>20))throw Error('组合块权重无效');}
    if(!s.schemes.some(p=>p.id===s.activeSchemeId)||s.favorites.some(f=>typeof f!=='string'))throw Error('当前方案或收藏无效');
    const upgraded=copy(s);for(const p of [...upgraded.schemes,...upgraded.templates]){if(p.characters)p.characters=upgradeCharacters(p.characters);for(const b of p.blocks||[])if(b.characters)b.characters=upgradeCharacters(b.characters);}return upgraded;
  }
  function fromTemplate(t) {return {...block(t.name,t.role,t.positive,t.negative),...languageFields(t),weight:t.weight??1,sourceTemplateId:t.id,recipe:t.recipe||''};}
  function duplicate(b) {return {...copy(b),id:id(),name:b.name+' · 副本'};}
  function assemble(p,format='comfy',raw=false) {
    const result={positive:'',negative:'',warnings:[],errors:[],counts:{positive:0,negative:0},paragraphs:{positive:0,negative:0},sources:{positive:[],negative:[]}};
    for(const side of ['positive','negative']) {
      const seen=new Map(),out=[];
      for(const b of p.blocks.filter(b=>b.enabled))for(const t of b[side].filter(t=>t.enabled)) {
        const w=Number((t.weight*b.weight).toFixed(6)),key=norm(t.text),existing=seen.get(key)||[];
        if(existing.some(x=>x.weight!==w))result.warnings.push(`${side==='positive'?'正面':'负面'}重复词「${t.text}」权重不同：${existing.map(x=>x.block+' ×'+x.weight).join('、')} / ${b.name} ×${w}；已保留两处，请自行调整。`);
        if(existing.some(x=>x.weight===w)) {result.sources[side].find(x=>x.key===key&&x.weight===w).blocks.push(b.name);continue;}
        const text=format==='plain'||w===1?t.text:format==='nai'?`${w}::${t.text}::`:`(${t.text}:${w})`;
        out.push(text);existing.push({weight:w,block:b.name});seen.set(key,existing);
        result.sources[side].push({key,text:t.text,weight:w,blocks:[b.name]});
      }
      result[side]=out.join(', ');result.counts[side]=out.length;
    }
    const pos=new Set(result.sources.positive.map(x=>x.key)),neg=new Set(result.sources.negative.map(x=>x.key));
    for(const t of pos)if(neg.has(t))result.warnings.push(`「${t}」同时出现在正面和负面，请检查用途。`);
    if(pos.has('solo')&&(pos.has('2girls')||pos.has('2boys')||pos.has('multiple girls')))result.warnings.push('solo 与多人标签同时启用，请检查人数设定。');
    if(pos.has('1girl')&&pos.has('2girls'))result.warnings.push('1girl 与 2girls 同时启用，请检查人数设定。');
    const chars=new Map((p.characters||[]).map(c=>[c.alias,c])),used=new Set();
    for(const side of ['positive','negative']) {
      const paragraphs=[];
      for(const b of p.blocks.filter(b=>b.enabled&&b.kind==='prose')) {
        const source=b[side+'Source']||'',text=b[side+'Text']||'';
        if(source.trim()&&!text.trim())result.errors.push(`「${b.name}」${side==='positive'?'正面':'负面'}尚未翻译。`);
        if(source.trim()&&text.trim()&&b[side+'TranslatedFrom']!==source)result.errors.push(`「${b.name}」中文已修改，请更新对应英文。`);
        if(!text.trim())continue;
        for(const warning of proseWarnings(text,p.characters,source))result.warnings.push(`「${b.name}」${warning}`);
        if(source.trim()&&JSON.stringify(aliases(source).sort())!==JSON.stringify(aliases(text).sort()))result.errors.push(`「${b.name}」中英文的角色代号不一致，请检查译文。`);
        const expanded=raw?text:text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]{0,15})\s*\}\}/g,(match,key)=>{const alias=key.toUpperCase(),c=chars.get(alias);if(!c){result.errors.push(`未定义角色 {{${alias}}}（${b.name}）`);return match;}if(side==='positive')used.add(alias);return c.name;});
        if(!raw&&/[{}]/.test(expanded))result.errors.push(`「${b.name}」存在未展开的占位符，请使用 {{A}} 这类格式。`);
        paragraphs.push(expanded.trim());result.sources[side].push({key:'prose:'+b.id,text:expanded,weight:1,blocks:[b.name],kind:'prose'});
      }
      result.paragraphs[side]=paragraphs.length;
      const introductions=[];
      if(!raw&&side==='positive'&&p.autoIdentity!==false){
        const added=[];
        for(const alias of used){const c=chars.get(alias),tags=identityTokens(c);if(!tags.length)result.warnings.push(`角色 ${alias}（${c.name}）未填写身份标签；原创角色可留空，已有角色建议补全姓名与作品标签。`);
          for(const text of tags){const key=norm(text);const existing=result.sources.positive.find(x=>x.key===key);if(existing){if(!existing.blocks.includes('角色 '+alias))existing.blocks.push('角色 '+alias);continue;}
            added.push(text);result.sources.positive.push({key,text,weight:1,blocks:['角色 '+alias]});result.counts.positive++;if(neg.has(key))result.warnings.push(`身份标签「${text}」同时出现在负面，请检查用途。`);
          }
        }
        result.positive=[result.positive,...added].filter(Boolean).join(', ');
      }
      if(!raw&&side==='positive'&&p.autoIntroduce!==false)for(const alias of used){const c=chars.get(alias);if(c.sourceDescription?.trim()&&(!c.description.trim()||c.translatedFrom!==c.sourceDescription))result.errors.push(`角色 ${alias} 的中文外貌尚未翻译或已修改。`);if(c.description.trim())introductions.push(`${c.name}: ${c.description.trim()}${/[.!?。！？]$/.test(c.description.trim())?'':'.'}`);}
      result[side]=[result[side],...introductions,...paragraphs].filter(Boolean).join('\n\n');
    }
    result.warnings=[...new Set(result.warnings)];result.errors=[...new Set(result.errors)];return result;
  }
  function importLegacy(old) {
    if(!old||old.version!==1||!Array.isArray(old.presets)||!Array.isArray(old.positive)||!Array.isArray(old.negative))throw Error('不是旧版工作区');
    const p=scheme('旧版当前方案');p.blocks=[block('旧版当前提示词','自由补充',old.positive,old.negative)];
    const s={version:2,activeSchemeId:p.id,schemes:[p],templates:old.presets.map(t=>({...copy(t),id:id(),role:'完整组合'})),favorites:copy(old.favorites||[]),format:old.format||'comfy'};
    return validate(s);
  }
  return {copy,id,roles,characterPresets,upgradeCharacters,identityTokens,proseWarnings,block,prose,scheme,validate,validateCharacters,languageFields,aliases,fromTemplate,duplicate,assemble,importLegacy};
})();
