import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.resolve(root, 'artifacts/achievements-expansion/browser');
await mkdir(evidence, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/achievement-milestones-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ACHIEVEMENT_MILESTONES} from ${JSON.stringify(path.join(root, 'src/core/game'))};
import {AchievementsModalPage} from ${JSON.stringify(path.join(root, 'src/web/play/modalPages/profile/ProfileStatsModalPages.tsx'))};
import {AchievementFanfare} from ${JSON.stringify(path.join(root, 'src/web/play/modalPages/fanfare/FanfareModalContent.tsx'))};
import {setLocaleAndWait, tr} from ${JSON.stringify(path.join(root, 'src/web/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.modal-shell.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.account.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.profile-details.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.modal-rewards.css'))};
const root = createRoot(document.getElementById('root'));
window.injectAchievementProfile = async (locale, unlocked) => {
  await setLocaleAndWait(locale);
  const profile = {username: 'Solver', coins: 0, level: 1, xp: 0, winStreak: 0,
    gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 0};
  for (const {id, stat, threshold} of ACHIEVEMENT_MILESTONES) {
    profile[stat] = Math.max(profile[stat] ?? 0, threshold - 1);
    if (unlocked) profile.achievements.push(id);
  }
  root.render(<main className="game-modal modal-achievements" style={{position:'relative',margin:'20px auto',maxWidth:'calc(100% - 24px)'}}>
    <h2>{tr('Achievements.MODAL_TITLE')}</h2><AchievementsModalPage profile={profile}/>
    <section id="fanfare">{unlocked && ACHIEVEMENT_MILESTONES.map(({id}) => <AchievementFanfare key={id} achievementId={id}/>)}</section>
  </main>);
  return ACHIEVEMENT_MILESTONES.map(({id, threshold, stat}) => ({id, threshold,
    progress: Math.min(profile[stat], threshold), name:tr('Achievements.MILESTONES.'+id+'.NAME'),
    description:tr('Achievements.MILESTONES.'+id+'.DESCRIPTION')}));
};
window.injectAchievementProfile('en', false);
`);
let browser, server;
try {
  await build({root: scratch, configFile: false, logLevel: 'error', build: {outDir: 'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true});
  for (const width of [1280, 390]) {
    const page = await browser.newPage({viewport: {width, height: 844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.locator('.achievement-grid article').first().waitFor();
    for (const locale of ['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi']) {
      for (const unlocked of [false, true]) {
        const milestones = await page.evaluate(([locale, unlocked]) => window.injectAchievementProfile(locale, unlocked), [locale, unlocked]);
        await page.waitForFunction(unlocked => document.querySelectorAll('.achievement-grid article.unlocked').length === (unlocked ? 12 : 0), unlocked);
        for (const {id, threshold, progress, name, description} of milestones) {
          const card = page.locator('.achievement-grid article').filter({has: page.getByText(name, {exact: true})});
          assert.equal(await card.count(), 1, id);
          assert.equal(await card.locator('p').textContent(), description);
          assert.equal((await card.locator('small').first().textContent()).replace(/\s/g, ''), (unlocked ? threshold : progress) + '/' + threshold);
          const bar = await card.locator('.achievement-progress i').evaluate(element => parseFloat(element.style.width));
          assert(Math.abs(bar - (unlocked ? 100 : progress / threshold * 100)) < 0.001, id);
          if (unlocked) {
            const celebration = page.locator('#fanfare .achievement-unlock').filter({has: page.getByText(name, {exact: true})});
            assert.equal(await celebration.locator('p').textContent(), description);
          }
        }
      }
      assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow: ' + locale);
      if (['en', 'ar'].includes(locale)) {
        const name = await page.evaluate(() => document.querySelectorAll('.achievement-grid article strong')[42]?.textContent);
        if (name) await page.locator('.achievement-grid article').filter({has: page.getByText(name, {exact: true})}).scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({path: path.join(evidence, locale + '-' + width + '.png')});
      }
      console.log('All 12 achievement cards, progress bars and fanfares passed: ' + locale + ' at ' + width + 'px.');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
