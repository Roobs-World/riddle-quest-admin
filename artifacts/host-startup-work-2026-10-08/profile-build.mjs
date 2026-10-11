import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const portal=path.resolve('packages/portal'),require=createRequire(path.join(portal,'package.json'));
const {build}=await import(require.resolve('vite'));
const evidence=path.resolve('artifacts/host-startup-work-2026-10-08');
process.env.JEST_BUILD='1';process.env.VITE_JEST_RUNTIME='1';process.env.NODE_ENV='production';process.env.JEST_BUILD_OUT_DIR='/tmp/host-startup-profile-20261008a';
await mkdir(evidence,{recursive:true});
await build({root:portal,mode:"jest",configFile:path.join(portal,'vite.config.ts'),logLevel:'error',plugins:[{name:'diagnostic-chunk-work',generateBundle(_options,bundle){return writeFile(path.join(evidence,'chunk-work.json'),JSON.stringify(Object.values(bundle).filter(x=>x.type==='chunk').map(x=>({file:x.fileName,imports:x.imports,dynamicImports:x.dynamicImports,bytes:Buffer.byteLength(x.code),modules:Object.entries(x.modules).map(([id,m])=>({id,renderedLength:m.renderedLength,originalLength:m.originalLength})).sort((a,b)=>b.renderedLength-a.renderedLength)})),null,2)+'\n');}}]});
