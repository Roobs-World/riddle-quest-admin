import {expect,it} from '@jest/globals';
import {createJournalWriter} from '../journalWriter';
import {writePendingGuessJournal,acquirePendingPlayLease,releasePendingPlayLease,type PendingGuessJournal} from "../pendingGuessJournal";
import {createPendingPlayJournalStorage,readPendingGuessJournal} from "../pendingPlayJournalDiagnostics";
import {createInitialGameSession,gameSessionReducer} from '../gameSession';

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
