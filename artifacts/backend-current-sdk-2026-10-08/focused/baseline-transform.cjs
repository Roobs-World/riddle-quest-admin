const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root="/home/craig-beswetherick/Documents/riddle-quest/firebase-functions",factory=require(require.resolve('ts-jest',{paths:[root]}));
const transformer=factory.default.createTransformer({tsconfig:path.join(root,'tsconfig.json')});
const before=fs.readFileSync("/home/craig-beswetherick/Documents/riddle-quest/artifacts/backend-current-sdk-2026-10-08/focused/singlePlayerSession.before.ts",'utf8');
const sourceFor=(source,filename)=>filename===path.join(root,'src/gameplay/singlePlayerSession.ts')?before:source;
module.exports={getCacheKey(source,filename,options){return transformer.getCacheKey(sourceFor(source,filename),filename,options);},process(source,filename,options){if(filename===path.join(root,'src/gameplay/singlePlayerSession.ts'))fs.writeFileSync(path.join(__dirname,'override-applied.json'),JSON.stringify({filename,beforeSha256:createHash('sha256').update(before).digest('hex'),currentSha256:createHash('sha256').update(source).digest('hex')},null,2));return transformer.process(sourceFor(source,filename),filename,options);}};
