import {expect,it,jest} from '@jest/globals';
import type {GameToHostMessage} from '@qwordly/core/bridge';
/** Terminal authority or exact unresolved payment fixture. */
const mockEffects:Array<()=>unknown>=[];
/** Terminal authority or exact unresolved payment fixture. */
const mockLayoutEffects:Array<()=>unknown>=[];
jest.mock('react',()=>({useCallback:<T,>(fn:T)=>fn,useMemo:<T,>(fn:()=>T)=>fn(),useEffect:(fn:()=>unknown)=>mockEffects.push(fn),useLayoutEffect:(fn:()=>unknown)=>mockLayoutEffects.push(fn),useRef:<T,>(current:T)=>({current}),useState:<T,>(initial:T|(()=>T))=>[typeof initial==='function'?(initial as ()=>T)():initial,jest.fn()]}));
import {useGameMessageRouter} from '../useGameMessageRouter';
import {createInitialGameSession,gameSessionReducer} from "@qwordly/hosted/play/gameSession";
import {pendingPlayScope,type PendingGuessJournal} from "@qwordly/hosted/play/pendingGuessJournal";
import {createPendingPlayJournalStorage} from "@qwordly/hosted/play/pendingPlayJournalDiagnostics";
import {useProvisionalPlayRecovery} from '../game/hooks/useProvisionalPlayRecovery';
import type {PendingPlayRecoveryAdapters} from "@qwordly/hosted/play/pendingPlayAdapters";
it.each((['win','loss'] as const).flatMap(kind=>(['hint','skip'] as const).map(operation=>({kind,operation,holdCharge:true,buffered:false}))))('terminal $kind preserves authority after accepted $operation',async({kind,operation,holdCharge,buffered})=>{
 mockEffects.length=0;mockLayoutEffects.length=0;
 /** Terminal authority or exact unresolved payment fixture. */
const riddle={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,index:1,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true,evaluation:{answer:'piano',locale:'en'}};
 /** Terminal authority or exact unresolved payment fixture. */
const loaded=gameSessionReducer({...createInitialGameSession(),user:{uid:'Alice',isAnonymous:true},profile:{username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1}},{type:'loadRiddle',riddle});
 /** Terminal authority or exact unresolved payment fixture. */
const charged=operation==='hint'?loaded:gameSessionReducer(loaded,{type:'previewCoinSpend',requestId:'continue-held-terminal',amount:50,reason:'skip'});
 /** Terminal authority or exact unresolved payment fixture. */
const acceptedGuesses=Array.from({length:6},(_,index)=>({attempt:index+1,feedback:[...(index===5&&kind==='win'?'PIANO':'PIZZA')].map(letter=>({letter,status:index===5&&kind==='win'?'green' as const:'red' as const}))}));
 /** Terminal authority or exact unresolved payment fixture. */
const terminal=gameSessionReducer(holdCharge?charged:loaded,{type:'loadRiddle',riddle:{...riddle,attemptsUsed:6,hasUsedContinue:true,awaitingContinue:false,acceptedGuesses}});
 /** Terminal authority or exact unresolved payment fixture. */
const scope=pendingPlayScope('Alice',undefined,'en');
/** Terminal authority or exact unresolved payment fixture. */
const record:PendingGuessJournal={version:1,scope,confirmedClassicIndex:1,riddle,base:loaded,draft:Array(5).fill(''),successors:[],queue:[],coinAction:holdCharge?{type:operation==='hint'?'game:requestHint':'game:skipRiddle',requestId:'continue-held-terminal',payload:{gameMode:'classic',riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,...(operation==='hint'?{requestId:'continue-held-terminal',currentAttempt:Array(5).fill('')}:{})}}:undefined} as PendingGuessJournal;
 if(buffered){record.successors=[{riddle:{...riddle,index:2,riddleId:'classic-2',sessionToken:'00000000-0000-4000-8000-000000000002',attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false},base:loaded,draft:['C','R','','','']}];record.queue=[{message:{type:'game:submitGuess',requestId:'successor-guess',payload:{requestId:'successor-guess',riddleId:'classic-2',sessionToken:'00000000-0000-4000-8000-000000000002',gameMode:'classic',guess:'CRANE'}},attempts:1,isCorrect:false,gameOver:false,canContinue:false,feedback:Array(5).fill('red')}];}
/** Terminal authority or exact unresolved payment fixture. */
const values=new Map<string,string>();
/** Terminal authority or exact unresolved payment fixture. */
const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});expect(storage.write(record)).toBe(true);
 /** Retry clock remains independent of terminal completion acknowledgement. */
