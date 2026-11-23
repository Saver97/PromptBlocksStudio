'use strict';
const knownCharacters=Blocks.characterPresets;
function llmRequestControls(controls,status){
 let active=null;const buttons=[];
 const update=()=>{for(const b of buttons)b.disabled=!!active;stop.hidden=!active;};
 const stop=btn('停止请求','停止当前请求',()=>{const task=active;if(!task)return;task.cancelled=true;active=null;update();status.textContent='已停止本地请求，原文保留。';if(window.pywebview?.api?.cancel_request)Promise.resolve(window.pywebview.api.cancel_request(task.id)).catch(()=>{status.textContent='已停止等待；连接中止未确认，迟到结果不会覆盖内容。';});});
 stop.hidden=true;stop.title='停止本地等待并关闭连接；供应商可能仍在计算。';controls.insertBefore(stop,status);
 return {track(b){buttons.push(b);update();},start(){if(active)return null;active={id:crypto.randomUUID(),cancelled:false};update();return active;},accepts(task){return active===task&&!task.cancelled;},finish(task){if(active===task){active=null;update();}}};
}
async function copyReturnedText(text){try{if(native)await window.pywebview.api.copy(text);else await navigator.clipboard.writeText(text);toast('已复制返回内容');}catch(e){toast('复制失败：'+e.message);}}
function mergeCharacters(p,incoming){p.characters??=[];for(const c of incoming||[])if(!p.characters.some(x=>x.alias===c.alias))p.characters.push(copy(c));}
function charactersForBlock(b){const used=new Set(Blocks.aliases((b.positiveText||'')+'\n'+(b.negativeText||'')));return copy((scheme().characters||[]).filter(c=>used.has(c.alias)));}
function renderLanguage(){const chars=scheme().characters||[];$('characterCount').textContent=chars.length;$('characterSummary').textContent=chars.length?chars.map(c=>c.alias+' = '+c.name).join(' · '):'先定义 A、B，再写互动';}
async function copyTranslationRequest(text){if(!text.trim()){toast('请先填写中文');return;}const request='请把以下中文生图描述翻译为简洁准确的英文。保留所有 {{A}}、{{B}} 这类占位符及其出现次数，明确人物、左右手和位置关系，不增加原文没有的动作、外貌或画风。保留段落，只返回译文，不解释、不加代码围栏。\n\n'+text;try{if(native)await window.pywebview.api.copy(request);else await navigator.clipboard.writeText(request);toast('已复制翻译请求，发送给助手后将英文粘回右栏');}catch(e){toast('复制失败：'+e.message);}}
function addPolishControls(wrap,controls,pair,label,side,status){
 const panel=el('div','polish-panel');panel.hidden=true;
 panel.append(el('p','muted','核对修改前后内容。采用后还需翻译英文，保存弹窗后才写入方案。'));
 const comparison=el('div','form-row'),original=field(comparison,label+' · 润色前','','textarea'),candidate=field(comparison,label+' · 中文润色候选','','textarea'),notes=el('div','polish-notes');original.readOnly=true;panel.append(comparison,notes);
 const rawDetails=el('details'),rawSummary=el('summary','','原始返回内容'),raw=field(rawDetails,label+' · 润色原始返回','','textarea');raw.readOnly=true;rawDetails.prepend(rawSummary);panel.append(rawDetails);
 const highlightLabel=el('p','muted'),highlight=el('div','role-preview');highlight.setAttribute('aria-label',label+' · 角色替换高亮');panel.insertBefore(highlightLabel,notes);panel.insertBefore(highlight,notes);
 let snapshot='',contextSnapshot='',resultText='',roleChanges=[];
 const context=()=>copy(scheme().characters||[]);
 function renderHighlights(){
  const text=candidate.value,exact=text===resultText,chars=[...text];highlight.replaceChildren();
  const ranges=exact?roleChanges:[...text.matchAll(/\{\{[^{}]*\}\}/g)].map(m=>({start:[...text.slice(0,m.index)].length,end:[...text.slice(0,m.index+m[0].length)].length}));
  highlightLabel.textContent=exact?(ranges.length?'高亮：本次新增或规范化的角色引用，悬停可查看角色。':'本次没有新增或规范化的角色引用。'):'候选已手动修改：以下高亮所有角色引用，请核对。';
  let end=0;for(const range of ranges){if(range.start<end||range.end>chars.length)continue;highlight.append(document.createTextNode(chars.slice(end,range.start).join('')));const token=chars.slice(range.start,range.end).join(''),mark=el('mark','role-change',token),alias=token.slice(2,-2),character=context().find(c=>c.alias===alias);mark.title=character?alias+' = '+character.name:'角色 '+alias;highlight.append(mark);end=range.end;}highlight.append(document.createTextNode(chars.slice(end).join('')));
 }
 candidate.addEventListener('input',renderHighlights);
 const current=()=>pair.source.value===snapshot&&JSON.stringify(context())===contextSnapshot;
 const apply=btn('采用润色','采用润色 '+label,()=>{
  if(!current()){status.textContent='原文或角色定义已修改，请重新润色。';return;}
  if(!candidate.value.trim()){status.textContent='候选稿不能为空。';return;}
  pair.source.value=candidate.value.trim();pair.source.dispatchEvent(new Event('input'));
  status.textContent='已采用中文润色。请更新英文，返回内容保留供对照。';
 });
 const actions=el('div','language-actions');actions.append(apply,btn('复制候选','复制润色候选 '+label,()=>copyReturnedText(candidate.value)),btn('放弃候选','放弃润色 '+label,()=>{status.textContent='已放弃采用，返回内容保留供查看或复制。';}));panel.append(actions);wrap.append(panel);
 const polish=btn('中文润色','中文润色 '+label,async()=>{
  if(!pair.source.value.trim()){toast('请先填写中文');return;}
  if(!native||!window.pywebview.api.polish){status.textContent='中文润色需要新版桌面程序，以及“翻译 / 润色设置”中的文字模型接口。';return;}
  const task=pair.requests.start();if(!task)return;
  const characters=context(),requestContext=JSON.stringify(characters),requestSource=pair.source.value;
  status.textContent='正在按生图描述整理中文…';
  try{
   const result=await window.pywebview.api.polish(requestSource,side,characters,task.id);
   if(!pair.source.isConnected||!pair.requests.accepts(task))return;
   if(result.cancelled){status.textContent='已停止请求。';return;}
   if(result.error)throw Error(result.error);
   snapshot=requestSource;contextSnapshot=requestContext;original.value=requestSource;candidate.value=result.text||result.raw||'';raw.value=result.raw||result.text||'';resultText=candidate.value;roleChanges=result.roleChanges||[];renderHighlights();notes.replaceChildren(...[...(result.warnings||[]),...(result.notes||[])].map(note=>el('div','warning',note)));
   apply.disabled=!current();panel.hidden=false;status.textContent=!current()?'原文或角色定义已修改，本次结果未采用；返回内容已展示。':result.valid===false?'返回内容已展示，请核对或修改后自行采用。':'候选稿已生成，原文未修改；请核对后采用。';
  }catch(e){if(pair.source.isConnected&&pair.requests.accepts(task))status.textContent=e.message;}
  finally{pair.requests.finish(task);}
 });
 pair.source.addEventListener('input',()=>{if(!panel.hidden)apply.disabled=!current();});
 controls.prepend(polish);
 pair.requests.track(polish);
}
async function localChinese(items, kind, requestId) {
 const api = window.pywebview?.api;
 if (!api?.translate_to_chinese) throw Error('请在更新后的桌面程序中使用本地英译中。');
 const result = await api.translate_to_chinese(items, kind, requestId);
 if (result.error) throw Error(result.error);
 if (result.cancelled) throw Error('请求已停止。');
 return result.translations;
}
async function chineseTagLabels(texts) {
 const labels = new Map(), missing = [];
 for (const text of new Set(texts)) {
  const known = lookup.get(norm(text))?.label;
  if (known && /[\u3400-\u9fff]/.test(known)) labels.set(text, known);
  else missing.push(text);
 }
 for (let start = 0; start < missing.length;) {
  let end = start + 1, length = missing[start].length;
  while (end < missing.length && length + missing[end].length <= 12000) {
   length += missing[end++].length;
  }
  const batch = missing.slice(start, end);
  const translated = await localChinese(batch, 'tags', crypto.randomUUID());
  batch.forEach((text, i) => labels.set(text, translated[i]));
  start = end;
 }
 return texts.map(text => labels.get(text));
}
async function translateBlockLabels(block, button) {
 const tokens = [...block.positive, ...block.negative].filter(t => !/[\u3400-\u9fff]/.test(t.label || ''));
 if (!tokens.length) { toast('词条已有显示名称。'); return; }
 const snapshot = tokens.map(t => ({text:t.text, label:t.label}));
 button.disabled = true;
 button.textContent = '翻译中…';
 try {
  const labels = await chineseTagLabels(snapshot.map(t => t.text));
  if (!button.isConnected || !scheme().blocks.includes(block)) return;
  if (tokens.some((t,i) => t.text !== snapshot[i].text || t.label !== snapshot[i].label)) return;
  commit(() => tokens.forEach((t,i) => { t.label = labels[i]; }));
  toast('已补全词条显示名，可撤销。');
 } catch (error) { if (button.isConnected) toast(error.message); }
 finally { button.disabled = false; button.textContent = '翻译词条'; }
}
// 自然语言“中文 → 英文”可选引擎：按翻译设置，或本地混元 HY-MT（更准、稍慢）。选择记在本机。
let hunyuanCheck=null;
function hunyuanReady(){if(!hunyuanCheck)hunyuanCheck=(native&&window.pywebview.api.translation_settings?window.pywebview.api.translation_settings().then(s=>!!(s&&s.hunyuan_available)).catch(()=>false):Promise.resolve(false));return hunyuanCheck;}
function proseEngineSelect(label){
 const wrap=el('label','engine-picker'),select=el('select','engine-select');wrap.append(el('span','','引擎'),select);
 select.setAttribute('aria-label','翻译引擎 '+label);select.title='“按翻译设置”使用翻译设置里选的引擎；混元只用电脑处理器，不占显卡，首次使用需启动约 10 秒。';
 const def=new Option('按翻译设置','default'),hy=new Option('混元（本地，更准）','local-hunyuan');select.append(def,hy);
 select.value=localStorage.getItem('pb-prose-engine')||'default';
 select.onchange=()=>{localStorage.setItem('pb-prose-engine',select.value);document.querySelectorAll('.engine-select').forEach(s=>{if(s!==select&&!s.querySelector('option[value=local-hunyuan]').disabled)s.value=select.value;});};
 const install=btn('如何安装？','查看混元翻译的安装方法',()=>hunyuanInstallGuide(),'engine-install');install.hidden=true;wrap.append(install);
 hunyuanReady().then(ok=>{if(ok)return;hy.disabled=true;hy.textContent='混元（未安装）';install.hidden=false;if(select.value==='local-hunyuan')select.value='default';});
 return {wrap,select};
}
// 混元未安装时的安装指引：组件不随程序提供，引导用户自行下载并放进 hunyuan 文件夹，放好后可直接重新检测。
function hunyuanInstallGuide(){
 const api=native?window.pywebview.api:null,dialog=el('dialog','hunyuan-guide'),form=el('div','hunyuan-guide-body');
 const head=el('div','dialog-heading');head.append(el('h2','','安装混元翻译（可选）'),btn('×','关闭安装指引',()=>dialog.close()));
 const status=el('p','muted guide-status'),folderText=el('code','guide-folder','（请在桌面程序中查看）');
 const open=key=>async()=>{if(!api||!api.open_download){toast('请在桌面程序中打开下载地址');return;}const r=await api.open_download(key);if(r&&r.error)toast(r.error);};
 const step=(n,title,detail,actions)=>{const box=el('div','guide-step');box.append(el('span','guide-num',String(n)));const text=el('div','guide-text');text.append(el('strong','',title));for(const d of detail)text.append(typeof d==='string'?el('p','muted',d):d);const row=el('div','language-actions');row.append(...actions);text.append(row);box.append(text);return box;};
 form.append(el('p','','混元只用电脑处理器运行，不占显卡显存，翻译动作描述比默认的本地翻译更准。组件约 1.2GB，不随程序提供，需要自己下载后放进安装文件夹。'),
  step(1,'下载翻译模型',['文件名 HY-MT1.5-1.8B-Q4_K_M.gguf，约 1.13GB。'],[btn('打开下载地址','打开混元模型下载地址',open('model')),btn('模型主页','打开混元模型主页',open('model_page'))]),
  step(2,'下载运行工具 llama.cpp',['在发布页里找一个带文件列表（Assets）的版本，下载名字里同时有 win、cpu、x64 的 zip，约 25MB。','不要选带 cuda、vulkan 的显卡版，那会占用出图显存。'],[btn('打开发布页','打开 llama.cpp 发布页',open('llama'))]),
  step(3,'放进安装文件夹',[folderText,'模型文件直接放进这个文件夹；zip 解压到里面的 llama 文件夹，让 llama-server.exe 位于 llama 文件夹里。'],[btn('打开安装文件夹','打开混元安装文件夹',async()=>{if(!api||!api.open_hunyuan_folder){toast('请在桌面程序中打开');return;}const r=await api.open_hunyuan_folder();if(r&&r.error)toast(r.error);})]),
  status);
 const actions=el('div','dialog-actions'),recheck=btn('重新检测','重新检测混元组件',()=>refresh(true),'primary');actions.append(btn('关闭','关闭安装指引',()=>dialog.close()),recheck);
 async function refresh(announce){
  if(!api||!api.hunyuan_status){status.textContent='网页预览无法检测，请在桌面程序中使用。';return;}
  const s=await api.hunyuan_status();if(s.folder)folderText.textContent=s.folder;
  status.textContent=s.error||('模型：'+(s.has_model?'✓ 已找到 '+s.model:'✗ 未找到')+'　　运行工具：'+(s.has_server?'✓ 已找到':'✗ 未找到 llama\llama-server.exe'));
  if(s.available){hunyuanCheck=Promise.resolve(true);document.querySelectorAll('.engine-select option[value=local-hunyuan]').forEach(o=>{o.disabled=false;o.textContent='混元（本地，更准）';});document.querySelectorAll('.engine-install').forEach(b=>{b.hidden=true;});if(announce){toast('混元已就绪，可以在“引擎”里选择');dialog.close();}}
  else if(announce)toast('还没找到完整的混元组件，请按步骤放好后再检测');
 }
 dialog.append(head,form,actions);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();refresh(false);
}
function translatorPair(body,label,sourceValue,textValue,translatedFrom='',placeholders=true,side='positive'){
 const wrap=el('div','translation-pair'),row=el('div','form-row');const source=field(row,label+' · 中文',sourceValue,'textarea'),english=field(row,label+' · 英文输出',textValue,'textarea');wrap.append(row);
 source.placeholder=placeholders?'例如：{{B}} 用右手握住 {{A}} 的左手。':'例如：浅蓝色长发，金色眼睛';english.placeholder='点击翻译，或粘贴助手返回的英文';
 const controls=el('div','language-actions'),status=el('span','muted'),diagnostics=el('div','translation-checks'),pair={source,english,translatedFrom};
 const returned=el('div','translation-return polish-panel');returned.hidden=true;const returnedStatus=el('p','muted'),returnedText=field(returned,label+' · 翻译返回内容','','textarea');returned.prepend(returnedStatus);let returnedSource='',returnedEnglish='';
 const returnedActions=el('div','language-actions');returnedActions.append(btn('采用返回内容','采用翻译返回 '+label,()=>{if(!returnedText.value.trim()){status.textContent='返回内容不能为空。';return;}if(source.value!==returnedSource){status.textContent='中文原文已变动，返回内容可复制，请重新翻译后再采用。';return;}english.value=returnedText.value;english.dispatchEvent(new Event('input'));status.textContent='已手动采用返回内容，请核对角色引用。';}),btn('复制返回内容','复制翻译返回 '+label,()=>copyReturnedText(returnedText.value)));returned.append(returnedActions);
 const engineChoice=placeholders?proseEngineSelect(label):null;
 const translate=btn('中文 → 英文','翻译 '+label,async()=>{
  const original=source.value,previousEnglish=english.value;if(!original.trim()){toast('请先填写中文');return;}if(!native||!window.pywebview.api.translate){status.textContent='先设置翻译接口，或复制翻译请求给助手。';return;}
  const engine=engineChoice&&engineChoice.select.value!=='default'?engineChoice.select.value:null;const task=pair.requests.start();if(!task)return;status.textContent=engine==='local-hunyuan'?'混元翻译中…（首次使用需先启动，约 10 秒）':'正在翻译…';
  try{
   const result=await window.pywebview.api.translate(original,task.id,engine);if(!source.isConnected||!pair.requests.accepts(task))return;if(result.cancelled){status.textContent='已停止请求。';return;}if(result.error)throw Error(result.error);
   returnedSource=original;returnedEnglish=previousEnglish;returnedText.value=result.text||result.raw||'';returned.hidden=false;
   const stale=source.value!==original||english.value!==previousEnglish;
   returnedStatus.textContent=[...(result.warnings||[]),stale?'编辑内容已变动，返回内容已保留，未自动覆盖。':''].filter(Boolean).join('\n')||'接口返回内容，可修改或复制。';
   if(result.valid===false||stale){status.textContent='返回内容已展示，未自动采用；请核对下方结果。';return;}
   english.value=result.text;pair.translatedFrom=original;english.dispatchEvent(new Event('input'));status.textContent=result.notice||'已翻译，返回内容保留在下方供核对。';
  }catch(e){if(source.isConnected&&pair.requests.accepts(task))status.textContent=e.message;}finally{pair.requests.finish(task);}
 });
 const reverse = btn('英文 → 中文（本地）', '本地英译中 '+label, async () => {
  const original = english.value, previous = source.value;
  if (!original.trim()) { status.textContent = '请先填写英文。'; return; }
  const task = pair.requests.start();
  if (!task) return;
  status.textContent = '正在本地翻译英文…';
  try {
   const [translation] = await localChinese([original], 'prose', task.id);
   if (!$('modal').open || !source.isConnected || !pair.requests.accepts(task)) return;
   if (english.value !== original || source.value !== previous) {
    status.textContent = '内容已变动，请再次翻译。'; return;
   }
   pair.translatedFrom = translation;
   source.value = translation;
   source.dispatchEvent(new Event('input'));
   status.textContent = '中文译文已填入，可编辑后保存。';
  } catch (error) { if (source.isConnected && pair.requests.accepts(task)) status.textContent = error.message; }
  finally { pair.requests.finish(task); }
 });
 if(engineChoice)controls.append(engineChoice.wrap);
 controls.append(translate,reverse,btn('复制翻译请求','复制翻译请求 '+label,()=>copyTranslationRequest(source.value)),status);wrap.append(controls,diagnostics);
 pair.requests=llmRequestControls(controls,status);pair.requests.track(translate);pair.requests.track(reverse);wrap.append(returned);
 if(placeholders)addPolishControls(wrap,controls,pair,label,side,status);
 if(placeholders){const insert=el('div','language-actions role-insert');insert.append(el('span','muted','插入角色：'));for(const alias of [...new Set(['A','B',...(scheme().characters||[]).map(c=>c.alias)])])insert.append(btn('{{'+alias+'}}','插入角色 '+alias,()=>{const start=source.selectionStart,end=source.selectionEnd;source.setRangeText('{{'+alias+'}}',start,end,'end');source.focus();source.dispatchEvent(new Event('input'));}));wrap.insertBefore(insert,row);}
 const updateStatus=()=>{status.textContent=source.value.trim()?(english.value.trim()?(pair.translatedFrom===source.value?'英文对应当前原文':'中文已修改，请更新英文'):'待翻译，可先保存中文草稿'):'可直接填写英文';diagnostics.replaceChildren(...(placeholders?Blocks.proseWarnings(english.value,scheme().characters,source.value):[]).map(w=>el('div','warning',w)));};source.addEventListener('input',updateStatus);english.addEventListener('input',()=>{pair.translatedFrom=source.value;updateStatus();});updateStatus();body.append(wrap);return pair;
}
function editCharacters(){let list,auto,autoIdentity;const rows=[];
 modal('角色定义 · 每个方案独立保存',body=>{
  $('modal').classList.add('language-dialog');
  body.append(el('p','','身份标签回答“画谁”，固定英文外貌回答“长什么样”。这两项直接拼接，不经过动作翻译。自然语言用 {{A}} 引用，输出时替换成完整姓名。'));
  const identityLabel=el('label','check-label');autoIdentity=el('input');autoIdentity.type='checkbox';autoIdentity.checked=scheme().autoIdentity!==false;identityLabel.append(autoIdentity,el('span','','自动添加被引用角色的身份标签（同词去重）'));body.append(identityLabel);
  const autoLabel=el('label','check-label'),check=el('input');check.type='checkbox';check.checked=scheme().autoIntroduce!==false;auto=check;autoLabel.append(check,el('span','','自动补充被引用角色的外貌介绍'));body.append(autoLabel);list=el('div','character-editor');body.append(list);
  function addRow(c){const card=el('div','character-definition'),top=el('div','form-row');const alias=field(top,'代号',c.alias),name=field(top,'输出姓名',c.name);alias.maxLength=16;name.placeholder='例如 Nagasaki Soyo';card.append(top);
   const preset=selectField(card,'从常用角色填入',[['','手动填写']],'');
   const groups=new Set(['MyGO!!!!!','Ave Mujica',...knownCharacters.map(p=>p.group)]);
   for(const label of groups){
     const group=document.createElement('optgroup');group.label=label;
     knownCharacters.forEach((p,i)=>{if(p.group===label)group.append(new Option(p.review ? p.label+' · '+p.review : p.label,String(i)));});
     preset.append(group);
   }
   const identity=field(card,'固定身份标签（英文，逗号分隔）',c.identityTags||'');identity.placeholder='例如 nagasaki soyo, bang dream!';
   const gender=selectField(card,'性别（用于译文检查）',[['unknown','未指定'],['female','女性'],['male','男性'],['other','其他']],c.gender||'unknown');
   const pair=translatorPair(card,'外貌描述',c.sourceDescription||'',c.description||'',c.translatedFrom||'',false);
   const note=el('p','muted','常用角色会一次填入完整姓名、身份标签和已校对的英文外貌。外貌只有主动点击翻译时才会重译；原创角色可不填身份标签。文字组装不等于区域绑定或锁脸。');card.append(note);
   preset.onchange=()=>{if(preset.value==='')return;const p=knownCharacters[Number(preset.value)];name.value=p.name;identity.value=p.identityTags;gender.value=p.gender;pair.source.value=p.sourceDescription;pair.english.value=p.description;pair.english.dispatchEvent(new Event('input'));};
   const syncChoice=()=>{const i=knownCharacters.findIndex(p=>p.name===name.value&&p.identityTags===identity.value&&p.gender===gender.value&&p.sourceDescription===pair.source.value&&p.description===pair.english.value);preset.value=i<0?'':String(i);};
   for(const input of [name,identity,gender,pair.source,pair.english])input.addEventListener('input',syncChoice);
   syncChoice();
   const row={alias,name,identity,gender,pair,removed:false};rows.push(row);card.append(btn('移除定义','移除角色定义 '+c.alias,()=>{row.removed=true;card.remove();}));list.append(card);
  }
  const existing=scheme().characters||[];for(const c of existing.length?existing:[{alias:'A',name:'',description:''},{alias:'B',name:'',description:''}])addRow(c);
  body.append(btn('＋ 增加角色','增加角色定义',()=>{const used=new Set(rows.filter(r=>!r.removed).map(r=>r.alias.value.toUpperCase()));let n=0;while(used.has(n<26?String.fromCharCode(65+n):'R'+n))n++;addRow({alias:n<26?String.fromCharCode(65+n):'R'+n,name:'',description:''});}));
 },()=>{const chars=rows.filter(r=>!r.removed&&(r.name.value.trim()||r.identity.value.trim()||r.pair.source.value.trim()||r.pair.english.value.trim())).map(r=>({alias:r.alias.value.trim().toUpperCase(),name:r.name.value.trim(),identityTags:r.identity.value.trim(),gender:r.gender.value,description:r.pair.english.value.trim(),sourceDescription:r.pair.source.value,translatedFrom:r.pair.translatedFrom}));Blocks.validateCharacters(chars);commit(()=>{scheme().characters=chars;scheme().autoIntroduce=auto.checked;scheme().autoIdentity=autoIdentity.checked;});});
}
function proseCardBody(b){const body=el('div','block-body prose-body');for(const side of ['positive','negative'])if(b[side+'Source']||b[side+'Text']){body.append(el('div','token-side-label',side==='positive'?'正面描述':'负面描述'));if(b[side+'Source'])body.append(el('p','prose-source',b[side+'Source']));if(b[side+'Text'])body.append(el('p','prose-english',b[side+'Text']));else body.append(el('p','muted','待翻译 · 点“编辑”继续'));}if(!b.positiveText&&!b.negativeText&&!b.positiveSource&&!b.negativeSource)body.append(el('p','empty','点编辑，用中文写场景和互动；用 {{A}}、{{B}} 引用角色。'));return body;}
function editProse(b,isTemplate=false,isNew=false){let name,pos,neg,preview;modal(isNew?'新建自然语言块':'编辑自然语言 · 中文与英文',body=>{
 $('modal').classList.add('language-dialog');name=field(body,'名称',b.name);body.append(el('p','','这里只写动作、表情和场景；身份与外貌在“角色定义”中固定。每句明确谁对谁做什么，必要时交代另外一只手的位置。支持 {{A}}，小写 {{a}} 也可以。'));
 pos=translatorPair(body,'正面描述',b.positiveSource||'',b.positiveText||'',b.positiveTranslatedFrom||'');
 const extra=el('details');extra.open=!!(b.negativeSource||b.negativeText);extra.append(el('summary','','负面自然语言（可选）'));body.append(extra);neg=translatorPair(extra,'负面描述',b.negativeSource||'',b.negativeText||'',b.negativeTranslatedFrom||'',true,'negative');
 BlockSearch.editor(b,[pos.source,pos.english,neg.source,neg.english]);
 preview=el('div','preview');body.append(el('p','muted','展开预览（按当前方案的角色定义）'),preview);
 const update=()=>{const p=copy(scheme()),draft={...copy(b),...read()};const i=p.blocks.findIndex(x=>x.id===b.id);if(i>=0)p.blocks[i]=draft;else p.blocks=[draft];const out=Blocks.assemble(p,state.format);preview.textContent=out.errors.length?out.errors.join('\n'):out.positive;};
 for(const pair of [pos,neg])for(const input of [pair.source,pair.english])input.addEventListener('input',update);update();
 },()=>{if(!name.value.trim())throw Error('请填写名称');const values=read();if(!values.positiveText.trim()&&!values.negativeText.trim()&&!values.positiveSource.trim()&&!values.negativeSource.trim())throw Error('至少填写一段中文或英文');commit(()=>{Object.assign(b,values,{name:name.value.trim()});if(isNew){scheme().blocks.push(b);selectedId=b.id;}if(isTemplate)b.characters=charactersForBlock(b);});});
 function read(){return {kind:'prose',positiveText:pos.english.value,negativeText:neg.english.value,positiveSource:pos.source.value,negativeSource:neg.source.value,positiveTranslatedFrom:pos.translatedFrom,negativeTranslatedFrom:neg.translatedFrom};}
}
function saveMixedTemplate(){nameDialog('整套存为组合 · 保留角色变量',scheme().name,name=>{const out=Blocks.assemble(scheme(),state.format,true);if(out.errors.length)throw Error('请先更新各段英文，或导出当前配方保留中文草稿');commit(()=>{state.templates.push({id:Blocks.id(),name,role:'完整组合',kind:'prose',positive:[],negative:[],positiveText:out.positive,negativeText:out.negative,characters:copy(scheme().characters||[]),parameters:copy(scheme().parameters),models:copy(scheme().models),recipe:'合并组合保留角色变量；标签权重使用保存时的输出格式。完整分块结构可通过导出配方保留。'});});});}
function translationSettings(){let engine,endpoint,model,key,status,apiPanel,localNote;modal('翻译 / 润色设置',body=>{
 $('modal').classList.add('language-dialog');
 body.append(el('p','','翻译可选本地 OPUS-MT 或文字接口。中文润色始终使用下方文字接口，也支持本机运行的 LLM。仅主动点击时发送当前段落；润色另附当前段落引用的角色定义，不发送整套词库。'));
 engine=selectField(body,'翻译引擎',[['local-opus','本地离线 · OPUS-MT（CPU）'],['api','在线 / 自备接口']],'local-opus');
 localNote=el('p','','OPUS-MT 中英双向 · INT8 · 仅使用 CPU。首次翻译需要加载模型，后续重复文本会直接复用结果。原文和译文均可保存。');body.append(localNote);
 apiPanel=el('div','character-editor');body.append(apiPanel);
 apiPanel.append(el('p','muted','API 格式：Responses（/responses）；思考强度：低（low）。基础地址只追加 /responses，不添加版本号；完整 /responses 地址原样使用。润色与 API 翻译共用，翻译选本地时也能单独润色。'));
 endpoint=field(apiPanel,'Base URL / 完整 Responses 地址','');endpoint.placeholder='例如 https://api.deepseek.com';model=field(apiPanel,'模型名称','');model.placeholder='填写服务提供的文字模型名';key=field(apiPanel,'API Key（留空保留已有值）','');key.type='password';key.autocomplete='off';status=el('p','muted','正在读取本机设置…');body.append(status);
 const clear=el('label','check-label'),checkbox=el('input');checkbox.type='checkbox';clear.append(checkbox,el('span','','清除已保存密钥'));apiPanel.append(clear);
 const available=selectField(apiPanel,'选择接口模型',[['','先获取列表，也可在上方手动填写模型名称']],'');available.disabled=true;
 const credentials=()=>JSON.stringify({endpoint:endpoint.value.trim(),key:key.value,clear_key:checkbox.checked});
 const fetchModels=btn('获取模型列表','获取模型列表',async()=>{
  if(!native||!window.pywebview.api.list_models){status.textContent='请在新版桌面程序中获取模型列表。';return;}
  const snapshot=credentials();fetchModels.disabled=true;status.textContent='正在获取模型列表…';
  try{
   const result=await window.pywebview.api.list_models(JSON.parse(snapshot));
   if(!available.isConnected)return;
   if(snapshot!==credentials()){status.textContent='接口设置已变动，请重新获取模型列表。';return;}
   if(result.error)throw Error(result.error);
   available.replaceChildren(new Option('请选择模型，或手动填写模型名称',''),...result.models.map(id=>new Option(id,id)));
   available.disabled=!result.models.length;
   available.value=result.models.includes(model.value.trim())?model.value.trim():'';
   status.textContent=result.models.length?'已获取 '+result.models.length+' 个模型。选择后点击“保存翻译设置”。列表包含服务公开的模型，请选择支持 Responses 的文字模型。':'服务返回空列表，可手动填写模型名称。';
  }catch(e){if(status.isConnected)status.textContent=e.message;}
  finally{fetchModels.disabled=false;}
 });apiPanel.append(fetchModels);
 available.onchange=()=>{if(available.value){model.value=available.value;status.textContent='已选择 '+available.value+'，点击“保存翻译设置”生效。';}};
 model.addEventListener('input',()=>{available.value=model.value.trim();});
 for(const input of [endpoint,key,checkbox])input.addEventListener('input',()=>{available.replaceChildren(new Option('设置已修改，请重新获取模型列表',''));available.disabled=true;});
 const refresh=()=>{localNote.hidden=engine.value!=='local-opus';};engine.onchange=refresh;refresh();
 const saveButton=btn('保存翻译设置','保存翻译接口设置',async()=>{if(!native||!window.pywebview.api.save_translation_settings){status.textContent='请在桌面程序内配置翻译。';return;}saveButton.disabled=true;try{const result=await window.pywebview.api.save_translation_settings({engine:engine.value,endpoint:endpoint.value.trim(),model:model.value.trim(),key:key.value,clear_key:checkbox.checked});if(result.error)throw Error(result.error);if(status.isConnected){key.value='';checkbox.checked=false;status.textContent='已保存。回到自然语言编辑框使用“中文润色”或“中文 → 英文”。';}}catch(e){if(status.isConnected)status.textContent=e.message;}finally{saveButton.disabled=false;}});body.append(saveButton);
 if(native&&window.pywebview.api.translation_settings)window.pywebview.api.translation_settings().then(s=>{if(!endpoint.isConnected)return;engine.value=s.engine||'api';endpoint.value=s.endpoint||'';model.value=s.model||'';refresh();status.textContent=s.error?s.error:s.local_available?'本地模型已安装，可以离线翻译。':'本地模型尚未就绪，可先使用接口或复制翻译请求。';}).catch(e=>{if(status.isConnected)status.textContent=e.message;});else status.textContent='网页预览不加载本地模型，请使用桌面程序。';
 },()=>{},'关闭');}
