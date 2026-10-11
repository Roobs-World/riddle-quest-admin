import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,stat,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
const portal=path.resolve('packages/portal'),require=createRequire(path.join(portal,'package.json'));
const {build}=await import(require.resolve('vite'));
const evidence=path.resolve('artifacts/host-startup-work-2026-10-08'),run=promisify(execFile);
const before=new Map(await Promise.all(['achievements.ts','gameSession.ts','fakeServices.ts'].map(async(name,i)=>[path.join(portal,'src/play',name),await readFile(path.join(evidence,`owned-${String(i).padStart(2,'0')}-before.txt`),'utf8')])));
process.env.JEST_BUILD='1';process.env.VITE_JEST_RUNTIME='1';process.env.NODE_ENV='production';
const results=[];
for(let pair=1;pair<=5;pair++)for(const side of ['baseline','current']){
 const root=`/tmp/host-startup-compare-20261008a-${pair}-${side}`,out=path.join(evidence,'measurements',`${pair}-${side}`);await mkdir(out,{recursive:true});process.env.JEST_BUILD_OUT_DIR=root;
 let chunks;
 await build({root:portal,mode:'jest',configFile:path.join(portal,'vite.config.ts'),logLevel:'error',plugins:[{name:'owned-achievement-source-comparison',enforce:'pre',load(id){return side==='baseline'?before.get(id):undefined;},generateBundle(_options,bundle){chunks=Object.values(bundle).filter(x=>x.type==='chunk').map(x=>({file:x.fileName,imports:x.imports,modules:Object.keys(x.modules)}));}}]});
 const audited=await run(process.execPath,['scripts/audit-jest-artifact.mjs',root],{cwd:portal,env:process.env});await writeFile(path.join(out,'audit.log'),audited.stdout+audited.stderr);
 const html=await readFile(path.join(root,'index.html'),'utf8');await writeFile(path.join(out,'index.html'),html);
 const refs=[...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(x=>x[1]).filter(x=>! /^(?:https?:|data:|#)/i.test(x)).map(x=>x.split(/[?#]/)[0]))];let initialBytes=0;const resources=[];
 for(const name of refs){const source=path.resolve(root,name),bytes=(await stat(source)).size,body=await readFile(source),target=path.resolve(out,name);await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);initialBytes+=bytes;resources.push({name,bytes,sha256:createHash('sha256').update(body).digest('hex')});}
 const admitted=new Set(refs.map(x=>x.replace(/^\.\//,'')));let expanded=true;while(expanded){expanded=false;for(const chunk of chunks)if(admitted.has(chunk.file))for(const dependency of chunk.imports)if(!admitted.has(dependency)){admitted.add(dependency);expanded=true;}}
 const eagerCatalog=chunks.filter(x=>admitted.has(x.file)).flatMap(x=>x.modules).filter(x=>x.endsWith('/src/play/achievements.ts')||x.endsWith('/src/play/achievementMilestones.ts')||x.endsWith('/src/play/race/raceAchievementDefinitions.ts'));
 const result={pair,side,root,initialBytes,resources,eagerCatalog};results.push(result);await writeFile(path.join(out,'chunks.json'),JSON.stringify(chunks,null,2)+'\n');await writeFile(path.join(evidence,'measurements.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({pair,side,initialBytes,eagerCatalog}));
}
