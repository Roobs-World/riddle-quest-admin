const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const output=__dirname,repo=path.resolve(output,'../../..'),scratch=path.join(output,'transpiled');fs.mkdirSync(scratch,{recursive:true});
const backendRequire=Module.createRequire(path.join(repo,'firebase-functions/package.json')),ts=backendRequire('typescript');
const loaded=new Map(),sourceHashes={};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function loadTs(file){file=path.resolve(file);if(loaded.has(file))return loaded.get(file).exports;
 const source=fs.readFileSync(file,'utf8'),relative=path.relative(repo,file);sourceHashes[relative]=hash(source);
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:file}).outputText;
 const saved=path.join(scratch,relative.replace(/\.ts$/,'.cjs'));fs.mkdirSync(path.dirname(saved),{recursive:true});fs.writeFileSync(saved,js);
 const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));loaded.set(file,mod);
 const originalRequire=Module.createRequire(file);
 mod.require=request=>{if(/^@qwordly\/core\/(game|race)$/.test(request))return loadTs(path.join(repo,'packages/core/src',request.split('/').pop(),'index.ts'));
  if(request.startsWith('.')){const candidate=path.resolve(path.dirname(file),request);if(fs.existsSync(candidate+'.ts'))return loadTs(candidate+'.ts');if(fs.existsSync(path.join(candidate,'index.ts')))return loadTs(path.join(candidate,'index.ts'));}
  return originalRequire(request);};mod._compile(js,file);return mod.exports;
}
const game=loadTs(path.join(repo,'packages/core/src/game/index.ts')),race=loadTs(path.join(repo,'packages/core/src/race/index.ts'));
const {editRaceInput}=loadTs(path.join(repo,'packages/portal/src/play/race/logic/raceInput.ts'));
const {validateRacePool}=loadTs(path.join(repo,'firebase-functions/src/race/raceContentValidation.ts'));
const {assertRaceDeckCompatible,assertLiveRaceDeckCompatible}=loadTs(path.join(repo,'firebase-functions/src/race/raceDeckCompatibility.ts'));
const {liveRun}=loadTs(path.join(repo,'firebase-functions/src/race/raceLiveState.ts'));
const {applyRaceGuess,applyRaceHint}=loadTs(path.join(repo,'firebase-functions/src/race/raceEngine.ts'));
const locale='en',now=2000;
const examples=[{kind:'space',answer:'a b',discarded:true},{kind:'tab',answer:'a\tb',discarded:true},{kind:'line-feed',answer:'a\nb',discarded:true},{kind:'CRLF',answer:'a\r\nb',discarded:true},{kind:'NBSP',answer:'a\u00a0b',discarded:true},{kind:'narrow-NBSP',answer:'a\u202fb',discarded:true},{kind:'ideographic-space',answer:'a\u3000b',discarded:true},{kind:'thin-space',answer:'a\u2009b',discarded:true},{kind:'BOM-trim-whitespace',answer:'a\ufeffb',discarded:true},
 {kind:'hyphen',answer:'a-b',discarded:false},{kind:'apostrophe',answer:"a'b",discarded:false},{kind:'digit',answer:'a1b',discarded:false},{kind:'emoji',answer:'a🙂b',discarded:false},{kind:'emoji-ZWJ-family',answer:'a👩‍👩‍👧‍👧b',discarded:false},{kind:'zero-width-space-not-trim-whitespace',answer:'a\u200bb',discarded:false},{kind:'ordinary-letters',answer:'abc',discarded:false}];
