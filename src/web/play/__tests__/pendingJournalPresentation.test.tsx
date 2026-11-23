import React from 'react';
import {renderToString} from 'react-dom/server';
import {pendingPlayScope,type PendingGuessJournal} from "../../../hosted/play/pendingGuessJournal";
import {createPendingPlayJournalStorage} from "../../../hosted/play/pendingPlayJournalDiagnostics";
import {gameSessionReducer,createInitialGameSession} from "../../../hosted/play/gameSession";
import {ControlledGuessBoard} from '../GameFrameControls';
/** State or receipt fixture for the recovery boundary. */
const riddle={riddleId:'classic-1',text:'A clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale:'en'}};
/** State or receipt fixture for the recovery boundary. */
const loaded=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle});
/** State or receipt fixture for the recovery boundary. */
const scope=pendingPlayScope('Alice',1,'en');
/** State or receipt fixture for the recovery boundary. */
const {currentLetters,activeSlotIndex,guesses,engineSnapshot,modal,lastOutcome,completionAcknowledged,letterStates,profile,lastRewards,optimisticAchievementIds}=loaded;
/** State or receipt fixture for the recovery boundary. */
const journal=():PendingGuessJournal=>({version:1,scope,confirmedClassicIndex:1,riddle,base:{currentLetters,activeSlotIndex,guesses,engineSnapshot,modal,lastOutcome,completionAcknowledged,letterStates,profile,lastRewards,optimisticAchievementIds},successors:[],draft:Array(5).fill(''),queue:[{message:{type:'game:submitGuess',requestId:'journal-receipt-0001',payload:{riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,gameMode:'classic',requestId:'journal-receipt-0001',guess:'PIZZA'}},attempts:1,isCorrect:false,gameOver:false,canContinue:false,feedback:Array(5).fill('red')}]});
/** Restores through durable storage and renders the resulting real board. */
function restoreAndRender(record:PendingGuessJournal, host=loaded){
 /** State or receipt fixture for the recovery boundary. */
const values=new Map<string,string>();
/** State or receipt fixture for the recovery boundary. */
const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);
 /** State or receipt fixture for the recovery boundary. */
const retained=storage.read(scope);expect(retained?.queue[0]?.message.requestId).toBe('journal-receipt-0001');
 /** State or receipt fixture for the recovery boundary. */
const restored=gameSessionReducer(host,{type:'restoreQueuedGuesses',base:retained!.base,guesses:retained!.queue.map(item=>item.message.payload.guess),guessAttempts:retained!.queue.map(item=>item.attempts),draft:retained!.draft});
 expect(retained!.queue).toEqual(record.queue);
 return renderToString(<ControlledGuessBoard answerLength={5} currentLetters={restored.currentLetters} activeSlotIndex={restored.activeSlotIndex} guesses={restored.guesses} hintRevealedIndices={restored.hintRevealedIndices} onSelectSlot={()=>{}}/>);
}
it('renders the valid durable control',()=>expect(()=>restoreAndRender(journal())).not.toThrow());
it.each([null,{}, {guess:null,feedback:[]}])('does not crash on malformed saved presentation %p', bad=>{
 /** State or receipt fixture for the recovery boundary. */
const record=journal();record.base.guesses=[bad] as never;
 expect(()=>restoreAndRender(record)).not.toThrow();
});

it.each([{}, {guesses: []}])('recovers missing board fields without losing receipts %p', bad => {
 /** State or receipt fixture for the recovery boundary. */
const record=journal();record.base=bad as never;
 expect(()=>restoreAndRender(record)).not.toThrow();
});
it('does not append an already host-confirmed pending attempt when the saved board is corrupt',()=>{
 /** State or receipt fixture for the recovery boundary. */
const record=journal();record.base.guesses=[null] as never;
 /** State or receipt fixture for the recovery boundary. */
const host=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{...riddle,attemptsUsed:1,
 acceptedGuesses:[{attempt:1,feedback:[..."PIZZA"].map(letter=>({letter,status:'red' as const}))}]}});
 /** State or receipt fixture for the recovery boundary. */
