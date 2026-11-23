import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'vite';
const playwright=await import(process.env.JEST_SCREENSHOT_PLAYWRIGHT_MODULE?pathToFileURL(process.env.JEST_SCREENSHOT_PLAYWRIGHT_MODULE).href:'@playwright/test');
const engines=process.env.JEST_SCREENSHOT_BROWSER?[process.env.JEST_SCREENSHOT_BROWSER]:['chromium','webkit'];
if(engines.some(engine=>!['chromium','webkit'].includes(engine)))throw new Error('JEST_SCREENSHOT_BROWSER must be chromium or webkit');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.env.JEST_SCREENSHOT_REPORT_DIR??path.join(root,'../../artifacts/jest-screenshot-review-2026-10-25'));await mkdir(out,{recursive:true});
const fixture=(req,res,next)=>{
 if(!req.url.startsWith('/__capture-fixture'))return next();
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><style>html,body{margin:0}body{background:#efef00}aside{position:fixed;right:0;top:0;background:#efef00;z-index:999}.game-app{position:relative;width:100vw;height:100dvh;overflow:hidden;background:#123a28;color:white;font:24px sans-serif}.board{position:absolute;left:30px;top:130px;width:220px;height:130px;background:#d43241}.asset{position:absolute;left:30px;top:300px;width:80px;height:80px}.modal{position:fixed;inset:90px 25px 130px;background:#4055de;color:white;border:8px solid #f0c230}.scrollbox{position:absolute;left:30px;top:450px;width:220px;height:150px;overflow:auto}.scrollbox>div{height:150px}.private{position:absolute;right:2px;top:2px;width:24px;height:24px;background:#ff00ff}.secret{display:none;background:#ff00ff}.offscreen{position:absolute;left:200vw;width:60px;height:60px;background:#ff00ff}</style></head><body><aside>OUTSIDE SECRET</aside><main class="game-app"><h1>Current rendered game</h1><div class="board">Five guess rows</div><img class="asset" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%2345c5e8'/%3E%3C/svg%3E"><div class="scrollbox"><div style="background:#d43241">First row</div><div style="background:#4055de">Current scrolled row</div></div><div class="private" data-screenshot-private>Private</div><div class="secret">HIDDEN SECRET</div><div class="offscreen">OFFSCREEN SECRET</div></main></body></html>`);
};
const vite=await createServer({root,configFile:false,optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'capture-fixture',configureServer(server){server.middlewares.use(fixture);}}]});
await vite.listen();const entry='http://127.0.0.1:'+vite.httpServer.address().port;const results=[];
try{for(const engine of engines){const launcher=playwright[engine];const launchOptions={headless:true,args:engine==='chromium'?['--mute-audio']:[]};if(process.env.GIO_MODULE_DIR?.includes('/snap/code/')){launchOptions.env={...process.env};delete launchOptions.env.GIO_MODULE_DIR;}
 let browser;try{browser=await launcher.launch(launchOptions);}catch(error){if(engine!=='webkit')throw error;results.push({engine,skipped:true,reason:String(error).includes('libevent-2.1.so.7')?'WebKit system dependency libevent-2.1.so.7 is unavailable':String(error).split('\n')[0]});continue;}
 try{for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){this.muted=true;return Promise.resolve();};for(const k of ['AudioContext','webkitAudioContext'])if(window[k]){window[k]=class{resume(){return Promise.resolve();}suspend(){return Promise.resolve();}close(){return Promise.resolve();}};}});
  await context.route('**/*',route=>route.request().resourceType()==='media'?route.abort():route.continue());
  const page=await context.newPage();await page.goto(entry+'/__capture-fixture');
  for(const state of ['game','failed-avatar','scrolled','modal']){const modal=state==='modal';if(state==='failed-avatar'){await page.locator('img.asset').evaluate(image=>{image.onerror=()=>{const fallback=document.createElement('span');fallback.className='asset avatar-fallback';fallback.style.background='#45c5e8';fallback.textContent='G';image.replaceWith(fallback);};image.src='/__missing-avatar.png';});await page.locator('.avatar-fallback').waitFor({state:'visible'});}if(state==='scrolled')await page.locator('.scrollbox').evaluate(node=>node.scrollTop=150);
   if(modal)await page.locator('.game-app').evaluate(node=>{const dialog=document.createElement('section');dialog.className='modal';dialog.textContent='Current shop overlay';node.append(dialog);});
   const result=await page.evaluate(async()=>{
    const {captureGameScreenshot}=await import('/src/jest/sharing/captureGameScreenshot.ts');const image=await captureGameScreenshot();if(!image)return {image:null};
    const bitmap=new Image();bitmap.src=image;await bitmap.decode();const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const pixel=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    return {image,width:bitmap.width,height:bitmap.height,pixels:{background:pixel(10,400),board:pixel(60,180),asset:pixel(60,340),bottom:pixel(10,bitmap.height-20),modal:pixel(100,200),scroll:pixel(60,530),private:pixel(bitmap.width-10,10),hiddenPink:Array.from(ctx.getImageData(0,0,bitmap.width,bitmap.height).data).filter((value,i,all)=>i%4===0&&value===255&&all[i+1]===0&&all[i+2]===255).length}};
   });
   const name=engine+'-'+viewport.width+'-'+state;if(result.image)await writeFile(path.join(out,name+'.png'),Buffer.from(result.image.split(',')[1],'base64'));
   assert.equal(result.width,viewport.width,name+' must capture viewport width');assert.equal(result.height,viewport.height,name+' must capture viewport height');
   const equal=(actual,expected)=>assert.deepEqual(actual,expected,name+' must capture actual rendered pixels');
   assert.equal(result.pixels.hiddenPink,0,name+' must exclude hidden, private and offscreen content');equal(result.pixels.private,[18,58,40,255]);equal(result.pixels.background,[18,58,40,255]);equal(result.pixels.bottom,[18,58,40,255]);
   if(modal)equal(result.pixels.modal,[64,85,222,255]);else{equal(result.pixels.scroll,state==='scrolled'?[64,85,222,255]:[212,50,65,255]);equal(result.pixels.board,[212,50,65,255]);equal(result.pixels.asset,[69,197,232,255]);}
   results.push({name,passed:true,width:result.width,height:result.height});
  }
  await context.close();
 }}finally{await browser.close();}
}}finally{await vite.close();await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
