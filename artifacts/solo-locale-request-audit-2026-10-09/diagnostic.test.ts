import {GameRequestHintMessageSchema, GameSubmitGuessMessageSchema} from '@qwordly/core/bridge';
import {GetHintRequestSchema} from '@qwordly/core/validation/requestSchemas';
import {createPendingPlayJournalStorage, pendingPlayScope, type PendingGuessJournal} from '../../packages/portal/src/play/pendingGuessJournal';
import {gameSessionReducer,createInitialGameSession} from '../../packages/portal/src/play/gameSession';
const riddle={riddleId:'classic-1',text:'A Turkish clue',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic' as const,evaluation:{answer:'izmir',locale:'tr'}};
const payload={riddleId:riddle.riddleId,gameMode:riddle.gameMode,sessionToken:riddle.sessionToken,requestId:'locale-hint-0001',currentAttempt:['İ','','','','']};
it('the actual Turkish preview creates the letter used by the following request',()=>{
 const loaded=gameSessionReducer({...createInitialGameSession(),locale:'tr'},{type:'loadRiddle',riddle});
 const hinted=gameSessionReducer(loaded,{type:'previewHint',index:0,letter:'i'});
 expect(hinted.currentLetters[0]).toBe('İ');
});
it('accepts that current attempt at the bridge boundary',()=>expect(GameRequestHintMessageSchema.safeParse({type:'game:requestHint',requestId:payload.requestId,payload}).success).toBe(true));
it('accepts that current attempt at the callable boundary',()=>expect(GetHintRequestSchema.safeParse(payload).success).toBe(true));
it('restores a durable hint with that exact current attempt',()=>{
 const values=new Map<string,string>();const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 const scope=pendingPlayScope('Alice',1,'tr');
 const base=createInitialGameSession();
 const journal={version:1,scope,confirmedClassicIndex:1,riddle,base,successors:[],queue:[],draft:payload.currentAttempt,coinAction:{type:'game:requestHint',requestId:payload.requestId,payload}} as PendingGuessJournal;
 expect(storage.write({...journal,coinAction:{...journal.coinAction!,payload:{...payload,currentAttempt:['I','','','','']}}} as PendingGuessJournal)).toBe(true);expect(storage.read(scope)).not.toBeNull();expect(storage.write(journal)).toBe(true);expect(storage.read(scope)?.coinAction).toEqual(journal.coinAction);
});
it('accepts the locale-correct completed word at the bridge',()=>expect(GameSubmitGuessMessageSchema.safeParse({type:'game:submitGuess',requestId:'locale-guess-0001',payload:{riddleId:riddle.riddleId,gameMode:riddle.gameMode,sessionToken:riddle.sessionToken,requestId:'locale-guess-0001',guess:'İZMİR'}}).success).toBe(true));

it('identical ASCII requests pass both boundaries',()=>{const ascii={...payload,currentAttempt:['I','','','','']};expect(GameRequestHintMessageSchema.safeParse({type:'game:requestHint',requestId:ascii.requestId,payload:ascii}).success).toBe(true);expect(GetHintRequestSchema.safeParse(ascii).success).toBe(true);});
