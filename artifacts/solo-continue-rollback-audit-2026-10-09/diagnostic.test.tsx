import {createInitialGameSession,gameSessionReducer} from '../../packages/portal/src/play/gameSession';
import {createPendingPlayJournalStorage,pendingPlayScope,type PendingGuessJournal} from '../../packages/portal/src/play/pendingGuessJournal';
import {CONTINUE_COIN_COST} from '../../packages/portal/src/play/modalPages/commerce/commerceCosts';
const riddle={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true,revealedHints:[{index:0,letter:'P'}],evaluation:{answer:'piano',locale:'en'}};
const profile={username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1};
const loaded=gameSessionReducer({...createInitialGameSession(),profile},{type:'loadRiddle',riddle});

const pending=()=>gameSessionReducer(loaded,{type:'previewCoinSpend',requestId:'continue-receipt-0001',amount:CONTINUE_COIN_COST,reason:'continue'});
const reject=(state:ReturnType<typeof pending>)=>gameSessionReducer(state,{type:'rejectCoinSpend',requestId:'continue-receipt-0001'});
it('keeps a newly host-confirmed hint when Continue is rejected',()=>{
 const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,revealedHints:[{index:0,letter:'P'},{index:1,letter:'I'}]}});
 const rolledBack=reject(current);expect(rolledBack.hintRevealedIndices).toEqual([0,1]);expect(rolledBack.currentLetters.slice(0,2)).toEqual(['P','I']);expect(rolledBack.letterStates.i).toBe('green');
});
it('does not undo a host-confirmed Continue grant when an older local preview is rejected',()=>{
 const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,hasUsedContinue:true,awaitingContinue:false}});
 const rolledBack=reject(current);expect(rolledBack.engineSnapshot?.hasUsedContinue).toBe(true);expect(rolledBack.modal).toBeNull();
});
it.each(['win','loss'])('does not reopen a host-confirmed terminal %s on Continue rejection',kind=>{
 const acceptedGuesses=Array.from({length:6},(_,index)=>({attempt:index+1,feedback:[...(index===5&&kind==='win'?'PIANO':'PIZZA')].map(letter=>({letter,status:index===5&&kind==='win'?'green' as const:'red' as const}))}));
 const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,hasUsedContinue:true,awaitingContinue:false,attemptsUsed:6,acceptedGuesses}});
 expect(current.lastOutcome?.kind).toBe(kind);const rolledBack=reject(current);expect(rolledBack.lastOutcome).toEqual(current.lastOutcome);expect(rolledBack.engineSnapshot?.gameOver).toBe(true);expect(rolledBack.engineSnapshot?.attemptsUsed).toBe(6);
});
it('keeps a player-owned utility page open during Continue rollback',()=>{
 const current=gameSessionReducer(pending(),{type:'openModal',modal:'shop'});expect(reject(current).modal).toBe('shop');
});
it('restores the ordinary exhausted round after an unchanged Continue rejection',()=>{
 const rolledBack=reject(pending());expect(rolledBack.engineSnapshot?.hasUsedContinue).toBe(false);expect(rolledBack.modal).toBe('continue');expect(rolledBack.profile?.coins).toBe(600);expect(rolledBack.pendingCoinSpend).toBeNull();
});
