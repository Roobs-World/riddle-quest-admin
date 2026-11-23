import assert from "node:assert/strict";

/** Injects proposed ownership/history wiring only into local verification bundles. */
export const createRaceHistoryPrototypePlugin = () => ({name:'prototype-owned-history-integration',enforce:'pre',transform(code,id){
  if(id.endsWith('/play/race/hooks/useRaceSession.ts')){
   assert(code.includes('const session = sessionRef.current;'));
   return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};
  }
  if(id.endsWith('/play/race/RaceSession.ts')){
   if(code.includes('run => this.authority.previewHistory(run)')){assert(code.includes('run: this.authority.confirmRun(patch.run, receivedAt)'));return null;}
   assert(code.includes('this.authority.outcome, current);'));
   assert(code.includes('this.authority.confirmRun(patch.run, receivedAt);'));
   code=code.replace('this.authority.outcome, current);','this.authority.outcome, current, run => this.authority.previewHistory(run));');
   code=code.replace('this.authority.confirmRun(patch.run, receivedAt);','patch = {...patch, run: this.authority.acceptHistory(patch.run)};this.authority.confirmRun(patch.run, receivedAt);');
   return {code,map:null};
  }
  if(id.endsWith('/play/race/RaceOwnedAuthority.ts')){
   if(code.includes('private readonly history = new RaceConfirmedHistory();')){assert(code.includes('this.history.reset();'));return null;}
   assert(code.includes('private receipt = 0;'));assert(code.includes('reset(): void {'));
   code='import {RaceConfirmedHistory} from "./logic/raceConfirmedHistory";\n'+code;
   code=code.replace('private receipt = 0;','private receipt = 0;\n private history = new RaceConfirmedHistory();\n previewHistory(run: RaceRunView): RaceRunView {return this.history.preview(run); }\n acceptHistory(run: RaceRunView): RaceRunView {return this.history.accept(run); }');
   code=code.replace('reset(): void {','reset(): void {this.history.reset();');
   return {code,map:null};
  }
  if(id.endsWith('/play/race/RaceSessionAuthority.ts')){
   if(code.includes('history: (run: RaceRunView) => RaceRunView')){assert(code.includes('return history(raceSnapshot(run, previous));'));return null;}
   const signature='current: () => boolean = () => true): Partial<RaceSessionState>';
   assert(code.includes(signature));assert(code.includes('return raceSnapshot(run, previous);'));
   assert(code.includes('const run = raceSnapshot(RaceRunResponseSchema.parse(data).run);'));
   code=code.replace(signature,'current: () => boolean = () => true, history: (run: RaceRunView) => RaceRunView = run => run): Partial<RaceSessionState>');
   code=code.replace('return raceSnapshot(run, previous);','return history(raceSnapshot(run, previous));');
   code=code.replace('const run = raceSnapshot(RaceRunResponseSchema.parse(data).run);','const run = history(raceSnapshot(RaceRunResponseSchema.parse(data).run));');
   return {code,map:null};
  }
  return null;
 }});
