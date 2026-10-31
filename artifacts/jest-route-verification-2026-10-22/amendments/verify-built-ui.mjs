import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../../..");
const output = path.resolve(process.env.BUILT_UI_REPORT_DIR ?? path.join(root, "artifacts/jest-amendments-2026-10-22/browser"));
await mkdir(output, {recursive: true});
const artifact = process.env.AMENDED_JEST_ARTIFACT;
if (!artifact || !path.isAbsolute(artifact)) throw new Error("AMENDED_JEST_ARTIFACT must name the immutable combined artifact");
const require = createRequire(path.join(root, "packages/portal/package.json"));
const {chromium, expect} = require("@playwright/test");
const evidence = {artifact, scope: "Exact compiled artifact UI with controlled local receipts/transports; no real provider transactions", cases: [], failures: []};
const files = await readdir(path.join(artifact, "assets"));
const asset = (pattern) => {
  const matches = files.filter(name => pattern.test(name));
  assert.equal(matches.length, 1, `Expected one artifact asset matching ${pattern}`);
  return "/assets/" + matches[0];
};
const raceModule = asset(/^RaceTo10Game-.*\.js$/);
const raceCss = asset(/^RaceTo10Game-.*\.css$/);
const reactModule = asset(/^vendor-react-.*\.js$/);
const i18nModule = asset(/^i18n-.*\.js$/);
const index = await readFile(path.join(artifact, "index.html"), "utf8");
const styles = [...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(match => match[1]);
const waitHtml = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${[...styles, raceCss].map(url => `<link rel="stylesheet" href="${url}">`).join("")}</head><body><div id="root"></div><script type="module" src="/__wait.js"></script></body></html>`;
const waitScript = `
import * as runtime from ${JSON.stringify(reactModule)};
import {RaceTo10Game} from ${JSON.stringify(raceModule)};
import * as locale from ${JSON.stringify(i18nModule)};
const React=runtime.a(), {createRoot}=runtime.r();
const language=new URLSearchParams(location.search).get('locale')??'en';
await locale.o(language);
window.probe={joins:[],retirements:[],queued:false,outerCloses:0,errors:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));
window.addEventListener('unhandledrejection',e=>window.probe.errors.push(String(e.reason)));
const transport={join:async input=>{window.probe.joins.push(input);window.probe.queued=true;const now=Date.now();
return {ticketId:'a'.repeat(64),phase:'searching',waitForPlayer:true,serverNowMs:now,searchEndsAtMs:now+900000,startsAtMs:null,
player:{displayName:'Owner',avatarUrl:null,bot:false,correctCount:0},opponent:null,run:null,result:null,rewardCoins:0};},
update:async()=>{throw new Error('No poll expected during focused wait check');},
retireJoin:async input=>{window.probe.retirements.push(input);window.probe.queued=false;return {status:'retired'};}};
const categories=[{categoryId:'mixed',nameKey:'RaceTo10.CATEGORY_MIXED_NAME',descriptionKey:'RaceTo10.CATEGORY_MIXED_DESCRIPTION',icon:'shuffle',colorToken:'#8855aa',availableRiddleCount:30}];
function App(){
  const [open,setOpen]=React.useState(true);
  return open?React.createElement(RaceTo10Game,{locale:language,coins:300,ownerId:'artifact-wait-owner',
    initialCategories:categories,matchmaking:{live:transport},postToHost:()=>{},
    onClose:()=>{window.probe.outerCloses++;setOpen(false);}}):React.createElement('main',{'data-testid':'solo-owner'},'Solo riddle owner restored');
}
createRoot(document.querySelector('#root')).render(React.createElement(App));
`;
const contentTypes = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webm": "audio/webm", ".woff2": "font/woff2", ".ttf": "font/ttf"};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/__wait.html" || pathname === "/__wait.js") {
    response.setHeader("Content-Type", pathname.endsWith("js") ? "text/javascript" : "text/html");
    response.end(pathname.endsWith("js") ? waitScript : waitHtml);
    return;
  }
  const file = path.join(artifact, pathname === "/" || !path.extname(pathname) ? "index.html" : pathname);
  try {response.setHeader("Content-Type", contentTypes[path.extname(file)] ?? "application/octet-stream");response.end(await readFile(file));}
  catch {response.writeHead(404).end();}
});
async function inventory(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await inventory(filename));
    else result.push({path: path.relative(artifact, filename), sha256: createHash("sha256").update(await readFile(filename)).digest("hex")});
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
const before = await inventory(artifact);
evidence.artifactFiles = before.length;
await writeFile(path.join(output, "built-ui-artifact-inventory.json"), JSON.stringify(before, null, 2) + "\n");
const save = () => writeFile(path.join(output, process.env.BUILT_UI_RESULT_FILE ?? "built-ui-results.json"), JSON.stringify(evidence, null, 2) + "\n");
let browser, origin;
async function check(name, body) {
  if (process.env.BUILT_UI_CASE_FILTER && !name.includes(process.env.BUILT_UI_CASE_FILTER)) return;
  console.log("Checking " + name);
  try {evidence.cases.push({name, passed: true, ...await body()});console.log("PASS " + name);}
  catch (error) {evidence.failures.push({name, stack: error.stack ?? String(error)});console.error("FAIL " + name + ": " + error.message);}
  await save();
}
async function openPage(viewport) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage();
  const errors = [], externals = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.shaderProbe={compiles:0,links:0,failures:[]};
    for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]) {
      if(!type) continue;
      const compile=type.prototype.compileShader,link=type.prototype.linkProgram;
      type.prototype.compileShader=function(shader){
        compile.call(this,shader);window.shaderProbe.compiles++;
        if(!this.getShaderParameter(shader,this.COMPILE_STATUS)) window.shaderProbe.failures.push({operation:'compile',log:this.getShaderInfoLog(shader)});
      };
      type.prototype.linkProgram=function(program){
        link.call(this,program);window.shaderProbe.links++;
        if(!this.getProgramParameter(program,this.LINK_STATUS)) window.shaderProbe.failures.push({operation:'link',log:this.getProgramInfoLog(program)});
      };
    }
  });
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    if (!route.request().url().startsWith("https://cdn.jest.com/")) externals.push(route.request().url());
    return route.fulfill({status: 200, contentType: "application/javascript", body: ""});
  });
  return {context, page, errors, externals};
}
async function inViewport(locator, viewport, label) {
  const bounds = await locator.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1,
    `${label} is entirely in the viewport: ${JSON.stringify(bounds)}`);
  return bounds;
}
await new Promise((resolve, reject) => {server.once("error", reject);server.listen(0, "127.0.0.1", resolve);});
origin = `http://127.0.0.1:${server.address().port}`;
try {
  browser = await chromium.launch({headless: true});
  await check('SolarSystem WebGL shader compilation and rendered animation',async()=>{
    const {context,page,errors,externals}=await openPage({width:390,height:844});
    try {
      await page.addInitScript(()=>{
        window.__RIDDLE_QUEST_BROWSER_TEST__=true;
        localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest','seen');
        localStorage.setItem('riddleQuest:tooltipSeen:gameCoins:jest-guest','seen');
        sessionStorage.setItem('riddleQuest:welcomeSession:jest-guest','seen');
      });
      await page.goto(origin+'/?harness=jest');
      await page.getByRole('button',{name:"Let's Play",exact:true}).waitFor({timeout:20000});
      await page.locator('.onboarding-card').first().evaluate(card=>Promise.all(card.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>undefined))));
      await page.getByRole('button',{name:"Let's Play",exact:true}).click();
      await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
      await page.locator('.onboarding-card').waitFor({state:'hidden'});
      const canvas=page.locator('.solar-system canvas');
      await canvas.waitFor();
      await page.waitForFunction(()=>window.shaderProbe.compiles>0&&window.shaderProbe.links>0);
      const first=await canvas.screenshot({path:path.join(output,'solar-system-before.png')});
      await page.waitForTimeout(500);
      const second=await canvas.screenshot({path:path.join(output,'solar-system-after.png')});
      assert.notDeepEqual(first,second,'The rendered SolarSystem animation must advance');
      const shader=await page.evaluate(()=>window.shaderProbe);
      assert.deepEqual(shader.failures,[]);
      assert.deepEqual(errors,[]);assert.deepEqual(externals,[]);
      await page.screenshot({path:path.join(output,'solar-system-game-390.png')});
      return {shader,animationAdvanced:true};
    } finally {await context.close();}
  });
  for (const viewport of [{width: 320, height: 568}, {width: 390, height: 844}]) {
    for (const language of ["en", "de", "fr", "ar"]) {
      await check(`Daily five-component receipt ${language} ${viewport.width}`, async () => {
        const {context, page, errors, externals} = await openPage(viewport);
        try {
          await page.addInitScript(() => {
            window.__RIDDLE_QUEST_BROWSER_TEST__=true;
            window.injectedReceipts=0;
            localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v4:jest-guest','seen');
            localStorage.setItem('riddleQuest:tooltipSeen:gameCoins:jest-guest','seen');
            sessionStorage.setItem('riddleQuest:welcomeSession:jest-guest','seen');
            window.addEventListener('riddle-quest:host-to-game',event=>{
              const m=event.detail;
              if(m?.type==='host:operationResult'&&m.payload?.operation==='completeGame'&&m.payload.ok&&m.payload.data?.isCorrect===true){
                m.payload.data.coinsEarned=125;
                m.payload.data.rewardBreakdown={baseWinCoins:75,levelUpBonus:10,dailyStreakBonus:15,achievementBonus:20,referralBonus:5,totalAwarded:125,newBalance:425};
                window.injectedReceipts++;
              }
            });
          });
          await page.goto(origin+'/?harness=jest');
          await page.getByRole('button',{name:"Let's Play",exact:true}).waitFor({timeout:20000});
          await page.locator('.onboarding-card').first().evaluate(card=>Promise.all(card.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>undefined))));
          await page.getByRole('button',{name:"Let's Play",exact:true}).click();
          await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
          await page.locator('.onboarding-card').waitFor({state:'hidden'});
          await page.locator('.keyboard').waitFor();
          for(const letter of 'ECHO') await page.locator('.keyboard').getByRole('button',{name:letter,exact:true}).click();
          await page.locator('.game-input-actions').getByRole('button',{name:/submit/i}).click();
          await page.locator('.victory-reward-breakdown').waitFor({timeout:15000});
          await page.evaluate(async ({module,language})=>{const locale=await import(module);await locale.o(language);},{module:i18nModule,language});
          await expect(page.locator('html')).toHaveAttribute('lang',language);
          await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
          await page.evaluate(()=>document.fonts.ready);
          const labels=(JSON.parse(await readFile(path.join(root,'src/locales',language,'victory.json'),'utf8'))).VictoryModal;
          const expected=[['REWARD_DAILY','+75'],['REWARD_STREAK_BONUS','+15'],['REWARD_LEVEL_BONUS','+10'],['REWARD_ACHIEVEMENT_BONUS','+20'],['REWARD_REFERRAL_BONUS','+5']];
          const rows=page.locator('.victory-reward-breakdown > div');
          await expect(rows).toHaveCount(5);
          for(let i=0;i<expected.length;i++){
            await expect(rows.nth(i).locator('dt')).toHaveText(labels[expected[i][0]]);
            await expect(rows.nth(i).locator('dd')).toHaveText(expected[i][1]);
            await expect(rows.nth(i).locator('bdi')).toHaveAttribute('dir','ltr');
            await inViewport(rows.nth(i),viewport,'Reward component');
          }
          const modal=page.locator('.modal-victory'), next=modal.locator('.reward-continue');
          await expect(next).toBeEnabled();
          await next.click({trial:true});
          await page.locator('.route-loading').waitFor({state:'hidden'});
          const geometry={chest:await inViewport(modal.locator('.reward-chest'),viewport,'Chest'),next:await inViewport(next,viewport,'Next')};
          assert.equal(await modal.evaluate(element=>element.scrollHeight<=element.clientHeight+1),true,'Victory requires no hidden scroll to reach Next');
          assert.equal(await page.getByRole('button',{name:/tap the chest/i}).count(),0);
          assert.equal(await page.evaluate(()=>window.injectedReceipts),1);
          await page.screenshot({path:path.join(output,`receipt-${language}-${viewport.width}.png`)});
          await next.click();
          await expect(modal).toHaveCount(0);
          await expect(page.locator('.game-content .keyboard button').first()).toBeEnabled();
          assert.deepEqual(errors,[]);assert.deepEqual(externals,[]);
          const shader=await page.evaluate(()=>window.shaderProbe);
          assert.deepEqual(shader.failures,[]);
          return {language,viewport,rows:expected.map(([key,value])=>({label:labels[key],value})),geometry,parserReceivedValidReceipt:true,nextLoadsPlayableSuccessor:true,shader};
        } catch(error){await page.screenshot({path:path.join(output,`receipt-${language}-${viewport.width}-failure.png`)}).catch(()=>{});throw error;}
        finally {await context.close();}
      });
      await check(`Compiled human wait and cancellation ${language} ${viewport.width}`, async () => {
        const {context,page,errors,externals}=await openPage(viewport);
        try {
          await page.goto(origin+'/__wait.html?locale='+language);
          await page.locator('.live-race-start').click();
          const label=(JSON.parse(await readFile(path.join(root,'src/locales',language,'race.json'),'utf8'))).RaceTo10.LIVE_HUMAN_WAIT;
          const hint=page.getByText(label,{exact:true});
          await hint.waitFor();
          const geometry=await inViewport(hint,viewport,'Human-wait explanation');
          await inViewport(page.locator('.race-close'),viewport,'Close');
          await page.screenshot({path:path.join(output,`human-wait-${language}-${viewport.width}.png`)});
          await page.locator('.race-close').click();
          await expect(page.locator('.live-race-start')).toBeEnabled();
          await expect(hint).toHaveCount(0);
          const probe=await page.evaluate(()=>window.probe);
          assert.equal(probe.queued,false);assert.equal(probe.retirements.length,1);
          assert.equal(probe.retirements[0].requestId,probe.joins[0].requestId);
          assert.equal(probe.retirements[0].expectedOwnerId,'artifact-wait-owner');
          assert.equal(probe.outerCloses,0,'The first Close returns to the hub without closing multiplayer');
          await page.locator('.race-close').click();
          await expect(page.getByTestId('solo-owner')).toBeVisible();
          await expect(page.locator('.race-screen')).toHaveCount(0);
          const closedProbe=await page.evaluate(()=>window.probe);
          assert.equal(closedProbe.outerCloses,1,'The hub Close closes the owning multiplayer surface once');
          assert.equal(closedProbe.retirements.length,1,'Closing the hub cannot retire the original search twice');
          assert.deepEqual(probe.errors,[]);assert.deepEqual(errors,[]);assert.deepEqual(externals,[]);
          return {language,viewport,geometry,copy:label,originalIntentCancelled:true,firstCloseReturnsHub:true,secondCloseClosesOwnerOnce:true};
        } catch(error){await page.screenshot({path:path.join(output,`human-wait-${language}-${viewport.width}-failure.png`)}).catch(()=>{});throw error;}
        finally {await context.close();}
      });
    }
  }
  assert.deepEqual(await inventory(artifact),before,'Immutable artifact hashes must remain unchanged');
  evidence.artifactUnchanged=true;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
  await save();
}
console.log(JSON.stringify({cases:evidence.cases.length,failures:evidence.failures.length,artifactFiles:evidence.artifactFiles},null,2));
assert.deepEqual(evidence.failures,[],'All changed artifact routes must pass');
