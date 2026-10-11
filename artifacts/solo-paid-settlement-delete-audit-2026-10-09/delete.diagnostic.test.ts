import {expect,it,jest} from '@jest/globals';
/** Exercises speculative ownership and rejection against the real recovery handler. */
const effects:Array<()=>unknown>=[],layouts:Array<()=>unknown>=[];
jest.mock('react',()=>({useCallback:<T>(fn:T)=>fn,useEffect:(fn:()=>unknown)=>effects.push(fn),useLayoutEffect:(fn:()=>unknown)=>layouts.push(fn),useRef:<T>(current:T)=>({current}),useState:<T>(initial:T|(()=>T))=>[typeof initial==='function'?(initial as ()=>T)():initial,jest.fn()]}));
import {createInitialGameSession,gameSessionReducer} from '/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/play/gameSession';
import {createPendingPlayJournalStorage,pendingPlayScope,type PendingGuessJournal} from '/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/play/pendingGuessJournal';
import {useProvisionalPlayRecovery,type PendingPlayRecoveryAdapters} from '/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/play/game/hooks/useProvisionalPlayRecovery';
it.each(['reject-durable-preview'] as const)('Skip ownership: %s',async target=>{
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
 /** Storage failure begins only after the paid request is durable. */
 let failWrite=false,failRemove=false;
 /** Durable bytes remain readable after a simulated write failure. */
 const values=new Map<string,string>();
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failWrite)throw new Error('storage unavailable');values.set(key,value);},removeItem:key=>{if(failRemove&&key.startsWith("riddleQuest:pendingPlay:v1:"))throw new Error("storage unavailable");values.delete(key);}});if(target.startsWith('reject')&&target!=='reject-owned-preview')expect(storage.write(record)).toBe(true);
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const stateRef={current:target==='reject-durable-preview'?gameSessionReducer(loaded,{type:'loadRiddle',riddle:next}):loaded},post=jest.fn();
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const intervals:Array<()=>void>=[];
 const cancelled=new Set<number>();
 const adapters:PendingPlayRecoveryAdapters={journal:storage,clock:{now:()=>1000,setTimeout:()=>1,clearTimeout:()=>{},setInterval:callback=>{intervals.push(callback as ()=>void);return intervals.length;},clearInterval:timer=>{cancelled.add(timer);}}};
 /** Exercises speculative ownership and rejection against the real recovery handler. */
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{},removeEventListener:()=>{}}});
 try{
  /** Exercises speculative ownership and rejection against the real recovery handler. */
  const recovery=useProvisionalPlayRecovery({state:stateRef.current,stateRef,adapters,dispatch:action=>{stateRef.current=gameSessionReducer(stateRef.current,action);},postToHost:post,playFeedback:()=>{}});
  for(const effect of layouts)effect();for(const effect of effects)effect();
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
   failRemove=true;
   recovery.handleQueuedGuessResult({type:'host:operationResult',requestId,payload:{operation:'skip',ok:false,errorKind:'rejected',error:'Rejected'}});
   expect(stateRef.current.riddle?.index).toBe(target==='reject-advanced'?3:target==='reject-preview'||target==='reject-malformed-preview'?2:1);
   await new Promise<void>(resolve=>setImmediate(resolve));
   failRemove=false;
   for(const [index,tick] of intervals.entries())if(!cancelled.has(index+1))tick();
   await new Promise<void>(resolve=>setImmediate(resolve));
   const durable=storage.read(scope);
   expect(durable).toBeNull();
  }

 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
