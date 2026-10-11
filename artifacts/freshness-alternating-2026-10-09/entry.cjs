const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
if(process.versions.node!=='22.23.1')throw Error('Pinned runtime required');
const evidence=path.resolve('../artifacts/freshness-alternating-2026-10-09');
const run=(variant,label,profile=false)=>{
 const file=path.join('/tmp/freshness-alternating-20261009a',variant,'scripts/race-match-benchmark.js');
 const args=profile?['--cpu-prof','--cpu-prof-dir='+evidence,'--cpu-prof-name='+label+'.cpuprofile',file,'--scenario','freshness','--iterations','5']:[file,'--iterations','5'];
 const result=spawnSync(process.execPath,args,{cwd:path.dirname(file),env:process.env,encoding:'utf8',maxBuffer:8*1024*1024});
 fs.writeFileSync(path.join(evidence,label+'.stdout'),result.stdout??'');fs.writeFileSync(path.join(evidence,label+'.stderr'),result.stderr??'');
 if(result.status!==0)throw Error(label+' failed '+result.status);
 const report=JSON.parse(result.stdout);if(!report.passed)throw Error('Result checks failed');fs.writeFileSync(path.join(evidence,label+'.json'),JSON.stringify(report,null,2));
 console.log(label+' passed');
};
run('baseline','profile-baseline',true);run('candidate','profile-candidate',true);
for(let pair=0;pair<5;pair++)for(const variant of pair%2?['candidate','baseline']:['baseline','candidate'])run(variant,`pair-${pair}-${variant}`);
