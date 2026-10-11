import {expect,it,jest} from '@jest/globals';
const effects:Array<()=>unknown>=[],layouts:Array<()=>unknown>=[];
jest.mock('react',()=>({useCallback:<T>(fn:T)=>fn,useEffect:(fn:()=>unknown)=>effects.push(fn),useLayoutEffect:(fn:()=>unknown)=>layouts.push(fn),useRef:<T>(current:T)=>({current}),useState:<T>(initial:T|(()=>T))=>[typeof initial==='function'?(initial as ()=>T)():initial,jest.fn()]}));
import {createInitialGameSession,gameSessionReducer} from '../../packages/portal/src/play/gameSession';
import {createPendingPlayJournalStorage,pendingPlayScope,type PendingGuessJournal} from '../../packages/portal/src/play/pendingGuessJournal';
import {useProvisionalPlayRecovery,type PendingPlayRecoveryAdapters} from '../../packages/portal/src/play/game/hooks/useProvisionalPlayRecovery';
it.each(['preview-valid','preview-wrong-index','preview-wrong-mode','preview-advanced','reject-origin','reject-preview','reject-owned-preview','reject-advanced'] as const)('Skip ownership: %s',target=>{
 effects.length=0;layouts.length=0;
 const origin={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale:'en'}};
 const next={...origin,riddleId:'classic-2',index:2,sessionToken:'00000000-0000-4000-8000-000000000002'};
 const loaded=gameSessionReducer({...createInitialGameSession(),user:{uid:'Alice',isAnonymous:true},profile:{username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1}},{type:'loadRiddle',riddle:origin});
 const scope=pendingPlayScope('Alice',undefined,'en');
 const action={type:'game:skipRiddle' as const,requestId:'skip-owned-1',payload:{gameMode:'classic' as const,riddleId:origin.riddleId,sessionToken:origin.sessionToken}};
 const record:PendingGuessJournal={version:1,scope,confirmedClassicIndex:1,riddle:origin,base:loaded,draft:Array(5).fill(''),successors:[],queue:[],coinAction:action};
 const values=new Map<string,string>();
 const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});if(target.startsWith('reject')&&target!=='reject-owned-preview')expect(storage.write(record)).toBe(true);
 const stateRef={current:loaded},post=jest.fn();
 const adapters:PendingPlayRecoveryAdapters={journal:storage,clock:{now:()=>1000,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{}}};
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{},removeEventListener:()=>{}}});
 try{
  const recovery=useProvisionalPlayRecovery({state:loaded,stateRef,adapters,dispatch:action=>{stateRef.current=gameSessionReducer(stateRef.current,action);},postToHost:post,playFeedback:()=>{}});
  for(const effect of layouts)effect();for(const effect of effects)effect();
  if(target.startsWith('preview')){
   recovery.requestSkip();
   const preview=post.mock.calls.map(call=>call[0]).find(message=>message.type==='game:loadRiddle'&&message.requestId?.startsWith('skip-preview-'));
   expect(preview).toBeDefined();
   if(target==='preview-advanced')stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:{...next,index:3,riddleId:'classic-3',sessionToken:'00000000-0000-4000-8000-000000000003'}});
   const riddle=target==='preview-wrong-index'?{...next,index:4}:target==='preview-wrong-mode'?{...next,gameMode:'challenge' as const}:next;
   expect(recovery.acceptRiddleResult({type:'host:riddleLoaded',requestId:preview!.requestId,payload:{riddle}})).toBe(target==='preview-valid');
  }else{
   let requestId=action.requestId;
   if(target==='reject-owned-preview'){recovery.requestSkip();const paid=post.mock.calls.map(call=>call[0]).find(message=>message.type==='game:skipRiddle');const preview=post.mock.calls.map(call=>call[0]).find(message=>message.type==='game:loadRiddle'&&message.requestId?.startsWith('skip-preview-'));expect(paid).toBeDefined();expect(preview).toBeDefined();requestId=paid!.requestId!;expect(recovery.acceptRiddleResult({type:'host:riddleLoaded',requestId:preview!.requestId,payload:{riddle:next}})).toBe(true);stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:next});}
   if(target==='reject-preview')stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:next});
   if(target==='reject-advanced')stateRef.current=gameSessionReducer(stateRef.current,{type:'loadRiddle',riddle:{...next,index:3,riddleId:'classic-3',sessionToken:'00000000-0000-4000-8000-000000000003'}});
   recovery.handleQueuedGuessResult({type:'host:operationResult',requestId,payload:{operation:'skip',ok:false,errorKind:'rejected',error:'Rejected'}});
   expect(stateRef.current.riddle?.index).toBe(target==='reject-advanced'?3:target==='reject-preview'?2:1);
   expect(storage.read(scope)).toBeNull();
  }

 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
