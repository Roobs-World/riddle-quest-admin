import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import {developmentSourceDigest} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-source-digest.mjs';
const run=promisify(execFile),root='/home/craig-beswetherick/Documents/riddle-quest';
const output=root+'/artifacts/current-source-readiness-2026-10-25';
const checks=[
 ['tsdoc','node',['scripts/audit-tsdoc.mjs']],
 ['file-sizes','node',['scripts/audit-file-sizes.mjs']],
 ['target-boundaries','node',['packages/portal/scripts/audit-web-target-boundaries.mjs']],
 ['locales','node',['packages/portal/scripts/audit-locales.mjs']],
 ['core-types','pnpm',['--filter','@qwordly/core','check:types']],
 ['portal-types','pnpm',['--filter','@qwordly/portal','check:types']],
 ['licenses','node',['packages/portal/scripts/generate-third-party-licenses.mjs','--check']],
 ['security-config','node',['scripts/audit-security-config.mjs']],
 ['facebook-secrets','node',['scripts/audit-facebook-secret-boundary.mjs']],
 ['facebook-commerce','node',['scripts/audit-facebook-commerce-activation.mjs']],
 ['facebook-profile','node',['scripts/audit-facebook-profile-boundary.mjs']],
 ['modern-packages','node',['scripts/audit-modern-package-features.mjs']],
 ['backend-scalability','node',['scripts/audit-backend-scalability.mjs']],
 ['function-capacity','node',['scripts/audit-function-capacity.mjs']],
];
await mkdir(output,{recursive:true});
const sourceBefore=await developmentSourceDigest(root),results=[];
for(const [id,executable,args] of checks){
 const startedAt=new Date().toISOString();let status='passed',stdout='',stderr='',exitCode=0;
 try{({stdout,stderr}=await run(executable,args,{cwd:root,maxBuffer:8*1024*1024}));}catch(error){status='failed';exitCode=error.code;stdout=error.stdout||'';stderr=error.stderr||String(error)}
 const log=stdout+stderr;await writeFile(output+'/'+id+'.log',log);
 results.push({id,executable,args,status,exitCode,startedAt,completedAt:new Date().toISOString(),log:'artifacts/current-source-readiness-2026-10-25/'+id+'.log',sha256:createHash('sha256').update(log).digest('hex')});
}
const sourceAfter=await developmentSourceDigest(root);
const report={scope:'Compiler and static source/dependency audits only. No runtime test suite, browser harness, game upload, activation, live navigation or provider submission.',sourceBefore,sourceAfter,sourceStable:sourceBefore===sourceAfter,checks:results};
await writeFile(output+'/static-checks.json',JSON.stringify(report,null,2)+'\n');
for(const [from,to] of [['/tmp/riddle-tsdoc-fix.json','tsdoc-runtime-equivalence.json'],['/tmp/riddle-queued-extraction-static-proof.json','queued-extraction-static-proof.json'],['/tmp/riddle-development-evidence-census-2026-10-25.json','historical-evidence-census.json']])await writeFile(output+'/'+to,await readFile(from));
console.log(JSON.stringify({sourceStable:report.sourceStable,passed:results.filter(r=>r.status==='passed').length,total:results.length,failures:results.filter(r=>r.status!=='passed'),report:output+'/static-checks.json'},null,2));
