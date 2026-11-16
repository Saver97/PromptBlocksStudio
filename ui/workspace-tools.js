'use strict';
const WorkspaceTools=(()=>{
 function cloneScheme(source,name){const p=Blocks.copy(source);p.id=Blocks.id();p.name=name;for(const b of p.blocks)b.id=Blocks.id();delete p.restoredTemplateId;return p;}
 return {cloneScheme};
})();
const blockInputDrafts=new Map();
function blockInput(b){
 const key=scheme().id+':'+b.id,draft=blockInputDrafts.get(key)||{text:'',side:targetSide},wrap=el('div','block-quick-input'),input=el('textarea');
 input.rows=2;input.value=draft.text;input.placeholder='输入或粘贴提示词，支持逗号和权重';input.setAttribute('aria-label','直接输入提示词 '+b.name);
 const controls=el('div','block-input-actions'),side=el('select');side.setAttribute('aria-label','输入到正负面 '+b.name);side.append(new Option('正面','positive'),new Option('负面','negative'));side.value=draft.side;
 const remember=()=>{draft.text=input.value;draft.side=side.value;blockInputDrafts.set(key,draft);};
 const add=btn('加入本块','加入输入词 '+b.name,()=>{
  if(!input.value.trim())return;remember();let parsed;
  try{parsed=parsePrompt(input.value);}catch(e){toast(e.message+'；输入内容已保留');return;}
  if(!parsed.length)return;
  const original=draft.text;draft.text='';blockInputDrafts.set(key,draft);
  try{commit(()=>{b[side.value].push(...parsed);selectedId=b.id;});toast('已加入 '+parsed.length+' 个词条，可撤销');setTimeout(()=>document.querySelector('[data-block-id="'+b.id+'"] .block-quick-input textarea')?.focus(),0);}catch(e){draft.text=original;blockInputDrafts.set(key,draft);toast(e.message);}
 });
 add.disabled=!input.value.trim();input.oninput=()=>{remember();add.disabled=!input.value.trim();};side.onchange=remember;
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();add.click();}};
 controls.append(side,add,el('small','muted','Enter 加入 · Shift+Enter 换行'));wrap.append(input,controls);return wrap;
}
