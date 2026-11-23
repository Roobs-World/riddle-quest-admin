import {expect,it} from '@jest/globals';
import {createJournalWriter} from '../journalWriter';
import {writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease,type PendingGuessJournal} from "../pendingGuessJournal";
import {createPendingPlayJournalStorage,readPendingGuessJournal} from "../pendingPlayJournalDiagnostics";
import {createInitialGameSession,gameSessionReducer} from "../../gameSession";
import {createSavedGame,GameSessionCheckpoints} from "../../checkpoints/GameSessionCheckpoints";

it.each(['active-takeover','released-takeover','expired-takeover','local-edit','failed-write','failed-delete','retired-owner','unknown-predecessor','remount','remount-takeover','write-readback','delete-readback'] as const)('journal writer guards %s',scenario=>{
 /** Concrete bytes are shared by the mounted writer and an independent tab. */
 const values=new Map<string,string>();
 /** Storage failures occur only after the initial journal is durable. */
 let fail=false,live=true,now=1000,readFailure=false;
 /** Existing adapter supports independent setup and genuine lease acquisition. */
 const storage={getItem:(key:string)=>{if(readFailure){readFailure=false;throw new Error("read unavailable");}return values.get(key)??null;},setItem:(key:string,value:string)=>{if(fail)throw new Error('unavailable');values.set(key,value);if(scenario==='write-readback'&&key.includes("pendingPlay:v1:"))readFailure=true;},removeItem:(key:string)=>{if(fail)throw new Error('unavailable');values.delete(key);if(scenario==='delete-readback'&&key.includes("pendingPlay:v1:"))readFailure=true;}};
 /** Issued question and reducer projection form a valid recovery journal. */
 const scope='Alice:1:en',riddle={riddleId:'q1',text:'Clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false};
 /** Durable work must survive any rejected stale mutation. */
 const record:PendingGuessJournal={version:1,scope,riddle,base:gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle}),confirmedClassicIndex:1,draft:['','','','',''],queue:[],successors:[]};
 /** Bare adapter represents another writer, not the current owner's observation cursor. */
 const other=createPendingPlayJournalStorage(storage);
 expect(other.write(record)).toBe(true);readFailure=false;expect(other.read(scope)).not.toBeNull();
 /** Each owner gets a separate immutable observed predecessor. */
 const observed=new Map<string,string|null>();
 /** Active writer changes when the mounted lifetime is replaced. */
 let writer=createJournalWriter({observed,storage,owner:'first-tab',now:()=>now,owns:()=>live,operations:[readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease]});
 if(scenario!=='unknown-predecessor')expect(writer.read(scope)).not.toBeNull();
 /** A different tab's paid request remains authoritative for local delivery recovery. */
 const replacement={...record,draft:['S','','','',''],coinAction:{type:'game:skipRiddle' as const,requestId:'skip-other-tab-required',payload:{gameMode:'classic' as const,riddleId:riddle.riddleId,sessionToken:riddle.sessionToken}}};
 if(scenario.startsWith('remount')){
  live=false;
  /** Retired writer keeps its revoked gate despite sharing immutable observations. */
  const old=writer;
  writer=createJournalWriter({storage,observed,owner:'second-lifetime',now:()=>now,owns:()=>true,operations:[readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease]});
  expect(old.read(scope)).toBeNull();expect(old.write(record)).toBe(false);
 }
 if(scenario==='write-readback'){
  /** Exact payload can be retried after a verification read failure. */
  const changed={...record,draft:['R','','','','']};
  expect(writer.write(changed)).toBe(false);
  expect(writer.write(changed,true)).toBe(true);return;
 }
 if(scenario==='delete-readback'){
  expect(writer.clear(scope)).toBe(false);
  expect(writer.acknowledge(scope,null)).toBe(true);return;
 }
 if(scenario.endsWith('takeover')){
  expect(other.acquire(scope,'other-tab',now)).toBe(true);expect(other.write(replacement)).toBe(true);
  if(scenario==='released-takeover')other.release(scope,'other-tab');
  if(scenario==='expired-takeover')now=50000;
 }
 if(scenario==='retired-owner')live=false;
 if(scenario==='failed-write'||scenario==='failed-delete')fail=true;
 /** Local state changes do not update the immutable observed bytes. */
 const changed={...record,draft:['R','','','','']};
 if(scenario==='failed-delete'){
  expect(writer.clear(scope)).toBe(false);fail=false;expect(writer.clear(scope)).toBe(true);expect(other.read(scope)).toBeNull();return;
 }
 expect(writer.write(changed)).toBe(scenario==='local-edit'||scenario==='remount');
 if(scenario==='local-edit'||scenario==='remount')expect(other.read(scope)?.draft).toEqual(changed.draft);
 else if(scenario.endsWith('takeover')){
  expect(other.read(scope)?.coinAction).toEqual(replacement.coinAction);
  expect(writer.clear(scope)).toBe(false);expect(other.read(scope)?.draft).toEqual(replacement.draft);
 }else if(scenario==='failed-write'){
  fail=false;expect(writer.write(changed)).toBe(true);expect(other.read(scope)?.draft).toEqual(changed.draft);
 }else expect(other.read(scope)?.draft).toEqual(record.draft);
});

