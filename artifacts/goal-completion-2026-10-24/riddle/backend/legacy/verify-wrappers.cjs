const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const stage=path.resolve(process.argv[2]);assert(stage.startsWith('/tmp/riddle-legacy-security-20261024/'));
process.env.GCLOUD_PROJECT='demo-riddle-quest-legacy-wrapper';process.env.FIREBASE_PROJECT_ID=process.env.GCLOUD_PROJECT;process.env.SENTRY_DSN='';delete process.env.FUNCTIONS_EMULATOR;
const local=(name)=>require(path.join(stage,'lib',name));
const calls=[];const lease=local('jest/jestAccountDeletion.js');lease.runWithJestAccountOperationLease=async(uid,timeout,invoke)=>{calls.push(['lease',uid,timeout]);return invoke();};
const social=local('social/socialSafety.js');social.blockKnownRival=async(...args)=>{calls.push(['block',...args]);return {blocked:true};};social.reportKnownRival=async(...args)=>{calls.push(['report',...args]);return {reportId:'c'.repeat(64),queued:true};};
const rollout=local('race/raceRollout.js');rollout.assertRaceAccess=async(...args)=>{calls.push(['access',...args]);};
const history=local('race/raceLiveHistory.js');history.listLiveRaceHistoryForUser=async(...args)=>{calls.push(['history',...args]);return {locale:'en',serverNowMs:1800000000000,entries:[]};};
const safety=local('social/socialSafetyCallables.js'),races=local('race/raceLiveCallables.js');
const handlers={blockLiveRaceOpponent:safety.blockLiveRaceOpponent,reportLiveRaceOpponent:safety.reportLiveRaceOpponent,listLiveRaceHistoryPage:races.listLiveRaceHistoryPage};
const uid='facebook_'+'a'.repeat(40),ticket='b'.repeat(64);const request=(data,auth=true)=>({data,...(auth?{auth:{uid,token:{}}}:{}),rawRequest:{headers:{}}});const results=[];
async function check(name,invoke){await invoke();results.push({name,status:'passed'});}
(async()=>{
 for(const [name,handler] of Object.entries(handlers)){
  await check(name+':production-attestation',async()=>{assert.equal(local('shared/callableSecurity.js').browserCallableSecurityOptions.enforceAppCheck,true);assert.deepEqual(handler.__endpoint.callableTrigger,{});assert.equal(handler.__endpoint.timeoutSeconds,60);});
  await check(name+':missing-auth',async()=>{await assert.rejects(handler.run(request(name==='listLiveRaceHistoryPage'?{locale:'en'}:{liveTicketId:ticket,category:'spam',requestId:'legacy-report-001'},false)),e=>e.code==='unauthenticated');});
 }
 await check('block:owner-seat-completed-binding',async()=>{calls.length=0;assert.deepEqual(await handlers.blockLiveRaceOpponent.run(request({liveTicketId:ticket})),{blocked:true});assert.deepEqual(calls,[['lease',uid,60],['block',uid,{liveTicketId:ticket},{requireCompleted:true}]]);});
 await check('report:owner-seat-replay-identity',async()=>{calls.length=0;const input={liveTicketId:ticket,category:'spam',requestId:'legacy-report-001'};assert.deepEqual(await handlers.reportLiveRaceOpponent.run(request(input)),{reportId:'c'.repeat(64),queued:true});assert.deepEqual(calls,[['lease',uid,60],['report',uid,input,{requireCompleted:true}]]);});
 await check('history:authorized-owner-bounded-page',async()=>{calls.length=0;assert.deepEqual(await handlers.listLiveRaceHistoryPage.run(request({locale:'en'})),{locale:'en',serverNowMs:1800000000000,entries:[]});assert.deepEqual(calls,[['lease',uid,60],['access',uid,'en'],['history',uid,{locale:'en',limit:20}]]);});
 for(const [name,input] of [['blockLiveRaceOpponent',{liveTicketId:ticket,targetUserId:'forged'}],['reportLiveRaceOpponent',{liveTicketId:ticket,category:'invalid',requestId:'legacy-report-001'}],['reportLiveRaceOpponent',{liveTicketId:ticket,category:'spam',requestId:'x'}],['listLiveRaceHistoryPage',{locale:'en',limit:21}],['listLiveRaceHistoryPage',{locale:'en',userId:'forged'}]]){
  await check(name+':strict-rejection:'+JSON.stringify(input),async()=>{calls.length=0;await assert.rejects(handlers[name].run(request(input)),e=>e.code==='invalid-argument');assert.deepEqual(calls,[['lease',uid,60]]);});
 }
 const metadata=Object.entries(handlers).map(([name,fn])=>({name,endpoint:fn.__endpoint}));
 console.log('RIDDLE_WRAPPER_RESULTS='+JSON.stringify({checks:results.length,results,metadata,dependencyVersions:{zod:require(path.join(stage,'node_modules/zod/package.json')).version,'firebase-functions':require(path.join(stage,'node_modules/firebase-functions/package.json')).version}},null,2));
})().catch(error=>{console.error(error.name+': '+error.message);process.exitCode=1;});
