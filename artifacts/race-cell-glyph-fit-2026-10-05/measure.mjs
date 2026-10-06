import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const evidence=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(evidence,'../..'),portal=path.join(repo,'packages/portal'),phase=process.argv[2]??'baseline',output=path.join(evidence,phase),fixture=path.join(output,'fixture');
assert(['baseline','fixed'].includes(phase));
const require=createRequire(path.join(portal,'package.json')),{build}=await import(require.resolve('vite')),{chromium,firefox}=require('@playwright/test');
const before=JSON.parse(await readFile(path.join(repo,'artifacts/race-answer-input-shape-2026-10-05/source-report.json'),'utf8'));
const sourcePaths=Object.keys(before);if(phase==='fixed')sourcePaths.push('packages/portal/src/input/useGuessGlyphFit.ts');
const hashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,createHash('sha256').update(await readFile(path.join(repo,p))).digest('hex')])));
const sourceBefore=await hashes();await writeFile(path.join(output,'source-before.json'),JSON.stringify(sourceBefore,null,2));
const controls=JSON.parse(await readFile(path.join(evidence,'controls.json'),'utf8'));const rows=[];let server,browser,cases=0;
try{
 for(const mode of ['development','production'])await build({root:fixture,base:'/'+mode+'/',configFile:false,publicDir:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:[{find:/^react$/,replacement:path.join(portal,'node_modules/react')},{find:/^react\//,replacement:path.join(portal,'node_modules/react/')},{find:/^react-dom$/,replacement:path.join(portal,'node_modules/react-dom')},{find:/^react-dom\//,replacement:path.join(portal,'node_modules/react-dom/')},{find:'@qwordly/core/race',replacement:path.join(repo,'packages/core/src/race/index.ts')},{find:'@qwordly/core/game',replacement:path.join(repo,'packages/core/src/game/index.ts')}]},build:{outDir:path.join(output,mode,'built'),minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}const match=/^\/(development|production)(\/.*)?$/.exec(url.pathname);if(!match){res.writeHead(404).end();return;}const file=path.join(output,match[1],'built',!match[2]||match[2]==='/'?'index.html':match[2]);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch(error){res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;await writeFile(path.join(output,'server.json'),JSON.stringify({base,pid:process.pid},null,2));
 for(const browserName of ['chromium','firefox']){
 browser=await (browserName==='chromium'?chromium.launch({headless:true}):firefox.launch({headless:true,executablePath:'/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox'}));
 for(const mode of ['development','production'])for(const [viewportName,viewport] of Object.entries({small:{width:320,height:568},mobile:{width:390,height:844},desktop:{width:1280,height:800},landscape:{width:844,height:390}}))for(const kind of Object.keys(controls)){
 const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));await page.goto(base+'/'+mode+'/?kind='+kind);await page.waitForFunction(()=>window.nativeExercise);await page.evaluate(()=>window.nativeExercise('paste'));await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 const measure=async stage=>{
 const cells=await page.locator('.guess-board').evaluate(board=>[...board.querySelectorAll('button')].filter(b=>b.textContent).map(b=>{const range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect(),rect=b.getBoundingClientRect(),style=getComputedStyle(b);return {text:b.textContent,button:{left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom},glyph:{left:text.left,top:text.top,width:text.width,height:text.height,right:text.right,bottom:text.bottom},fontSize:style.fontSize,overflowX:text.left<rect.left-.5||text.right>rect.right+.5,overflowY:text.top<rect.top-.5||text.bottom>rect.bottom+.5,disabled:b.disabled,label:b.getAttribute('aria-label')};}));
 rows.push({browser:browserName,mode,viewportName,kind,stage,cells});
 if(phase==='fixed')for(const cell of cells){assert(!cell.overflowX&&!cell.overflowY,JSON.stringify({browserName,mode,viewportName,kind,stage,cell}));assert(cell.label.includes(cell.text),'Complete accessible text');}
 };
 await measure('draft');await page.locator('.race-actions .submit-action').click();await page.waitForFunction(()=>window.probe.commands.length===1);await measure('history');await page.locator('.race-actions button').first().click();await page.waitForFunction(()=>window.readUnicode().run.currentRiddle.revealedLetters.length===1);await measure('hint');
 if(phase==='fixed'&&kind==='hi'&&viewportName==='mobile')for(const [name,size] of Object.entries({small:{width:320,height:568},landscape:{width:844,height:390},mobile:{width:390,height:844}})){await page.setViewportSize(size);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await measure('resize-'+name);}
 if(phase==='fixed'&&kind==='hi'&&viewportName==='mobile'){const style=await page.addStyleTag({content:'.cell {font-size:38px !important;}'});await page.evaluate(()=>{document.fonts.dispatchEvent(new Event('loadingdone'));});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await measure('font-notification');await style.evaluate(node=>node.remove());await page.evaluate(()=>{document.fonts.dispatchEvent(new Event('loadingdone'));});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await measure('font-restored');}
 if(['hi','family'].includes(kind))await page.screenshot({path:path.join(output,[browserName,mode,viewportName,kind].join('-')+'.png'),fullPage:true});assert.deepEqual(errors,[]);await context.close();cases++;
 }
 await browser.close();browser=null;
 }
}finally{
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));const sourceAfter=await hashes();await writeFile(path.join(output,'source-after.json'),JSON.stringify(sourceAfter,null,2));assert.deepEqual(sourceAfter,sourceBefore);await writeFile(path.join(output,'measurements.json'),JSON.stringify(rows,null,2));const overflow=rows.filter(r=>r.cells.some(c=>c.overflowX||c.overflowY));const summary={phase,cases,documentStates:rows.length,overflowDocumentStates:overflow.length,overflowControls:[...new Set(overflow.map(r=>r.kind))],maxHorizontalOverflowPixels:Math.max(0,...rows.flatMap(r=>r.cells.map(c=>Math.max(c.button.left-c.glyph.left,c.glyph.right-c.button.right)))),sourceStable:true,selectedSourceInputs:Object.keys(sourceBefore).length,portClosed:true};await writeFile(path.join(output,'terminal.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