it.each([false,true])('keeps committed draft edits, confirmed hint locks and empty input durable (hinted=%s)',hinted=>{
 /** The real writer and reader share browser-like durable bytes. */
 const values=new Map<string,string>();
 /** Account-scoped storage isolates this ordinary-draft scenario. */
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 /** One admitted writer owns the same scope through typing and completion. */
 const scope='Alice:1:en',writer=createJournalWriter({storage,owner:'draft-tab',now:()=>1000,owns:candidate=>candidate===scope,
  operations:[readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease]});
 /** Reducer input uses the authority-issued question shape. */
 let state=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'draft-piano',text:'Clue',answerLength:5,
  sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}});
 if(hinted)state=gameSessionReducer(state,{type:'applyHint',index:0,letter:'P',newCoins:275});
 for(const letter of hinted?'IA':'PIA')state=gameSessionReducer(state,{type:'typeLetter',letter});
 expect(writer.read(scope)).toBeNull();
 /** Confirmed input is durable before the SDK writer can acknowledge it. */
 let journal=writer.checkpoint(scope,state,null,state);
 expect(readPendingGuessJournal(scope,storage)).toMatchObject({draft:['P','I','A','',''],draftActiveSlotIndex:3,
  riddle:{revealedHints:hinted?[{index:0,letter:'P'}]:[]}});
 for(let index=0;index<3;index++)state=gameSessionReducer(state,{type:'backspace'});
 journal=writer.checkpoint(scope,state,journal,state);
 expect(readPendingGuessJournal(scope,storage)?.draft).toEqual(hinted?['P','','','','']:['','','','','']);
 state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:[...'PIANO'],feedback:['green','green','green','green','green']},
  attempts:1,isCorrect:true,gameOver:true,canContinue:false});
 expect(writer.checkpoint(scope,state,journal,state)).toBeNull();
 expect(readPendingGuessJournal(scope,storage)).toBeNull();
});

it.each(['guess','coin'])('preserves an unresolved %s when confirmed terminal input retires its draft',kind=>{
 /** Real storage preserves separately idempotent requests while presentation finishes. */
 const values=new Map<string,string>();
 /** Durable bytes remain observable after a terminal checkpoint. */
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 /** One scope owns pending and terminal views of the issued question. */
 const scope='Alice:1:en',writer=createJournalWriter({storage,owner:'pending-tab',now:()=>1000,owns:candidate=>candidate===scope,
  operations:[readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease]});
 /** The terminal reply belongs to this exact issued session. */
 let state=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'pending-piano',text:'Clue',answerLength:5,
  sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}});
 if(!state.riddle)throw new Error('The issued question must be available.');
 /** Pending delivery data remains independent of the draft-only terminal cleanup. */
 const journal=writer.create(state,scope,state.riddle,state);
 if(kind==='coin')journal.coinAction={type:'game:requestHint',requestId:'pending-hint',payload:{riddleId:state.riddle.riddleId,
  sessionToken:state.riddle.sessionToken,gameMode:'classic',currentAttempt:['','','','',''],requestId:'pending-hint'}};
 else journal.queue.push({message:{type:'game:submitGuess',requestId:'pending-guess',payload:{riddleId:state.riddle.riddleId,
  sessionToken:state.riddle.sessionToken,gameMode:'classic',guess:'PIANO',requestId:'pending-guess'}},attempts:1,isCorrect:true,
  gameOver:true,canContinue:false,feedback:['green','green','green','green','green']});
 expect(writer.write(journal)).toBe(true);
 state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:[...'PIANO'],feedback:['green','green','green','green','green']},
  attempts:1,isCorrect:true,gameOver:true,canContinue:false});
 writer.checkpoint(scope,state,journal,state);
 expect(readPendingGuessJournal(scope,storage)).toMatchObject(kind==='coin'?{coinAction:{requestId:'pending-hint'}}:{queue:[{message:{requestId:'pending-guess'}}]});
});

