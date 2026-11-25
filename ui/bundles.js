'use strict';
const BundleTools=(()=>{
 function append(block,positive,negative,key){
  if(block.kind==='prose')throw Error('请先选择一个标签块');
  for(const side of ['positive','negative'])for(const item of (side==='positive'?positive:negative)){
   if(!Number.isFinite(item.weight)||Math.abs(item.weight)>20)throw Error('组内权重超出当前支持范围');
  }
  block.positive.push(...positive.map(t=>({...t,...(key?{bundleId:key}:{})})));
  block.negative.push(...negative.map(t=>({...t,...(key?{bundleId:key}:{})})));
 }
 function toggle(block,recipe,side){
  if(block.kind==='prose')throw Error('请先选择一个标签块');
  const target=recipe.negative?'negative':side,key=recipe.id+':'+target;
  if(block[target].some(t=>t.bundleId===key)){block[target]=block[target].filter(t=>t.bundleId!==key);return false;}
  append(block,target==='positive'?recipe.tokens:[],target==='negative'?recipe.tokens:[],key);return true;
 }
 return {append,toggle};
})();
let bundleLibrary=[];
function addBundle(recipe){const block=selected();if(!block||block.kind==='prose'){toast('先选中要加入的标签块');return;}let added;commit(()=>{added=BundleTools.toggle(block,recipe,targetSide);});toast(added?'已整组加入「'+block.name+'」，可逐词编辑或撤销':'已移除这次整组添加，原有词条保留');}
function previewBundle(recipe){modal('词库配方 · '+recipe.name,body=>{
 body.append(el('p','',recipe.source+' / '+recipe.category));
 const text=field(body,'配方原文',recipe.raw,'textarea');text.readOnly=true;
 body.append(el('p','muted',recipe.parseNote||('共 '+recipe.tokens.length+' 个词条，原有权重会一起加入。')));
 if(recipe.negative)body.append(el('p','muted','这是来源词库的负面配方，加入当前块的负面栏。'));
 },()=>{if(!selected()||selected().kind==='prose'){toast('先选中要加入的标签块');return false;}addBundle(recipe);},'整组加入 / 取消');}
function renderBundleLibrary(q,frag){
 const source=$('bundleSource').value;
 const matches=bundleLibrary.filter(r=>(!source||r.source===source)&&(!q||(r._search??=norm([r.name,r.raw,r.category,r.source].join(' '))).includes(q)));
 $('resultCount').textContent=matches.length+' 组配方';$('more').hidden=matches.length<=shown;
 for(const recipe of matches.slice(0,shown)){
  const row=el('div','template bundle-option'),side=recipe.negative?'negative':targetSide,key=recipe.id+':'+side,added=selected()?.[side].some(t=>t.bundleId===key);
  row.append(el('h3','',recipe.name+(recipe.negative?' · 负面':'')),el('p','',recipe.source+' · '+recipe.category),el('p','bundle-excerpt',recipe.raw));
  const actions=el('div','actions'),add=btn(added?'✓ 已加入，再点取消':'＋ 整组加入',(added?'取消配方 ':'加入配方 ')+recipe.id,()=>addBundle(recipe),added?'added':'');add.title=(added?'移除这次添加：':'加入选中块：')+recipe.name;add.setAttribute('aria-pressed',String(!!added));add.disabled=!selected()||selected().kind==='prose';
  actions.append(add,btn('预览','预览配方 '+recipe.id,()=>previewBundle(recipe)));row.append(actions);frag.append(row);
 }
 if(!matches.length)frag.append(el('div','empty','没有匹配配方，试试名称、分类或英文关键词。'));
}
function appendTemplate(t){const block=selected();if(!block||block.kind==='prose'||t.kind==='prose'){toast('请先选择标签块');return;}const weighted=side=>t[side].map(x=>({...x,weight:Number((x.weight*(t.weight??1)).toFixed(6))}));try{commit(()=>BundleTools.append(block,weighted('positive'),weighted('negative')));toast('已将组合整组加入当前块，可撤销');}catch(e){toast(e.message);}}
