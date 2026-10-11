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

function retained(record:PendingGuessJournal){
 const values=new Map<string,string>();const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);const read=storage.read(scope);expect(read).not.toBeNull();
 expect(read!.queue).toEqual(record.queue);return read!;
}
it('keeps a nominal base owned by the current question',()=>{
 const record=retained(journal());const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:record.base,guesses:[],draft:record.draft});
 expect(restored.riddle).toBe(loaded.riddle);expect(restored.paused).toBe(loaded.paused);
});
it.each(['riddle','user','paused'])('does not restore host-owned field %s from serialized extras',field=>{
 const record=journal();(record.base as any)[field]=field==='paused'?true:field==='riddle'?{...riddle,riddleId:'foreign-question',sessionToken:'00000000-0000-4000-8000-000000000099'}:{uid:'foreign-user',isAnonymous:false,accountGeneration:99};
 const read=retained(record);const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read.base,guesses:[],draft:read.draft});
 expect((restored as any)[field]).toEqual((loaded as any)[field]);
});
it('does not let an extra malformed hint-lock field crash a valid draft restore',()=>{
 const record=journal();(record.base as any).hintRevealedIndices=null;const read=retained(record);
 expect(()=>gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read.base,guesses:[],draft:['P','','','',''],draftActiveSlotIndex:1})).not.toThrow();
});
it('recovers malformed keyboard presentation while retaining host-confirmed hint knowledge',()=>{
 const host=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{...riddle,revealedHints:[{index:0,letter:'P'}]}});
 const record=journal();record.base.letterStates=null as never;const read=retained(record);
 expect(()=>gameSessionReducer(host,{type:'restoreQueuedGuesses',base:read.base,guesses:[],draft:read.draft})).not.toThrow();
});
