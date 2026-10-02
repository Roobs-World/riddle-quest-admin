import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

// Cold browser contexts, local uncompressed artifacts, 4x CPU slowdown and a
// deterministic 300ms host SDK response. No live provider/backend timing noise.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedTargets = ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo'];
const targets = process.env.LOAD_TARGETS?.split(',') ?? supportedTargets;
assert.ok(targets.every(target => supportedTargets.includes(target)), 'Unknown measurement target');
const results = [];
const browser = await chromium.launch({headless: true});
try {
  for (const target of targets) {
    const directory = path.join(process.env.LOAD_ARTIFACT_ROOT ?? root, `dist-${target}`);
    const html = await readFile(path.join(directory, 'index.html'), 'utf8');
    const initialJs = [...new Set([...html.matchAll(/(?:src|href)="\.\/([^" ]+\.js)"/g)].map(match => match[1]))];
    const initialJsBytes = (await Promise.all(initialJs.map(async file => (await stat(path.join(directory, file))).size))).reduce((sum, size) => sum + size, 0);
    const server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const file = path.join(directory, pathname === '/' ? 'index.html' : pathname);
        const type = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.webp':'image/webp'}[path.extname(file)];
        const body = await readFile(file);
        response.writeHead(200, {'content-type': type || 'application/octet-stream', 'cache-control':'no-store'});
        response.end(body);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const runs = [];
    try {
      for (let run = 0; run < 5; run++) {
        const context = await browser.newContext({viewport: {width:390, height:844}});
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await context.route(/^https:\/\//, async route => {
          await new Promise(resolve => setTimeout(resolve, 300));
          await route.fulfill({status:200, contentType:'text/javascript', body:''});
        });
        await page.addInitScript(() => {
          window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
          window.devvit = {context:{}, entrypoints:{game:'/index.html'}, token:'browser-test-token', webViewMode:1};
          window.ytgame = {IN_PLAYABLES_ENV:true, game:{firstFrameReady(){}, gameReady(){window.__gameReadyAt=performance.now();}, async loadData(){return '';}, async saveData(){}}, system:{async getLanguage(){return 'fr-CA';}, isAudioEnabled(){return false;}, onAudioEnabledChange(){return ()=>{};}, onPause(){return ()=>{};}, onResume(){return ()=>{};}}, health:{logError(){}, logWarning(){}}};
          window.FBInstant = {async initializeAsync(){}, setLoadingProgress(){}, async startGameAsync(){}, getSupportedAPIs(){return [];}, onPause(){}, onResume(){}, player:{getID(){return 'load-test';}, getName(){return 'Solver';}, getPhoto(){return null;}, async getDataAsync(){return {};}, async setDataAsync(){}, async getSignedPlayerInfoAsync(){throw Error('offline measurement');}}};
        });
        const session = await context.newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', {rate:4});
        if (process.env.LOAD_DOWNLOAD_KBPS) {
          await session.send('Network.enable');
          await session.send('Network.emulateNetworkConditions', {offline:false, latency:80,
            downloadThroughput:Number(process.env.LOAD_DOWNLOAD_KBPS)*1024, uploadThroughput:100*1024});
        }
        await page.goto(`http://127.0.0.1:${server.address().port}/?harness=jest`);
        await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
        if (['youtube','netflix','yahoo'].includes(target)) await page.getByRole('button', {name:/classique|classic/i}).waitFor();
        else await page.locator('#root button').first().waitFor();
        const metrics = await page.evaluate(() => ({
          fcpMs: performance.getEntriesByName('first-contentful-paint')[0].startTime,
          domContentLoadedMs: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
          readyMs: window.__gameReadyAt ?? null,
          interactiveMs: performance.now(),
          loadedJsBytes: performance.getEntriesByType('resource').filter(item => /\.js(?:\?|$)/.test(item.name)).reduce((sum,item) => sum+item.decodedBodySize,0),
          contentChunks: performance.getEntriesByType('resource').filter(item => /playable-pack-/.test(item.name)).map(item => item.name.split('/').pop()),
        }));
        assert.deepEqual(errors, [], `${target} browser errors`);
        if (process.argv.includes('--expect-split-content') && ['youtube','netflix','yahoo'].includes(target)) {
          assert.equal(metrics.contentChunks.length, 1, `${target} loaded extra locale packs`);
          assert.ok(metrics.contentChunks[0].includes(`playable-pack-${target === 'youtube' ? 'fr' : 'en'}-`), `${target} loaded the wrong locale pack`);
        }
        if (process.argv.includes('--expect-monolithic-content') && ['youtube','netflix','yahoo'].includes(target)) {
          assert.equal(metrics.contentChunks.length, 0, `${target} baseline unexpectedly contains split packs`);
          assert.ok(initialJsBytes > 1_000_000, `${target} baseline is missing the monolithic content`);
        }
        runs.push(metrics);
        if (run === 0 && process.env.LOAD_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.LOAD_SCREENSHOT_DIR, `${target}.png`)});
        await context.close();
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
    const median = key => runs.map(item => item[key]).filter(item => item !== null).sort((a,b) => a-b)[2] ?? null;
    const result = {target, initialJsBytes, medianFcpMs:median('fcpMs'), medianDomContentLoadedMs:median('domContentLoadedMs'), medianReadyMs:median('readyMs'), medianInteractiveMs:median('interactiveMs'), medianLoadedJsBytes:median('loadedJsBytes'), runs};
    results.push(result);
    console.log(JSON.stringify(result));
  }
} finally { await browser.close(); }
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify({conditions:`5 cold runs; local uncompressed assets; mobile viewport; 4x CPU; 300ms injected SDK response; French playable locale${process.env.LOAD_DOWNLOAD_KBPS ? `; ${process.env.LOAD_DOWNLOAD_KBPS} KiB/s download; 80ms RTT` : ''}`, results}, null, 2)+'\n');
