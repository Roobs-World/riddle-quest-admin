import {createInitialGameSession,gameSessionReducer} from "@qwordly/hosted/play/gameSession";
import {pendingPlayScope,type PendingGuessJournal} from "@qwordly/hosted/play/pendingGuessJournal";
import {createPendingPlayJournalStorage} from "@qwordly/hosted/play/pendingPlayJournalDiagnostics";
import {CONTINUE_COIN_COST} from '../modalPages/commerce/commerceCosts';
/** Original Continue preview or newer authoritative state under test. */
const riddle={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true,revealedHints:[{index:0,letter:'P'}],evaluation:{answer:'piano',locale:'en'}};
/** Original Continue preview or newer authoritative state under test. */
const profile={username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1};
/** Original Continue preview or newer authoritative state under test. */
const loaded=gameSessionReducer({...createInitialGameSession(),profile},{type:'loadRiddle',riddle});

/** Original Continue preview or newer authoritative state under test. */
const pending=()=>gameSessionReducer(loaded,{type:'previewCoinSpend',requestId:'continue-receipt-0001',amount:CONTINUE_COIN_COST,reason:'continue'});
/** Original Continue preview or newer authoritative state under test. */
const reject=(state:ReturnType<typeof pending>)=>gameSessionReducer(state,{type:'rejectCoinSpend',requestId:'continue-receipt-0001'});
it('keeps a newly host-confirmed hint when Continue is rejected',()=>{
 /** Original Continue preview or newer authoritative state under test. */
const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,revealedHints:[{index:0,letter:'P'},{index:1,letter:'I'}]}});
 /** Original Continue preview or newer authoritative state under test. */
const rolledBack=reject(current);expect(rolledBack.hintRevealedIndices).toEqual([0,1]);expect(rolledBack.currentLetters.slice(0,2)).toEqual(['P','I']);expect(rolledBack.letterStates.i).toBe('green');
});
it('does not undo a host-confirmed Continue grant when an older local preview is rejected',()=>{
 /** Original Continue preview or newer authoritative state under test. */
const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,hasUsedContinue:true,awaitingContinue:false}});
 /** Original Continue preview or newer authoritative state under test. */
const rolledBack=reject(current);expect(rolledBack.engineSnapshot?.hasUsedContinue).toBe(true);expect(rolledBack.modal).toBeNull();
});
it.each(['win','loss'])('does not reopen a host-confirmed terminal %s on Continue rejection',kind=>{
 /** Original Continue preview or newer authoritative state under test. */
const acceptedGuesses=Array.from({length:6},(_,index)=>({attempt:index+1,feedback:[...(index===5&&kind==='win'?'PIANO':'PIZZA')].map(letter=>({letter,status:index===5&&kind==='win'?'green' as const:'red' as const}))}));
 /** Original Continue preview or newer authoritative state under test. */
const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,hasUsedContinue:true,awaitingContinue:false,attemptsUsed:6,acceptedGuesses}});
 expect(current.lastOutcome?.kind).toBe(kind);
/** Original Continue preview or newer authoritative state under test. */
const rolledBack=reject(current);expect(rolledBack.lastOutcome).toEqual(current.lastOutcome);expect(rolledBack.engineSnapshot?.gameOver).toBe(true);expect(rolledBack.engineSnapshot?.attemptsUsed).toBe(6);
});
it('keeps a player-owned utility page open during Continue rollback',()=>{
 /** Original Continue preview or newer authoritative state under test. */
const current=gameSessionReducer(pending(),{type:'openModal',modal:'shop'});expect(reject(current).modal).toBe('shop');
});
it('restores the ordinary exhausted round after an unchanged Continue rejection',()=>{
 /** Original Continue preview or newer authoritative state under test. */
const rolledBack=reject(pending());expect(rolledBack.engineSnapshot?.hasUsedContinue).toBe(false);expect(rolledBack.modal).toBe('continue');expect(rolledBack.profile?.coins).toBe(600);expect(rolledBack.pendingCoinSpend).toBeNull();
});

it('preserves a host-confirmed fifth-attempt win before any Continue was used',()=>{
 /** Complete host feedback proves a terminal result without a Continue grant. */
 const acceptedGuesses=Array.from({length:5},(_,index)=>({attempt:index+1,feedback:[...(index===4?'PIANO':'PIZZA')].map(letter=>({letter,status:index===4?'green' as const:'red' as const}))}));
 /** Terminal history alone must outrank the saved nonterminal Continue offer. */
 const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,awaitingContinue:false,acceptedGuesses}});
 expect(current.lastOutcome?.kind).toBe('win');expect(reject(current).lastOutcome).toEqual(current.lastOutcome);
 expect(reject(current).engineSnapshot?.gameOver).toBe(true);
});

it('keeps a host-confirmed Continue when the recovery effect restores an older journal base',()=>{
 /** Canonical grant is newer than the pre-charge durable presentation. */
 const current=gameSessionReducer(pending(),{type:'loadRiddle',riddle:{...riddle,hasUsedContinue:true,awaitingContinue:false}});
 /** An older queued restoration must preserve that host grant. */
 const restored=gameSessionReducer(current,{type:'restoreQueuedGuesses',base:loaded,guesses:[],draft:['P','I','','','']});
 expect(restored.engineSnapshot?.hasUsedContinue).toBe(true);expect(restored.modal).toBeNull();
});
