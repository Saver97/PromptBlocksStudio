const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({});
for(const name of ['parser.js','bundles.js'])vm.runInContext(fs.readFileSync(path.join(root,'ui',name),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),catalog=JSON.parse(fs.readFileSync(path.join(root,'ui/bundles.json'),'utf8'));
assert.equal(new Set(catalog.map(r=>r.id)).size,catalog.length);assert.equal(catalog.length,483);
for(const recipe of catalog){assert(recipe.raw.length);assert(recipe.tokens.length);for(const t of recipe.tokens)assert(Number.isFinite(t.weight)&&Math.abs(t.weight)<=20);if(recipe.parseNote)assert.equal(recipe.tokens[0].text,recipe.raw);}
ctx.recipe=catalog.find(r=>r.name==='简单起手'&&r.source==='老六词库');
run("var b={positive:[token('masterpiece')],negative:[]};BundleTools.toggle(b,recipe,'positive')");assert.equal(run('b.positive.length'),3);
run("BundleTools.toggle(b,recipe,'positive')");assert.equal(run('b.positive.length'),1);assert.equal(run('b.positive[0].text'),'masterpiece');
ctx.recipe=catalog.find(r=>r.negative&&r.tokens.length>2);run("BundleTools.toggle(b,recipe,'positive')");assert.equal(run('b.positive.length'),1);assert.equal(run('b.negative.length'),ctx.recipe.tokens.length);
ctx.recipe=catalog.find(r=>r.parseNote);run("BundleTools.toggle(b,recipe,'positive')");assert.equal(run('b.positive[b.positive.length-1].text'),ctx.recipe.raw);
ctx.recipe=catalog.find(r=>!r.negative&&r.tokens.some(t=>t.weight!==1)&&!r.parseNote);run("var weighted={positive:[],negative:[]};BundleTools.toggle(weighted,recipe,'positive')");assert.deepStrictEqual(JSON.parse(run('JSON.stringify(weighted.positive.map(t=>t.weight))')),ctx.recipe.tokens.map(t=>t.weight));
assert.throws(()=>run("BundleTools.toggle({kind:'prose'},recipe,'positive')"));
console.log('PASS: 483 retained recipes, raw fallback, original weights, negative routing, toggle preserves existing words');
