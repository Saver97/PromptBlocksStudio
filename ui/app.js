'use strict';
const $=id=>document.getElementById(id),copy=Blocks.copy;
let state,library=[],native=false,selectedId=null,targetSide='positive',libraryView='words',favoritesOnly=false,shown=100;
let history=[],future=[],saveTimer,saveChain=Promise.resolve(),toastTimer,modalAction;
let blockDrag = null;
let chromeTheme='',chromeUpdate=Promise.resolve();
function syncWindowTheme(theme){
 if(!native||!window.pywebview.api.set_window_colors||chromeTheme===theme)return;
 chromeTheme=theme;
 const style=getComputedStyle(document.documentElement),background=style.getPropertyValue('--bg').trim(),foreground=style.getPropertyValue('--muted').trim(),dark=style.colorScheme==='dark';
 chromeUpdate=chromeUpdate.catch(()=>{}).then(()=>window.pywebview.api.set_window_colors(background,foreground,dark)).then(result=>{window.chromeThemeResult=result;}).catch(()=>{window.chromeThemeResult={applied:false};});
}
const scheme=()=>state.schemes.find(s=>s.id===state.activeSchemeId);
const selected=()=>scheme().blocks.find(b=>b.id===selectedId);
function el(tag,cls='',text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function btn(text,label,action,cls=''){const e=el('button',cls,text);e.type='button';e.title=label;e.setAttribute('aria-label',label);e.onclick=action;return e;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function save(){clearTimeout(saveTimer);$('saveStatus').textContent='正在保存…';saveTimer=setTimeout(()=>{const snapshot=copy(state);saveChain=saveChain.catch(()=>{}).then(async()=>{if(native)await window.pywebview.api.save(snapshot);else localStorage.setItem('prompt-blocks-workspace-v2',JSON.stringify(snapshot));$('saveStatus').textContent='已保存到本机';}).catch(e=>{$('saveStatus').textContent='保存失败';toast(e.message);});},180);}
function commit(fn){const before=copy(state);try{fn();Blocks.validate(state);}catch(e){state=before;toast(e.message);throw e;}history.push(before);if(history.length>60)history.shift();future=[];render();save();}
function undo(){if(!history.length)return;future.push(copy(state));state=history.pop();render();save();}
function redo(){if(!future.length)return;history.push(copy(state));state=future.pop();render();save();}
window.exportState=()=>state;
function modal(title,build,action,confirm='保存'){$('modalTitle').textContent=title;$('modalBody').replaceChildren();$('modalError').textContent='';$('modalConfirm').textContent=confirm;$('modalConfirm').disabled=false;modalAction=action;build($('modalBody'));$('modal').showModal();setTimeout(()=>$('modalBody').querySelector('input,textarea,select')?.focus(),0);}
function field(body,label,value='',tag='input'){const wrap=el('label','',label),input=el(tag);input.setAttribute('aria-label',label);input.value=value;wrap.append(input);body.append(wrap);return input;}
function selectField(body,label,options,value){const input=field(body,label,'','select');for(const [v,t] of options)input.append(new Option(t,v));input.value=value;return input;}
function nameDialog(title,value,action){let input;modal(title,b=>{input=field(b,'名称',value);},()=>{const name=input.value.trim();if(!name)throw Error('请填写名称');action(name);});}
function render(){
 const theme=state.theme||'forest';document.documentElement.dataset.theme=theme;$('themeSelect').value=theme;
 syncWindowTheme(theme);
 if(!scheme().blocks.some(b=>b.id===selectedId))selectedId=scheme().blocks[0]?.id||null;
 $('schemeSelect').replaceChildren(...state.schemes.map(p=>new Option(p.name,p.id)));$('schemeSelect').value=state.activeSchemeId;
 $('schemeCount').textContent=state.schemes.length+' 个方案';$('deleteScheme').disabled=state.schemes.length<=1;
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;$('format').value=state.format;
 $('templateCount').textContent=state.templates.length;$('blockCount').textContent=scheme().blocks.length;
 $('targetName').textContent=selected()?'加入：'+selected().name:'先新建或选择一个块';
 $('positiveTarget').classList.toggle('active',targetSide==='positive');$('negativeTarget').classList.toggle('active',targetSide==='negative');
 renderLanguage();renderLibrary();renderBlocks();renderOutput();
}
function setGroups(){const cat=$('category').value;const names=[...new Set(library.filter(e=>!cat||e.category===cat).map(e=>e.group))];$('group').replaceChildren(new Option('全部子分类',''),...names.map(n=>new Option(n,n)));}
function addEntry(entry){
 if(!selected()){toast('请先新建一个内容块');return;}
 if(selected().kind==='prose'){toast('自然语言块保留完整段落，请点击编辑；标签请加入其他块。');return;}
 const b=selected(),side=entry.negative?'negative':targetSide,key=norm(entry.text),exists=b[side].some(t=>norm(t.text)===key);
 commit(()=>{if(exists)b[side]=b[side].filter(t=>norm(t.text)!==key);else b[side].push(token(entry.text,entry.label));});
 if(entry.negative&&!exists)toast('已加入该块的负面词');
}
function renderLibrary(){
 const q=norm($('search').value),cat=$('category').value,group=$('group').value,frag=document.createDocumentFragment();
 $('wordFilters').classList.toggle('hidden',libraryView!=='words');$('templateTools').classList.toggle('hidden',libraryView!=='templates');
 $('bundleFilters').classList.toggle('hidden',libraryView!=='bundles');$('bundleTab').classList.toggle('active',libraryView==='bundles');
 $('libraryTab').classList.toggle('active',libraryView==='words');$('templateTab').classList.toggle('active',libraryView==='templates');
 $('favoriteOnly').classList.toggle('hidden',libraryView!=='words');$('favoriteOnly').setAttribute('aria-pressed',String(favoritesOnly));$('favoriteOnly').textContent=favoritesOnly?'★ 已收藏':'☆ 收藏';
 $('libraryHint').textContent=libraryView==='words'?'＋ 添加 · ✓ 取消':libraryView==='bundles'?'整组加入选中块':'可新建块或并入当前块';
 if(libraryView==='bundles'){renderBundleLibrary(q,frag);}else if(libraryView==='words'){
  const matches=library.filter(e=>(!favoritesOnly||state.favorites.includes(e.id))&&(q?norm([e.label,e.text,e.category,e.group].join(' ')).includes(q):(!cat||e.category===cat)&&(!group||e.group===group)));
  $('resultCount').textContent=matches.length+' 个词条';$('more').hidden=matches.length<=shown;
  for(const e of matches.slice(0,shown)){
   const row=el('div','word'),info=el('div','word-info'),name=el('strong','',e.label);if(e.negative)name.append(el('span','badge','负面'));
   info.append(name,el('small','',e.text));info.title=e.category+' / '+e.group;
   const side=e.negative?'negative':targetSide,added=selected()?.[side].some(t=>norm(t.text)===norm(e.text));
   const star=btn(state.favorites.includes(e.id)?'★':'☆','收藏 '+e.label,()=>commit(()=>{state.favorites=state.favorites.includes(e.id)?state.favorites.filter(x=>x!==e.id):[...state.favorites,e.id];}),'star');
   const add=btn(added?'✓':'＋',(added?'移除 ':'添加 ')+e.label,()=>addEntry(e),added?'added':'');add.setAttribute('aria-pressed',String(!!added));add.disabled=!selected()||selected().kind==='prose';
   row.append(info,star,add);frag.append(row);
  }
  if(!matches.length)frag.append(el('div','empty','没有匹配的词条，试试更短的中文或英文。'));
 }else{
  const matches=state.templates.filter(t=>!q||norm([t.name,t.role,t.positiveText||'',t.negativeText||'',t.positiveSource||'',t.negativeSource||'',...t.positive.map(x=>x.text),...t.negative.map(x=>x.text)].join(' ')).includes(q));
  $('resultCount').textContent=matches.length+' 个组合块';$('more').hidden=true;
  for(const t of matches){const row=el('div','template');row.append(el('h3','',t.name),el('p','',`${t.kind==='prose'?'自然语言 · '+t.role:t.role+' · 正 '+t.positive.length+' / 负 '+t.negative.length}${t.kind!=='prose'&&t.weight&&t.weight!==1?' · 整块 ×'+t.weight:''}`));
   const actions=el('div','actions');const replace=btn('替换选中','用 '+t.name+' 替换选中块',()=>useTemplate(t,true));replace.disabled=!selected();
   if(t.kind!=='prose'){const append=btn('加入当前块','并入当前块 '+t.name,()=>appendTemplate(t));append.disabled=!selected()||selected().kind==='prose';actions.append(append);}
   actions.append(btn('＋ 加入','加入组合 '+t.name,()=>useTemplate(t,false)),replace,btn('编辑','编辑组合 '+t.name,()=>editTemplate(t)),btn('×','删除组合 '+t.name,()=>modal('删除组合',b=>b.append(el('p','',`删除“${t.name}”？已经放入各方案的副本会保留。`)),()=>commit(()=>{state.templates=state.templates.filter(x=>x.id!==t.id);}), '删除')));
   if(t.parameters&&Object.keys(t.parameters).length)actions.append(btn('新建配方','以 '+t.name+' 新建配方',()=>commit(()=>{const p=Blocks.scheme(t.name);p.blocks=[Blocks.fromTemplate(t)];p.parameters=copy(t.parameters);p.models=copy(t.models||{});p.characters=copy(t.characters||[]);p.notes=t.recipe||'';state.schemes.push(p);state.activeSchemeId=p.id;})));
   row.append(actions);frag.append(row);
  }
  if(!matches.length)frag.append(el('div','empty','还没有匹配组合。可把当前块存为组合，或粘贴提示词导入。'));
 }
 $('results').replaceChildren(frag);
}
function useTemplate(t,replace){const next=Blocks.fromTemplate(t);commit(()=>{mergeCharacters(scheme(),t.characters);if(replace){const i=scheme().blocks.findIndex(b=>b.id===selectedId);if(i<0)throw Error('请先选择要替换的块');scheme().blocks.splice(i,1,next);}else scheme().blocks.push(next);selectedId=next.id;});toast(replace?'已替换当前块，可撤销':'已加入独立副本');}
function moveBlock(id,offset){const a=scheme().blocks,i=a.findIndex(b=>b.id===id),j=i+offset;if(i<0||j<0||j>=a.length)return;commit(()=>{a.splice(j,0,a.splice(i,1)[0]);});}
function startBlockDrag(event, source, side, token) {
 blockDrag = {source, side, token};
 event.dataTransfer.effectAllowed = 'move';
 event.dataTransfer.setData('application/x-prompt-block', source.id);
}
function endBlockDrag() {
 blockDrag = null;
 document.querySelector('.block.drag-over')?.classList.remove('drag-over');
}
function acceptsBlockDrop(target) {
 return blockDrag && blockDrag.source !== target && (!blockDrag.token || target.kind !== 'prose');
}
function dropOnBlock(event, target) {
 if (!acceptsBlockDrop(target)) return;
 event.preventDefault();
 const {source, side, token} = blockDrag;
 endBlockDrag();
 const blocks = scheme().blocks;
 const from = blocks.indexOf(source), to = blocks.indexOf(target);
 if (from < 0 || to < 0) return;
 if (token) {
  const index = source[side].indexOf(token);
  if (index < 0) return;
  commit(() => {
   source[side].splice(index, 1);
   target[side].push(token);
  });
  toast('已移至「' + target.name + '」的' + (side === 'positive' ? '正面' : '负面'));
 } else {
  commit(() => { blocks.splice(to, 0, blocks.splice(from, 1)[0]); });
 }
}
function renderBlocks(){
 const frag=document.createDocumentFragment();
 for(const b of scheme().blocks){
  const card=el('article','block'+(selectedId===b.id?' selected':'')+(!b.enabled?' disabled':''));card.dataset.blockId=b.id;
  card.onclick=e=>{if(e.target.closest('button,input,select,textarea,label'))return;selectedId=b.id;render();};
  const collapsed=b.collapsed&&!BlockSearch.isOpen(b);
  const head=el('div','block-head'),handle=btn('⋮⋮','拖动排序 '+b.name,()=>{selectedId=b.id;render();},'drag');handle.draggable=true;
  handle.ondragstart = event => startBlockDrag(event, b);
  handle.ondragend = endBlockDrag;
  card.ondragover = event => {
   if (!acceptsBlockDrop(b)) return;
   event.preventDefault();
   event.dataTransfer.dropEffect = 'move';
   card.classList.add('drag-over');
  };
  card.ondragleave = event => {
   if (!card.contains(event.relatedTarget)) card.classList.remove('drag-over');
  };
  card.ondrop = event => dropOnBlock(event, b);
  const enabled=el('input');enabled.type='checkbox';enabled.checked=b.enabled;enabled.setAttribute('aria-label','启用块 '+b.name);enabled.onchange=()=>commit(()=>{b.enabled=enabled.checked;});
  const title=el('div','block-title');title.append(el('b','',b.name),el('small','',`${b.kind==='prose'?'自然语言 · '+b.role:b.role+' · 正 '+b.positive.length+' / 负 '+b.negative.length}${b.sourceTemplateId?' · 组合副本':''}`));
  const weight=el('input');weight.type='number';weight.min='-20';weight.max='20';weight.step='.1';weight.value=b.weight;weight.setAttribute('aria-label','整块权重 '+b.name);weight.disabled=b.kind==='prose';if(b.kind==='prose')weight.title='自然语言保留原文，不应用标签倍率';weight.onchange=()=>{const v=Number(weight.value);if(weight.value===''||!Number.isFinite(v)||Math.abs(v)>20){weight.value=b.weight;toast('整块权重范围为 -20～20');return;}commit(()=>{b.weight=v;});};
  head.append(handle,enabled,title,el('span','weight-label','倍率'),weight,btn(collapsed?'▸':'▾',(collapsed?'展开 ':'折叠 ')+b.name,()=>{BlockSearch.close(b);commit(()=>{b.collapsed=!collapsed;});}));
  const actions=el('div','block-actions');const up=btn('↑','上移 '+b.name,()=>moveBlock(b.id,-1)),down=btn('↓','下移 '+b.name,()=>moveBlock(b.id,1));up.disabled=scheme().blocks[0]===b;down.disabled=scheme().blocks.at(-1)===b;
  actions.append(btn('编辑','编辑块 '+b.name,()=>editBlock(b)),btn('替换','替换块 '+b.name,()=>{selectedId=b.id;libraryView='templates';$('search').value='';render();toast('左侧找到组合后，点“替换选中”');}),btn('存为组合','保存块 '+b.name,()=>saveBlock(b)),btn('复制','复制块 '+b.name,()=>commit(()=>{const next=Blocks.duplicate(b);scheme().blocks.splice(scheme().blocks.indexOf(b)+1,0,next);selectedId=next.id;})),up,down,btn('移除','移除块 '+b.name,()=>commit(()=>{scheme().blocks=scheme().blocks.filter(x=>x.id!==b.id);})));card.append(head,actions);
  if(b.sourceTemplateId&&state.templates.some(t=>t.id===b.sourceTemplateId))actions.append(btn('更新来源组合','更新来源组合 '+b.name,()=>updateSource(b)));
  if(!collapsed&&b.kind==='prose')card.append(proseCardBody(b));
  if(!collapsed&&b.kind!=='prose'){const body=el('div','block-body');for(const side of ['positive','negative']){
    if(!b[side].length)continue;
    const label=el('div','token-side-label',side==='positive'?'正面':'负面');const list=el('div','token-list');
    b[side].forEach((t,i)=>{const chip=el('div','token'+(!t.enabled?' off':'')),check=el('input');check.type='checkbox';check.checked=t.enabled;check.setAttribute('aria-label',`启用词 ${b.name} ${side} ${i}`);check.onchange=()=>commit(()=>{t.enabled=check.checked;});
      const edit=btn(t.label||t.text,'编辑词 '+t.text,()=>editToken(b,side,i),'edit-token');edit.title=t.text;
      edit.draggable = true;
      edit.setAttribute('aria-description', '点击编辑，拖到另一标签块可移动词条');
      edit.ondragstart = event => startBlockDrag(event, b, side, t);
      edit.ondragend = endBlockDrag;
      chip.append(check,edit);if(t.weight!==1)chip.append(el('span','weight-badge','×'+t.weight));chip.append(btn('×','移除词 '+t.text,()=>commit(()=>{b[side].splice(i,1);}),'remove-token'));list.append(chip);
    });if(!b[side].length)list.append(el('span','empty','暂无词条'));body.append(label,list);
   }if(!b.positive.length&&!b.negative.length)body.append(el('p','empty','从左侧加词，或在下面直接输入提示词。'));body.append(blockInput(b));card.append(body);}
  BlockSearch.attach(card,actions,b);
  frag.append(card);
 }
 if(!scheme().blocks.length)frag.append(el('div','empty','新建一个块，或从左侧组合库加入内容。'));
 $('blocks').replaceChildren(frag);
}
function renderOutput(){
 const out=Blocks.assemble(scheme(),state.format);for(const side of ['positive','negative']){$(side+'Output').value=out[side];$(side+'Count').textContent=out.counts[side]+' 标签'+(out.paragraphs[side]?' / '+out.paragraphs[side]+' 段':'');}
 $('formatNote').textContent={comfy:'输出 (tag:权重)。整块倍率 × 词条权重；是否生效取决于编码节点。',nai:'输出 权重::tag::。支持负权重；实际解释取决于所用模型。',plain:'只输出标签，不包含权重语法。'}[state.format];
 $('warnings').replaceChildren(...out.errors.map(w=>el('div','warning error',w)),...out.warnings.map(w=>el('div','warning',w)));$('copyPositive').disabled=$('copyNegative').disabled=out.errors.length>0;
 $('sourceList').replaceChildren(...['positive','negative'].flatMap(side=>out.sources[side].map(t=>el('p','',`${side==='positive'?'正':'负'} · ${t.text}${t.kind==='prose'?'':' ×'+t.weight} ← ${t.blocks.join('、')}`))));
 const p=scheme().parameters||{},m=scheme().models||{},parts=[];
 if(p.width&&p.height)parts.push(`${p.width} × ${p.height}`);if(p.steps!=null)parts.push(p.steps+' 步');if(p.cfg!=null)parts.push('CFG '+p.cfg);if(p.sampler_name)parts.push(p.sampler_name);if(p.scheduler)parts.push(p.scheduler);if(p.denoise!=null)parts.push('denoise '+p.denoise);
 const seeds=Blocks.schemeSeeds(p);
 $('parameters').replaceChildren(...(parts.length||!seeds.length?[el('p','',parts.join(' / ')||'未设置，可在这里记录配方参数。')]:[]),...Object.entries(m).filter(([,v])=>v).map(([k,v])=>el('p','',`${{unet_name:'模型',clip_name:'编码器',vae_name:'VAE'}[k]||k}：${v}`)));
 for (const seed of seeds) {
  const row = el('div', 'seed-row');
  row.append(el('span', '', '种子 ' + seed), btn('复制', '复制种子 ' + seed, () => copyPlainText(String(seed))));
  $('parameters').append(row);
 }
 if(scheme().notes)$('parameters').append(el('p','',scheme().notes));
}
function editToken(b,side,i){const t=b[side][i];let text,label,weight;modal('编辑词条',body=>{text=field(body,'英文提示词',t.text);label=field(body,'显示名称',t.label);weight=field(body,'词条权重',t.weight);weight.type='number';weight.step='.1';weight.min='-20';weight.max='20';BlockSearch.editor(b,[text,label]);},()=>{const w=Number(weight.value);if(!text.value.trim()||weight.value===''||!Number.isFinite(w)||Math.abs(w)>20)throw Error('请填写提示词，权重范围为 -20～20');commit(()=>{b[side][i]={...t,text:text.value.trim(),label:label.value.trim()||text.value.trim(),weight:w};});});}
function editBlock(b){if(b.kind==='prose'){editProse(b);return;}let name,role;modal('编辑内容块',body=>{name=field(body,'名称',b.name);role=selectField(body,'类型',Blocks.roles.map(r=>[r,r]),b.role);body.append(el('p','','块内标签可直接点击编辑。需要增加更多词时，选中本块后从词库添加或粘贴。'));if(b.recipe){const info=field(body,'来源配方',b.recipe,'textarea');info.readOnly=true;}},()=>{if(!name.value.trim())throw Error('请填写名称');commit(()=>{b.name=name.value.trim();b.role=role.value;});});}
function saveBlock(b){nameDialog('保存组合块',b.name,name=>commit(()=>{state.templates.push({id:Blocks.id(),name,role:b.role,positive:copy(b.positive),negative:copy(b.negative),weight:b.weight,recipe:b.recipe||'',...Blocks.languageFields(b),characters:charactersForBlock(b)});}));}
function updateSource(b){const t=state.templates.find(t=>t.id===b.sourceTemplateId);if(!t)return;modal('更新来源组合',body=>body.append(el('p','',`用当前块的词条、权重与启停状态更新组合库里的“${t.name}”。其他方案中已有的副本保持不变，之后加入会使用更新后的内容。`)),()=>commit(()=>{Object.assign(t,{role:b.role,positive:copy(b.positive),negative:copy(b.negative),weight:b.weight,...Blocks.languageFields(b),characters:charactersForBlock(b)});}),'更新组合');}
function promptDialog(title,initial,onSave){
 let name,role,pos,neg,syntax,preview,parsed;
 const update=()=>{try{parsed={positive:parsePrompt(pos.value,syntax.value),negative:parsePrompt(neg.value,syntax.value)};preview.textContent=`正面 ${parsed.positive.length} 词 · 负面 ${parsed.negative.length} 词\n`+[...parsed.positive,...parsed.negative].slice(0,16).map(t=>`${t.text}${t.weight===1?'':' ×'+t.weight}`).join(' / ');$('modalError').textContent='';$('modalConfirm').disabled=false;}catch(e){parsed=null;$('modalError').textContent=e.message;$('modalConfirm').disabled=true;}};
 modal(title,body=>{if(initial.name!==undefined){name=field(body,'名称',initial.name);role=selectField(body,'类型',Blocks.roles.map(r=>[r,r]),initial.role||'自由补充');}
  syntax=selectField(body,'输入语法',[['auto','自动识别'],['sd','SD / ComfyUI'],['nai','NovelAI']], 'auto');
  pos=field(body,'正面提示词',initial.positive||'','textarea');neg=field(body,'负面提示词',initial.negative||'','textarea');preview=el('div','preview');body.append(preview,el('p','','未收录词照常保留。识别逗号、换行、SD 与 NAI 权重。'));for(const input of [pos,neg,syntax])input.oninput=update;update();
 },()=>{update();if(!parsed)throw Error('请修正提示词格式');if(name&&!name.value.trim())throw Error('请填写名称');if(!parsed.positive.length&&!parsed.negative.length)throw Error('至少填写一个提示词');onSave({...parsed,name:name?.value.trim(),role:role?.value});});
}
function editTemplate(t){if(t.kind==='prose'){editProse(t,true);return;}
 // Keep disabled flags and exact text by editing identity here; content editing opens a local working copy.
 let name,role,recipe;modal('编辑组合资料',body=>{name=field(body,'名称',t.name);role=selectField(body,'类型',Blocks.roles.map(r=>[r,r]),t.role);recipe=field(body,'说明 / 配方',t.recipe||'','textarea');body.append(el('p','','这里只修改组合库资料，已有方案副本保持不变。修改词条请加入方案、编辑后保存为新组合。'));},()=>{if(!name.value.trim())throw Error('请填写名称');commit(()=>{t.name=name.value.trim();t.role=role.value;t.recipe=recipe.value;});});
}
function pasteIntoBlock(){const b=selected();if(!b){toast('请先选择内容块');return;}if(b.kind==='prose'){editProse(b);return;}promptDialog('粘贴到「'+b.name+'」',{},p=>commit(()=>{for(const side of ['positive','negative'])b[side].push(...p[side]);}));}
function editParams(){
 const initial=copy(scheme()),fields={},modelFields={};let notes,seedInput;
 const config=[['width','宽度'],['height','高度'],['steps','步数'],['cfg','CFG'],['denoise','重绘幅度'],['sampler_name','采样器'],['scheduler','调度器']];
 modal('配方参数',body=>{for(let i=0;i<config.length;i+=2){const row=el('div','form-row');for(const [key,label] of config.slice(i,i+2)){const input=field(row,label,initial.parameters?.[key]??'');fields[key]=input;}body.append(row);}
  seedInput=field(body,'种子（每行一个）',Blocks.schemeSeeds(initial.parameters || {}).join('\n'),'textarea');
  seedInput.rows=3;
  for(const [key,label] of [['unet_name','模型'],['clip_name','编码器'],['vae_name','VAE']])modelFields[key]=field(body,label,initial.models?.[key]||'');notes=field(body,'方案备注',initial.notes||'','textarea');body.append(el('p','','参数随方案保存，导出时包含；不会自动提交或修改 ComfyUI。'));},()=>{
  const p={...initial.parameters};for(const [key,input] of Object.entries(fields)){const value=input.value.trim();if(!value){delete p[key];continue;}if(['sampler_name','scheduler'].includes(key)){p[key]=value;continue;}const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('参数需要填写有效的非负数字');if(['width','height','steps'].includes(key)&&!Number.isSafeInteger(n))throw Error('宽高和步数需要填写安全范围内的整数');if(['width','height','steps'].includes(key)&&n===0)throw Error('宽高和步数需大于零');if(key==='denoise'&&n>1)throw Error('重绘幅度应在 0～1 之间');p[key]=n;}
  const seeds = seedInput.value.split(/\s+/).filter(Boolean).map(text => {
   Blocks.seedValue(text);
   const value = Number(text);
   return Number.isSafeInteger(value) ? value : text;
  });
  if (seeds.length) p.seed = seeds[0];
  else delete p.seed;
  if (seeds.length > 1) p.extra_seeds = seeds.slice(1);
  else delete p.extra_seeds;
  commit(()=>{scheme().parameters=p;scheme().models={...initial.models,...Object.fromEntries(Object.entries(modelFields).map(([k,v])=>[k,v.value.trim()]))};scheme().notes=notes.value;});
 });
}
async function copyOutput(side){try{const assembled=Blocks.assemble(scheme(),state.format);if(assembled.errors.length)throw Error(assembled.errors[0]);const text=assembled[side];if(native)await window.pywebview.api.copy(text);else await navigator.clipboard.writeText(text);toast('已复制'+(side==='positive'?'正面':'负面')+'提示词');}catch(e){toast('复制失败：'+e.message);}}
async function exportData(data,name){try{if(native){if(await window.pywebview.api.export_file(data))toast('已导出');}else{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch(e){toast('导出失败：'+e.message);}}
function importData(data){
 const incoming=data?.version===1?Blocks.importLegacy(data):Blocks.validate(data);let mode;
 modal('导入工作区',body=>{body.append(el('p','',`包含 ${incoming.schemes.length} 个方案、${incoming.templates.length} 个组合。`));mode=selectField(body,'导入方式',[['merge','合并到当前工作区（推荐）'],['replace','替换当前工作区，可撤销']], 'merge');},()=>commit(()=>{
  if(mode.value==='replace'){state=incoming;return;}
  const templateIds=new Map();for(const t of incoming.templates){const next=copy(t);next.id=Blocks.id();templateIds.set(t.id,next.id);state.templates.push(next);}
  for(const p of incoming.schemes){const next=copy(p);next.id=Blocks.id();if(state.schemes.some(x=>x.name===next.name))next.name+=' · 导入';for(const b of next.blocks){b.id=Blocks.id();if(b.sourceTemplateId)b.sourceTemplateId=templateIds.get(b.sourceTemplateId)||b.sourceTemplateId;}state.schemes.push(next);state.activeSchemeId=next.id;}
  state.favorites=[...new Set([...state.favorites,...incoming.favorites])];
 }), '导入');
}
function bind(){
 bindLanguage();
 $('agentTemplateImport').onclick=openAgentImport;
 $('themeSelect').onchange=()=>commit(()=>{state.theme=$('themeSelect').value;});
 $('blocks').ondragover=e=>{if(!blockDrag)return;const rect=$('blocks').getBoundingClientRect();if(e.clientY<rect.top+45)$('blocks').scrollTop-=25;else if(e.clientY>rect.bottom-45)$('blocks').scrollTop+=25;};
 $('modalForm').onsubmit=e=>{if(e.submitter?.value!=='ok')return;e.preventDefault();try{if(modalAction?.()===false)return;$('modal').close();}catch(error){$('modalError').textContent=error.message;}};
 $('schemeSelect').onchange=()=>commit(()=>{state.activeSchemeId=$('schemeSelect').value;});
 $('newScheme').onclick=()=>nameDialog('新建方案','新方案',name=>commit(()=>{const p=Blocks.scheme(name);state.schemes.push(p);state.activeSchemeId=p.id;}));
 $('renameScheme').onclick=()=>nameDialog('重命名方案',scheme().name,name=>commit(()=>{scheme().name=name;}));
 $('duplicateScheme').onclick=()=>nameDialog('另存为方案 · 保留完整分块',scheme().name+' · 副本',name=>{commit(()=>{const p=WorkspaceTools.cloneScheme(scheme(),name);state.schemes.push(p);state.activeSchemeId=p.id;});toast('已另存为新方案，可从顶部下拉框切换');});
 $('deleteScheme').onclick=()=>modal('删除方案',body=>body.append(el('p','',`删除“${scheme().name}”？可通过撤销恢复。`)),()=>commit(()=>{if(state.schemes.length<=1)throw Error('至少保留一个方案');state.schemes=state.schemes.filter(p=>p.id!==state.activeSchemeId);state.activeSchemeId=state.schemes[0].id;}),'删除');
 $('addBlock').onclick=()=>{let name,role;modal('新建内容块',body=>{name=field(body,'名称','自由补充');role=selectField(body,'类型',Blocks.roles.map(r=>[r,r]),'自由补充');role.onchange=()=>{name.value=role.value;};},()=>{if(!name.value.trim())throw Error('请填写名称');commit(()=>{const b=Blocks.block(name.value.trim(),role.value);scheme().blocks.push(b);selectedId=b.id;});});};
 $('paste').onclick=pasteIntoBlock;
 $('foldAll').onclick=()=>commit(()=>{const fold=scheme().blocks.some(b=>!b.collapsed||BlockSearch.isOpen(b));for(const b of scheme().blocks){if(fold)BlockSearch.close(b);b.collapsed=fold;}});
 $('saveSchemeTemplate').onclick=()=>{if(scheme().blocks.some(b=>b.kind==='prose')){saveMixedTemplate();return;}saveTagScheme();};
 const saveTagScheme=()=>nameDialog('整套存为组合',scheme().name,name=>{const positive=[],negative=[];for(const b of scheme().blocks.filter(b=>b.enabled))for(const side of ['positive','negative'])for(const t of b[side]){if(t.enabled)(side==='positive'?positive:negative).push({...copy(t),weight:Number((t.weight*b.weight).toFixed(6))});}if([...positive,...negative].some(t=>Math.abs(t.weight)>20))throw Error('合并后存在超过 ±20 的词权重，请降低整块倍率，或直接导出当前配方保存完整结构');commit(()=>{state.templates.push({id:Blocks.id(),name,role:'完整组合',positive,negative,parameters:copy(scheme().parameters),models:copy(scheme().models)});});});
 $('importTemplate').onclick=()=>promptDialog('导入组合块',{name:'新组合',role:'自由补充'},p=>commit(()=>{state.templates.push({id:Blocks.id(),...p});}));
 $('libraryTab').onclick=()=>{libraryView='words';renderLibrary();};$('templateTab').onclick=()=>{libraryView='templates';renderLibrary();};
 $('bundleTab').onclick=()=>{libraryView='bundles';shown=100;renderLibrary();};$('bundleSource').onchange=()=>{shown=100;renderLibrary();};
 $('search').oninput=()=>{shown=100;renderLibrary();};$('clearSearch').onclick=()=>{$('search').value='';renderLibrary();};
 $('category').onchange=()=>{shown=100;setGroups();renderLibrary();};$('group').onchange=()=>{shown=100;renderLibrary();};$('more').onclick=()=>{shown+=100;renderLibrary();};
 $('favoriteOnly').onclick=()=>{favoritesOnly=!favoritesOnly;renderLibrary();};
 for(const side of ['positive','negative'])$(side+'Target').onclick=()=>{targetSide=side;render();};
 $('undo').onclick=undo;$('redo').onclick=redo;$('format').onchange=()=>commit(()=>{state.format=$('format').value;});
 $('copyPositive').onclick=()=>copyOutput('positive');$('copyNegative').onclick=()=>copyOutput('negative');$('editParams').onclick=editParams;
 $('backup').onclick=()=>exportData(state,'提示词积木工作区.json');
 $('exportScheme').onclick=()=>exportData({...copy(state),schemes:[copy(scheme())]},scheme().name+'.json');
 $('restore').onclick=async()=>{try{if(native){const data=await window.pywebview.api.import_file();if(data)importData(data);}else{const input=el('input');input.type='file';input.accept='.json';input.onchange=async()=>{if(input.files[0])try{importData(JSON.parse(await input.files[0].text()));}catch(e){toast(e.message);}};input.click();}}catch(e){toast(e.message);}};
 $('help').onclick=()=>modal('使用说明',body=>{for(const text of ['① 先选中间的内容块，再从左侧点 ＋ 加词，再点 ✓ 取消。负面词库词条自动进入该块负面栏。','② 每块可以折叠、启停、整块调权重、复制和排序。点击词条可编辑，拖到另一个标签块可移动，正负面归属和词条权重会保留。','③ 左侧“组合块”可整体加入，或替换选中块。加入的是副本，编辑不会改变公共组合或其他方案。','④ 在顶部保存多个方案。切换会保留当前内容；复制方案适合对比不同角色、场景或画师串。','⑤ 相同文本与权重会去重，但保留来源；不同权重和正负冲突会提示，不自动覆盖。','⑥ 整块倍率与词条权重相乘。词块只是组织提示词，不代表区域控制或人物绑定。','⑦ 模型、种子等参数在右侧记录。导出当前配方保留块结构；整套存为组合会合并为一个块。','⑧ 支持导入旧版或新版备份，默认合并。导入前建议先导出备份。','⑨ 点“角色定义”给 A、B 配置完整姓名、固定身份标签与外貌，再添加“自然语言”块。中文描述可插入 {{A}}、{{B}}；翻译后自动展开成英文姓名。看书或牵手示例按钮会新建独立方案。','⑩ 中文原文和英文分别保存。改过中文、缺少英文或漏掉角色代号会提示，更新英文后可复制。翻译设置支持本地离线模型和自备接口，也可复制翻译请求给助手。黄色指代提醒不会阻止复制；请核对后使用。','快捷键：Ctrl+K 搜索；Ctrl+Z 撤销；Ctrl+Shift+Z 重做。','词库来源：Physton、老六、n714（MIT）；详情见 README 与第三方许可文件。分块交互思路参考 Infinite Canvas。'])body.append(el('p','',text));},()=>{},'知道了');
 document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();$('search').select();}if(e.ctrlKey&&e.key.toLowerCase()==='z'&&!$('modal').open&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();e.shiftKey?redo():undo();}});
}
async function boot(){try{
 if(!window.pywebview?.api)await new Promise(r=>{const t=setTimeout(r,1000);window.addEventListener('pywebviewready',()=>{clearTimeout(t);r();},{once:true});});
 native=!!window.pywebview?.api;const loaded=native?await window.pywebview.api.load():{library:await(await fetch('library.json')).json(),bundles:await(await fetch('bundles.json')).json(),state:JSON.parse(localStorage.getItem('prompt-blocks-workspace-v2')||'null')||await(await fetch('starter-workspace.json')).json()};
 bundleLibrary=loaded.bundles||[];for(const source of new Set(bundleLibrary.map(r=>r.source)))$('bundleSource').append(new Option(source,source));
 library=loaded.library;for(const e of library)if(!lookup.has(norm(e.text)))lookup.set(norm(e.text),e);
 state=Blocks.validate(loaded.state);Blocks.installCharacterTemplates(state);$('libraryCount').textContent=library.length.toLocaleString('en-US');
 for(const cat of new Set(library.map(e=>e.category)))$('category').append(new Option(cat,cat));setGroups();bind();render();window.appReady=true;save();
 }catch(e){$('saveStatus').textContent='载入失败';$('blocks').replaceChildren(el('div','empty',e.message+'。原文件未改动。'));console.error(e);}}
boot();
