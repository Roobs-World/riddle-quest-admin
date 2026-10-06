const {RaceRiddlePromptSchema,RacePreloadedRiddleSchema,SubmitRaceGuessRequestSchema}=require('../../packages/core/dist/race/raceSchemas.js');
const originalNormalize=String.prototype.normalize;
const originalSegment=Intl.Segmenter.prototype.segment;
let work;
String.prototype.normalize=function(...args){work.normalizedUnits+=this.length;return originalNormalize.apply(this,args);};
Intl.Segmenter.prototype.segment=function(text){work.segmentedUnits+=text.length;return originalSegment.call(this,text);};
try{
 const shapes=[['guess',answer=>SubmitRaceGuessRequestSchema.safeParse({runId:'probe-run',riddleId:'probe-riddle',requestId:'probe-command',guess:answer})],['prompt',answer=>RaceRiddlePromptSchema.shape.evaluation.unwrap().shape.answer.safeParse(answer)],['preload',answer=>RacePreloadedRiddleSchema.shape.evaluation.shape.answer.safeParse(answer)]];
 const results=[];
 for(const [kind,parse]of shapes){work={normalizedUnits:0,segmentedUnits:0};const success=parse('a'.repeat(4096)).success;results.push({kind,inputUnits:4096,success,...work});}
 console.log(JSON.stringify(results,null,2));
}finally{String.prototype.normalize=originalNormalize;Intl.Segmenter.prototype.segment=originalSegment;}
