import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
/** Existing retained verifiers execute against the proposed integration without editing application sources. */
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
/** Child scripts remain beneath portal dependencies so Vite and Playwright resolve normally. */
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/history-prototype-retained-'));
/** Promise adapter preserves child failures and their diagnostic output. */
const run=promisify(execFile);
try{
 for(const name of ['verify-race-paid-draft-checkpoints-browser.mjs','verify-race-answer-free-checkpoints-browser.mjs','verify-race-authority-clock-ownership-browser.mjs','verify-race-projected-attempt-rows-browser.mjs']){
  /** Original verifier is retained as the authoritative scenario definition. */
  let source=await readFile(path.join(root,'scripts',name),'utf8');
  if(!/plugins:\s*\[/.test(source))throw Error('Verifier no longer exposes a plugin list: '+name);
  source=source.replace(/const root\s*=\s*path.resolve[^\n]+;/,'const root='+JSON.stringify(root)+';');
  source='import {createRaceHistoryPrototypePlugin} from '+JSON.stringify(path.join(root,'scripts/race-history-prototype-plugin.mjs'))+';\n'+source;
  source=source.replace(/plugins:\s*\[/,'plugins:[createRaceHistoryPrototypePlugin(),');
  /** Instrumented copy cannot overwrite the retained verifier or production code. */
  const file=path.join(scratch,name);await writeFile(file,source);
  try{
   /** Capture every retained assertion's output and keep the exact child result. */
   const result=await run(process.execPath,[file],{maxBuffer:8*1024*1024,env:process.env});
   process.stdout.write(result.stdout);process.stderr.write(result.stderr);console.log('Retained prototype verifier passed: '+name);
  }catch(error){process.stdout.write(error.stdout??'');process.stderr.write(error.stderr??'');throw error;}
 }
}finally{await rm(scratch,{recursive:true,force:true});}
