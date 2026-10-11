import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {playableContentPlugin,playableContentModule} from '../../packages/portal/playableContentPlugin.ts';
const directory=await mkdtemp('/tmp/riddle-content-loader-audit-');
try {
 const file=directory+'/content.json';
 await writeFile(file,JSON.stringify({locales:['en'],packs:{en:{answer:'word'}}}));
 const plugin=playableContentPlugin(file);
 plugin.configResolved({command:'build'});
 const source=await plugin.load.call({addWatchFile(){},emitFile(){return 'audit';}},plugin.resolveId(playableContentModule));
 const body=source.slice(source.indexOf('function loader(url)'),source.indexOf('export default'));
 let imports=0,decodes=0,release;
 const urls=[];
 const loader=new Function('importPack','readProtectedContent',body.replace('import(/* @vite-ignore */','importPack(')+';return loader;')(
  url=>{imports++;urls.push(url);return new Promise(resolve=>{release=resolve;});},
  async value=>{decodes++;return value;});
 const load=loader('/local/en.js');
 const first=load(),second=load();
 assert.equal(first,second);assert.equal(imports,1);
 release({default:{answer:'word'}});
 const pack=await first;
 assert.equal(await load(),pack);assert.equal(imports,1);assert.equal(decodes,1);
 let attempts=0;
 const retries=[];
 const retryLoader=new Function('importPack','readProtectedContent',body.replace('import(/* @vite-ignore */','importPack(')+';return loader;')(
  async url=>{retries.push(url);if(++attempts===1)throw new Error('download');return {default:{answer:'word'}};},async value=>value)('/local/en.js');
 await assert.rejects(retryLoader(),/download/);
 assert.deepEqual(await retryLoader(),{answer:'word'});
 assert.deepEqual(retries,['/local/en.js','/local/en.js?retry=1']);
 console.log(JSON.stringify({imports,decodes,concurrentPromiseShared:true,resolvedPackShared:true,retryURLs:retries,scope:'generated loader with injected module transport; not browser latency'},null,2));
} finally {await rm(directory,{recursive:true,force:true});}
