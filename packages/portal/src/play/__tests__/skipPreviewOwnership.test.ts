import {expect,it,jest} from '@jest/globals';
import type {GameToHostMessage} from '@riddle-quest/core/bridge';
/** Exercises speculative ownership and rejection against the real recovery handler. */
const effects:Array<()=>unknown>=[],layouts:Array<()=>unknown>=[];
jest.mock('react',()=>({useCallback:<T>(fn:T)=>fn,useEffect:(fn:()=>unknown)=>effects.push(fn),useLayoutEffect:(fn:()=>unknown)=>layouts.push(fn),useRef:<T>(current:T)=>({current}),useState:<T>(initial:T|(()=>T))=>[typeof initial==='function'?(initial as ()=>T)():initial,jest.fn()]}));
import {createInitialGameSession,gameSessionReducer} from '../gameSession';
import {pendingPlayScope,type PendingGuessJournal} from "../pendingGuessJournal";
import {createPendingPlayJournalStorage} from "../pendingPlayJournalDiagnostics";
import {useProvisionalPlayRecovery,type PendingPlayRecoveryAdapters} from '../game/hooks/useProvisionalPlayRecovery';
it.each(['preview-valid','preview-wrong-index','preview-wrong-mode','preview-advanced','preview-storage-failure','reject-origin','reject-preview','reject-owned-preview','reject-durable-preview','reject-malformed-preview','reject-advanced','reject-storage-recovery','reject-delete-recovery','reject-storage-takeover'] as const)('Skip ownership: %s',async scenario=>{
 /** Storage recovery uses the same owned-preview rejection fixture. */
 const target=['reject-storage-recovery','reject-delete-recovery','reject-storage-takeover'].includes(scenario)?'reject-durable-preview':scenario;
 effects.length=0;layouts.length=0;
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const origin={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale:'en'}};
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const next={...origin,riddleId:'classic-2',index:2,sessionToken:'00000000-0000-4000-8000-000000000002'};
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const loaded=gameSessionReducer({...createInitialGameSession(),user:{uid:'Alice',isAnonymous:true},profile:{username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1}},{type:'loadRiddle',riddle:origin});
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const scope=pendingPlayScope('Alice',undefined,'en');
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const action={type:'game:skipRiddle' as const,requestId:'skip-owned-1',payload:{gameMode:'classic' as const,riddleId:origin.riddleId,sessionToken:origin.sessionToken}};
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const record:PendingGuessJournal={version:1,scope,confirmedClassicIndex:1,riddle:origin,base:loaded,draft:Array(5).fill(''),successors:[],queue:[],coinAction:action};
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 if(target==='reject-durable-preview'){record.skipPreview={requestId:action.requestId,sessionToken:origin.sessionToken,riddle:next};record.successors=[{riddle:next,base:gameSessionReducer(loaded,{type:'loadRiddle',riddle:next}),draft:['Q','','','','']}];}
 if(target==='reject-malformed-preview')record.skipPreview={requestId:action.requestId,sessionToken:origin.sessionToken,riddle:{...next,index:77}};
 if(scenario==='reject-storage-recovery'||scenario==='reject-storage-takeover')record.successors.push({riddle:{...next,index:3,riddleId:'classic-3',sessionToken:'00000000-0000-4000-8000-000000000003'},base:loaded,draft:['R','','','','']});
 /** Storage failure begins only after the paid request is durable. */
 let failWrite=false,failRemove=false;
 /** Durable bytes remain readable after a simulated write failure. */
 const values=new Map<string,string>();
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failWrite)throw new Error('storage unavailable');values.set(key,value);},removeItem:key=>{if(failRemove&&key.includes("pendingPlay:v1:"))throw new Error("storage unavailable");values.delete(key);}});if(target.startsWith('reject')&&target!=='reject-owned-preview')expect(storage.write(record)).toBe(true);
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const stateRef={current:target==='reject-durable-preview'?gameSessionReducer(loaded,{type:'loadRiddle',riddle:next}):loaded},post=jest.fn<(message:GameToHostMessage)=>void>();
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 /** Each registration retains its cancellation identity. */
 const intervals:Array<()=>void>=[],cancelled=new Set<number>();
 /** Durable storage and cancellable clock used by the mounted recovery owner. */
 /** Lease expiry can admit another tab before the persistence retry. */
 let now=1000;
 /** Concrete adapters bind the mutable test clock. */
 const adapters:PendingPlayRecoveryAdapters={journal:storage,clock:{now:()=>now,setTimeout:()=>1,clearTimeout:()=>{},setInterval:callback=>{intervals.push(callback as ()=>void);return intervals.length;},clearInterval:timer=>{if(timer!==undefined)cancelled.add(timer);}}};
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{},removeEventListener:()=>{}}});
 try{
  /** Exercises speculative ownership and rejection against the real recovery handler. */
  const recovery=useProvisionalPlayRecovery({state:stateRef.current,stateRef,adapters,dispatch:action=>{stateRef.current=gameSessionReducer(stateRef.current,action);},postToHost:post,playFeedback:()=>{}});
  for(const effect of layouts)effect();await new Promise<void>(resolve=>setImmediate(resolve));
  // Writer readiness commits recovery before passive effects, without remounting its owner.
  for(const effect of layouts.slice(1))effect();for(const effect of effects)effect();
  if(target.startsWith('preview')){
   recovery.requestSkip();
   /** Exercises speculative ownership and rejection against the real recovery handler. */
   
   /** Preview request created by the same Skip command. */
   const preview=post.mock.calls.map(call=>call[0]).find(message=>message.type==='game:loadRiddle'&&message.requestId?.startsWith('skip-preview-'));
   expect(preview).toBeDefined();
   if(target==='preview-storage-failure')failWrite=true;
   if(target==='preview-advanced')stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:{...next,index:3,riddleId:'classic-3',sessionToken:'00000000-0000-4000-8000-000000000003'}});
   /** Exercises speculative ownership and rejection against the real recovery handler. */
   const riddle=target==='preview-wrong-index'?{...next,index:4}:target==='preview-wrong-mode'?{...next,gameMode:'challenge' as const}:next;
   expect(recovery.acceptRiddleResult({type:'host:riddleLoaded',requestId:preview!.requestId,payload:{riddle}})).toBe(target==='preview-valid');
  }else{
   /** Correlates the rejection with the actual paid request. */
   let requestId=action.requestId;
   if(target==='reject-owned-preview'){recovery.requestSkip();
   /** Paid request created by the real Skip command. */
   const paid=post.mock.calls.map(call=>call[0]).find(message=>message.type==='game:skipRiddle');
   /** Preview request created by the same Skip command. */
   const preview=post.mock.calls.map(call=>call[0]).find(message=>message.type==='game:loadRiddle'&&message.requestId?.startsWith('skip-preview-'));expect(paid).toBeDefined();expect(preview).toBeDefined();requestId=paid!.requestId!;expect(recovery.acceptRiddleResult({type:'host:riddleLoaded',requestId:preview!.requestId,payload:{riddle:next}})).toBe(true);stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:next});}
   if(target==='reject-preview'||target==='reject-durable-preview'||target==='reject-malformed-preview')stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:next});
   if(target==='reject-advanced')stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:{...next,index:3,riddleId:'classic-3',sessionToken:'00000000-0000-4000-8000-000000000003'}});
   if(scenario==='reject-storage-recovery'||scenario==='reject-storage-takeover')failWrite=true;
   if(scenario==='reject-delete-recovery')failRemove=true;
   recovery.handleQueuedGuessResult({type:'host:operationResult',requestId,payload:{operation:'skip',ok:false,errorKind:'rejected',error:'Rejected'}});
   expect(stateRef.current.riddle?.index).toBe(target==='reject-advanced'?3:target==='reject-preview'||target==='reject-malformed-preview'?2:1);
   await new Promise<void>(resolve=>setImmediate(resolve));
   if(['reject-storage-recovery','reject-delete-recovery','reject-storage-takeover'].includes(scenario)){
    /** Storage recovers while the mounted game is idle. */
    failWrite=failRemove=false;
    if(scenario==='reject-storage-takeover'){
     now=20000;
     expect(storage.acquire(scope,'other-tab',now)).toBe(true);
     /** Independently persisted gameplay replaces the old tab's failed snapshot. */
     const other=storage.read(scope)!;
     other.coinAction=undefined;other.skipPreview=undefined;
     other.successors=other.successors.filter(segment=>segment.riddle.index===3);
     other.successors[0]!.draft=['S','','','',''];
     expect(storage.write(other)).toBe(true);
    }
    /** Persistence repair must not deliver the settled payment again. */
    const delivered=post.mock.calls.length;
    for(const [index,tick] of intervals.entries())if(!cancelled.has(index+1))tick();
    await new Promise<void>(resolve=>setImmediate(resolve));
    if(scenario==='reject-delete-recovery')expect(storage.read(scope)).toBeNull();
    else expect(storage.read(scope)?.successors.map(segment=>segment.riddle.index)).toEqual([3]);
    if(scenario==='reject-storage-takeover')expect(storage.read(scope)?.successors[0]?.draft).toEqual(['S','','','','']);
    expect(storage.read(scope)?.coinAction).toBeUndefined();
    expect(storage.read(scope)?.skipPreview).toBeUndefined();
    expect(post.mock.calls.length).toBe(delivered);
    expect(cancelled.has(intervals.length)).toBe(true);
   }else expect(storage.read(scope)).toBeNull();
  }

 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
