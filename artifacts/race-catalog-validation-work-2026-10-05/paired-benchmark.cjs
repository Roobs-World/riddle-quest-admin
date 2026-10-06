const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'../..'), functionsRoot=path.join(root,'firebase-functions'), req=createRequire(path.join(functionsRoot,'package.json')), ts=req('typescript');
const pinned=fs.readFileSync(path.join(functionsRoot,'.nvmrc'),'utf8').trim();assert.equal(process.versions.node,pinned);
const actual=path.join(functionsRoot,'src/race/raceContentValidation.ts'), cache=new Map(), inputs={};
const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function compile(filename,source){
 const bytes=source??fs.readFileSync(filename,'utf8');if(source===undefined){inputs[path.relative(root,filename)]=digest(Buffer.from(bytes));if(cache.has(filename))return cache.get(filename);}
 const output=ts.transpileModule(bytes,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, module={exports:{}};
 const at=createRequire(filename), local=name=>{
  if(name.startsWith('.')){const resolved=path.resolve(path.dirname(filename),name+'.ts');if(fs.existsSync(resolved))return compile(resolved);}
  return at(name);
 };
 new Function('require','module','exports',output)(local,module,module.exports);if(source===undefined)cache.set(filename,module.exports);return module.exports;
}
const baselineSource=fs.readFileSync(path.join(__dirname,'validation-before.ts'),'utf8'), fixedSource=fs.readFileSync(actual,'utf8');
assert.equal(fixedSource,fs.readFileSync(path.join(__dirname,'validation-after.ts'),'utf8'));
const baseline=compile(actual,baselineSource).validateRacePool, fixed=compile(actual).validateRacePool;
const fixtures=[{name:'minimum',answer:'x'.repeat(129)},{name:'fullwidth',answer:'Ａ'.repeat(200000)},{name:'combining',answer:'a\u0301'.repeat(100000)},
 {name:'joined-emoji',answer:'👩‍👩‍👧‍👦'.repeat(10000)},{name:'healthy',answer:'piano'},{name:'valid-128-units',answer:'a'+'\u0301'.repeat(127)}];
const rows=[];
for(const fixture of fixtures){
 const records=Array.from({length:30},(_,index)=>({locale:'en',documentPath:`localizedRiddles/en/riddles/work-${index}`,data:{riddleId:`work-${index}`,canonicalRiddleId:`history:${index}`,
  text:`Original clue ${index} follows its distinct trail`,answer:index===0?fixture.answer:`word${String.fromCharCode(97+Math.floor(index/26),97+index%26)}`,categoryId:'history',difficultyBand:['easy','medium','hard'][index%3],raceEligible:true,qualityVersion:'human_review_v1'}}));
 const options={locale:'en',categoryId:'history'}, expected=baseline(records,options);assert.deepEqual(fixed(records,options),expected);
 for(const [block,phase] of ['baseline','fixed','fixed','baseline'].entries()){
  const run=phase==='baseline'?baseline:fixed,samples=[];for(let index=0;index<25;index++){const start=performance.now();run(records,options);if(index>=5)samples.push(performance.now()-start);}
  rows.push({name:fixture.name,phase,block,sourceAnswerUnits:fixture.answer.length,sourceAnswerBytes:Buffer.byteLength(fixture.answer),samples});
 }
 assert.equal(records[0].data.answer,fixture.answer);
}
for(const [filename,hash] of Object.entries(inputs))assert.equal(digest(fs.readFileSync(path.join(root,filename))),hash);
function quantile(values,proportion){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*proportion)];}
const comparison=fixtures.map(fixture=>{const result={name:fixture.name};for(const phase of ['baseline','fixed']){const values=rows.filter(row=>row.name===fixture.name&&row.phase===phase).flatMap(row=>row.samples);assert.equal(values.length,40);result[phase]={medianMs:quantile(values,.5),p95Ms:quantile(values,.95),samples:values.length};}return result;});
const result={runtime:process.version,cases:6,blocks:24,measuredValidations:480,warmupsExcluded:120,order:['baseline','fixed','fixed','baseline'],resultUnchanged:true,sourceInputs:inputs,
 sourceImplementations:{baseline:digest(Buffer.from(baselineSource)),fixed:digest(Buffer.from(fixedSource))},comparison,rows,scope:'Pure balanced 30-record validation in the pinned Functions runtime, without spies. TypeScript production implementations and unchanged dependencies are compiled before timing. Excludes Firestore/network, input/rendering, provider SDKs, and production concurrency.'};
fs.writeFileSync(path.join(__dirname,'paired-benchmark.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({runtime:result.runtime,cases:result.cases,measuredValidations:result.measuredValidations,comparison,scope:result.scope},null,2));