const restored=gameSessionReducer(host,{type:'restoreQueuedGuesses',base:record.base,
 guesses:['PIZZA'],guessAttempts:[1],draft:['P','I','','',''],draftActiveSlotIndex:2});
 expect(restored.guesses).toHaveLength(1);
 expect(restored.engineSnapshot?.attemptsUsed).toBe(1);
 expect(restored.currentLetters).toEqual(['P','I','','','']);
 expect(restored.activeSlotIndex).toBe(2);
 expect(record.queue[0]?.message.requestId).toBe('journal-receipt-0001');
});
it('replays only later pending attempts above complete host history after presentation recovery',()=>{
 /** State or receipt fixture for the recovery boundary. */
const record=journal();record.base.guesses=[{}] as never;
 /** State or receipt fixture for the recovery boundary. */
const host=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{...riddle,attemptsUsed:1,
 acceptedGuesses:[{attempt:1,feedback:[..."PIZZA"].map(letter=>({letter,status:'red' as const}))}]}});
 /** State or receipt fixture for the recovery boundary. */
const restored=gameSessionReducer(host,{type:'restoreQueuedGuesses',base:record.base,
 guesses:['PIZZA','CRANE'],guessAttempts:[1,2],draft:Array(5).fill('')});
 expect(restored.guesses).toHaveLength(2);
 expect(restored.engineSnapshot?.attemptsUsed).toBe(2);
});
it('falls back safely when rejection restores a corrupt confirmed checkpoint',()=>{
 /** State or receipt fixture for the recovery boundary. */
const record=journal();record.base.currentLetters=null as never;
 expect(()=>gameSessionReducer(loaded,{type:'restoreConfirmedRiddle',riddle,base:record.base})).not.toThrow();
});
it('ignores malformed draft cells while retaining playable pending rows',()=>{
 /** State or receipt fixture for the recovery boundary. */
const record=journal();record.base.guesses=[null] as never;record.draft=[null,{},'', '', ''] as never;
 expect(()=>restoreAndRender(record)).not.toThrow();
});

/** Round-trips a checkpoint while verifying its request remains unchanged. */
function retained(record:PendingGuessJournal){
 /** Recovery boundary fixture with an unchanged durable request. */
const values=new Map<string,string>();
/** Recovery boundary fixture with an unchanged durable request. */
const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);
/** Recovery boundary fixture with an unchanged durable request. */
const read=storage.read(scope);expect(read).not.toBeNull();
 expect(read!.queue).toEqual(record.queue);return read!;
}
it('keeps a nominal base owned by the current question',()=>{
 /** Recovery boundary fixture with an unchanged durable request. */
const record=retained(journal());
/** Recovery boundary fixture with an unchanged durable request. */
const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:record.base,guesses:[],draft:record.draft});
 expect(restored.riddle).toBe(loaded.riddle);expect(restored.paused).toBe(loaded.paused);
});
it.each(['riddle','user','paused'])('does not restore host-owned field %s from serialized extras',field=>{
 /** Recovery boundary fixture with an unchanged durable request. */
const record=journal();(record.base as any)[field]=field==='paused'?true:field==='riddle'?{...riddle,riddleId:'foreign-question',sessionToken:'00000000-0000-4000-8000-000000000099'}:{uid:'foreign-user',isAnonymous:false,accountGeneration:99};
 /** Recovery boundary fixture with an unchanged durable request. */
const read=retained(record);
/** Recovery boundary fixture with an unchanged durable request. */
const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read.base,guesses:[],draft:read.draft});
 expect((restored as any)[field]).toEqual((loaded as any)[field]);
});
it('does not let an extra malformed hint-lock field crash a valid draft restore',()=>{
 /** Recovery boundary fixture with an unchanged durable request. */
const record=journal();(record.base as any).hintRevealedIndices=null;
/** Recovery boundary fixture with an unchanged durable request. */
const read=retained(record);
 expect(()=>gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read.base,guesses:[],draft:['P','','','',''],draftActiveSlotIndex:1})).not.toThrow();
});
it('recovers malformed keyboard presentation while retaining host-confirmed hint knowledge',()=>{
 /** Recovery boundary fixture with an unchanged durable request. */
const host=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{...riddle,revealedHints:[{index:0,letter:'P'}]}});
 /** Recovery boundary fixture with an unchanged durable request. */
const record=journal();record.base.letterStates=null as never;
/** Recovery boundary fixture with an unchanged durable request. */
const read=retained(record);
 expect(()=>gameSessionReducer(host,{type:'restoreQueuedGuesses',base:read.base,guesses:[],draft:read.draft})).not.toThrow();
});

