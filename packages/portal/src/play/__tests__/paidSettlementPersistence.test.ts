import {expect,it} from '@jest/globals';
import {createInitialGameSession,gameSessionReducer} from '../gameSession';
import {type PendingGuessJournal} from "../pendingGuessJournal";
import {createPendingPlayJournalStorage} from "../pendingPlayJournalDiagnostics";
import type {SettlementPersistence} from '../paidSettlement';

it.each(['retired-owner','new-receipt','new-draft','restricted-reader'] as const)('deferred settlement owns %s',async scenario=>{
 /** Issued account and question used by the concrete durable adapter. */
 const scope='Alice:1:en',riddle={riddleId:'q1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false};
 /** Actual reducer projection forms a valid recovery checkpoint. */
 const base=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle});
 /** Paid request remains durable until its receipt transition completes. */
 const record:PendingGuessJournal={version:1,scope,riddle,base,confirmedClassicIndex:1,draft:['','','','',''],successors:[],queue:[],coinAction:{type:'game:skipRiddle',requestId:'skip-owned-1',payload:{gameMode:'classic',riddleId:riddle.riddleId,sessionToken:riddle.sessionToken}}};
 /** Remaining draft can change while the optional module loads. */
 const remaining={...record,coinAction:undefined};
 /** Real storage bytes retain writes across the deferred continuation. */
 const values=new Map<string,string>();
 /** Restricted reading must preserve the obligation for a later retry. */
 let blocked=false,cancelled=false;
 /** Concrete adapter performs the same validation and lease operations as browser storage. */
 const storage=createPendingPlayJournalStorage({getItem:key=>{if(blocked)throw new Error('unavailable');return values.get(key)??null;},setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 expect(storage.write(record)).toBe(true);
 expect(storage.read(scope)?.coinAction).toEqual(record.coinAction);
 /** Capture predecessor identity before any asynchronous module work. */
 const expected=JSON.stringify(record);
 /** Current mutable cells emulate the mounted hook's lifetime and latest draft. */
 const cells:SettlementPersistence=[{current:{scope}},{current:scope},{current:remaining},{current:expected},{current:33},'tab-1',{now:()=>1000,clearInterval:()=>{cancelled=true;}}];
 /** The adapter must capture owner and receipt before yielding to import. */
 const pending=storage.persist(cells);
 if(scenario==='retired-owner')cells[0].current={scope};
 if(scenario==='new-receipt')cells[3].current='replacement-receipt';
 if(scenario==='new-draft')cells[2].current={...remaining,draft:['N','','','','']};
 if(scenario==='restricted-reader')blocked=true;
 await pending;
 if(scenario==='restricted-reader'){
  expect(cells[3].current).toBe(expected);expect(cancelled).toBe(false);
  blocked=false;await storage.persist(cells);
 }
 if(scenario==='retired-owner'||scenario==='new-receipt'){
  expect(storage.read(scope)?.coinAction).toEqual(record.coinAction);expect(cancelled).toBe(false);
  expect(cells[3].current).toBe(scenario==='new-receipt'?'replacement-receipt':expected);
 }else{
  expect(storage.read(scope)?.coinAction).toBeUndefined();expect(cells[3].current).toBeNull();expect(cancelled).toBe(true);
  expect(storage.read(scope)?.draft).toEqual(scenario==='new-draft'?['N','','','','']:record.draft);
 }
});
