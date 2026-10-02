import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-youtube');
const server = createServer(async (request, response) => {
  try {
    const file = path.join(directory, new URL(request.url, 'http://localhost').pathname === '/' ? 'index.html' : new URL(request.url, 'http://localhost').pathname);
    const body = await readFile(file);
    response.writeHead(200, {'content-type': {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'}[path.extname(file)] || 'application/octet-stream'});
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext();
  await context.route('https://www.youtube.com/game_api/v1', route => route.fulfill({contentType:'text/javascript',body:''}));
  await context.addInitScript(() => {
    window.__contentTest = {ready:0, saved:[], events:[]};
    window.ytgame = {IN_PLAYABLES_ENV:true,game:{firstFrameReady(){},gameReady(){window.__contentTest.ready++;},async loadData(){window.__contentTest.events.push('load');return '';},async saveData(data){window.__contentTest.saved.push(data);}},system:{async getLanguage(){return new URLSearchParams(location.search).get('language') || 'fr';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(callback){window.__contentTest.pause=callback;return ()=>{};},onResume(callback){window.__contentTest.resume=callback;return ()=>{};}},health:{logError(){},logWarning(){}}};
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let attempts = 0;
  await page.route('**/*playable-pack-fr-*.js*', route => ++attempts === 1 ? route.fulfill({status:503,body:'unavailable'}) : route.continue());
  await page.goto(origin);
  await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => window.__contentTest.ready), 0);
  assert.deepEqual(await page.evaluate(() => window.__contentTest.saved), []);
  await page.getByRole('button', {name:'Retry'}).click();
  await page.getByRole('heading', {name:'Choisissez une énigme'}).waitFor();
  assert.equal(attempts, 2);
  assert.equal(await page.evaluate(() => window.__contentTest.ready), 1);
  console.log('PASS: unavailable locale chunk retries without granting gameReady or saving early');
  await page.close();

  const delayed = await context.newPage();
  delayed.on('pageerror', error => errors.push(error.message));
  let release;
  let requested;
  const packRequested = new Promise(resolve => {requested = resolve;});
  await delayed.route('**/*playable-pack-fr-*.js*', async route => {
    requested();
    await new Promise(resolve => {release = resolve;});
    await route.continue();
  });
  await delayed.goto(origin, {waitUntil:'domcontentloaded'});
  await packRequested;
  await delayed.evaluate(() => window.__contentTest.pause());
  release();
  await delayed.waitForFunction(() => performance.getEntriesByType('resource').some(item => item.name.includes('playable-pack-fr-')));
  assert.equal(await delayed.evaluate(() => window.__contentTest.ready), 0);
  await delayed.evaluate(() => window.__contentTest.resume());
  await delayed.getByRole('heading', {name:'Choisissez une énigme'}).waitFor();
  assert.equal(await delayed.evaluate(() => window.__contentTest.ready), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: pause during locale download delays interactive startup until SDK resume');
  await delayed.close();
  const manifest = JSON.parse(await readFile(path.join(directory,'youtube-content-manifest.json'),'utf8'));
  for (const language of manifest.locales) {
    const localePage = await context.newPage();
    localePage.on('pageerror', error => errors.push(error.message));
    const packs = [];
    localePage.on('request', request => {if(request.url().includes('playable-pack-')) packs.push(request.url());});
    await localePage.goto(`${origin}/?language=${language}`);
    await localePage.waitForFunction(() => window.__contentTest.ready === 1);
    assert.equal(await localePage.locator('[data-youtube-playable-root]').getAttribute('lang'), language);
    assert.equal(packs.length, 1);
    assert.ok(packs[0].includes(`playable-pack-${language}-`));
    await localePage.close();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: all ${manifest.locales.length} bundled locales initialize with only their own pack`);
  await context.close();
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
