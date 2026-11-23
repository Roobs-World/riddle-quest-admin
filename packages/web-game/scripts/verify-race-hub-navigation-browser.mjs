import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-hub-navigation-'));
const output=path.resolve(root,'../../artifacts/race-hub-navigation');
await mkdir(output,{recursive:true});
const source=`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import ${JSON.stringify(path.join(root,'src/styles.race-lobby.css'))};
import {RaceHubTabs} from ${JSON.stringify(path.join(root,'src/play/race/components/RaceHubTabs.tsx'))};
import {setLocale,useLocale} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
window.changeLocale=setLocale;window.selectEvents=[];
function App(){useLocale();const [active,setActive]=useState('play');const [tournaments,setTournaments]=useState(true);
 window.setTournamentCapability=setTournaments;
 const select=value=>{window.selectEvents.push(value);setActive(value);};
 return <main className="race-screen"><RaceHubTabs active={active} onPlay={()=>select('play')} onActivity={()=>select('activity')}
 onTournaments={tournaments?()=>select('tournaments'):undefined}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body style="margin:0"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser,server;
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{
  try{const url=new URL(request.url,'http://localhost');const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);
   response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');response.end(await readFile(file));
  }catch{response.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 const context=await browser.newContext();const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const locales=['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi'];
 let scenarios=0;
 for(const locale of locales){
  await page.evaluate(locale=>window.changeLocale(locale),locale);
  await page.waitForFunction(locale=>document.documentElement.lang===locale,locale);
  for(const width of [320,390,1280])for(const large of [false,true])for(const enabled of (['en','ar'].includes(locale)?[true,false]:[true])){
   await page.setViewportSize({width,height:900});
   await page.evaluate(({large,enabled})=>{window.setTournamentCapability(enabled);
    document.querySelectorAll('[role="tab"]').forEach(tab=>tab.style.fontSize=large?'32px':'');}, {large,enabled});
   await page.waitForFunction(enabled=>document.querySelectorAll('[role="tab"]').length===(enabled?3:2),enabled);
   await page.evaluate(large=>document.querySelectorAll('[role="tab"]').forEach(tab=>tab.style.fontSize=large?'32px':''),large);
   const boxes=await page.getByRole('tab').evaluateAll(tabs=>tabs.map(tab=>{
    const box=tab.getBoundingClientRect();return {label:tab.textContent,left:box.left,right:box.right,height:box.height,
     scrollWidth:tab.scrollWidth,clientWidth:tab.clientWidth,scrollHeight:tab.scrollHeight,clientHeight:tab.clientHeight};}));
   for(const box of boxes){assert(box.left>=0&&box.right<=width+1,JSON.stringify({locale,width,large,enabled,box}));
    assert(box.height>=44,JSON.stringify({locale,width,large,enabled,box}));
    assert(box.scrollWidth<=box.clientWidth+1&&box.scrollHeight<=box.clientHeight+1,JSON.stringify({locale,width,large,enabled,box}));}
   const tabs=page.getByRole('tab');await tabs.first().focus();await page.keyboard.press('End');
   await page.waitForFunction(()=>{const tabs=[...document.querySelectorAll('[role="tab"]')];return document.activeElement===tabs.at(-1)&&tabs.at(-1).getAttribute('aria-selected')==='true';});
   await page.keyboard.press('Home');
   await page.waitForFunction(()=>document.activeElement===document.querySelector('[role="tab"]')&&document.activeElement.getAttribute('aria-selected')==='true');
   assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(),1);
   if(width===390&&enabled&&['en','ar'].includes(locale))await page.screenshot({path:path.join(output,locale+'-'+(large?'large':'normal')+'.png'),fullPage:true});
   scenarios++;
  }
 }
 assert.deepEqual(errors,[]);console.log('Hub navigation passed: '+scenarios+' layouts; 16 locales, 320/390/1280px, normal/large text, optional tournaments, Home/End focus and one keyboard tab stop.');
 await context.close();
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
