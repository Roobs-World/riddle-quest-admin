import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {build} from '../../packages/portal/node_modules/vite/dist/node/index.js';
const portal=path.resolve('packages/portal'),evidence=path.resolve(process.env.CONTEXT_GAP_REPORT_DIR??'artifacts/live-context-read-cancellation-2026-10-06/gap-red');await mkdir(evidence,{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/context-admission-probe-'));let observations=[];
try {
 const entry=path.join(scratch,'entry.ts');await writeFile(entry,`export {createFacebookContextBoard} from ${JSON.stringify(path.join(portal,'src/facebook/contextBoard.ts'))};`);
 await build({root:scratch,configFile:false,logLevel:'error',plugins:[{name:'baseline-adapter',enforce:'pre',async load(id){if(process.env.CONTEXT_GAP_BASELINE_FILE&&id.endsWith('/facebook/contextBoard.ts'))return readFile(process.env.CONTEXT_GAP_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,lib:{entry,formats:['es'],fileName:()=> 'adapter.mjs'}}});
 const {createFacebookContextBoard}=await import(path.join(scratch,'dist/adapter.mjs'));
 const reads=[],board={locale:'en',startsAtMs:1000,endsAtMs:2000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[]};
 const capability=createFacebookContextBoard({ensureCurrent:async()=>({status:'success',value:{contextId:'a',contextType:'GROUP'}}),onContextChange:()=>()=>{}},{list:async input=>{reads.push(input);return {data:board};},record:async()=>{throw Error('Unexpected record');}});
 const controller=new AbortController(),pending=capability.list('en',controller.signal);
 await Promise.resolve();controller.abort();const result=await pending;
 observations=[{name:'retirement between native resolution and authority admission issues no request',actual:reads.length,expected:0},{name:'retired read resolves as ignored absence',actual:result,expected:null}];
} finally {await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({checks:observations.length,failures},null,2));assert.equal(failures.length,0);
