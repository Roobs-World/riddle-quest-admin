import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.resolve(root, "../../artifacts/multiplayer-wins-leaderboard");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/leaderboard-"));
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, "main.tsx"), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {BridgeLeaderboardEntrySchema, GameLoadLeaderboardMessageSchema} from '@qwordly/core/bridge';
import {LeaderboardModalPage} from ${JSON.stringify(path.join(root, "src/play/modalPages/leaderboard/LeaderboardModalPage.tsx"))};
import {setLocaleAndWait, tr} from ${JSON.stringify(path.join(root, "src/play/i18n.ts"))};
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import ${JSON.stringify(path.join(root, "src/styles.modal-shell.css"))};
import ${JSON.stringify(path.join(root, "src/styles.account.css"))};
const entries = Array.from({length:23}, (_, index) => BridgeLeaderboardEntrySchema.parse({
  userId:'player-'+index, username:'Player '+index, level:2, xp:100, totalWins:100-index,
  bestStreak:3, multiplayerWins:42-index}));
function App() {
  const [type, setType] = React.useState('xp'), [loading, setLoading] = React.useState(false), [empty, setEmpty] = React.useState(false);
  window.injectLeaderboard = async (locale, noScores=false) => {
    await setLocaleAndWait(locale); document.documentElement.lang=locale;
    document.documentElement.dir=locale==='ar'?'rtl':'ltr'; setEmpty(noScores); setType('xp');
    return tr('Leaderboard.TAB_MULTIPLAYER_WINS');
  };
  function request(type) {
    GameLoadLeaderboardMessageSchema.parse({type:'game:loadLeaderboard', payload:{leaderboardType:type}});
    setLoading(true); setType(type); setTimeout(() => setLoading(false), 60);
  }
  return <div className="game-modal-backdrop"><section className="game-modal modal-leaderboard" role="dialog" aria-labelledby="title">
    <h2 id="title">{tr('Leaderboard.TITLE')}</h2><LeaderboardModalPage entries={empty?[]:entries} loading={loading}
      leaderboardType={type} onRequestLeaderboard={request}/></section></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
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
    const page = await browser.newPage({viewport: {width, height: 844}}), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => Boolean(window.injectLeaderboard));
    for (const locale of ["en", "ar", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi"]) {
      const label = await page.evaluate(locale => window.injectLeaderboard(locale), locale);
      const button = page.getByRole("button", {name: label, exact: true});
      await button.click();
      await page.waitForFunction(() => document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false");
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("li strong").first().innerText(), "42");
      const overflow = await page.locator(".modal-leaderboard").evaluate(modal => ({
        modal: modal.scrollWidth - modal.clientWidth,
        buttons: [...modal.querySelectorAll("button")].some(button => button.scrollWidth > button.clientWidth),
      }));
      assert.deepEqual(overflow, {modal: 0, buttons: false}, `${locale} overflow at ${width}px`);
      if (["en", "ar", "de"].includes(locale)) await page.screenshot({path: path.join(evidence, `leaderboard-${locale}-${width}.png`)});
    }
    await page.evaluate(() => window.injectLeaderboard("en", true));
    await page.getByRole("button", {name: "Multiplayer wins", exact: true}).click();
    await page.waitForFunction(() => document.querySelector(".leaderboard-list")?.getAttribute("aria-busy") === "false");
    assert.match(await page.locator(".leaderboard-list").innerText(), /No scores yet/);
    assert.equal(await page.locator(".leaderboard-pagination").count(), 0);
    assert.deepEqual(errors, []);
    console.log(`Injected leaderboard component passed in all 16 locales at ${width}px, including empty scores and RTL.`);
    await page.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
