const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve('firebase-functions');const {Firestore,Timestamp}=require(require.resolve('firebase-admin/firestore',{paths:[root]}));
const {streamLiveRaceChanges}=require('/tmp/backend-concurrency-current-full-sdk-compiled-20261009a/lib/race/raceLiveStream.js');
const db=new Firestore({projectId:'demo-riddle-quest-stream-retention-audit',host:'127.0.0.1:41439',ssl:false});
const watchdog=setTimeout(()=>{console.error('Owned diagnostic exceeded 10-second protocol deadline');process.exit(124);},10000);
(async()=>{console.log('probe-start');
const user='jest:stream-signal-retention-audit',ticket='b'.repeat(64),controller=new AbortController(),chunks=[];let caught;
console.log('creating-owner');await db.doc('users/'+user).set({displayName:'Audit'});await db.doc('liveRaceTickets/'+ticket).set({userId:user,expiresAt:Timestamp.fromMillis(Date.now()+60000)});
console.log('creating-signal');await db.doc('liveRaceSignals/'+ticket).set({revision:'12345678-1234-1234-1234-123456789012',expiresAt:{unexpected:true}});
const handler=error=>{console.log('uncaught',error.name,error.message);caught={name:error.name,message:error.message};controller.abort();};process.once('uncaughtException',handler);const timer=setTimeout(()=>controller.abort(),1000);
console.log('opening-stream');try{await streamLiveRaceChanges(db,user,ticket,{signal:controller.signal,sendChunk:async chunk=>{chunks.push(chunk);return true;}},2000);}
finally{console.log('stream-settled',caught);clearTimeout(timer);process.removeListener('uncaughtException',handler);await db.doc('users/'+user).delete();await db.doc('liveRaceTickets/'+ticket).delete();await db.doc('liveRaceSignals/'+ticket).delete();await db.terminate();clearTimeout(watchdog);}
console.log(JSON.stringify({caught,chunks},null,2));assert.equal(caught?.name,'TypeError');assert.match(caught.message,/toMillis/);
})().catch(error=>{console.error(error);process.exitCode=1;});
