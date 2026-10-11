import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const evidence=path.resolve('artifacts/backend-current-sdk-2026-10-08'),functionsRoot=path.resolve('firebase-functions'),require=createRequire(path.join(functionsRoot,'package.json'));
const held=[];try{
 for(let i=0;i<6;i++){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));held.push(server);}
 const ports=held.map(x=>x.address().port);
 await writeFile(path.join(evidence,'emulator.json'),JSON.stringify({firestore:{rules:path.join(functionsRoot,'firestore.rules'),indexes:path.join(functionsRoot,'firestore.indexes.json')},database:{rules:path.join(functionsRoot,'database.rules.json')},storage:{rules:path.join(functionsRoot,'storage.rules')},emulators:{firestore:{host:'127.0.0.1',port:ports[0],websocketPort:ports[1]},database:{host:'127.0.0.1',port:ports[2]},storage:{host:'127.0.0.1',port:ports[3]},hub:{host:'127.0.0.1',port:ports[4]},logging:{host:'127.0.0.1',port:ports[5]},ui:{enabled:false},singleProjectMode:true}},null,2)+'\n');
 await writeFile(path.join(evidence,'integration.config.cjs'),`const base=require(${JSON.stringify(path.join(functionsRoot,'jest.config.js'))});module.exports={...base,rootDir:${JSON.stringify(functionsRoot)},testMatch:['**/__tests__/**/*.it.test.ts'],collectCoverage:false,reporters:['default',${JSON.stringify(path.join(functionsRoot,'scripts/test-progress-reporter.cjs'))}]};\n`);
 await writeFile(path.join(evidence,'sdk-entry.cjs'),`const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');const root=${JSON.stringify(functionsRoot)},pinned=fs.readFileSync(path.join(root,'.nvmrc'),'utf8').trim();if(process.versions.node!==pinned)throw new Error('Pinned runtime required');console.log('[Pinned Functions runtime '+process.version+'] complete current integration selection');const jest=require.resolve('jest/bin/jest',{paths:[root]});const result=spawnSync(process.execPath,['--experimental-vm-modules',jest,'--config',${JSON.stringify(path.join(evidence,'integration.config.cjs'))},'--maxWorkers=1','--workerIdleMemoryLimit=1536MB','--json','--outputFile',${JSON.stringify(path.join(evidence,'integration-results.json'))}],{cwd:root,env:process.env,stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;\n`);
 for(const server of held)await new Promise(resolve=>server.close(resolve));
 const cli=require.resolve('firebase-tools/lib/bin/firebase.js');
 const command=`node scripts/run-with-functions-node.js ${path.join(evidence,'sdk-entry.cjs')}`;
 const child=spawn(process.execPath,[cli,'emulators:exec','--project','demo-riddle-quest-audit','--config',path.join(evidence,'emulator.json'),'--only','firestore,database,storage',command],{cwd:functionsRoot,stdio:'inherit',env:{...process.env,GCLOUD_PROJECT:'demo-riddle-quest-audit',FIREBASE_PROJECT_ID:'demo-riddle-quest-audit',pnpm_config_verify_deps_before_run:'false',CI:'1',PRESENCE_RECONCILIATION_CLI:'/tmp/backend-current-sdk-compiled-20261008a/scripts/presence-visibility-reconcile.js'}});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});process.exitCode=code??1;
}finally{for(const server of held)if(server.listening)await new Promise(resolve=>server.close(resolve));}
