const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve('firebase-functions');const {Firestore,Timestamp}=require(require.resolve('firebase-admin/firestore',{paths:[root]}));
const {streamLiveRaceChanges}=require('/tmp/backend-concurrency-current-full-sdk-compiled-20261009a/lib/race/raceLiveStream.js');
const db=new Firestore({projectId:'demo-riddle-quest-stream-retention-audit',host:'127.0.0.1:41439',ssl:false});
const watchdog=setTimeout(()=>{console.error('Cleanup deadline exceeded');process.exit(124);},10000);
(async()=>{const paths=['users/jest:stream-signal-retention-audit','liveRaceTickets/'+'b'.repeat(64),'liveRaceSignals/'+'b'.repeat(64)];for(const name of paths)await db.doc(name).delete();const results=await db.getAll(...paths.map(name=>db.doc(name)));assert(results.every(snapshot=>!snapshot.exists));await db.terminate();clearTimeout(watchdog);console.log(JSON.stringify({paths,allAbsent:true}));})().catch(error=>{console.error(error);process.exitCode=1;clearTimeout(watchdog);});
