import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const repository=fileURLToPath(new URL('../..',import.meta.url));
test('a selected command retains artifact evidence for tasks using another alias',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'development-check-alias-'));
 try{
  await mkdir(path.join(root,'docs/common/development/development-tasks'),{recursive:true});
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  const args=['-e','process.stdout.write(process.env.CHECK_SELECTION_MESSAGE)'];
  for(const name of ['first','second']){
   await writeFile(path.join(root,'docs/common/development/development-tasks',name+'.json'),JSON.stringify({taskId:name,checks:[{id:name,executable:process.execPath,args}],artifacts:[{file:'artifacts/'+name+'.json'}]}));
   await writeFile(path.join(root,'artifacts',name+'.json'),JSON.stringify({name}));
  }
  let source=await readFile(path.join(repository,'scripts/release/verify-development-checks.mjs'),'utf8');
  for(const file of ['development-source-digest.mjs','development-check-output.mjs'])source=source.replace('./'+file,pathToFileURL(path.join(repository,'scripts/release',file)).href);
  source=source.replace('const root = fileURLToPath(new URL("../..", import.meta.url));','const root = '+JSON.stringify(root+'/')+';');

  await writeFile(path.join(root,'runner.mjs'),source);
  execFileSync('git',['init','--quiet'],{cwd:root,stdio:'pipe'});
  execFileSync('git',['-c','user.name=Verification fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','--quiet','-m','verification fixture'],{cwd:root,stdio:'pipe'});
  execFileSync(process.execPath,[path.join(root,'runner.mjs'),'first'],{cwd:root,env:{...process.env,DEBUG:'',CHECK_SELECTION_MESSAGE:'first execution'},stdio:'pipe'});
  const report=JSON.parse(await readFile(path.join(root,'artifacts/development-checks/current.json'),'utf8'));
  assert.equal(report.checks.length,1);
  assert.equal(report.checks[0].status,'passed');
  assert.deepEqual(report.checks[0].ids,['first']);
  for(const name of ['first','second']){
   const file='artifacts/'+name+'.json';
   const digest=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
   assert.equal(report.checks[0].artifacts[file],digest,'Exact command must retain '+file+' for every task alias');
  }
  const prior=report.checks[0],priorOutput=await readFile(path.join(root,prior.log),'utf8');
  execFileSync(process.execPath,[path.join(root,'runner.mjs'),'first'],{cwd:root,env:{...process.env,DEBUG:'',CHECK_SELECTION_MESSAGE:'second execution'},stdio:'pipe'});
  const next=JSON.parse(await readFile(path.join(root,'artifacts/development-checks/current.json'),'utf8'));
  assert.equal(next.checks.length,1);
  assert.notEqual(next.checks[0].log,prior.log,'A different output needs its own proof log');
  assert.equal(await readFile(path.join(root,prior.log),'utf8'),priorOutput,'Earlier completion proof must survive a same-source rerun');
  assert.equal(createHash('sha256').update(priorOutput).digest('hex'),prior.sha256);
 }finally{await rm(root,{recursive:true,force:true});}
});
