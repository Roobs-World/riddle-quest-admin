import {chromium} from '../../packages/portal/node_modules/@playwright/test/index.mjs';
import AxeBuilder from '../../packages/portal/node_modules/@axe-core/playwright/dist/index.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const output = path.resolve('artifacts/design-polish-2026-10-03');
const target = process.argv[2] || 'jest';
const classic = process.argv[3] === 'classic';
const root = path.resolve(`packages/portal/dist-${target}`);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  try {
    const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
try {
  for (const [width,height] of (process.argv[4] === 'landscape' ? [[844,390]] : [[390,844],[1440,900],[320,568],[844,390]])) {
    const context = await browser.newContext({viewport:{width,height}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (target === 'jest') {
      await page.route('https://cdn.jest.com/**', route => route.fulfill({status:200,body:''}));
      await page.addInitScript(() => {
        window.__RIDDLE_QUEST_BROWSER_TEST__ = true;
        localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest', 'seen');
        localStorage.setItem('riddleQuest:tooltipSeen:hintAfterWrongGuess:jest-guest', 'seen');
        localStorage.setItem('riddleQuest:tooltipSequenceSeen:profileTour:v2:jest-guest', 'seen');
        sessionStorage.setItem('riddleQuest:welcomeSession:jest-guest', 'seen');
      });
      await page.goto(`${origin}/?harness=jest${classic ? '&dailyCompleted=1' : ''}`);
      await page.getByRole('button', {name: /let's play/i}).waitFor();
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))); });
      if(width === 390) await page.screenshot({path:`${output}/onboarding-${target}.png`});
      await page.getByRole('button', {name: /let's play/i}).click();
      await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
      await page.locator('.onboarding-card').waitFor({state:'hidden'});
      await page.locator('.game-bottom-navigation').waitFor();
    } else {
      await page.goto(origin);
      await page.getByRole('heading', {name:'Choose a puzzle'}).waitFor();
      if(width === 390) await page.screenshot({path:`${output}/menu-${target}.png`});
      await page.getByRole('button', {name:/Classic/}).click();
      await page.locator('.yt-puzzle').waitFor();
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      for(let frame=0;frame<45;frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    });
    const variant = classic ? '-classic' : '';

    await page.screenshot({path:`${output}/game-${target}${variant}-${width}x${height}.png`});
    const surfacesFit = await page.evaluate(() => [...document.querySelectorAll('.game-header, .riddle-card, .guess-board, .keyboard, .keyboard .key, .game-input-actions, .game-bottom-navigation')].every(surface => { const rect = surface.getBoundingClientRect(); return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1; }));
    if(!surfacesFit) throw new Error(`Clipped game controls at ${width}x${height}`);
    const {violations} = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    if(violations.length) throw new Error(JSON.stringify(violations.map(({id,nodes}) => ({id,targets:nodes.map(node => node.target)}))));
    if(target === 'jest' && width === 390) {
      await page.keyboard.type(classic ? 'XXXXX' : 'EEEE');
      await page.getByRole('button', {name:/^submit$/i,exact:true}).click();
      await page.locator('.cell.red').first().waitFor();
      if(await page.locator('.tooltip-card').isVisible()) await page.locator('.tooltip-card').getByRole('button', {name:/got it/i}).click();
      await page.screenshot({path:`${output}/feedback-${target}${variant}.png`});
      const feedbackAudit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
      if(feedbackAudit.violations.length) throw new Error(JSON.stringify(feedbackAudit.violations.map(({id,nodes}) => ({id,targets:nodes.map(node => node.target)}))));
      await page.evaluate(() => document.documentElement.dataset.riddleQuestHighContrast = 'true');
      const contrastAudit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
      if(contrastAudit.violations.length) throw new Error(JSON.stringify(contrastAudit.violations.map(({id,nodes}) => ({id,targets:nodes.map(node => node.target)}))));
      await page.screenshot({path:`${output}/high-contrast-${target}${variant}.png`});
      await page.evaluate(() => delete document.documentElement.dataset.riddleQuestHighContrast);
      await page.getByRole('button', {name:'Settings',exact:true}).click();
      await page.getByRole('dialog', {name:'Settings',exact:true}).waitFor();
      await page.screenshot({path:`${output}/settings-${target}${variant}.png`});
      const settingsAudit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
      if(settingsAudit.violations.length) throw new Error(JSON.stringify(settingsAudit.violations.map(({id,nodes}) => ({id,targets:nodes.map(node => node.target)}))));
    }
    console.log(JSON.stringify({target,width,height,errors,accessibilityViolations:violations.length,layout:await page.evaluate(() => ({scrollWidth:document.body.scrollWidth,viewport:innerWidth,keyboard:document.querySelector('.keyboard, .yt-keyboard')?.getBoundingClientRect().toJSON(),navigation:document.querySelector('.game-bottom-navigation')?.getBoundingClientRect().toJSON()}))}));
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
