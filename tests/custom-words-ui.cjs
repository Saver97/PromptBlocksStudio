const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
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
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const ready = () => page.waitForFunction(() => window.appReady);
    await ready();
    const count = await page.locator('#libraryCount').innerText();
    const add = page.locator('#addLibraryWord');
    const confirm = page.locator('#modalConfirm');
    await add.click();
    await confirm.click();
    assert.match(await page.locator('#modalError').innerText(), /填写/);
    await page.getByLabel('提示词原文').fill('test_glass_outline');
    await page.getByLabel('显示名称（可选）').fill('玻璃轮廓测试');
    await page.getByLabel('子分类', {exact:true}).fill('构图测试');
    await page.getByLabel('添加到', {exact:true}).selectOption('negative');
    await confirm.click();
    assert.equal(await page.locator('#category').inputValue(), '自定义');
    assert.equal(await page.locator('#group').inputValue(), '构图测试');
    await page.locator('#undo').click();
    assert.equal(await page.locator('#libraryCount').innerText(), count);
    await page.locator('#redo').click();
    for (const query of ['玻璃轮廓测试', 'test glass outline']) {
      await page.locator('#search').fill(query);
      assert.equal(await page.locator('#results .word').count(), 1);
    }
    await page.getByRole('button', {name:'收藏 玻璃轮廓测试'}).click();
    await page.getByRole('button', {name:'添加 玻璃轮廓测试'}).click();
    assert.equal(await page.evaluate(() => selected().negative.at(-1).text), 'test_glass_outline');
    await add.click();
    await page.getByLabel('提示词原文').fill('TEST GLASS OUTLINE');
    await confirm.click();
    assert.match(await page.locator('#modalError').innerText(), /已有/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('prompt-blocks-workspace-v2'))?.favorites.includes('custom:test glass outline'));
    await page.reload();
    await ready();
    await page.locator('#favoriteOnly').click();
    await page.locator('#search').fill('玻璃轮廓测试');
    assert.equal(await page.locator('#results .word').count(), 1);
    const menu = page.getByTitle('备份与帮助');
    await menu.click();
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#backup').click();
    const download = await downloadEvent;
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.customWords[0].group, '构图测试');
    async function restore(data, mode) {
      await menu.click();
      const choose = page.waitForEvent('filechooser');
      await page.locator('#restore').click();
      await (await choose).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
      await page.getByLabel('导入方式').selectOption(mode);
      await confirm.click();
    }
    backup.customWords.push({text:'extra test',label:'第二条',group:'常用',negative:false});
    await restore(backup, 'merge');
    assert.equal(await page.evaluate(() => window.exportState().customWords.length), 2);
    delete backup.customWords;
    await restore(backup, 'replace');
    assert.deepEqual(await page.evaluate(() => window.exportState().customWords), []);
    assert.equal(await page.locator('#results .word').count(), 0);
    const additions = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/PromptBlocks-additions-2026.11.23.json'), 'utf8'));
    const before = await page.evaluate(() => window.exportState().schemes.length);
    await restore(additions, 'merge');
    const merged = await page.evaluate(() => window.exportState());
    assert.equal(merged.schemes.length, before + additions.schemes.length);
    assert.deepEqual(merged.customWords, additions.customWords);
    for (const scheme of additions.schemes) {
      assert.deepEqual(merged.schemes.find(item => item.name === scheme.name).blocks.map(b => b.name), scheme.blocks.map(b => b.name));
    }
    await page.locator('#themeSelect').selectOption('sakura');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'sakura');
    await page.locator('#tutorialBtn').click();
    await page.locator('#tutorialNav button').last().click();
    assert.ok(await page.locator('#tutorialBody h3').innerText());
    await page.locator('#tutorialClose').click();
    assert.deepEqual(errors, []);
    console.log('PASS custom word creation, validation, filtering, undo/redo, negative insertion, favorites, reload, backup and legacy restore');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
test().catch(error => { console.error(error); process.exitCode = 1; });
