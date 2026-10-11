const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root="/home/craig-beswetherick/Documents/riddle-quest/firebase-functions",evidence="/home/craig-beswetherick/Documents/riddle-quest/artifacts/backend-current-sdk-2026-10-08/focused";
if(process.versions.node!==fs.readFileSync(path.join(root,'.nvmrc'),'utf8').trim())throw new Error('Pinned runtime required');
console.log('[Pinned Functions runtime '+process.version+'] real hint locale and receipt regression');
const current=path.join(evidence,'integration.config.cjs'),baseline=path.join(evidence,'baseline.config.cjs');
const targetKey=Object.keys(require(current).transform).find(key=>key.startsWith('^.+'));if(!targetKey)throw new Error('Missing TypeScript transform');
fs.writeFileSync(baseline,'const base=require('+JSON.stringify(current)+');module.exports={...base,transform:{...base.transform,['+JSON.stringify(targetKey)+']:['+JSON.stringify(path.join(evidence,'baseline-transform.cjs'))+']}};\n');
const applied=require(baseline).transform;if(applied[targetKey]?.[0]!==path.join(evidence,'baseline-transform.cjs')||!new RegExp(targetKey).test(path.join(root,'src/gameplay/singlePlayerSession.ts')))throw new Error('Incorrect baseline transform');
for(const name of ['baseline-results.json','current-results.json','override-applied.json','terminal.json'])fs.rmSync(path.join(evidence,name),{force:true});
const jest=require.resolve('jest/bin/jest',{paths:[root]}),results=[];
for(const [name,config,expected] of [['baseline',baseline,1],['current',current,0]]){
 const result=spawnSync(process.execPath,['--experimental-vm-modules',jest,'--config',config,'--runInBand','--json','--outputFile',path.join(evidence,name+'-results.json')],{cwd:root,env:process.env,stdio:'inherit'});
 if(result.error)throw result.error;results.push({name,exit:result.status,expected});
 const reportPath=path.join(evidence,name+'-results.json');if(!fs.existsSync(reportPath))throw new Error('Missing '+name+' test results');const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));if(name==='baseline'&&(report.numFailedTests!==2||report.numPassedTests!==2||!fs.existsSync(path.join(evidence,'override-applied.json'))))throw new Error('Baseline did not reproduce exactly two casing failures');if(name==='current'&&(!report.success||report.numPassedTests!==4))throw new Error('Current hint integration did not pass');
 if(result.status!==expected){fs.writeFileSync(path.join(evidence,'terminal.json'),JSON.stringify(results,null,2));process.exit(result.status===0?1:result.status??1);}
}
fs.writeFileSync(path.join(evidence,'terminal.json'),JSON.stringify(results,null,2));
