// Supporting injected component checks; actual Jest-hosted E2E is recorded separately.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.resolve(process.env.ACHIEVEMENT_LOCALIZATION_EVIDENCE ?? path.join(root, 'artifacts/achievement-localization'));
await mkdir(evidence, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/achievement-localization-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ACHIEVEMENT_DEFINITIONS} from ${JSON.stringify(path.join(root, "src/progression/achievements/catalog/achievements.ts"))};
import {AchievementsModalPage} from ${JSON.stringify(path.join(root, "src/progression/components/ProfileStatsModalPages.tsx"))};
import {AchievementFanfare} from ${JSON.stringify(path.join(root, "src/progression/components/rewards/FanfareModalContent.tsx"))};
import {setLocaleAndWait, tr} from ${JSON.stringify(path.join(root, "src/localization/browser/i18n.ts"))};
${['app/styles/foundation.css', 'app/styles/game.css', 'app/styles/shared-controls.css', 'app/modals/styles/modal-shell.css', 'accounts/styles/account.css', 'accounts/styles/profile-details.css', 'progression/styles/rewards.css'].map(name => 'import '+JSON.stringify(path.join(root,'src',name))+';').join('\n')}
const root = createRoot(document.getElementById('root'));
window.injectAchievementProfile = async (locale, unlocked) => {
  await setLocaleAndWait(locale);
  const profile = {username:'Solver', coins:0, level:1, xp:0, winStreak:0, gamesPlayed:0,
    wins:0, achievements:unlocked ? ACHIEVEMENT_DEFINITIONS.map(({id})=>id) : [], classicIndex:0};
  const definitions = ACHIEVEMENT_DEFINITIONS.map(def => ({id:def.id, name:tr(def.nameKey),
    description:tr(def.descriptionKey), threshold:def.threshold}));
  root.render(<main className="game-modal modal-achievements" data-fixture={locale+'-'+unlocked}
    style={{position:'relative',margin:'20px auto',maxWidth:'calc(100% - 24px)'}}>
    <h2>{tr('Achievements.MODAL_TITLE')}</h2><AchievementsModalPage profile={profile}/>
    <section id="fanfare">{unlocked && ACHIEVEMENT_DEFINITIONS.map(({id}) => <AchievementFanfare key={id} achievementId={id}/>)}</section>
  </main>);
  return definitions;
};
window.injectAchievementProfile('en', false);
`);
let browser, server;
const cases = [];
try {
  await build({root:scratch, configFile:false, logLevel:'error', build:{outDir:'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  browser = await chromium.launch({headless:true});
  for (const width of [320,390,1280]) {
    const page = await browser.newPage({viewport:{width,height:844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('.achievement-grid article').first().waitFor();
    for (const locale of ['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi']) {
      for (const unlocked of [false,true]) {
        const expected = await page.evaluate(([locale,unlocked]) => window.injectAchievementProfile(locale,unlocked),[locale,unlocked]);
        await page.locator('[data-fixture="'+locale+'-'+unlocked+'"]').waitFor();
        const cards = await page.locator('.achievement-grid article').evaluateAll(elements => elements.map(card => ({
          name:card.querySelector('h3').textContent, description:card.querySelector('p').textContent,
          unlocked:card.classList.contains('unlocked'), progress:Number(card.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')),
          threshold:Number(card.querySelector('[role="progressbar"]').getAttribute('aria-valuemax')),
          overflow:card.scrollWidth > card.clientWidth+1,
        })));
        assert.equal(cards.length,expected.length);
        cards.forEach(card=>{
          const definition=expected.find(item=>item.name===card.name);
          assert(definition,card.name);
          assert.equal(card.name,definition.name,definition.id);
          assert.equal(card.description,definition.description,definition.id);
          assert.equal(card.threshold,100,definition.id);
          assert.equal(card.unlocked,unlocked,definition.id);
          assert.equal(card.overflow,false,'card overflow: '+locale+'/'+definition.id);
          assert.equal(card.progress,unlocked ? 100 : (definition.id.startsWith('level_') ? Math.round(100 / definition.threshold) : 0),definition.id);
        });
        const fanfares = await page.locator('#fanfare .achievement-unlock').evaluateAll(elements=>elements.map(element=>({
          name:element.querySelector('strong').textContent,description:element.querySelector('p').textContent,
        })));
        assert.deepEqual(fanfares,unlocked ? expected.map(({name,description})=>({name,description})) : []);
        assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar' ? 'rtl' : 'ltr');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow: '+locale);
        cases.push({locale,width,unlocked,achievements:cards.length,passed:true});
      }
      if (['es','ar'].includes(locale)) await page.screenshot({path:path.join(evidence,locale+'-'+width+'.png')});
      console.log('Achievement cards and fanfares passed: '+locale+' at '+width+'px.');
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingInjectedChecks:true,hostedE2E:false,cases},null,2)+'\n');
} finally {
  await browser?.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  await rm(scratch,{recursive:true,force:true});
}
