import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
const root=process.cwd(),directory=path.join(root,'artifacts/content-hex-decoding-audit-2026-10-09');
const source=await readFile(path.join(root,'packages/core/dist/contentProtection.js'),'utf8');
const old='return Uint8Array.from(value.match(/../gu), pair => Number.parseInt(pair, 16));';
assert(source.includes(old));
const replacement=`const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    const high = value.charCodeAt(index * 2), low = value.charCodeAt(index * 2 + 1);
    bytes[index] = ((high < 58 ? high - 48 : high - 87) << 4) | (low < 58 ? low - 48 : low - 87);
  }
  return bytes;`;
const candidate=source.replace(old,replacement);
function evaluate(code){const module={exports:{}};new Function('require','exports','module',code)(createRequire(import.meta.url),module.exports,module);return module.exports;}
const sides={baseline:evaluate(source),candidate:evaluate(candidate)};
const document=JSON.parse(await readFile(path.join(root,'packages/portal/src/playable/generated/youtube-content-v1.json'),'utf8'));
const packs=[];
for(const locale of ['en','hi']){const pack=document.packs[locale],envelope=await sides.baseline.protectContent(pack);packs.push({locale,pack,envelope});}
await writeFile(directory+'/baseline.js',source);await writeFile(directory+'/candidate.js',candidate);
const profile=process.argv.includes('--profile'),samples=[];let operations=0,failures=0;
for(const {locale,pack,envelope} of packs){
 for(const side of Object.keys(sides))for(let warm=0;warm<5;warm++)assert.deepEqual(await sides[side].readProtectedContent(envelope),pack);
 for(let round=0;round<(profile?2:9);round++)for(const side of round%2?['candidate','baseline']:['baseline','candidate']){
  const count=profile?300:100,start=performance.now();let result;
  for(let index=0;index<count;index++){result=await sides[side].readProtectedContent(envelope);operations++;}
  const elapsedMs=performance.now()-start;
  try{assert.deepEqual(result,pack);}catch(error){failures++;throw error;}
  samples.push({locale,side,round,operations:count,elapsedMs,perOperationMs:elapsedMs/count,ciphertextBytes:envelope.data.length/2,riddles:Object.keys(result).length});
 }
}
assert.equal(failures,0);
await writeFile(directory+(profile?'/profile-runs.json':'/measurement.json'),JSON.stringify({operations,failures,node:process.version,scope:'Local protected-pack decryption plus UTF-8/JSON decoding; excludes import, domain validation, rendering, provider/network latency',samples},null,2)+'\n');
if(!profile)for(const locale of ['en','hi'])for(const side of Object.keys(sides)){const values=samples.filter(row=>row.locale===locale&&row.side===side).map(row=>row.perOperationMs).sort((a,b)=>a-b);console.log(JSON.stringify({locale,side,medianMs:values[4],rangeMs:[values[0],values.at(-1)]}));}
