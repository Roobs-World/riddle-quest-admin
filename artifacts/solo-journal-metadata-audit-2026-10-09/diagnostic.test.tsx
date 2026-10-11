import React from 'react';
import {renderToString} from 'react-dom/server';
import {createPendingPlayJournalStorage,pendingPlayScope,type PendingGuessJournal} from '../../packages/portal/src/play/pendingGuessJournal';
import {gameSessionReducer,createInitialGameSession} from '../../packages/portal/src/play/gameSession';
import {ControlledGuessBoard} from '../../packages/portal/src/play/GameFrameControls';
const riddle={riddleId:'classic-1',text:'A clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale:'en'}};
const loaded=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle});
const scope=pendingPlayScope('Alice',1,'en');
const {currentLetters,activeSlotIndex,guesses,engineSnapshot,modal,lastOutcome,completionAcknowledged,letterStates,profile,lastRewards,optimisticAchievementIds}=loaded;
const journal=():PendingGuessJournal=>({version:1,scope,confirmedClassicIndex:1,riddle,base:{currentLetters,activeSlotIndex,guesses,engineSnapshot,modal,lastOutcome,completionAcknowledged,letterStates,profile,lastRewards,optimisticAchievementIds},successors:[],draft:Array(5).fill(''),queue:[{message:{type:'game:submitGuess',requestId:'journal-receipt-0001',payload:{riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,gameMode:'classic',requestId:'journal-receipt-0001',guess:'PIZZA'}},attempts:1,isCorrect:false,gameOver:false,canContinue:false,feedback:Array(5).fill('red')}]});

it.each([
 ['optimisticAchievementIds',null],['optimisticAchievementIds',{}],['modal',{}],['modal','unrecognized-modal'],
 ['completionAcknowledged','false'],['lastRewards',{coinsEarned:1,newlyUnlockedAchievementIds:null}],
 ['lastOutcome',{kind:'win'}],['lastOutcome',{id:'foreign-win',kind:'win',riddleId:'foreign',gameMode:'classic',sessionToken:'foreign-session',attempts:1,isCorrect:true}],
])('does not project unusable completion metadata %s=%p', (field,value)=>{
 const record=journal();(record.base as any)[field]=value;
 const values=new Map<string,string>();const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,v)=>{values.set(key,v);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);const read=storage.read(scope);expect(read?.queue).toEqual(record.queue);
 const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read!.base,guesses:[],draft:read!.draft});
 expect((restored as any)[field]).toEqual((loaded as any)[field]);
 const edited=gameSessionReducer(restored,{type:'typeLetter',letter:'A'});expect(edited.currentLetters[0]).toBe('A');
 expect(()=>[...restored.optimisticAchievementIds]).not.toThrow();
});
it('keeps valid completion metadata in the nominal nonterminal control',()=>{
 const record=journal();const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:record.base,guesses:[],draft:record.draft});
 expect(restored.lastOutcome).toBeNull();expect(restored.lastRewards).toBeNull();expect(restored.optimisticAchievementIds).toEqual([]);
 expect(gameSessionReducer(restored,{type:'typeLetter',letter:'A'}).currentLetters[0]).toBe('A');
});

it.each(['victory','continue','outcome','terminal'])('does not reopen contradictory saved terminal state %s',kind=>{
 const record=journal();if(kind==='victory'||kind==='continue')record.base.modal=kind;
 if(kind==='outcome')record.base.lastOutcome={id:'contradictory-win',kind:'win',riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,gameMode:'classic',attempts:1,isCorrect:true};
 if(kind==='terminal')record.base.engineSnapshot={...record.base.engineSnapshot!,gameOver:true};
 const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:record.base,guesses:[],draft:record.draft});
 expect(restored.modal).toBeNull();expect(restored.lastOutcome).toBeNull();expect(restored.engineSnapshot?.gameOver).toBe(false);
 expect(gameSessionReducer(restored,{type:'typeLetter',letter:'A'}).currentLetters[0]).toBe('A');
});
