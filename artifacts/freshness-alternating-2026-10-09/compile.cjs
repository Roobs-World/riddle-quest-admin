const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve('firebase-functions'),owned='/tmp/freshness-alternating-20261009a';
if(process.versions.node!=='22.23.1'||fs.existsSync(owned))throw Error('Pinned runtime and absent owned output required');
const compiler=path.join(path.dirname(require.resolve('@typescript/native/package.json',{paths:[root]})),'bin/tsc');
for(const variant of ['baseline','candidate']){
 const out=path.join(owned,variant);fs.mkdirSync(out,{recursive:true});fs.copyFileSync(path.join(root,'package.json'),path.join(out,'package.json'));fs.symlinkSync(path.join(root,'node_modules'),path.join(out,'node_modules'),'dir');
 fs.cpSync(path.join(root,'src'),path.join(out,'src'),{recursive:true});
 if(variant==='baseline')fs.copyFileSync('artifacts/freshness-batching-2026-10-09/raceMatchmaking.before.ts',path.join(out,'src/race/raceMatchmaking.ts'));
 fs.mkdirSync(path.join(out,'scripts'));fs.copyFileSync(path.join(root,'scripts/race-match-benchmark.js'),path.join(out,'scripts/race-match-benchmark.js'));
 const config=path.join(out,'tsconfig.json');fs.writeFileSync(config,JSON.stringify({extends:path.join(root,'tsconfig.json'),compilerOptions:{rootDir:path.join(out,'src'),outDir:path.join(out,'lib')},include:[path.join(out,'src/**/*.ts'),path.join(out,'src/**/*.js')],exclude:[path.join(out,'src/__tests__'),path.join(out,'src/__mocks__'),'**/*.bak','**/*.skip']}));
 const result=spawnSync(process.execPath,[compiler,'-p',config],{cwd:out,stdio:'inherit'});if(result.status!==0)throw Error('Compilation failed '+variant);
}
console.log('Both isolated variants compiled under '+process.version);