it('restores an SDK draft before seeding a journal from its authority-issued hint',()=>{
 /** One authority-issued hint also appears in the existing SDK checkpoint. */
 const loaded=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'startup-piano',text:'Clue',answerLength:5,
  sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,
  revealedHints:[{index:0,letter:'P'}]}});
 /** Prior client-owned SDK progress includes two additional typed letters. */
 let previous=loaded;
 for(const letter of 'IA')previous=gameSessionReducer(previous,{type:'typeLetter',letter});
 /** Canonical SDK projection waits for the ordinary checkpoint restore decision. */
 const saved=createSavedGame(previous,1000);
 /** Browser journal is initially empty during the upgraded launch. */
 const values=new Map<string,string>();
 /** The same durable adapter is used before and after SDK restoration. */
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 /** A ready writer must not supersede the pending SDK startup projection. */
 const scope='Alice:1:en',writer=createJournalWriter({storage,owner:'startup-tab',now:()=>1000,owns:candidate=>candidate===scope,
  operations:[readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease]});
 expect(writer.checkpoint(scope,loaded,null,loaded)).toBeNull();
 expect(readPendingGuessJournal(scope,storage)).toBeNull();
 /** Real checkpoint policy admits the matching SDK draft before the new journal owns input. */
 const restoration=new GameSessionCheckpoints().update(loaded,saved);
 if(restoration?.kind!=='restore')throw new Error('Expected matching SDK restoration.');
 /** Reducer ownership closes startup restoration after recovering all typed letters. */
 const restored=gameSessionReducer(loaded,restoration.action);
 writer.checkpoint(scope,restored,null,restored);
 expect(restored.currentLetters).toEqual(['P','I','A','','']);
 expect(readPendingGuessJournal(scope,storage)).toMatchObject({draft:['P','I','A','',''],draftActiveSlotIndex:3,riddle:{revealedHints:[{index:0,letter:'P'}]}});
});


it.each(['classic','challenge'] as const)('preserves the other mode through passive %s edits and admits a new submission',gameMode=>{
 /** Concrete storage preserves the exact detached record across passive edits. */
 const values=new Map<string,string>();
 /** The real writer and validator share this account-scoped storage. */
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 /** One writer observes both modes within the same account and locale. */
 const scope='Alice:1:en',writer=createJournalWriter({storage,owner:'mode-tab',now:()=>1000,owns:candidate=>candidate===scope,
  operations:[readPendingGuessJournal,writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease]});
 /** Each direction starts with durable input owned by the opposite mode. */
 const otherMode=gameMode==='classic'?'challenge':'classic';
 /** The original issued question owns the saved CL draft. */
 let prior=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'prior-round',text:'Prior clue',answerLength:5,
  sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:otherMode,index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}});
 for(const letter of 'CL')prior=gameSessionReducer(prior,{type:'typeLetter',letter});
 if(!prior.riddle)throw new Error('Expected prior issued round.');
 /** This observed predecessor must survive typing in the displayed mode. */
 const retained=writer.create(prior,scope,prior.riddle,prior);
 expect(writer.write(retained)).toBe(true);expect(writer.read(scope)).not.toBeNull();
 /** Exact durable bytes catch replacement even when the new record is valid. */
 const bytes=storage.getItem('riddleQuest:pendingPlay:v1:'+scope);
 /** A separately issued question receives the user's new input. */
 let current=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'current-round',text:'Current clue',answerLength:5,
  sessionToken:'00000000-0000-4000-8000-000000000002',gameMode,index:2,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}});
 for(const letter of 'A')current=gameSessionReducer(current,{type:'typeLetter',letter});
 expect(writer.checkpoint(scope,current,null,current)).toBeNull();
 expect(storage.getItem('riddleQuest:pendingPlay:v1:'+scope)).toBe(bytes);
 for(const letter of 'PPLE')current=gameSessionReducer(current,{type:'typeLetter',letter});
 if(!current.riddle)throw new Error('Expected current issued round.');
 /** Deliberate answer delivery still replaces the detached mode's draft. */
 const submitted=writer.create(current,scope,current.riddle,current);
 submitted.queue.push({message:{type:'game:submitGuess',requestId:'current-mode-guess',payload:{riddleId:current.riddle.riddleId,
  sessionToken:current.riddle.sessionToken,gameMode,guess:'APPLE',requestId:'current-mode-guess'}},attempts:1,isCorrect:false,
  gameOver:false,canContinue:false,feedback:['red','red','red','red','red']});
 expect(writer.write(submitted)).toBe(true);
 expect(readPendingGuessJournal(scope,storage)).toMatchObject({riddle:{riddleId:'current-round',gameMode},queue:[{message:{requestId:'current-mode-guess'}}]});
});
