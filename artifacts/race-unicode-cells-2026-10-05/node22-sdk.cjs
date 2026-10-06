const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const functionsRoot=path.resolve(__dirname,'../../firebase-functions');
const pinned=fs.readFileSync(path.join(functionsRoot,'.nvmrc'),'utf8').trim();
if(process.versions.node!==pinned)throw new Error('Expected pinned Functions Node '+pinned);
console.log('[Pinned Functions runtime '+process.version+'] Unicode SDK compatibility');
const jestPackage=require.resolve('jest/package.json',{paths:[functionsRoot]});
const result=spawnSync(process.execPath,['--experimental-vm-modules',path.join(path.dirname(jestPackage),'bin/jest.js'),'--config',path.join(__dirname,'probe.config.cjs'),'--runInBand'],{cwd:functionsRoot,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exitCode=result.status??1;