function createLanguageDemo(handholding=false){commit(()=>{
 const p=Blocks.scheme(handholding?'双人互动示例 · 单手牵手':'角色变量示例 · 一起看书');
 p.characters=knownCharacters.slice(0,2).map((c,i)=>({alias:i?'B':'A',name:c.name,identityTags:c.identityTags,gender:c.gender,sourceDescription:c.sourceDescription,description:c.description,translatedFrom:c.sourceDescription}));
 p.blocks=[Blocks.block('共同标签','公共基础',parsePrompt(handholding?'masterpiece, best quality, 2girls, casual clothes, garden':'masterpiece, best quality, 2girls, casual clothes, library, upper body'))];
 const b=Blocks.prose(handholding?'单手牵手 · 明确四只手':'一起看书 · 中文模板');
 b.positiveSource=handholding?'{{A}} 站在左边，{{B}} 站在右边。\n{{A}} 向 {{B}} 伸出左手。{{B}} 用右手握住 {{A}} 的左手。\n{{A}} 的右手自然垂在 {{A}} 身侧，{{B}} 的左手自然垂在 {{B}} 身侧。\n{{A}} 看着 {{B}}，露出害羞的微笑。{{B}} 微笑着看向 {{A}}。\n两人站在花园里，身后是绿树和一张白色长椅。':'{{A}} 站在左边，{{B}} 站在右边。\n{{B}} 双手捧着一本打开的书，{{A}} 用右手食指指向书页上的一行文字。两人都低头看着书。';
 b.positiveText=handholding?"{{A}} stands on the left, and {{B}} stands on the right.\n{{A}} extends the left hand toward {{B}}. {{B}} uses the right hand to hold {{A}}'s left hand.\n{{A}}'s free right hand rests at {{A}}'s side, and {{B}}'s free left hand rests at {{B}}'s side.\n{{A}} looks at {{B}} with a shy smile. {{B}} smiles back at {{A}}.\nBoth girls stand in a garden with green trees and a white bench behind them.":'{{A}} stands on the left, and {{B}} stands on the right.\n{{B}} holds an open book with both hands. {{A}} points to a line on the page with her right index finger. Both girls look down at the book.';
 b.positiveTranslatedFrom=b.positiveSource;p.blocks.push(b);state.schemes.push(p);state.activeSchemeId=p.id;selectedId=b.id;
 });}
function bindLanguage(){
 $('editCharacters').onclick=editCharacters;$('addProse').onclick=()=>editProse(Blocks.prose(),false,true);$('languageDemo').onclick=()=>createLanguageDemo();$('handholdingDemo').onclick=()=>createLanguageDemo(true);$('translationSettings').onclick=translationSettings;
 $('modal').addEventListener('close',()=>{$('modal').classList.remove('language-dialog');});
}
