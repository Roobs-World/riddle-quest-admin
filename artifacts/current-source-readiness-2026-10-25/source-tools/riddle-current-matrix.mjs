import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rmdir} from 'node:fs/promises';
import {assertDevelopmentCheckOutput} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-check-output.mjs';
import {developmentSourceDigest} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-source-digest.mjs';
const root='/home/craig-beswetherick/Documents/riddle-quest';
const output=root+'/artifacts/current-source-readiness-2026-10-25/matrix';
const baseline=JSON.parse(await readFile(root+'/artifacts/development-checks/goal-20261024-receipts-final5c-local-receipts/checks-report-snapshot.json','utf8'));
baseline.checks.push({index:182,executable:'node',args:['scripts/release/verify-packaged-games.mjs'],ids:['fresh-packaged-gameplay-prerequisite'],tasks:[],localBrowser:true,artifacts:{'artifacts/release-e2e/packaged-games.json':null}});
baseline.checks.push({index:183,executable:'env',args:['REVIEW_FEEDBACK_REPORT_DIR='+root+'/artifacts/current-source-readiness-2026-10-25/final-continue-browser','PORTAL_JEST_BUILD_DIR='+root+'/builds/jest','node','packages/portal/scripts/verify-review-feedback-browser.mjs'],ids:['final-continue-compiled-browser'],tasks:[],localBrowser:true,artifacts:{'artifacts/current-source-readiness-2026-10-25/final-continue-browser/browser-results.json':null}});
baseline.checks.push(...[['184','delivery'],['185','lifecycle']].map(([index,kind])=>({index:Number(index),executable:'env',args:['NODE_OPTIONS=--require=/tmp/riddle-silent-browser.cjs --import=/tmp/riddle-join-deadline-diagnostic.mjs','LIVE_RACE_REPORT_DIR='+root+'/artifacts/current-source-readiness-2026-10-25/diagnostic-'+kind,'node','packages/portal/scripts/verify-live-race-'+kind+'-browser.mjs'],ids:['isolated-join-deadline-diagnostic-'+kind],tasks:[],localBrowser:true,artifacts:{}})));
baseline.checks.push({index:186,executable:'env',args:['NODE_OPTIONS=--require=/tmp/riddle-silent-browser.cjs --require=/tmp/riddle-history-readback-config.cjs','PORTAL_BROWSER_TESTS=1','PORTAL_USE_EXISTING_BUILD=1','pnpm','--filter','@qwordly/portal','test','--runInBand','--runTestsByPath','src/facebook/__tests__/facebookBrowser.jest-playwright.test.ts'],ids:['passive-history-failure-readback'],tasks:[],localBrowser:true,artifacts:{}});
const indexes=(await Promise.all(process.argv.slice(2).map(async value=>value.startsWith('@')?JSON.parse(await readFile(value.slice(1),'utf8')):[Number(value)]))).flat();
const checks=baseline.checks.filter(c=>indexes.includes(c.index)).sort((a,b)=>indexes.indexOf(a.index)-indexes.indexOf(b.index));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(output,{recursive:true});
const slotRoot='/tmp/riddle-browser-slots-20261025';
await mkdir(slotRoot,{recursive:true});
async function browserSlot(check){
 if(!check.localBrowser&&!check.args.some(value=>/browser|PORTAL_BROWSER_TESTS=1/.test(value)))return async()=>{};
 for(;;){for(let slot=0;slot<2;slot++){const path=slotRoot+'/'+slot;try{await mkdir(path);return async()=>rmdir(path);}catch(error){if(error.code!=='EEXIST')throw error;}}await new Promise(resolve=>setTimeout(resolve,200));}
}
for(const check of checks){
 const release=await browserSlot(check);
 const sourceBefore=await developmentSourceDigest(root),startedAt=new Date().toISOString();
 const logPath=output+'/'+String(check.index).padStart(3,'0')+'.log';
 const env={...process.env,...(check.index===182?{RIDDLE_ALLOW_LOCAL_SERVICE_WORKER:'1'}:{}),SENTRY_UPLOAD_SOURCEMAPS:'false',RIDDLE_LOCAL_VERIFICATION:'1',RIDDLE_MATRIX_GENERATION:process.env.RIDDLE_MATRIX_GENERATION??'next',NODE_OPTIONS:[process.env.NODE_OPTIONS,'--require=/tmp/riddle-silent-browser.cjs'].filter(Boolean).join(' ')};
 const guardSha256=sha(await readFile('/tmp/riddle-silent-browser.cjs'));
 let log='';
 const named=check.args.some(value=>/^--testNamePattern(?:=|$)/.test(value));
 const structured=output+'/structured/'+String(check.index).padStart(3,'0')+'-jest.json';
 if(named)await mkdir(output+'/structured',{recursive:true});
 const executedArgs=named?[...check.args,'--json','--outputFile',structured]:check.args;
 let exitCode=await new Promise((resolve,reject)=>{const child=spawn(check.executable,executedArgs,{cwd:root,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);child.on('error',reject);child.on('close',resolve);});
 if(named&&exitCode===0){try{const raw=await readFile(structured,'utf8'),report=JSON.parse(raw),passedAssertionNames=(report.testResults??[]).flatMap(suite=>(suite.assertionResults??[]).filter(assertion=>assertion.status==='passed').map(assertion=>assertion.fullName));log+='\nNamed assertion report:\n'+raw+'\nEnd named assertion report.\n';assertDevelopmentCheckOutput(check,{stdout:log,passedAssertionNames});}catch(error){exitCode=1;log+='\nNamed assertion validation failed: '+error.stack+'\n';}}
 try{const prior=JSON.parse(await readFile(output+'/'+String(check.index).padStart(3,'0')+'.json','utf8'));await mkdir(output+'/attempts',{recursive:true});await writeFile(output+'/attempts/'+String(check.index).padStart(3,'0')+'-'+prior.sha256+'.json',JSON.stringify(prior,null,2)+'\n');await writeFile(output+'/attempts/'+String(check.index).padStart(3,'0')+'-'+prior.sha256+'.log',await readFile(root+'/'+prior.log));}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(logPath,log);
 const artifacts={};for(const path of Object.keys(check.artifacts||{})){try{artifacts[path]=sha(await readFile(root+'/'+path));}catch{artifacts[path]=null;}}
 const sourceAfter=await developmentSourceDigest(root);
 const result={...check,executedArgs,status:exitCode===0?'passed':'failed',exitCode,startedAt,checkedAt:new Date().toISOString(),sourceBefore,sourceAfter,sourceStillMatches:sourceBefore===sourceAfter,log:logPath.slice(root.length+1),sha256:sha(log),artifacts,artifactsObservedAt:new Date().toISOString(),provenance:{kind:'current-exact-execution',baselineReport:'artifacts/development-checks/goal-20261024-receipts-final5c-local-receipts/checks-report-snapshot.json'},environment:{SENTRY_UPLOAD_SOURCEMAPS:'false',RIDDLE_LOCAL_VERIFICATION:'1',RIDDLE_MATRIX_GENERATION:process.env.RIDDLE_MATRIX_GENERATION??'next',NODE_OPTIONS:env.NODE_OPTIONS,silentGuardSha256:guardSha256,TMPDIR:process.env.TMPDIR??null,browserDebug:process.env.DEBUG==='pw:browser'?'pw:browser':null,silentFixtureSha256:sha(await readFile('/home/craig-beswetherick/Documents/BeeHive/tests/helpers/silent-audio.js')),jestSetupBridgeSha256:sha(await readFile('/tmp/riddle-jest-silent-setup.cjs')),sharedFixtureAdapterSha256:sha(await readFile('/tmp/riddle-shared-silent-audio.cjs'))}};
 delete result.originReport;
 await writeFile(output+'/'+String(check.index).padStart(3,'0')+'.json',JSON.stringify(result,null,2)+'\n');
 await release();
 console.log(JSON.stringify({index:check.index,status:result.status,sourceStable:result.sourceStillMatches,log:result.log}));
}
