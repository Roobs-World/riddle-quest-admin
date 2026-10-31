import assert from "node:assert/strict";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../../..");
const output = path.resolve(process.env.INSTRUCTIONS_REPORT_DIR ?? path.join(root, "artifacts/jest-instructions-modal-2026-10-22/browser"));
const artifact = process.env.INSTRUCTIONS_JEST_ARTIFACT;
if (!artifact || !path.isAbsolute(artifact)) throw new Error("INSTRUCTIONS_JEST_ARTIFACT must name the immutable artifact");
await mkdir(output, {recursive: true});
const require = createRequire(path.join(root, "packages/portal/package.json"));
const {chromium, expect} = require("@playwright/test");
const evidence = {artifact, scope: "Settings → Help through the compiled game with mock provider traffic", cases: [], failures: []};
const languages = (await readdir(path.join(root, "src/locales"), {withFileTypes: true}))
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const viewports = [{width: 402, height: 682}, {width: 320, height: 568}, {width: 390, height: 844}];
const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".webm": "audio/webm", ".woff2": "font/woff2", ".ttf": "font/ttf"};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = path.join(artifact, pathname === "/" || !path.extname(pathname) ? "index.html" : pathname);
  try {response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");response.end(await readFile(file));}
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
await writeFile(path.join(output, "artifact-inventory.json"), JSON.stringify(before, null, 2) + "\n");
evidence.artifactFiles = before.length;
const save = () => writeFile(path.join(output, "results.json"), JSON.stringify(evidence, null, 2) + "\n");
const normalize = text => text.replace(/\s+/gu, " ").trim();
async function measure(page, viewport) {
  const result = await page.locator(".modal-instructions").evaluate(modal => {
    const rect = element => {
      const value = element.getBoundingClientRect();
      return {left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height};
    };
    const dimensions = element => ({...rect(element), clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollTop: element.scrollTop});
    const instructions = modal.querySelector(".instructions-page");
    if (!instructions) throw new Error("Instructions page missing");
    const body = [...instructions.querySelectorAll("p,.instruction-clue")].map(element => ({text: element.textContent.trim(),
      fontSize: parseFloat(getComputedStyle(element).fontSize), lineHeight: parseFloat(getComputedStyle(element).lineHeight), bounds: rect(element)}));
    const range = document.createRange(), textRects = [];
    const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!node.textContent.trim() || !parent || parent.closest(".clue,[aria-hidden='true']") ||
        !parent.closest("p,.instruction-clue,h2,h3")) continue;
      range.selectNodeContents(node);
      for (const value of range.getClientRects()) textRects.push({left: value.left, top: value.top, right: value.right, bottom: value.bottom});
    }
    const primary = modal.querySelector(".play-primary");
    if (!primary) throw new Error("Primary instruction action missing");
    return {modal: dimensions(modal), page: dimensions(instructions), body, textRects,
      primary: {...dimensions(primary), fontSize: parseFloat(getComputedStyle(primary).fontSize), text: primary.textContent.trim()}};
  });
  for (const [name, bounds] of Object.entries({modal: result.modal, primary: result.primary})) {
    assert.ok(bounds.left >= -1 && bounds.top >= -1 && bounds.right <= viewport.width + 1 && bounds.bottom <= viewport.height + 1,
      `${name} must fit the iframe viewport: ${JSON.stringify(bounds)}`);
  }
  for (const [name, bounds] of Object.entries({modal: result.modal, page: result.page})) {
    assert.ok(bounds.scrollHeight <= bounds.clientHeight + 1, `${name} must not require vertical scrolling: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1, `${name} must not require horizontal scrolling: ${JSON.stringify(bounds)}`);
    assert.equal(bounds.scrollTop, 0, `${name} must remain at its initial unscrolled position`);
  }
  assert.ok(result.body.length > 0, "Instruction body is present");
  for (const body of result.body) {
    assert.ok(body.fontSize >= 16, `Instruction body must remain readable: ${JSON.stringify(body)}`);
    assert.ok(body.lineHeight >= 20, `Instruction lines must not be cramped: ${JSON.stringify(body)}`);
  }
  assert.ok(result.primary.height >= 44 && result.primary.fontSize >= 16, "The primary action must be readable and touchable");
  for (const bounds of result.textRects) {
    assert.ok(bounds.left >= result.modal.left + 1 && bounds.right <= result.modal.right - 1 &&
      bounds.top >= result.modal.top + 1 && bounds.bottom <= result.modal.bottom - 1,
      `Instruction text must not be clipped by the modal: ${JSON.stringify(bounds)}`);
  }
  return result;
}
let browser, origin;
await new Promise((resolve, reject) => {server.once("error", reject);server.listen(0, "127.0.0.1", resolve);});
origin = `http://127.0.0.1:${server.address().port}`;
try {
  browser = await chromium.launch({headless: true});
  for (const language of languages) {
    const copy = JSON.parse(await readFile(path.join(root, "src/locales", language, "onboarding.json"), "utf8")).Instructions;
    const settings = JSON.parse(await readFile(path.join(root, "src/locales", language, "settings.json"), "utf8")).Settings;
    const expected = ["GOAL_DESCRIPTION", "COLOR_CLUES_TITLE", "COLOR_CORRECT", "COLOR_MISPLACED", "COLOR_WRONG", "TIPS_TITLE", "TIPS_DESCRIPTION"].map(key => copy[key]);
    const context = await browser.newContext({viewport: viewports[0]});
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], external = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      if (!route.request().url().startsWith("https://cdn.jest.com/")) external.push(route.request().url());
      return route.fulfill({status: 200, contentType: "application/javascript", body: ""});
    });
    try {
      await page.addInitScript(() => {
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
      await page.locator('.game-bottom-navigation').waitFor();
      for (const viewport of viewports) {
        const name = `${language} ${viewport.width}×${viewport.height}`;
        console.log('Checking '+name);
        try {
          await page.setViewportSize(viewport);
          await page.locator('.game-bottom-navigation button').first().click();
          await page.locator('.modal-settings select').selectOption(language);
          await expect(page.locator('html')).toHaveAttribute('lang',language);
          await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
          await expect(page.locator('.modal-settings h2')).toHaveText(settings.TITLE);
          await page.locator('.modal-settings').getByRole('button',{name:settings.HELP_BUTTON,exact:true}).click();
          await page.locator('.modal-instructions').waitFor();
          await page.locator('.route-loading').waitFor({state:'hidden'});
          await page.evaluate(()=>document.fonts.ready);
          const found = new Set(), pages = [];
          for (let step=0;step<12;step++) {
            const modal=page.locator('.modal-instructions');
            const text=normalize(await modal.innerText());
            for(const value of expected) if(text.includes(normalize(value))) found.add(value);
            const geometry=await measure(page,viewport);
            const primary=modal.locator('.play-primary');
            await primary.click({trial:true});
            assert.equal(await modal.evaluate(element=>element.scrollTop),0);
            assert.equal(await modal.locator('.instructions-page').evaluate(element=>element.scrollTop),0);
            await page.screenshot({path:path.join(output,`${language}-${viewport.width}x${viewport.height}-page-${step+1}.png`)});
            pages.push({step:step+1,geometry});
            const finished=normalize(await primary.innerText())===normalize(copy.GOT_IT_BUTTON);
            await primary.click();
            if(finished){await expect(modal).toHaveCount(0);break;}
            await expect(modal).not.toHaveText(text);
            if(step===11)throw new Error('Instruction pages did not terminate');
          }
          assert.equal(found.size,expected.length,'All original instruction content must be reachable without scrolling');
          assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
          evidence.cases.push({name,language,viewport,passed:true,pages,allOriginalContentReachable:true,primaryActionDismissed:true});
          console.log('PASS '+name);
        } catch(error) {
          evidence.failures.push({name,stack:error.stack??String(error)});
          await page.screenshot({path:path.join(output,`${language}-${viewport.width}x${viewport.height}-failure.png`)}).catch(()=>{});
          console.error('FAIL '+name+': '+error.message);
          if(await page.locator('.modal-instructions').count()) await page.locator('.modal-instructions .modal-x').click().catch(()=>{});
        }
        await save();
      }
    } catch(error) {evidence.failures.push({name:language+' setup',stack:error.stack??String(error)});await save();}
    finally {await context.close();}
  }
  assert.deepEqual(await inventory(artifact),before,'Artifact hashes must remain unchanged');
  evidence.artifactUnchanged=true;
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await save();
}
console.log(JSON.stringify({cases:evidence.cases.length,failures:evidence.failures.length,artifactFiles:evidence.artifactFiles},null,2));
assert.deepEqual(evidence.failures,[],'Instruction layout must pass every supported locale and viewport');