it('does not preview a pending attempt already present in a usable saved board',()=>{
 /** Valid checkpoint already contains this original queued attempt slot. */
 const host=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{...riddle,attemptsUsed:1,
 acceptedGuesses:[{attempt:1,feedback:[..."PIZZA"].map(letter=>({letter,status:'red' as const}))}]}});
 /** Receipt delivery remains pending independently of the displayed board. */
 const restored=gameSessionReducer(host,{type:'restoreQueuedGuesses',base:host,guesses:['PIZZA'],guessAttempts:[1],draft:Array(5).fill('')});
 expect(restored.guesses).toHaveLength(1);expect(restored.engineSnapshot?.attemptsUsed).toBe(1);
});

it.each([
 ['optimisticAchievementIds',null],['optimisticAchievementIds',{}],['modal',{}],['modal','unrecognized-modal'],
 ['completionAcknowledged','false'],['lastRewards',{coinsEarned:1,newlyUnlockedAchievementIds:null}],
 ['lastOutcome',{kind:'win'}],['lastOutcome',{id:'foreign-win',kind:'win',riddleId:'foreign',gameMode:'classic',sessionToken:'foreign-session',attempts:1,isCorrect:true}],
])('does not project unusable completion metadata %s=%p', (field,value)=>{
 /** Persisted metadata fixture and real reducer result. */
const record=journal();(record.base as any)[field]=value;
 /** Persisted metadata fixture and real reducer result. */
const values=new Map<string,string>();
/** Persisted metadata fixture and real reducer result. */
const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,v)=>{values.set(key,v);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);
/** Persisted metadata fixture and real reducer result. */
const read=storage.read(scope);expect(read?.queue).toEqual(record.queue);
 /** Persisted metadata fixture and real reducer result. */
const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read!.base,guesses:[],draft:read!.draft});
 expect((restored as any)[field]).toEqual((loaded as any)[field]);
 /** Persisted metadata fixture and real reducer result. */
const edited=gameSessionReducer(restored,{type:'typeLetter',letter:'A'});expect(edited.currentLetters[0]).toBe('A');
 expect(()=>[...restored.optimisticAchievementIds]).not.toThrow();
});
it('keeps valid completion metadata in the nominal nonterminal control',()=>{
 /** Persisted metadata fixture and real reducer result. */
const record=journal();
/** Persisted metadata fixture and real reducer result. */
const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:record.base,guesses:[],draft:record.draft});
 expect(restored.lastOutcome).toBeNull();expect(restored.lastRewards).toBeNull();expect(restored.optimisticAchievementIds).toEqual([]);
 expect(gameSessionReducer(restored,{type:'typeLetter',letter:'A'}).currentLetters[0]).toBe('A');
});

it.each(['victory','continue','outcome','terminal'])('does not reopen contradictory saved terminal state %s',kind=>{
 /** Contradictory checkpoint evaluated against the loaded host state. */
const record=journal();if(kind==='victory'||kind==='continue')record.base.modal=kind;
 if(kind==='outcome')record.base.lastOutcome={id:'contradictory-win',kind:'win',riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,gameMode:'classic',attempts:1,isCorrect:true};
 if(kind==='terminal')record.base.engineSnapshot={...record.base.engineSnapshot!,gameOver:true};
 /** Contradictory checkpoint evaluated against the loaded host state. */
const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:record.base,guesses:[],draft:record.draft});
 expect(restored.modal).toBeNull();expect(restored.lastOutcome).toBeNull();expect(restored.engineSnapshot?.gameOver).toBe(false);
 expect(gameSessionReducer(restored,{type:'typeLetter',letter:'A'}).currentLetters[0]).toBe('A');
});

it('retains a valid locally completed checkpoint and its victory presentation',()=>{
 /** The real reducer produces the terminal metadata that pending recovery must preserve. */
 const won=gameSessionReducer({...loaded,currentLetters:[..."PIANO"]},{type:'guessRequested'});
 /** Valid terminal presentation remains recoverable until the original receipt settles. */
 const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:won,guesses:[],draft:Array(5).fill('')});
 expect(restored.modal).toBe('victory');expect(restored.lastOutcome).toEqual(won.lastOutcome);
 expect(restored.engineSnapshot?.gameOver).toBe(true);
});
