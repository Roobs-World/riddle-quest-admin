import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adapter = path.join(root, "src/reddit/RedditHostServices.ts");
const baseline = process.env.REDDIT_DELIVERY_BASELINE_SOURCE;
const output = path.resolve(process.env.REDDIT_DELIVERY_REPORT_DIR ?? path.join(root, "../../artifacts/game-reddit-receipts-2026-10-03"));
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/reddit-delivery-"));
const receipt = {attempts: 1, isCorrect: true, coinsEarned: 50, scoreEarned: 100, xpEarned: 10,
  newXp: 10, newLevel: 1, leveledUp: false, newlyUnlockedAchievementIds: [],
  rewardBreakdown: {baseWinCoins: 50, levelUpBonus: 0, dailyStreakBonus: 0, achievementBonus: 0, newBalance: 350, totalAwarded: 50}};
await writeFile(path.join(scratch, "main.ts"), `
import {createRedditHostServices} from ${JSON.stringify(adapter)};
import ${JSON.stringify(path.join(root, "src/styles.css"))};
window.probe={requests:[],delayMs:0,failProfile:false,holdProfile:false,pendingProfiles:[],snapshots:[],holdBuffer:false,pendingBuffers:[],
  profile:{username:'Solver',coins:300,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:17}};
const receipt=${JSON.stringify(receipt)};
window.reply=result=>new Response(JSON.stringify({ok:true,result}),{headers:{'content-type':'application/json'}});
window.question=index=>({riddleId:'classic-'+index,text:'Issued puzzle '+index,answerLength:5,
  sessionToken:'00000000-0000-4000-8000-'+String(index).padStart(12,'0'),questionNumber:1,
  attemptsUsed:window.probe.recovery?1:0,hasUsedContinue:false,awaitingContinue:false,
  ...(window.probe.recovery?{evaluation:{answer:'piano',locale:'en'},revealedHints:[{index:0,letter:'p'}],
    acceptedGuesses:[{attempt:1,feedback:Array.from('crane',(letter,index)=>({letter,status:index===2||index===3?'green':'red'}))}]}:{})});
window.buffer=index=>({confirmedClassicIndex:index,riddles:[{classicIndex:index,expiresAtMs:Date.now()+60000,question:window.question(index)}]});
window.fetch=async(path,init)=>{
  if(!String(path).startsWith('/api/'))throw new Error('Escaped same-origin gateway');
  window.probe.requests.push({path,body:JSON.parse(init.body),signal:init.signal});
  if(path==='/api/account/delete')return window.reply({});
  if(path.endsWith('game.complete'))return window.reply(receipt);
  if(path.endsWith('coins.spend'))return window.reply({newCoins:275});
  if(path.endsWith('profile.load')){
    if(window.probe.holdProfile)return new Promise(resolve=>window.probe.pendingProfiles.push(resolve));
    if(window.probe.failProfile)throw new Error('Injected optional profile outage');
    await new Promise(resolve=>setTimeout(resolve,window.probe.delayMs));return window.reply(window.probe.profile);
  }
  if(path.endsWith('riddle.classic-buffer')){
    if(window.probe.holdBuffer)return new Promise(resolve=>window.probe.pendingBuffers.push(resolve));
    return window.reply(window.buffer(17));
  }
  if(path.endsWith('riddle.classic'))return window.reply({classicIndex:17,challenge:{totalQuestions:1,questions:[window.question(17)]}});
  if(path.endsWith('riddle.daily'))return window.reply(window.probe.daily??{challenge:{totalQuestions:1,questions:[window.question(1)]}});
  throw new Error('Unexpected gateway operation '+path);
};
window.services=createRedditHostServices();
window.call=kind=>kind==='completion'?window.services.completeGame({riddleId:'classic-17',gameMode:'classic',sessionToken:'issued-session'}):
  window.services.spendCoins({reason:'continue',amount:25,requestId:'same-retry-request',riddleId:'classic-17',gameMode:'classic',sessionToken:'issued-session'});
window.measure=async kind=>{const started=performance.now();const value=await window.call(kind);
  document.querySelector('output').textContent=kind+' confirmed';return {value,elapsedMs:performance.now()-started};};
window.subscribe=()=>window.services.auth.subscribe(value=>window.probe.snapshots.push(value));
window.loadAuthority=()=>{window.authority=null;window.authorityPromise=window.services.loadRiddle({gameMode:'classic',locale:'en',authoritative:true})
  .then(value=>{window.authority=value;document.querySelector('output').textContent='Classic '+value.index+' recovery confirmed';});};
window.mountHost=async()=>{
  const [React,{createRoot},{PlayHostApp},{createHostedPlaySession}]=await Promise.all([import('react'),import('react-dom/client'),
    import(${JSON.stringify(path.join(root, "src/play/PlayHostApp.tsx"))}),import(${JSON.stringify(path.join(root, "src/play/HostedPlaySession.ts"))})]);
  localStorage.clear();document.querySelector('output').hidden=true;
  window.probe.recovery=true;window.probe.daily={hasCompletedToday:true,error:'Daily complete'};
  const element=document.createElement('div');element.id='host';document.body.appendChild(element);const root=createRoot(element);
  const session=createHostedPlaySession({hostServices:window.services,initialGameMode:'challenge'});
  root.render(React.createElement(React.StrictMode,null,React.createElement(PlayHostApp,{session,onPlayable:()=>window.hostPlayable=true})));
  window.disposeHost=()=>{root.unmount();element.remove();};
};
`);
await writeFile(path.join(scratch, "index.html"), '<html><body><output>Waiting for authority</output><script type="module" src="/main.ts"></script></body></html>');
let server, browser;
const samples = [];
try {
  await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
  await build({root: scratch, configFile: false, publicDir:path.join(root,"public"), logLevel: "error", plugins: [{name: "reddit-delivery-baseline", enforce: "pre",
    async load(id) {if (baseline && id === adapter) return readFile(baseline, "utf8");}}], build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const file = path.join(scratch, "dist", pathname === "/" ? "index.html" : pathname);
      response.writeHead(200, {"content-type": file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "text/html"});
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true});
  for (const width of [1280, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {window.probe.delayMs=300;});
    for (const kind of ["completion", "spend"]) {
      const timings = [];
      for (let run = 0; run < 5; run++) {
        const result = await page.evaluate(kind => window.measure(kind), kind);
        assert.deepEqual(result.value, kind === "completion" ? receipt : {newCoins: 275});
        assert.equal(await page.locator("output").innerText(), `${kind} confirmed`);
        timings.push(result.elapsedMs);
      }
      timings.sort((a,b) => a-b);
      samples.push({width, kind, injectedOptionalProfileDelayMs: 300, timingsMs: timings, medianMs: timings[2]});
      if (!baseline) assert.ok(timings[2] < 150, "Confirmed receipts must not await the optional 300ms profile read");
    }
    await page.waitForTimeout(350);
    if (!baseline) {
      await page.evaluate(() => {window.probe.failProfile=true;});
      for (const kind of ["completion", "spend"])
        assert.deepEqual((await page.evaluate(kind => window.measure(kind), kind)).value, kind === "completion" ? receipt : {newCoins:275});
      await page.evaluate(() => {window.probe.failProfile=false;window.probe.delayMs=0;window.subscribe();});
      await page.waitForFunction(() => window.probe.snapshots.at(-1)?.profile?.coins===300);
      await page.evaluate(() => {
        window.probe.holdProfile=true;window.older=null;
        window.services.loadProfile('reddit-account').then(value=>window.older={value});window.services.loadProfile('reddit-account');
        window.probe.pendingProfiles[1](window.reply({...window.probe.profile,coins:500}));
      });
      await page.waitForFunction(() => window.probe.snapshots.at(-1).profile?.coins===500);
      await page.evaluate(() => window.probe.pendingProfiles[0](window.reply({...window.probe.profile,coins:100})));
      await page.waitForFunction(() => window.older !== null);
      assert.equal(await page.evaluate(() => window.older.value), null);
      assert.equal(await page.evaluate(() => window.probe.snapshots.at(-1).profile.coins), 500);
      await page.evaluate(async () => {
        window.services.loadProfile('reddit-account');await window.services.deleteAccount('reddit-account');
        window.probe.pendingProfiles[2](window.reply({...window.probe.profile,coins:10}));
      });
      await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(resolve)));
      assert.deepEqual(await page.evaluate(() => window.probe.snapshots.at(-1)), {user:null,profile:null});
      await page.reload();
      await page.evaluate(() => {
        window.probe.holdBuffer=true;window.services.preloadInitialRiddles('en');window.loadAuthority();
        window.probe.pendingBuffers[1](window.reply(window.buffer(18)));
      });
      await page.waitForFunction(() => window.authority !== null);
      assert.equal(await page.evaluate(() => window.authority.index), 18);
      await page.evaluate(() => window.probe.pendingBuffers[0](window.reply(window.buffer(17))));
      const contentRequests=await page.evaluate(() => window.probe.requests.filter(request=>request.path.includes('riddle.')).map(request=>request.body));
      assert.ok(contentRequests.every(body=>body.includeHintRecovery===true && body.includeGuessRecovery===true));
      await page.screenshot({path:path.join(output, `reddit-recovery-${width}.png`)});
      await page.reload();
      await page.evaluate(async () => {
        window.probe.daily={error:'ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE'};window.services.preloadInitialRiddles('en');
        await Promise.resolve();await Promise.resolve();await Promise.resolve();
      });
      await page.waitForFunction(() => window.probe.requests.filter(request=>request.path.endsWith('riddle.daily')).length===1);
      await page.evaluate(async () => {
        window.probe.daily={challenge:{totalQuestions:1,questions:[window.question(1)]}};
        window.dailyResult=await window.services.loadRiddle({gameMode:'challenge',locale:'en'});
      });
      assert.equal(await page.evaluate(() => window.dailyResult.riddleId), 'classic-1');
      await page.reload();
      await page.evaluate(() => window.mountHost());
      await page.waitForFunction(() => window.hostPlayable === true);
      await page.getByRole('button',{name:/let's play/i}).click();
      await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
      await page.locator('.onboarding-card').waitFor({state:'hidden'});
      for(let step=0;step<8;step++){
        const tooltip=page.getByRole('button',{name:/got it/i});
        if(await tooltip.count()===0)break;
        await tooltip.click();
      }
      await page.locator('.guess-row').first().waitFor();
      assert.equal((await page.locator('.guess-row').first().innerText()).replace(/\s+/g,''), 'CRANE', 'Accepted server guesses must recover without a provider checkpoint');
      assert.equal(await page.locator('.guess-row').nth(1).locator('.cell').first().innerText(), 'P', 'Purchased hint must remain locked after reload');
      assert.ok((await page.locator('.riddle-surface').textContent()).toLowerCase().includes('issued puzzle 17'), 'Confirmed Daily completion must route the host to Classic');
      const controls=await page.locator('.game-input-actions button').evaluateAll(buttons=>buttons.map(button=>{
        const style=getComputedStyle(button);return {text:button.textContent,color:style.color,background:style.backgroundColor,
          opacity:style.opacity,visibility:style.visibility,rect:button.getBoundingClientRect().toJSON()};
      }));
      await writeFile(path.join(output, `host-controls-${width}.json`), JSON.stringify(controls,null,2));
      await page.screenshot({path:path.join(output, `reddit-host-recovery-${width}.png`)});
      await page.evaluate(() => window.disposeHost());
      await page.clock.install();
      await page.evaluate(() => {
        window.probe.holdProfile=true;window.expired=null;
        window.services.loadProfile('reddit-account').catch(error=>window.expired={code:error.code});
      });
      await page.clock.runFor(15000);
      assert.deepEqual(await page.evaluate(() => window.expired), {code:'deadline-exceeded'});
      assert.equal(await page.evaluate(() => window.probe.requests.at(-1).signal.aborted), true);
      assert.ok(await page.evaluate(() => window.probe.requests.every(request=>request.path.startsWith('/api/'))));
      assert.deepEqual(errors, []);
    }
    await context.close();
    console.log(`PASS ${width}px: ${baseline ? 'baseline optional-read timing' : 'confirmed receipts, profile outages, request ordering, retired account, fresh content recovery, reload negotiation, recovered React guess and paid hint, Daily-to-Classic routing, Daily retry, and gateway expiry'}`);
  }
  await writeFile(path.join(output, baseline ? "receipt-timing-before.json" : "receipt-timing-after.json"), JSON.stringify({
    evidence: "Actual Reddit adapter with injected same-origin gateway; controlled profile delays are not production latency", samples,
  }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
