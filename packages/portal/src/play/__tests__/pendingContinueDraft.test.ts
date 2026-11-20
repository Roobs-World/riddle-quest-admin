import {createInitialGameSession,gameSessionReducer} from "@riddle-quest/hosted/play/gameSession";
import {pendingPlayScope,type PendingGuessJournal} from "@riddle-quest/hosted/play/pendingGuessJournal";
import {createPendingPlayJournalStorage} from "@riddle-quest/hosted/play/pendingPlayJournalDiagnostics";
import {CONTINUE_COIN_COST} from '../modalPages/commerce/commerceCosts';
/** Issued Continue fixture or recovered state under test. */
const riddle={riddleId:'classic-1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true,revealedHints:[{index:0,letter:'P'}],evaluation:{answer:'piano',locale:'en'}};
/** Issued Continue fixture or recovered state under test. */
const profile={username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1};
/** Issued Continue fixture or recovered state under test. */
const loaded=gameSessionReducer({...createInitialGameSession(),profile},{type:'loadRiddle',riddle});
/** Round-trips the original paid request and executes the real restoration actions. */
function restore(draft:string[]){
 /** Issued Continue fixture or recovered state under test. */
const record:PendingGuessJournal={version:1,scope:pendingPlayScope('Alice',1,'en'),confirmedClassicIndex:1,riddle,base:loaded,successors:[],queue:[],draft,draftActiveSlotIndex:2,coinAction:{type:'game:spendCoins',requestId:'continue-receipt-0001',payload:{reason:'continue',gameMode:'classic',riddleId:riddle.riddleId,sessionToken:riddle.sessionToken,amount:CONTINUE_COIN_COST}}};
 /** Issued Continue fixture or recovered state under test. */
const values=new Map<string,string>();
/** Issued Continue fixture or recovered state under test. */
const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);
/** Issued Continue fixture or recovered state under test. */
const read=storage.read(record.scope);expect(read?.coinAction).toEqual(record.coinAction);
 /** Issued Continue fixture or recovered state under test. */
const restored=gameSessionReducer(loaded,{type:'restoreQueuedGuesses',base:read!.base,guesses:[],draft:read!.draft,draftActiveSlotIndex:read!.draftActiveSlotIndex});
 return gameSessionReducer(restored,{type:'previewCoinSpend',requestId:read!.coinAction!.requestId!,amount:CONTINUE_COIN_COST,reason:'continue',draft:read!.draft,draftActiveSlotIndex:read!.draftActiveSlotIndex});
}
it.each([[null,'','','',''],[{},'','','',''],['AB','','','','']])('does not restore malformed Continue cells %p',(...cells)=>{
 /** Issued Continue fixture or recovered state under test. */
const state=restore(cells as never);expect(state.currentLetters).toEqual(['P','','','','']);expect(state.engineSnapshot?.hasUsedContinue).toBe(true);expect(state.pendingCoinSpend?.requestId).toBe('continue-receipt-0001');
});
it('keeps host-confirmed hint glyphs when restoring an otherwise valid Continue draft',()=>{
 /** Issued Continue fixture or recovered state under test. */
const state=restore(['A','I','','','']);expect(state.currentLetters).toEqual(['P','I','','','']);
 expect(gameSessionReducer(state,{type:'typeLetter',letter:'A'}).currentLetters).toEqual(['P','I','A','','']);
});
it('retains a valid Continue control, cursor and original paid request',()=>{
 /** Issued Continue fixture or recovered state under test. */
const state=restore(['P','I','','','']);expect(state.currentLetters).toEqual(['P','I','','','']);expect(state.activeSlotIndex).toBe(2);
 expect(state.profile?.coins).toBe(600-CONTINUE_COIN_COST);expect(state.engineSnapshot?.attemptsUsed).toBe(5);expect(state.pendingCoinSpend?.requestId).toBe('continue-receipt-0001');
});
