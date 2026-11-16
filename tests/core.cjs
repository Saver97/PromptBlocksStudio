const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('node:assert/strict'), { webcrypto } = require('crypto');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ crypto: webcrypto, console });
for (const name of ['parser.js', 'model.js', 'workspace-tools.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'ui', name), 'utf8'), context);
}
const run = code => vm.runInContext(code, context);
context.starter = JSON.parse(fs.readFileSync(path.join(root, 'ui/starter-workspace.json'), 'utf8'));
run('Blocks.validate(starter)');
assert.equal(context.starter.schemes.length, 1);
assert.deepEqual(context.starter.templates, []);
assert.deepEqual(context.starter.favorites, []);
assert.deepEqual(context.starter.schemes[0].characters, []);
assert.equal(run('Blocks.assemble(starter.schemes[0]).positive'), '');
assert.equal(run('Blocks.assemble(starter.schemes[0]).negative'), '');

run(`var p=Blocks.scheme('Example');
var a=Blocks.block('A','角色',[token('blue hair','蓝发',1.2)]);
var b=Blocks.block('B','自由补充',[token('blue hair','蓝发',1.2)]);
p.blocks=[a,b];`);
assert.equal(run('Blocks.assemble(p).positive'), '(blue hair:1.2)');
assert.equal(run('Blocks.assemble(p).sources.positive[0].blocks.length'), 2);
run('b.weight=2');
assert.equal(run('Blocks.assemble(p).positive'), '(blue hair:1.2), (blue hair:2.4)');
assert.equal(run('Blocks.assemble(p).warnings.length'), 1);
assert.equal(run("Blocks.assemble(p,'nai').positive"), '1.2::blue hair::, 2.4::blue hair::');
run("b.negative=[token('blue hair')]");
assert(run('Blocks.assemble(p).warnings.some(w=>w.includes("同时出现在正面和负面"))'));
run("var cloned=WorkspaceTools.cloneScheme(p,'Independent');cloned.blocks[0].positive[0].text='red hair'");
assert.notEqual(run('cloned.id'), run('p.id'));
assert.notEqual(run('cloned.blocks[0].id'), run('p.blocks[0].id'));
assert.equal(run('p.blocks[0].positive[0].text'), 'blue hair');
assert.equal(run("parsePrompt('1.35::masterpiece, best quality::, (blue hair:1.2), custom_unknown')[3].text"), 'custom_unknown');
assert.throws(() => run("parsePrompt('(broken')"));

run(`var scene=Blocks.scheme('Book example');
scene.characters=[{alias:'A',name:'Alice',description:'short hair',gender:'female',identityTags:''}];
var prose=Blocks.prose();prose.positiveSource='{{A}} 看书。';
prose.positiveText='{{A}} reads a book.';prose.positiveTranslatedFrom=prose.positiveSource;
scene.blocks=[prose];`);
assert.equal(run('Blocks.assemble(scene).positive'), 'Alice: short hair.\n\nAlice reads a book.');
assert.equal(run('Blocks.assemble(scene).errors.length'), 0);
run("prose.positiveSource='{{A}} 合上书。'");
assert(run('Blocks.assemble(scene).errors.length') > 0);
run('var bad=Blocks.copy(starter);bad.schemes[0].blocks[0].weight=Infinity');
assert.throws(() => run('Blocks.validate(bad)'));

const library = JSON.parse(fs.readFileSync(path.join(root, 'ui/library.json'), 'utf8'));
assert.equal(library.length, 3982);
assert(!library.some(r => r.category === '本地常用搭配'));
console.log('PASS: clean defaults, dictionary, weights, dedup, independent schemes, custom tokens, role expansion and stale translation validation');
