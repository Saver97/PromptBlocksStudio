const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('node:assert/strict'), {webcrypto} = require('crypto');
const root = path.resolve(__dirname, '..'), ctx = vm.createContext({crypto:webcrypto, console});
for (const name of ['parser.js','model.js','agent-template.js']) vm.runInContext(fs.readFileSync(path.join(root,'ui',name),'utf8'),ctx);
const run = s => vm.runInContext(s,ctx);
const example = JSON.parse(run('JSON.stringify(AgentTemplate.example)'));
function parse(value) {ctx.input=typeof value==='string'?value:JSON.stringify(value);return run('AgentTemplate.parse(input)');}
function changed(fn) {const data=structuredClone(example);fn(data);return data;}
const initial = parse(example);
assert.equal(initial.blocks.length,5);
assert.equal(initial.characters[0].alias,'A');
assert.equal(initial.blocks[2].positive[1].weight,1.1);
ctx.scheme=initial;
assert.equal(run('Blocks.assemble(scheme).errors.length'),0);
assert(run('Blocks.assemble(scheme).positive').includes('Alice stands on the left'));
assert(run('Blocks.assemble(scheme).negative').includes('extra fingers'));
const roundTrip=run('AgentTemplate.serialize(scheme)');
ctx.restored=parse(roundTrip);
assert.equal(run('Blocks.assemble(restored).positive'),run('Blocks.assemble(scheme).positive'));
assert.equal(run('Blocks.assemble(restored).negative'),run('Blocks.assemble(scheme).negative'));
assert.notEqual(run('restored.id'),initial.id);
assert.equal(parse('```json\n'+JSON.stringify(example)+'\n```').blocks.length,5);
assert.equal(parse('\uFEFF'+JSON.stringify(example)).name,example.name);
const unique=parse(changed(d=>{d.blocks[0].positive=['not_in_any_catalog','a literal, containing a comma',{text:'soft light',label:'柔光',weight:1.5,enabled:false}];d.blocks[0].weight=2;d.parameters.seed='18446744073709551615';}));
assert.equal(unique.blocks[0].positive.length,3);
assert.equal(unique.blocks[0].positive[0].text,'not_in_any_catalog');
assert.equal(unique.blocks[0].positive[1].text,'a literal, containing a comma');
assert.equal(unique.blocks[0].positive[2].enabled,false);
assert.equal(unique.parameters.seed,'18446744073709551615');
for (const [mutate,message] of [
  [d=>d.format='wrong',/format/], [d=>d.version=2,/version/],
  [d=>d.unexpected=true,/unexpected/], [d=>d.blocks[0].typo=[],/blocks\[0\].typo/],
  [d=>d.blocks=[],/blocks/], [d=>d.blocks[0].positive='comma, list',/positive/],
  [d=>d.blocks[0].weight='1.2',/weight/], [d=>d.blocks[0].weight=21,/weight/],
  [d=>d.blocks[0].enabled='false',/enabled/], [d=>d.blocks[0].role='猜测分类',/role/],
  [d=>d.characters[1].alias='a',/角色/], [d=>d.characters=[],/未定义角色/],
  [d=>d.blocks[3].positive.en='{{C}} reads.',/未定义角色/],
  [d=>d.blocks[3].positive.en='Alice reads.',/不一致/],
  [d=>d.blocks[3].positive.zh='{A} 读书',/占位符/],
  [d=>d.blocks[3].weight=1.5,/自然语言块/],
  [d=>d.blocks[0].positive=['{{A}}'],/prose/],
  [d=>d.parameters.seed=Number.MAX_SAFE_INTEGER+1,/种子/],
  [d=>d.parameters.seed='18446744073709551616',/种子/],
  [d=>d.parameters.denoise=1.5,/重绘/], [d=>d.parameters.steps=0,/大于零/],
  [d=>d.models.api_key='fixture',/未知字段/]
]) assert.throws(()=>parse(changed(mutate)),message);
assert.throws(()=>parse('Here is your result:\n```json\n'+JSON.stringify(example)+'\n```'),/JSON/);
assert.throws(()=>parse('{"__proto__":{},"format":"prompt-blocks-template"}'),/未知字段/);
assert.throws(()=>parse('x'.repeat(1000001)),/100 万/);
const chineseOnly=parse(changed(d=>d.blocks[3].positive.en=''));
ctx.chineseOnly=chineseOnly;
assert(run('Blocks.assemble(chineseOnly).errors.some(e=>e.includes("尚未翻译"))'));
run("scheme.blocks[3].positiveSource+='新句子。'");
assert.throws(()=>run('AgentTemplate.serialize(scheme)'),/尚未同步/);
const instructions=run('AgentTemplate.instructions');
assert.equal(parse(instructions.match(/```json\n([\s\S]*?)\n```/)[1]).blocks.length,5);
console.log('PASS: versioned template, literal/unknown tags, weights, roles, prose, exact seed, roundtrip, Chinese drafts and invalid-field diagnostics');