const results=[];let assertions=0;const check=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions++;};
for(const item of examples){
 const records=Array.from({length:30},(_,index)=>({locale,documentPath:`localizedRiddles/${locale}/riddles/shape-${index}`,data:{riddleId:`shape-${index}`,canonicalRiddleId:`history:${index}`,text:`Synthetic riddle ${index} leads to a unique trail`,answer:index===0?item.answer:'zz'+String.fromCharCode(97+Math.floor(index/26),97+index%26),categoryId:'history',difficultyBand:['easy','medium','hard'][index%3],raceEligible:true,qualityVersion:'human_review_v1'}}));
 const catalog=validateRacePool(records,{locale,categoryId:'history'});check(catalog.issues,[],item.kind+' current catalog admits source');
 const riddles=records.slice(0,15).map(({data},position)=>({riddleId:data.riddleId,canonicalRiddleId:data.canonicalRiddleId,text:data.text,answer:data.answer,position,difficultyBand:data.difficultyBand}));
 assertRaceDeckCompatible(riddles,locale);assertLiveRaceDeckCompatible({riddles,locale});assertions+=2;
 const cells=game.splitGraphemes(item.answer,locale),prompt=race.RaceRiddlePromptSchema.parse({riddleId:riddles[0].riddleId,text:riddles[0].text,answerLength:cells.length,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],evaluation:{answer:item.answer,locale}});
 const original=race.RacePreloadedRiddleSchema.parse({riddleId:prompt.riddleId,text:prompt.text,answerLength:cells.length,position:0,evaluation:{answer:item.answer,locale}});check(original.evaluation.answer,item.answer,item.kind+' shared schema preserves answer bytes');
 const blank={letters:cells.map(()=>''),activeSlotIndex:0},edited=editRaceInput(prompt,blank,'text',item.answer.normalize('NFC')),guess=edited.letters.join('');
 check(edited.letters,item.discarded?['a','b','']:cells,item.kind+' native admission matches exact current edit policy');
 const decoded=race.SubmitRaceGuessRequestSchema.parse({runId:'shape-run',riddleId:prompt.riddleId,requestId:'shape-command',guess});check(decoded.guess,guess,item.kind+' request decoding preserves edited guess');
 const run=liveRun({riddles,locale,categoryId:'history',contentVersion:'shape-audit-original'},'shape-owner','shape-run',1000);
 let outcome;try{const result=applyRaceGuess(run,{riddleId:prompt.riddleId,guess:decoded.guess},now);outcome={accepted:true,isCorrect:result.isCorrect,correctCount:result.run.correctCount};}catch(error){outcome={accepted:false,code:error.code,message:error.message};}
 check(outcome.accepted,!item.discarded,item.kind+' actual engine accepts only a complete entered answer');if(!item.discarded)check(outcome.isCorrect,true,item.kind+' supported nonwhitespace control scores');
 results.push({...item,sourceUnits:item.answer.length,sourceGraphemes:cells,editorLetters:edited.letters,editedGuess:guess,allSlotsFilled:edited.letters.every(Boolean),catalogIssues:catalog.issues,frozenDeckCompatible:true,sharedEvaluationAccepted:true,transportAccepted:true,engine:outcome});
}
const main=results.find(row=>row.kind==='space'),riddles=Array.from({length:15},(_,position)=>({riddleId:`hint-shape-${position}`,canonicalRiddleId:`history:${position}`,text:`Hint-only synthetic riddle ${position}`,answer:position===0?'a b':'piano',position}));
const run=liveRun({riddles,locale,categoryId:'history',contentVersion:'shape-hint-audit'},'shape-owner','shape-hint-run',1000);
const prompt={riddleId:riddles[0].riddleId,text:riddles[0].text,answerLength:3,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};
const blank={letters:['','',''],activeSlotIndex:0},rejectedSpace=editRaceInput(prompt,blank,'letter',' ');check(rejectedSpace,blank,'Single-letter insertion cannot enter the whitespace either');
const first=applyRaceHint(run,{riddleId:prompt.riddleId},2000),second=applyRaceHint(first.run,{riddleId:prompt.riddleId},3000);check(second.revealedLetter,' ','Only the authoritative second hint admits the internal whitespace');
const hintedPrompt={...prompt,revealedLetters:second.run.revealedLetters},hintedDraft={letters:['a',' ',''],activeSlotIndex:2},completed=editRaceInput(hintedPrompt,hintedDraft,'text','b'),hintedResult=applyRaceGuess(second.run,{riddleId:prompt.riddleId,guess:completed.letters.join('')},4000);check(hintedResult.isCorrect,true,'Same original answer becomes guessable after two paid server hints');
const hintRecovery={firstHint:first.revealedLetter,secondHint:second.revealedLetter,paidHints:second.run.revealedLetters.length,penaltyMs:second.run.hintPenaltyMs,editorLetters:completed.letters,guess:completed.letters.join(''),isCorrect:hintedResult.isCorrect};
for(const [file,digest] of Object.entries(sourceHashes))check(hash(fs.readFileSync(path.join(repo,file))),digest,'Read-only source unchanged: '+file);
const result={diagnosisOnly:true,changedProductionPolicy:false,startedServers:false,emulatorUsed:false,examples:results,hintRecovery,assertions,sourceHashes,sourceFiles:Object.keys(sourceHashes).length,node:process.version,finishedAt:new Date().toISOString()};
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));
const scratchHashes={};for(const file of fs.readdirSync(scratch,{recursive:true})){const full=path.join(scratch,file);if(fs.statSync(full).isFile())scratchHashes[file]=hash(fs.readFileSync(full));}fs.writeFileSync(path.join(output,'transpiled-sha256.json'),JSON.stringify(scratchHashes,null,2));
console.log(JSON.stringify({examples:results.length,whitespaceCases:results.filter(row=>row.discarded).length,supportedNonwhitespaceControls:results.filter(row=>!row.discarded).length,assertions,sourceFiles:result.sourceFiles,sourceUnchanged:true,main,hintRecovery},null,2));
