const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve('firebase-functions');const {Firestore,Timestamp}=require(require.resolve('firebase-admin/firestore',{paths:[root]}));
const {streamLiveRaceChanges}=require('/tmp/backend-concurrency-current-full-sdk-compiled-20261009a/lib/race/raceLiveStream.js');
const db=new Firestore({projectId:'demo-riddle-quest-stream-retention-audit',host:'127.0.0.1:41439',ssl:false});
(async()=>{const observations=[];const user='jest:stream-retention-audit';await db.doc('users/'+user).set({displayName:'Audit'});
for(const [kind,expiry] of [['valid',Timestamp.fromMillis(Date.now()+60000)],['missing',undefined],['malformed',{unexpected:true}],['expired',Timestamp.fromMillis(Date.now()-1000)]]){
const ticket='a'.repeat(64);await db.doc('liveRaceTickets/'+ticket).set({userId:user,...(expiry===undefined?{}:{expiresAt:expiry})});
const controller=new AbortController();const chunks=[];const timer=setTimeout(()=>controller.abort(),200);
try{await streamLiveRaceChanges(db,user,ticket,{signal:controller.signal,sendChunk:async chunk=>{chunks.push(chunk);return true;}});observations.push({kind,status:'opened',chunks});}
catch(error){observations.push({kind,status:'rejected',name:error.name,code:error.code??null,message:error.message});}finally{clearTimeout(timer);}
}
await db.doc('users/'+user).delete();await db.doc('liveRaceTickets/'+'a'.repeat(64)).delete();await db.terminate();console.log(JSON.stringify(observations,null,2));
assert.equal(observations.find(x=>x.kind==='valid').status,'opened');assert.equal(observations.find(x=>x.kind==='missing').status,'opened');assert.equal(observations.find(x=>x.kind==='malformed').name,'TypeError');assert.equal(observations.find(x=>x.kind==='expired').code,'not-found');
})().catch(error=>{console.error(error);process.exitCode=1;});
