import {readFile,writeFile,mkdir,rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {developmentSourceDigest} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-source-digest.mjs';
const root='/home/craig-beswetherick/Documents/riddle-quest',out=root+'/artifacts/current-source-readiness-2026-10-25/upload';
const candidate=JSON.parse(await readFile(out+'/provider-candidate.json')),prepared=JSON.parse(await readFile(out+'/preparation.json')),content=JSON.parse(await readFile(out+'/provider-content-hashes.json'));
if(!content.allProviderServedBytesMatchTestedCanonicalArchive||candidate.versionId!==content.versionId||candidate.isActive!==false||candidate.buildStatus!=='ready')throw Error('Inactive tested hosted candidate is not ready');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(await readFile(out+'/build.zip'))!==prepared.archiveSha256)throw Error('Candidate archive changed');
const sourceBefore=await developmentSourceDigest(root);if(sourceBefore!==prepared.sourceDigest)throw Error('Candidate source changed');
const slotRoot='/tmp/riddle-browser-slots-20261025';await mkdir(slotRoot,{recursive:true});let slot;
while(!slot){for(let n=0;n<2;n++){try{await mkdir(slotRoot+'/'+n);slot=slotRoot+'/'+n;break;}catch(error){if(error.code!=='EEXIST')throw error;}}if(!slot)await new Promise(resolve=>setTimeout(resolve,20));}
const env={...process.env,RIDDLE_LOCAL_VERIFICATION:'1',RIDDLE_MATRIX_GENERATION:'next',RIDDLE_READONLY_BUILD_ORIGIN:new URL(candidate.contentBaseUrl).origin,NODE_OPTIONS:'--require=/tmp/riddle-silent-browser.cjs',REVIEW_FEEDBACK_HOSTED_URL:candidate.contentBaseUrl+'index.html',REVIEW_FEEDBACK_REPORT_DIR:out+'/hosted-continue',SENTRY_UPLOAD_SOURCEMAPS:'false'};
let log='',exitCode;const startedAt=new Date().toISOString();
try{exitCode=await new Promise((resolve,reject)=>{const child=spawn('/home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node',['packages/portal/scripts/verify-review-feedback-browser.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>log+=v);child.stderr.on('data',v=>log+=v);child.on('error',reject);child.on('close',resolve);});}finally{await rmdir(slot);}
await writeFile(out+'/hosted-continue.log',log);
const results=JSON.parse(await readFile(out+'/hosted-continue/browser-results.json'));
const guards={};for(const[key,file]of Object.entries({silentGuardSha256:'/tmp/riddle-silent-browser.cjs',jestSetupBridgeSha256:'/tmp/riddle-jest-silent-setup.cjs',sharedFixtureAdapterSha256:'/tmp/riddle-shared-silent-audio.cjs',silentFixtureSha256:'/home/craig-beswetherick/Documents/BeeHive/tests/helpers/silent-audio.js'}))guards[key]=sha(await readFile(file));
const sourceAfter=await developmentSourceDigest(root),report={startedAt,completedAt:new Date().toISOString(),status:exitCode===0&&results.length===5&&results.every(r=>r.passed)&&sourceBefore===sourceAfter?'passed':'failed',exitCode,sourceBefore,sourceAfter,sourceStillMatches:sourceBefore===sourceAfter,versionId:candidate.versionId,contentBaseUrl:candidate.contentBaseUrl,archiveSha256:prepared.archiveSha256,results,guards,log:'artifacts/current-source-readiness-2026-10-25/upload/hosted-continue.log',logSha256:sha(log),scope:'Five actual hosted inactive-candidate journeys with sandbox adapter/harness data and blocked external provider requests. No purchases, invitations, review, activation or publication.'};
if(!log.includes('context isolated before navigation')||!log.includes('muted chromium launch'))report.status='failed';
await writeFile(out+'/hosted-continue-receipt.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:results.length,versionId:report.versionId,sourceStable:report.sourceStillMatches}));if(report.status!=='passed')process.exit(1);
