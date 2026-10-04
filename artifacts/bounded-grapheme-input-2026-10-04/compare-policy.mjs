import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const original=path.join(root,'artifacts/bounded-grapheme-input-2026-10-04');
const scratch=await mkdtemp(path.join(tmpdir(),'bounded-grapheme-policy-'));
const locales=(await import(pathToFileURL(path.join(root,'packages/core/dist/validation/locales.js')).href)).SUPPORTED_LOCALES;
const saved=Object.getOwnPropertyDescriptor(Intl,'Segmenter');
let seed=20261004,comparisons=0,identityChecks=0,immutableChecks=0;
const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
try {
 const moduleUrl=pathToFileURL(path.join(root,'packages/core/dist/game/index.js')).href;
 for(const [name,file] of [['race','raceInput.before.txt'],['local','playable-input.before.txt']])await writeFile(path.join(scratch,name+'.ts'),(await readFile(path.join(original,file),'utf8')).replaceAll('"@qwordly/core/game"',JSON.stringify(moduleUrl)));
 const beforeRace=(await import(pathToFileURL(path.join(scratch,'race.ts')).href)).insertRaceText;
 const beforeLocal=(await import(pathToFileURL(path.join(scratch,'local.ts')).href)).insertYouTubeAnswerText;
 const afterRace=(await import(pathToFileURL(path.join(root,'packages/portal/src/play/race/logic/raceInput.ts')).href)).insertRaceText;
 const afterLocal=(await import(pathToFileURL(path.join(root,'packages/portal/src/playable/input.ts')).href)).insertYouTubeAnswerText;
 const chunks=['a','I',' ','!?','e\u0301','👩🏽‍🚀','नदी','نَ','猫','🇬🇧','\r\n','\u0301',''];
 for(const fallback of [false,true]){
  if(fallback)Object.defineProperty(Intl,'Segmenter',{configurable:true,value:undefined});
  for(let index=0;index<2048;index++){
   const width=1+random(12),locked=Array.from({length:width},(_,i)=>i).filter(()=>random(3)===0);
   const letters=Array.from({length:random(width+1)},()=>random(2)?'Q':'');
   for(const i of locked)if(i<letters.length)letters[i]='月';
   const draft={letters,activeSlotIndex:random(width+2)-1},unchanged=structuredClone(draft);
   const text=Array.from({length:random(16)},()=>chunks[random(chunks.length)]).join('');
   const locale=locales[index%locales.length];
   const riddle={answerLength:width,revealedLetters:locked.map(index=>({index,letter:'月'}))};
   for(const [previous,current] of [[beforeRace(riddle,draft,text),afterRace(riddle,draft,text)],[beforeLocal(draft,text,width,locked,locale),afterLocal(draft,text,width,locked,locale)]]){
    assert.deepEqual(current,previous,{fallback,index,width,locale,text});comparisons++;
    assert.equal(current===draft,previous===draft,{fallback,index});identityChecks++;
    assert.deepEqual(draft,unchanged);immutableChecks++;
   }
  }
 }
 const result={seed:20261004,cases:4096,comparisons,identityChecks,immutableChecks,locales,segmenterModes:['native','code-point fallback'],status:'passed'};
 await writeFile(path.join(original,'policy-comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {Object.defineProperty(Intl,'Segmenter',saved);await rm(scratch,{recursive:true,force:true});}
