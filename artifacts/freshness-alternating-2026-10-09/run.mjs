import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const evidence=path.resolve('artifacts/freshness-alternating-2026-10-09'),root=path.resolve('firebase-functions'),require=createRequire(path.join(root,'package.json'));
const held=[];
try {
 for(let i=0;i<4;i++){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));held.push(s);}
 const ports=held.map(s=>s.address().port);
 await writeFile(path.join(evidence,'ports.json'),JSON.stringify(ports));
 const config=path.join(evidence,'emulator.json');
 await writeFile(config,JSON.stringify({firestore:{rules:path.join(root,'firestore.rules'),indexes:path.join(root,'firestore.indexes.json')},emulators:{firestore:{host:'127.0.0.1',port:ports[0],websocketPort:ports[1]},hub:{host:'127.0.0.1',port:ports[2]},logging:{host:'127.0.0.1',port:ports[3]},ui:{enabled:false},singleProjectMode:true}},null,2));
 for(const s of held)await new Promise(r=>s.close(r));
 const command='node scripts/run-with-functions-node.js /home/craig-beswetherick/Documents/riddle-quest/artifacts/freshness-alternating-2026-10-09/entry.cjs';
 const child=spawn(process.execPath,[require.resolve('firebase-tools/lib/bin/firebase.js'),'emulators:exec','--project','demo-riddle-quest-match','--config',config,'--only','firestore',command],{cwd:root,stdio:'inherit',env:{...process.env,GCLOUD_PROJECT:'demo-riddle-quest-match',CI:'1'}});
 process.exitCode=await new Promise((r,j)=>{child.once('error',j);child.once('exit',c=>r(c??1));});
}finally{for(const s of held)if(s.listening)await new Promise(r=>s.close(r));}
