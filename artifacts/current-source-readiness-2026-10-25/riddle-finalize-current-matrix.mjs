import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {developmentSourceDigest} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-source-digest.mjs';
import {assertDevelopmentCheckOutput} from '/home/craig-beswetherick/Documents/riddle-quest/scripts/release/development-check-output.mjs';
const root='/home/craig-beswetherick/Documents/riddle-quest';
const readiness=root+'/artifacts/current-source-readiness-2026-10-25';
const directory=root+'/artifacts/development-checks/current-source-20261025';
const baseline=JSON.parse(await readFile(root+'/artifacts/development-checks/goal-20261024-receipts-final5c-local-receipts/checks-report-snapshot.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceDigest=await developmentSourceDigest(root);
if(baseline.checks.length!==182||new Set(baseline.checks.map(row=>row.index)).size!==182||baseline.checks.some(row=>row.index<0||row.index>181))throw Error('Canonical 182-command census changed');
const rows=[];
const expectedGuards=Object.fromEntries(await Promise.all([['silentGuardSha256','/tmp/riddle-silent-browser.cjs'],['jestSetupBridgeSha256','/tmp/riddle-jest-silent-setup.cjs'],['sharedFixtureAdapterSha256','/tmp/riddle-shared-silent-audio.cjs'],['silentFixtureSha256','/home/craig-beswetherick/Documents/BeeHive/tests/helpers/silent-audio.js']].map(async([key,file])=>[key,sha(await readFile(file))])));
for(const required of baseline.checks){
 const check=JSON.parse(await readFile(readiness+'/matrix/'+String(required.index).padStart(3,'0')+'.json'));
 if(check.executable!==required.executable||JSON.stringify(check.args)!==JSON.stringify(required.args)||check.status!=='passed'||check.exitCode!==0||!check.sourceStillMatches||check.sourceBefore!==sourceDigest||check.sourceAfter!==sourceDigest)throw Error('Missing current exact passing command '+required.index);
 for(const[key,digest]of Object.entries(expectedGuards))if(check.environment?.[key]!==digest)throw Error('Missing or changed environment guard '+key+' for '+required.index);
 const log=await readFile(root+'/'+check.log,'utf8');if(sha(log)!==check.sha256)throw Error('Changed command log '+required.index);
 const raw=log.match(/\nNamed assertion report:\n([\s\S]*?)\nEnd named assertion report\.\n/)?.[1];
 const names=raw?(JSON.parse(raw).testResults??[]).flatMap(suite=>(suite.assertionResults??[]).filter(assertion=>assertion.status==='passed').map(assertion=>assertion.fullName)):undefined;
 assertDevelopmentCheckOutput(check,{stdout:log,passedAssertionNames:names});
 if(check.args.includes('PORTAL_BROWSER_TESTS=1')&&!log.includes('Jest VM Playwright API patched before test modules'))throw Error('Missing Jest VM silence/network setup proof '+check.index);
 if(check.args.includes('PORTAL_BROWSER_TESTS=1')&&(!check.environment.jestSetupBridgeSha256||!check.environment.sharedFixtureAdapterSha256))throw Error('Missing Jest bridge/adapter hashes '+check.index);
 rows.push({...check,timingScope:'exact current command',log:'artifacts/development-checks/current-source-20261025/'+String(check.index).padStart(3,'0')+'.log'});
}
const prerequisites=[];
for(const index of [182,183]){
 const prerequisite=JSON.parse(await readFile(readiness+'/matrix/'+index+'.json'));
 if(prerequisite.status!=='passed'||prerequisite.exitCode!==0||!prerequisite.sourceStillMatches||prerequisite.sourceBefore!==sourceDigest||prerequisite.sourceAfter!==sourceDigest||sha(await readFile(root+'/'+prerequisite.log))!==prerequisite.sha256)throw Error('Current extra prerequisite missing or changed '+index);
 for(const[key,digest]of Object.entries(expectedGuards))if(prerequisite.environment?.[key]!==digest)throw Error('Prerequisite environment guard changed '+index+' '+key);
 for(const [file,digest]of Object.entries(prerequisite.artifacts??{}))if(sha(await readFile(root+'/'+file))!==digest)throw Error('Prerequisite artifact changed '+file);
 prerequisites.push(prerequisite);
}
const packaged=JSON.parse(await readFile(root+'/artifacts/release-e2e/packaged-games.json'));
for(const result of packaged.results){if(result.status!=='passed')throw Error('Packaged gameplay is incomplete');if(result.artifact&&sha(await readFile(root+'/'+result.artifact))!==result.sha256)throw Error('Tested package changed '+result.target);}
const sourceAfter=await developmentSourceDigest(root);if(sourceAfter!==sourceDigest)throw Error('Source changed while finalizing checks');
await mkdir(directory,{recursive:true});
for(const row of rows)await copyFile(readiness+'/matrix/'+String(row.index).padStart(3,'0')+'.log',root+'/'+row.log);
const auditedAt=new Date().toISOString();
const report={revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),sourceDigest,auditedAt,scope:'Fresh exact local current-source validation, build, loopback browser, artifact integrity and disposable-emulator commands. No provider submission, activation, publication or remote state change.',requiredCommandCount:182,passedCommandCount:rows.length,sourceStable:true,checks:rows,prerequisites,historicalBaselineReport:'artifacts/development-checks/goal-20261024-receipts-final5c-local-receipts/checks-report-snapshot.json'};
await writeFile(directory+'/checks-report.json',JSON.stringify(report,null,2)+'\n');
await copyFile('/tmp/riddle-record-current-revalidations.mjs',directory+'/record-current-revalidations.mjs');
await copyFile('/tmp/riddle-finalize-current-matrix.mjs',directory+'/finalize-current-matrix.mjs');
console.log(JSON.stringify({checks:rows.length,sourceDigest,report:directory+'/checks-report.json'}));
