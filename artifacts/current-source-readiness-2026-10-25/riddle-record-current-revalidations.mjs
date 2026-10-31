import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {reuseDevelopmentChecks} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-check-reuse.mjs';
import {recordDevelopmentCompletion} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-progress.mjs';
import {developmentSourceDigest} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-source-digest.mjs';
const root='/home/craig-beswetherick/Documents/riddle-quest';
const directory=root+'/artifacts/development-checks/current-source-20261025';
const historical=JSON.parse(await readFile(root+'/artifacts/development-checks/goal-20261024-receipts-final5c-local-receipts/report.json'));
const report=JSON.parse(await readFile(directory+'/checks-report.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const historicalReceiptsMatch=async()=>{for(const row of historical.results)if(sha(await readFile(root+'/'+row.receipt))!==row.receiptSha256)return false;return true;};
if(!await historicalReceiptsMatch())throw Error('Historical canonical receipt bytes changed before recording');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
const sourceBefore=await developmentSourceDigest(root);
if(sourceBefore!==report.sourceDigest||revision!==report.revision||report.checks.length!==182||report.checks.some(c=>c.status!=='passed'||!c.sourceStillMatches||c.sourceBefore!==sourceBefore||c.sourceAfter!==sourceBefore))throw Error('Current full-matrix source proof incomplete');
const snapshotPath=root+'/docs/reports/platform-release-readiness/src/data.json';
const beforeSnapshot=JSON.parse(await readFile(snapshotPath));
const beforeRows=beforeSnapshot.queries.development_progress.rows;
const otherQueries=Object.fromEntries(Object.entries(beforeSnapshot.queries).filter(([key])=>key!=='development_progress'));
const baselinePath=directory+'/recording-baseline.json';
let recordingBaseline;
try{recordingBaseline=JSON.parse(await readFile(baselinePath));}catch(error){if(error.code!=='ENOENT')throw error;recordingBaseline={sourceDigest:sourceBefore,revision,priorDevelopmentRows:beforeRows.length,priorRowsSha256:sha(JSON.stringify(beforeRows)),otherQueriesSha256:sha(JSON.stringify(otherQueries)),dashboardId:beforeSnapshot.id};await writeFile(baselinePath,JSON.stringify(recordingBaseline,null,2)+'\n',{flag:'wx'});}
if(recordingBaseline.sourceDigest!==sourceBefore||recordingBaseline.revision!==revision||recordingBaseline.dashboardId!==beforeSnapshot.id||sha(JSON.stringify(beforeRows.slice(0,recordingBaseline.priorDevelopmentRows)))!==recordingBaseline.priorRowsSha256||sha(JSON.stringify(otherQueries))!==recordingBaseline.otherQueriesSha256)throw Error('Recording baseline changed; preserve partial history');

await mkdir(directory+'/frozen-completions',{recursive:true});
const results=[];
for(const [index,original] of historical.results.entries()){
 const manifestBytes=await readFile(root+'/'+original.manifest),task=JSON.parse(manifestBytes);
 if(task.taskId!==original.taskId)throw Error('Original canonical task identity changed');
 const taskId=task.taskId+':source-'+sourceBefore.slice(0,12);
 if(taskId.length>160)throw Error('Revalidation alias is too long');
 const declarationSha256=sha(manifestBytes);
 const checks=await reuseDevelopmentChecks(root,task,report,{revision,sourceDigest:sourceBefore});
 const artifacts=[];for(const artifact of task.artifacts??[])artifacts.push({...artifact,sha256:sha(await readFile(root+'/'+artifact.file))});
 const candidate={taskId,targets:task.targets,work:task.work,revision,sourceDigest:sourceBefore,completedAt:report.auditedAt,trigger:'local current-source revalidation',requiredChecks:task.checks.map(c=>c.id),checks,remainingGates:task.remainingGates,nextAction:task.nextAction,artifacts,revalidation:{taskId:task.taskId,declarationSha256}};
 const frozenPath=directory+'/frozen-completions/'+String(index).padStart(3,'0')+'.json';
 const candidateBytes=JSON.stringify(candidate,null,2)+'\n';
 let completion;try{const frozenBytes=await readFile(frozenPath,'utf8');if(frozenBytes!==candidateBytes)throw Error('Frozen completion content changed; do not regenerate a partial retry');completion=JSON.parse(frozenBytes);}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(frozenPath,candidateBytes,{flag:'wx'});completion=candidate;}
 if(process.argv.includes('--record'))await recordDevelopmentCompletion(root,completion,{acceptedRevision:revision});
 const receipt='artifacts/development-progress/'+taskId.replaceAll(':','_')+'-'+revision+'.json';
 results.push({taskId:task.taskId,revalidationTaskId:taskId,manifest:original.manifest,declarationSha256,targetCount:task.targets.length,frozenCompletion:frozenPath.slice(root.length+1),frozenCompletionSha256:sha(candidateBytes),status:process.argv.includes('--record')?'passed':'validated',receipt,...(process.argv.includes('--record')?{receiptSha256:sha(await readFile(root+'/'+receipt))}:{}),remainingGatesPreserved:true,nextActionPreserved:true,targetsPreserved:true,workPreserved:true});
 if(index%25===0)console.log(JSON.stringify({validated:index+1,total:historical.results.length,recording:process.argv.includes('--record')}));
}
const afterSnapshot=JSON.parse(await readFile(snapshotPath));
const afterRows=afterSnapshot.queries.development_progress.rows;
const otherAfter=Object.fromEntries(Object.entries(afterSnapshot.queries).filter(([key])=>key!=='development_progress'));
const sourceAfter=await developmentSourceDigest(root);
const final={revision,sourceDigest:sourceBefore,checksReport:'artifacts/development-checks/current-source-20261025/checks-report.json',checksReportSha256:sha(await readFile(directory+'/checks-report.json')),scope:'Append-only source revalidation receipts for original canonical manifests. No provider publication, review, activation, or remote dashboard publication.',selected:results.length,results,sourceAfter,sourceStillMatches:sourceAfter===sourceBefore,priorDevelopmentRows:recordingBaseline.priorDevelopmentRows,priorDevelopmentRowsSha256:recordingBaseline.priorRowsSha256,otherQuerySha256:recordingBaseline.otherQueriesSha256,dashboardId:recordingBaseline.dashboardId,finalDevelopmentRows:afterRows.length,historicalReceiptHashesPreserved:await historicalReceiptsMatch(),priorRowsPreserved:sha(JSON.stringify(afterRows.slice(0,recordingBaseline.priorDevelopmentRows)))===recordingBaseline.priorRowsSha256,otherQueriesPreserved:sha(JSON.stringify(otherAfter))===recordingBaseline.otherQueriesSha256,newTaskTargetRows:afterRows.length-recordingBaseline.priorDevelopmentRows,expectedTaskTargetRowsForSelectedReceipts:results.reduce((sum,row)=>sum+row.targetCount,0),currentRevalidationTaskTargetRows:afterRows.filter(row=>results.some(result=>result.revalidationTaskId===row.taskId)).length,status:process.argv.includes('--record')?'passed':'validated',completedAt:new Date().toISOString()};
if(process.argv.includes('--record')&&final.currentRevalidationTaskTargetRows!==final.expectedTaskTargetRowsForSelectedReceipts)throw Error('Canonical task-target receipt count mismatch');
if(!final.historicalReceiptHashesPreserved||!final.sourceStillMatches||!final.priorRowsPreserved||!final.otherQueriesPreserved)throw Error('Completion recording changed source, prior history, or provider queries');
await writeFile(directory+'/'+(process.argv.includes('--record')?'receipt-report.json':'receipt-preflight.json'),JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify({status:final.status,receipts:results.length,newTaskTargetRows:final.newTaskTargetRows,sourceStable:final.sourceStillMatches,priorRowsPreserved:final.priorRowsPreserved,otherQueriesPreserved:final.otherQueriesPreserved}));
