import type {PendingGuessJournal,PendingPlayStorage} from './pendingGuessJournal';
import {preferProviderDraft} from './draftCheckpointReconciliation';
import type {JournalOperations} from './paidSettlement';
import type {BridgeRiddle} from '@riddle-quest/core/bridge';
import type {GameSessionState,PendingGuessState} from './gameSessionTypes';

/** Retains only confirmed purchased hint presentation alongside its issued question. */
const withHints=(state:GameSessionState,riddle:BridgeRiddle):BridgeRiddle=>({...riddle,
 revealedHints:state.hintRevealedIndices.map(index=>({index,letter:state.currentLetters[index]??''}))});

/** One mounted owner observes immutable storage bytes independently of other readers. */
export function createJournalWriter(options:{
 /** Concrete target-owned browser storage. */ storage:PendingPlayStorage;
 /** Existing journal validation and lease operations. */ operations:JournalOperations;
 /** Durable lease identity of this mounted owner. */ owner:string;
 /** Current lease clock. */ now:()=>number;
 /** Render and commit ownership must still admit this account. */ owns:(scope:string)=>boolean;
 /** One hook retains predecessor bytes across replacement commit lifetimes. */ observed?:Map<string,string|null>;
}){
 /** Scope-specific predecessor bytes cannot change when an in-memory draft is mutated. */
 const observed=options.observed??new Map<string,string|null>();
 /** Shared durable key format remains account/generation/locale scoped. */
 const key=(scope:string)=>`riddleQuest:pendingPlay:v1:${scope}`;
 /** Every mutation requires an unchanged predecessor before and after acquiring the lease. */
 const admit=(scope:string)=>{
  if(!options.owns(scope))return false;
  /** A new journal can start only in an empty store if it was never read. */
  const expected=observed.has(scope)?observed.get(scope):null;
  if(options.storage.getItem(key(scope))!==expected)return false;
  return options.operations[2](scope,options.owner,options.now(),options.storage)&&
   options.owns(scope)&&options.storage.getItem(key(scope))===expected;
 };
 /** One admitted writer owns pending requests and confirmed draft-only transitions. */
 const writer={
  /** Recovery comparison loads with the first journal rather than initial resources. */
  prefersProviderDraft:preferProviderDraft,
  /** Creates one shared snapshot shape for draft, guess and paid-action admission. */
  create:(state:GameSessionState,scope:string,riddle:BridgeRiddle,base:PendingGuessState):PendingGuessJournal=>({
   version:1,scope,riddle:withHints(state,riddle),confirmedClassicIndex:state.profile?.classicIndex??1,
   base,successors:[],queue:[],draft:[...state.currentLetters],draftActiveSlotIndex:state.activeSlotIndex,draftRevision:state.draftRevision,
  }),
  /** Records the exact bytes that were validated, without a second live read. */
  read:(scope:string):PendingGuessJournal|null=>{
   try{
    if(!options.owns(scope))return null;
    /** A captured read cannot adopt a different record halfway through validation. */
    const raw=options.storage.getItem(key(scope));
    /** Validation reads the captured journal; unrelated storage remains target-owned. */
    const journal=options.operations[0](scope,{...options.storage,getItem:name=>name===key(scope)?raw:options.storage.getItem(name)});
    observed.set(scope,raw);return journal;
   }catch{observed.delete(scope);return null;}
  },
  /** Persists only a still-owned successor of this writer's observed predecessor. */
  write:(journal:PendingGuessJournal,skipUnchanged=false):boolean=>{
   try{
    /** Serialization freezes the requested transition before touching shared storage. */
    const payload=JSON.stringify(journal),scope=journal.scope;
    if(!options.owns(scope))return false;
    if(skipUnchanged&&observed.get(scope)===payload&&options.storage.getItem(key(scope))===payload)return true;
    if(!admit(scope))return false;
    options.storage.setItem(key(scope),payload);
    observed.set(scope,payload);
    if(options.storage.getItem(key(scope))!==payload)return false;
    observed.set(scope,payload);return true;
   }catch{return false;}
  },
  /** Deletes only the exact observed journal while the current owner holds its lease. */
  clear:(scope:string):boolean=>{
   try{
    if(!admit(scope))return false;
    options.storage.removeItem(key(scope));
    observed.set(scope,null);
    if(options.storage.getItem(key(scope))!==null)return false;
    observed.set(scope,null);return true;
   }catch{return false;}
  },
  /** Persists committed input through the same ownership and predecessor guards as pending deliveries. */
  checkpoint:(scope:string,state:GameSessionState,journal:PendingGuessJournal|null,base:PendingGuessState):PendingGuessJournal|null=>{
   if(!state.riddle)return journal;
   /** Speculative hints, Continue and guesses cannot become a confirmed baseline. */
   const confirmed=!state.guessPending&&!state.pendingGuessState&&!state.pendingHintState&&!state.pendingCoinSpend;
   if(!journal&&confirmed&&!state.canRestoreCheckpoint&&!state.lastOutcome&&state.engineSnapshot?.gameOver===false&&state.currentLetters.some(Boolean)){
    /** Detached durable work belongs to its original mode until an explicit operation replaces it. */
    if(observed.has(scope)&&observed.get(scope)!==null)return null;
    /** Publication follows successful synchronous durability, never an attempted write. */
    const candidate=writer.create(state,scope,state.riddle,{...base,modal:null});
    if(!writer.write(candidate))return null;
    journal=candidate;
   }
   if(!journal||journal.scope!==scope)return journal;
   if(confirmed&&!journal.queue.length&&!journal.coinAction&&!journal.successors.length&&
    journal.riddle.sessionToken===state.riddle.sessionToken&&journal.riddle.riddleId===state.riddle.riddleId&&journal.riddle.gameMode===state.riddle.gameMode){
    if(state.lastOutcome||state.engineSnapshot?.gameOver){
     if(writer.clear(scope)){options.operations[3](scope,options.owner,options.storage);return null;}
     return journal;
    }
    journal.base={...base,modal:null};journal.riddle=withHints(state,state.riddle);
   }
   /** Root and buffered successor input retain their independently issued question identity. */
   const sessionToken=state.riddle.sessionToken;
   /** Only the matching segment receives the committed draft and selection. */
   const segment=journal.riddle.sessionToken===sessionToken?journal:journal.successors.find(item=>item.riddle.sessionToken===sessionToken);
   if(!segment)return journal;
   /** Exact unchanged bytes still pass through the guarded writer's duplicate suppression. */
   const unchanged=segment.draftActiveSlotIndex===state.activeSlotIndex&&segment.draft.length===state.currentLetters.length&&segment.draft.every((letter,index)=>letter===state.currentLetters[index]);
   segment.draft=[...state.currentLetters];segment.draftActiveSlotIndex=state.activeSlotIndex;segment.draftRevision=state.draftRevision;
   writer.write(journal,unchanged);return journal;
  },
  /** A separately guarded receipt transition may advance this cursor only to its actual saved result. */
  acknowledge:(scope:string,journal:PendingGuessJournal|null):boolean=>{
   try{
    if(!options.owns(scope)||journal&&journal.scope!==scope)return false;
    /** Replaced records must never silently become the predecessor of an old cached journal. */
    const payload=journal?JSON.stringify(journal):null;
    if(options.storage.getItem(key(scope))!==payload)return false;
    observed.set(scope,payload);return true;
   }catch{return false;}
  },
 };
 return writer;
}
