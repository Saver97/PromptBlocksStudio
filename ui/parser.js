'use strict';
const norm=s=>s.trim().toLowerCase().replaceAll('_',' ').replace(/\s+/g,' ');
const token=(text,label=text,weight=1,enabled=true)=>({text,label,weight,enabled});
const lookup=new Map();
function parsePrompt(raw, syntax='auto') {
  const text=raw.replace(/\\\r?\n/g,'').trim();
  const mode=syntax==='auto'?(/::|[{}]/.test(text)?'nai':'sd'):syntax;
  function split(value) {
    const chunks=[];let part='',stack=[],nai=false;
    for(let i=0;i<value.length;i++) {
      const c=value[i];
      if(c==='\\'&&i+1<value.length){part+=c+value[++i];continue;}
      if(c===':'&&value[i+1]===':'){nai=!nai;part+='::';i++;continue;}
      if(!nai){
        if('([{'.includes(c))stack.push(c);
        if(')]}'.includes(c)){
          const wanted={')':'(',']':'[','}':'{'}[c];
          if(stack.pop()!==wanted)throw Error('括号不配对，请检查粘贴内容');
        }
      }
      if((c===','||c==='，'||c==='\n')&&!stack.length&&!nai){if(part.trim())chunks.push(part.trim());part='';}else part+=c;
    }
    if(nai)throw Error('NAI 权重缺少结尾的 ::');
    if(stack.length)throw Error('括号不配对，请检查粘贴内容');
    if(part.trim())chunks.push(part.trim());return chunks;
  }
  function parse(value, inherited=1, level=0){
    if(level>30)throw Error('括号嵌套过深');
    return split(value).flatMap(part=>{
      let m=part.match(/^\((.*):([-+]?(?:\d+\.?\d*|\.\d+))\)$/s);
      if(m)return parse(m[1],inherited*Number(m[2]),level+1);
      m=part.match(/^([-+]?(?:\d+\.?\d*|\.\d+))?::(.*)::$/s);
      if(m)return parse(m[2],inherited*(m[1]===undefined?1:Number(m[1])),level+1);
      if(part.startsWith('{')&&part.endsWith('}'))return parse(part.slice(1,-1),inherited*1.05,level+1);
      if(part.startsWith('[')&&part.endsWith(']'))return parse(part.slice(1,-1),inherited/(mode==='nai'?1.05:1.1),level+1);
      if(mode==='sd'&&part.startsWith('(')&&part.endsWith(')'))return parse(part.slice(1,-1),inherited*1.1,level+1);
      const weight=Number(inherited.toFixed(6));
      if(!Number.isFinite(weight)||weight<-20||weight>20)throw Error('解析后的权重超出 -20～20，请调整后导入');
      return token(part,lookup.get(norm(part))?.label||part,weight);
    });
  }
  return parse(text);
}
