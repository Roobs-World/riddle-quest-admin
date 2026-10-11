import {expect,it,jest} from '@jest/globals';
const mockEffects:Array<()=>unknown>=[];const mockLayoutEffects:Array<()=>unknown>=[];
jest.mock('react',()=>({useCallback:<T,>(fn:T)=>fn,useEffect:(fn:()=>unknown)=>mockEffects.push(fn),useLayoutEffect:(fn:()=>unknown)=>mockLayoutEffects.push(fn),useRef:<T,>(current:T)=>({current}),useState:<T,>(initial:T|(()=>T))=>[typeof initial==='function'?(initial as ()=>T)():initial,jest.fn()]}));
import {createInitialGameSession,gameSessionReducer} from '../../packages/portal/src/play/gameSession';
import {createPendingPlayJournalStorage,pendingPlayScope,type PendingGuessJournal} from '../../packages/portal/src/play/pendingGuessJournal';
import {useProvisionalPlayRecovery,type PendingPlayRecoveryAdapters} from '../../packages/portal/src/play/game/hooks/useProvisionalPlayRecovery';
it.each([{kind:'win',holdCharge:true},{kind:'loss',holdCharge:true},{kind:'win',holdCharge:false},{kind:'loss',holdCharge:false}])('retains a settlement route for terminal $kind with held charge=$holdCharge',({kind,holdCharge})=>{
 mockEffects.length=0;mockLayoutEffects.length=0;
 const riddle={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true,evaluation:{answer:'piano',locale:'en'}};
 const loaded=gameSessionReducer({...createInitialGameSession(),user:{uid:'Alice',isAnonymous:true},profile:{username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1}},{type:'loadRiddle',riddle});
 const charged=gameSessionReducer(loaded,{type:'previewCoinSpend',requestId:'continue-held-terminal',amount:50,reason:'continue'});
 const acceptedGuesses=Array.from({length:6},(_,index)=>({attempt:index+1,feedback:[...(index===5&&kind==='win'?'PIANO':'PIZZA')].map(letter=>({letter,status:index===5&&kind==='win'?'green' as const:'red' as const}))}));
 const terminal=gameSessionReducer(holdCharge?charged:loaded,{type:'loadRiddle',riddle:{...riddle,attemptsUsed:6,hasUsedContinue:true,awaitingContinue:false,acceptedGuesses}});
 const scope=pendingPlayScope('Alice',undefined,'en');const record:PendingGuessJournal={version:1,scope,confirmedClassicIndex:1,riddle,base:loaded,draft:Array(5).fill(''),successors:[],queue:[],coinAction:holdCharge?{type:'game:spendCoins',requestId:'continue-held-terminal',payload:{reason:'continue',gameMode:'classic',riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,amount:50}}:undefined};
 const values=new Map<string,string>();const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});expect(storage.write(record)).toBe(true);
 const stateRef={current:terminal};const post=jest.fn();const adapters:PendingPlayRecoveryAdapters={journal:storage,clock:{now:()=>1000,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>2,clearInterval:()=>{}}};
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{},removeEventListener:()=>{}}});
 try{useProvisionalPlayRecovery({state:terminal,stateRef,adapters,dispatch:action=>{stateRef.current=gameSessionReducer(stateRef.current,action);},postToHost:post,playFeedback:()=>{}});for(const effect of mockLayoutEffects)effect();for(const effect of mockEffects)effect();
  expect(stateRef.current.lastOutcome?.kind).toBe(kind);expect(stateRef.current.engineSnapshot?.gameOver).toBe(true);
  expect(Boolean(storage.read(scope)?.coinAction)||stateRef.current.pendingCoinSpend===null).toBe(true);
 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
