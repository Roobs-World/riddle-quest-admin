import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.resolve(root, "artifacts/challenge-notification-toggle");
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/push-toggle-"));
await writeFile(path.join(scratch, "main.tsx"), `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root, "src/sharing/components/ReferralSharingCapability.tsx"))};
import {SettingsModalPage} from ${JSON.stringify(path.join(root, "src/settings/components/SettingsModalPage.tsx"))};
import {ProfileModalPage} from ${JSON.stringify(path.join(root, "src/accounts/components/ProfileModalPage.tsx"))};
import ${JSON.stringify(path.join(root, "src/app/modals/styles/modal-shell.css"))};
import ${JSON.stringify(path.join(root, "src/accounts/styles/account.css"))};
import ${JSON.stringify(path.join(root, "src/progression/styles/rewards.css"))};
import ${JSON.stringify(path.join(root, "src/accounts/styles/profile-details.css"))};
window.calls=[];
const capability={setLiveRacePush:enabled=>{window.calls.push(enabled);return new Promise((resolve,reject)=>{window.finish=resolve;window.fail=reject;});}};
function App(){const [surface,setSurface]=useState('settings');window.setSurface=setSurface;return <ReferralSharingProvider capability={location.search.includes('unsupported')?null:capability}><div className="game-modal-backdrop"><div className={"game-modal modal-"+surface}>{surface==='settings'?<SettingsModalPage locale="en" muted={false} onOpenModal={()=>{}} onToggleMute={()=>{}} commerceAvailable={false}/>:<ProfileModalPage profile={null} onOpenModal={()=>{}} onUpdateAvatar={async()=>{}} onDeleteAccount={()=>{}}/>}</div></div></ReferralSharingProvider>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html lang="en"><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({root: scratch, configFile: false, logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const file = path.join(scratch, "dist", pathname === "/" ? "index.html" : pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true});
  for (const width of [1280, 390, 280]) {
    const page = await browser.newPage({viewport: {width, height: 844}});
    const errors = [];page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const enable = page.getByRole("button", {name: "Enable challenge notifications", exact: true});
    const disable = page.getByRole("button", {name: "Disable challenge notifications", exact: true});
    const selected = async enabled => {
      await page.waitForFunction(value => document.querySelector('.live-race-push-consent button')?.getAttribute('aria-pressed') === String(value), enabled);
      assert.equal(await disable.getAttribute("aria-pressed"), String(!enabled));
    };
    await selected(false);
    await disable.click();assert.deepEqual(await page.evaluate(() => window.calls), [false]);
    await page.evaluate(() => window.finish(true));
    await page.waitForFunction(() => !document.querySelector('.live-race-push-consent button').disabled);
    await disable.click();assert.deepEqual(await page.evaluate(() => window.calls), [false]);
    await enable.click();assert.equal(await enable.isDisabled(), true);assert.equal(await disable.isDisabled(), true);
    await page.evaluate(() => window.setSurface('profile'));await page.locator('.profile-page').waitFor();
    assert.equal(await enable.isDisabled(), true);assert.equal(await disable.isDisabled(), true);
    await page.evaluate(() => window.finish(false));await page.getByRole("status").waitFor();await selected(false);
    await enable.click();await page.evaluate(() => window.finish(true));await selected(true);
    assert.equal(await page.getByRole("status").count(), 0);
    await page.evaluate(() => window.setSurface('settings'));await page.locator('.settings-page').waitFor();await selected(true);
    await page.screenshot({path: path.join(output, `settings-${width}.png`), fullPage: true});
    await page.evaluate(() => window.setSurface('profile'));await page.locator('.profile-page').waitFor();await selected(true);
    await enable.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(output, `profile-${width}.png`), fullPage: true});
    await enable.click();assert.deepEqual(await page.evaluate(() => window.calls), [false, true, true]);
    await disable.focus();await page.keyboard.press("Space");await page.evaluate(() => window.fail(new Error('unavailable')));
    await page.getByRole("status").waitFor();await selected(true);
    await disable.click();await page.evaluate(() => window.finish(true));await selected(false);
    assert.deepEqual(await page.evaluate(() => window.calls), [false, true, true, false, false]);
    await page.evaluate(() => window.setSurface('settings'));await page.locator('.settings-page').waitFor();await selected(false);
    for (const button of [enable, disable]) {
      const box = await button.boundingBox();assert.ok(box.height >= 48);assert.ok(box.x >= 0 && box.x + box.width <= width);
    }
    await page.screenshot({path: path.join(output, `toggle-${width}.png`), fullPage: true});
    assert.deepEqual(errors, []);
    await page.goto(`http://127.0.0.1:${server.address().port}/?unsupported`);
    assert.equal(await page.locator('.live-race-push-consent').count(), 0);
    await page.close();console.log(`Challenge notification toggle passed at ${width}px: selected state, consent failure, busy lock, keyboard, revocation and unsupported adapter.`);
  }
} finally {
  await browser?.close();if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
