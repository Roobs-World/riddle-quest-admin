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
function restoreAndRender(record:PendingGuessJournal){
 const values=new Map<string,string>();const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);
 const retained=storage.read(scope);expect(retained?.queue[0]?.message.requestId).toBe('journal-receipt-0001');
 const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:retained!.base,guesses:retained!.queue.map(item=>item.message.payload.guess),draft:retained!.draft});
 return renderToString(<ControlledGuessBoard answerLength={5} currentLetters={restored.currentLetters} activeSlotIndex={restored.activeSlotIndex} guesses={restored.guesses} hintRevealedIndices={restored.hintRevealedIndices} onSelectSlot={()=>{}}/>);
}
it('renders the valid durable control',()=>expect(()=>restoreAndRender(journal())).not.toThrow());
it.each([null,{}, {guess:null,feedback:[]}])('does not crash on malformed saved presentation %p', bad=>{
 const record=journal();record.base.guesses=[bad] as never;
 expect(()=>restoreAndRender(record)).not.toThrow();
});