let now=1000;
/** Live lease/retry callbacks captured from the actual recovery hook. */
const intervals:Array<()=>void>=[];
/** Terminal authority or exact unresolved payment fixture. */
const stateRef={current:terminal};
/** Terminal authority or exact unresolved payment fixture. */
const post=jest.fn<(message:GameToHostMessage)=>void>();
/** Terminal authority or exact unresolved payment fixture. */
const adapters:PendingPlayRecoveryAdapters={journal:storage,clock:{now:()=>now,setTimeout:()=>1,clearTimeout:()=>{},setInterval:fn=>{intervals.push(fn as ()=>void);return intervals.length;},clearInterval:()=>{}}};
 /** Terminal authority or exact unresolved payment fixture. */
const prior=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{},removeEventListener:()=>{}}});
 try{
/** Real receipt handler retains successor ownership after payment settlement. */
const recovery=useProvisionalPlayRecovery({state:terminal,stateRef,adapters,dispatch:action=>{stateRef.current=gameSessionReducer(stateRef.current,action);},postToHost:post,playFeedback:()=>{}});for(/** Terminal authority or exact unresolved payment fixture. */
const effect of mockLayoutEffects)effect();await new Promise<void>(resolve=>setImmediate(resolve));
// Writer readiness commits recovery before passive effects, without remounting its owner.
for(const effect of mockLayoutEffects.slice(1))effect();for(/** Terminal authority or exact unresolved payment fixture. */
const effect of mockEffects)effect();
  expect(stateRef.current.lastOutcome?.kind).toBe(kind);expect(stateRef.current.engineSnapshot?.gameOver).toBe(true);
  expect(Boolean(storage.read(scope)?.coinAction)||stateRef.current.pendingCoinSpend===null).toBe(true);
  if(holdCharge){if(!record.coinAction)throw new Error("Expected the held paid request.");expect(storage.read(scope)?.coinAction).toEqual(record.coinAction);expect(post).toHaveBeenCalledWith(record.coinAction);expect(post.mock.calls.every(call=>call[0].type!=="game:submitGuess")).toBe(true);
    now=26000;for(const interval of intervals)interval();expect(post.mock.calls.filter(call=>call[0].requestId===record.coinAction!.requestId)).toHaveLength(2);
    expect(stateRef.current.engineSnapshot?.gameOver).toBe(true);expect(storage.read(scope)?.coinAction).toEqual(record.coinAction);
    /** Fresh confirmed presentation and balance before an older immutable paid reply. */
    const before=stateRef.current;
    /** The actual bridge router exercises both recovery and generic receipt handling. */
    const router=useGameMessageRouter({stateRef,dispatch:action=>{stateRef.current=gameSessionReducer(stateRef.current,action);},postToHost:post,requestRiddle:()=>{},onGuessResult:recovery.handleQueuedGuessResult,acceptRiddleResult:recovery.acceptRiddleResult});
    await router({type:'host:operationResult',requestId:record.coinAction!.requestId,payload:{operation,ok:true,data:operation==='hint'?{index:0,revealedLetter:'P',newCoins:100}:{newCoins:100}}});
    expect(stateRef.current.engineSnapshot).toEqual(before.engineSnapshot);
    expect(stateRef.current.lastOutcome).toEqual(before.lastOutcome);
    expect(stateRef.current.modal).toEqual(before.modal);
    if(operation==='hint'){
      expect(stateRef.current.currentLetters).toEqual(before.currentLetters);
      expect(stateRef.current.profile?.coins).toBe(before.profile?.coins);
    }
    await new Promise<void>(resolve=>setImmediate(resolve));
    expect(storage.read(scope)).toBeNull();

  }
 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
