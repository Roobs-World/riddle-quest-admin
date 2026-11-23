import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.CENTERED_TOOLTIP_REACT_MODE??'development',baseline=process.env.CENTERED_TOOLTIP_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.CENTERED_TOOLTIP_REPORT_DIR??path.join(root,'builds/test-evidence/centered-tooltip-work-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/centered-tooltip-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {TooltipOverlay} from ${JSON.stringify(path.join(root,"src/onboarding/components/TooltipOverlay.tsx"))};
import {setLocaleAndWait,tr,useLocale} from ${JSON.stringify(path.join(root,"src/localization/browser/i18n.ts"))};
import {TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
const params=new URL(location.href).searchParams;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});await setLocaleAndWait(params.get('locale')??'en');
window.probe={reads:0,adds:0,removes:0,observers:new Set(),activations:0,errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const nativeRect=HTMLElement.prototype.getBoundingClientRect;window.probe.rect=element=>nativeRect.call(element);HTMLElement.prototype.getBoundingClientRect=function(){if(this.matches('.tooltip-card'))window.probe.reads++;return nativeRect.call(this);};
const NativeObserver=window.ResizeObserver;window.ResizeObserver=class extends NativeObserver{observed=false;observe(target,...args){if(target.matches('.tooltip-card')){this.observed=true;window.probe.adds++;window.probe.observers.add(this);}return super.observe(target,...args);}disconnect(){if(this.observed){window.probe.removes++;window.probe.observers.delete(this);this.observed=false;}return super.disconnect();}};
function App(){const locale=useLocale(),card=React.useRef(null),[anchored,setAnchored]=React.useState(false),[visible,setVisible]=React.useState(true),[tick,setTick]=React.useState(0),[size,setSize]=React.useState({width:innerWidth,height:innerHeight});React.useEffect(()=>{const resize=()=>setSize({width:innerWidth,height:innerHeight});window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const id=anchored?'submitAnswer':'leaderboardFifthCorrectAnswer';const content=React.useMemo(()=>{const [title,body]=TOOLTIP_KEYS[id];return {title:tr(title),body:tr(body).repeat(3)};},[id,locale]);const rect=React.useMemo(()=>anchored?new DOMRect(40,size.height-70,110,30):null,[anchored,size]);
 return <><nav style={{position:'fixed',zIndex:10000,top:0,left:0,fontSize:10}}><button data-refresh onMouseDown={e=>e.preventDefault()} onClick={()=>setTick(x=>x+1)}>Deliver update</button><button data-anchor onClick={()=>setAnchored(x=>!x)}>Toggle anchor</button><span data-tick>{tick}</span></nav>{visible&&<TooltipOverlay cardRef={card} activeTooltip={id} content={content} sequenceIndex={0} sequenceLength={1} targetRect={rect} onAdvance={()=>{window.probe.activations++;setVisible(false);}}/>}</>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-tooltip-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/TooltipOverlay.tsx'))return readFile(path.join(baseline,'tooltip.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port;
 if(process.env.CENTERED_TOOLTIP_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.CENTERED_TOOLTIP_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const locale of process.env.CENTERED_TOOLTIP_LOCALES?.split(',')??['ar','de','en','es','fr','hi','id','it','ja','ko','nl','pl','pt','ru','tr','vi']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const metric=(name,actual,expected)=>observations.push({width,height,locale,name,actual,expected});
  const counts=()=>page.evaluate(()=>({reads:window.probe.reads,adds:window.probe.adds,removes:window.probe.removes,active:window.probe.observers.size}));
  const geometry=()=>page.evaluate(()=>{const rect=window.probe.rect(document.querySelector('.tooltip-card'));return {x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};});
  await page.goto(url+'/?locale='+locale);await page.locator('.tooltip-card').waitFor();await settle();
  let before=await counts(),box=await geometry();
  metric('centered entry performs no panel geometry reads',before.reads,0);metric('centered entry has no panel observer',before.active,0);
  metric('native CSS centers the complete translated card',Math.abs(box.x-width/2)<1&&Math.abs(box.y-height/2)<1,true);
  metric('centered content fits inside the viewport',box.top>=13&&box.bottom<=height-13,true);
  for(let update=0;update<32;update++)await page.locator('[data-refresh]').click();await settle();
  let after=await counts();metric('32 updates add no centered geometry work',after.reads,before.reads);metric('32 updates do not register a centered observer',after.adds,before.adds);
  await page.locator('[data-anchor]').click();await settle();after=await counts();box=await geometry();
  metric('anchored placement still measures panel geometry',after.reads>before.reads,true);metric('anchored placement owns one observer',after.active,1);
  metric('anchored card and action remain inside the viewport',box.top>=13&&box.bottom<=height-13,true);
  before=after;await page.setViewportSize({width,height:height+160});await settle();after=await counts();box=await geometry();
  metric('anchored resize still updates panel geometry',after.reads>before.reads,true);metric('anchored resize retains its observer',after.active,1);
  metric('anchored resize keeps the translated action reachable',box.top>=13&&box.bottom<=height+160-13,true);
  before=after;await page.locator('[data-anchor]').click();await settle();after=await counts();box=await geometry();
  metric('returning to centered placement performs no new measurements',after.reads,before.reads);metric('returning to centered placement retires its observer',after.active,0);
  metric('returning to centered placement uses native CSS centering',Math.abs(box.y-(height+160)/2)<1,true);
  before=after;await page.setViewportSize({width,height});await settle();after=await counts();box=await geometry();
  metric('centered resize performs no geometry work',after.reads,before.reads);metric('centered resize follows the viewport naturally',Math.abs(box.y-height/2)<1,true);
  await page.screenshot({path:path.join(output,[locale,width,height].join('-')+'.png')});
  await page.locator('.tooltip-card button').click();await page.locator('.tooltip-card').waitFor({state:'detached'});await settle();
  metric('native advance activates exactly once',await page.evaluate(()=>window.probe.activations),1);metric('retirement leaves no panel observer',(await counts()).active,0);
  metric('browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);
  await context.close();
 }
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));
 if(process.env.CENTERED_TOOLTIP_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Centered tooltip layout work and geometry');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.CENTERED_TOOLTIP_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
