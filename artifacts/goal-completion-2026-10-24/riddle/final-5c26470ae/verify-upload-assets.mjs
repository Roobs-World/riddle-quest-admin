import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,serveArtifact} from '../../../../scripts/release/browser-artifact-support.mjs';
const out=path.dirname(fileURLToPath(import.meta.url)),artifact=path.join(out,'jest-upload-artifact'),screens=path.join(out,'asset-screenshots');await mkdir(screens,{recursive:true});
const server=await serveArtifact(artifact),browser=await chromium.launch({headless:true});const results=[];
try{for(const viewport of [{width:390,height:844},{width:1280,height:900},{width:459,height:591}]){
 const context=await browser.newContext({viewport});await context.route('https://cdn.jest.com/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await context.addInitScript(()=>{window.__RIDDLE_QUEST_BROWSER_TEST__=true;localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:jest-guest','seen');localStorage.setItem('riddleQuest:tooltipSequenceSeen:profileTour:jest-guest','seen');});
 const page=await context.newPage(),pageErrors=[],failed=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('response',response=>{if(response.status()>=400)failed.push({status:response.status(),path:new URL(response.url()).pathname});});
 await page.goto(server.url+'?harness=jest&dailyCompleted=1');await page.locator('.onboarding-card-welcome .play-primary').click();await page.locator('.onboarding-clues').waitFor();await page.locator('.onboarding-card .play-primary').click();await page.locator('.keyboard').waitFor();
 for(let n=0,idle=0;n<30&&idle<4;n++){await page.waitForTimeout(100);const tooltip=page.locator('.tooltip-backdrop');if(await tooltip.count()){await tooltip.locator('button').click();idle=0;}else idle++;}
 assert.equal(await page.locator('.tooltip-backdrop').count(),0);await page.keyboard.press('P');await page.waitForFunction(()=>document.querySelector('.guess-row .cell')?.textContent==='P');await page.keyboard.press('Backspace');
 await page.waitForFunction(()=>{const image=document.querySelector('.coin-pill img');return image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0;});
 const images=await page.locator('img').evaluateAll(nodes=>nodes.map(image=>({path:new URL(image.currentSrc||image.src,location.href).pathname,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,visible:image.getBoundingClientRect().width>0&&image.getBoundingClientRect().height>0})));
 assert(images.filter(image=>image.visible).every(image=>image.complete&&image.naturalWidth>0),'Visible image failed to decode');assert.deepEqual(failed,[]);assert.deepEqual(pageErrors,[]);await page.screenshot({path:path.join(screens,'game-'+viewport.width+'x'+viewport.height+'.png')});results.push({viewport,visibleImages:images.filter(image=>image.visible),allVisibleImagesDecoded:true,failedRequests:failed,pageErrors});await context.close();
}}finally{await browser.close();await server.close();}
await writeFile(path.join(out,'uploaded-asset-browser-results.json'),JSON.stringify({verifiedAt:new Date().toISOString(),versionId:'01a16bab-1ab2-769f-9640-062af485a1ef',scope:'Exact uploaded artifact; local provider boundary mock; genuine bundled assets and MIME types',results},null,2)+'\n');console.log(JSON.stringify({viewports:results.length,allVisibleImagesDecoded:true,coinIconVerified:true}));
