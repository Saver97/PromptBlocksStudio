const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('C:/Users/Agent/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright-core');
const ui = path.resolve(__dirname, '..', process.argv[2] || 'ui');

async function test() {
  const server = http.createServer((req, res) => {
    const name = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!/^[\w-]+\.(html|js|css|json)$/.test(name)) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', {html:'text/html', js:'application/javascript', css:'text/css', json:'application/json'}[path.extname(name).slice(1)]);
    res.end(fs.readFileSync(path.join(ui, name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.appReady);

    // 1. Custom words: add -> edit (sync favorites) -> delete -> undo
    await page.locator('#addLibraryWord').click();
    await page.getByLabel('提示词原文').fill('sunset_glow_test');
    await page.getByLabel('显示名称（可选）').fill('晚霞测试');
    await page.getByLabel('子分类', {exact:true}).fill('光照');
    await page.locator('#modalConfirm').click();
    await page.getByRole('button', {name: '收藏 晚霞测试'}).click();
    await page.getByRole('button', {name: '编辑自定义词条 晚霞测试'}).click();
    await page.getByLabel('提示词原文').fill('golden_sunset_test');
    await page.getByLabel('显示名称（可选）').fill('金色晚霞');
    await page.locator('#modalConfirm').click();
    const afterEdit = await page.evaluate(() => ({
      words: window.exportState().customWords,
      favs: window.exportState().favorites
    }));
    assert.equal(afterEdit.words[0].text, 'golden_sunset_test');
    assert.equal(afterEdit.words[0].label, '金色晚霞');
    assert.ok(afterEdit.favs.includes('custom:golden sunset test'));
    await page.getByRole('button', {name: '删除自定义词条 金色晚霞'}).click();
    await page.locator('#modalConfirm').click();
    assert.equal(await page.evaluate(() => window.exportState().customWords.length), 0);
    await page.locator('#undo').click();
    assert.equal(await page.evaluate(() => window.exportState().customWords.length), 1);

    // 2. Partial block rendering + quick weight adjust (+/-, Shift, Alt+Wheel)
    await page.locator('#newScheme').click();
    await page.getByLabel('名称').fill('优化测试方案');
    await page.locator('#modalConfirm').click();
    await page.locator('#addBlock').click();
    await page.getByLabel('名称').fill('第二块');
    await page.locator('#modalConfirm').click();
    const blockIds = await page.evaluate(() => scheme().blocks.map(b => b.id));
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-quick-input textarea`).fill('blue hair, looking back, violet eyes, school uniform, over shoulder');
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-quick-input textarea`).press('Enter');
    // Tag DOM reference of second block to confirm partial rendering doesn't rebuild unrelated blocks
    await page.evaluate(id => {
      window.__secondBlockEl = document.querySelector(`[data-block-id="${id}"]`);
    }, blockIds[1]);
    await page.locator(`[data-block-id="${blockIds[0]}"] .token[data-token-key="looking back"] .weight-step`).nth(1).click({force: true});
    const weightAfterPlus = await page.evaluate(id => {
      const b = scheme().blocks.find(x => x.id === id);
      const t = b.positive.find(x => x.text === 'looking back');
      return {
        weight: t.weight,
        enabled: t.enabled,
        preservedOtherBlock: document.querySelector(`[data-block-id="${scheme().blocks[1].id}"]`) === window.__secondBlockEl
      };
    }, blockIds[0]);
    assert.equal(weightAfterPlus.weight, 1.1);
    assert.equal(weightAfterPlus.enabled, true);
    assert.equal(weightAfterPlus.preservedOtherBlock, true, 'updating one block should not rebuild other blocks');
    await page.locator(`[data-block-id="${blockIds[0]}"] .token[data-token-key="looking back"] .weight-step`).nth(0).click({modifiers: ['Shift'], force: true});
    const weightAfterShiftMinus = await page.evaluate(id => scheme().blocks.find(x => x.id === id).positive.find(x => x.text === 'looking back').weight, blockIds[0]);
    assert.equal(weightAfterShiftMinus, 1.05);

    // 3. Block-level trait filter & batch disable / remove
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-find-toggle`).click();
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-find-trait`).click();
    const traitHits = await page.locator(`[data-block-id="${blockIds[0]}"] .token[data-filter-hit="1"]`).count();
    assert.equal(traitHits, 2, 'should match blue hair and violet eyes');
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-find-actions button`, {hasText: '停用命中'}).click();
    const disabledCount = await page.evaluate(id => scheme().blocks.find(x => x.id === id).positive.filter(t => !t.enabled).length, blockIds[0]);
    assert.equal(disabledCount, 2);
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-find-actions button`, {hasText: '移除命中'}).click();
    const remainingTexts = await page.evaluate(id => scheme().blocks.find(x => x.id === id).positive.map(t => t.text), blockIds[0]);
    assert.deepEqual(remainingTexts, ['looking back', 'school uniform', 'over shoulder']);

    // 4. Source list click-to-locate expands collapsed block
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-find-toggle`).click();
    await page.locator(`[data-block-id="${blockIds[0]}"] .block-head button[aria-label^="折叠"]`).click();
    assert.equal(await page.evaluate(id => scheme().blocks.find(x => x.id === id).collapsed, blockIds[0]), true);
    await page.locator('#sourceDetails summary').click();
    await page.locator('#sourceList .source-item', {hasText: 'looking back'}).click();
    assert.equal(await page.evaluate(id => scheme().blocks.find(x => x.id === id).collapsed, blockIds[0]), false);

    // 5. Role autocomplete (@ and {) in prose editor
    await page.locator('#editCharacters').click();
    await page.locator('.character-definition').first().getByLabel('输出姓名').fill('Togawa Sakiko');
    await page.locator('#modalConfirm').click();
    await page.locator('#addProse').click();
    const zhBox = page.getByLabel('正面描述 · 中文', {exact: true});
    await zhBox.fill('站在窗边的 @');
    await page.waitForSelector('.role-ac-menu:not([hidden])');
    await zhBox.press('Enter');
    assert.equal(await zhBox.inputValue(), '站在窗边的 {{A}}');
    await page.keyboard.press('Escape');

    // 6. Merge import preserves character.blockId mapping
    const linkedPayload = {
      version: 2,
      activeSchemeId: 's-old',
      format: 'comfy',
      favorites: [],
      templates: [],
      customWords: [],
      schemes: [{
        id: 's-old',
        name: '角色块关联导入测试',
        blocks: [
          {id: 'b-char-old', name: '雷电将军块', role: '角色', enabled: true, weight: 1, collapsed: false,
            positive: [{text: 'raiden shogun', label: '雷电将军', weight: 1, enabled: true}], negative: []},
          {id: 'b-prose-old', name: '动作', role: '自由补充', kind: 'prose', enabled: true, weight: 1, collapsed: false,
            positive: [], negative: [], positiveSource: '{{A}} 微笑。', positiveText: '{{A}} smiles.', positiveTranslatedFrom: '{{A}} 微笑。',
            negativeSource: '', negativeText: '', negativeTranslatedFrom: ''}
        ],
        characters: [{alias: 'A', name: 'Raiden Shogun', gender: 'female', identityTags: '', description: '', sourceDescription: '', translatedFrom: '', blockId: 'b-char-old'}],
        parameters: {}, models: {}, notes: ''
      }]
    };
    await page.locator('summary', {hasText: '菜单'}).click();
    const choose = page.waitForEvent('filechooser');
    await page.locator('#restore').click();
    await (await choose).setFiles({name: 'linked.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(linkedPayload))});
    await page.getByLabel('导入方式').selectOption('merge');
    await page.locator('#modalConfirm').click();
    const mergedCheck = await page.evaluate(() => {
      const p = scheme();
      const charBlock = p.blocks.find(b => b.role === '角色');
      const charDef = p.characters[0];
      const out = Blocks.assemble(p, 'comfy');
      return {
        remapped: charDef.blockId === charBlock.id && charDef.blockId !== 'b-char-old',
        positive: out.positive
      };
    });
    assert.equal(mergedCheck.remapped, true, 'character.blockId must remap to new block id on merge');
    assert.match(mergedCheck.positive, /Raiden Shogun: raiden shogun\./);

    assert.deepEqual(errors, []);
    console.log('PASS all enhancements: custom words edit/delete, quick weight, partial render, trait batch filter, source locate, role autocomplete, merge blockId remap');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

test().catch(error => { console.error(error); process.exitCode = 1; });
