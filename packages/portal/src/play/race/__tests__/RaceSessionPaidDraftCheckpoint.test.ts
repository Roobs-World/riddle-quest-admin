import {describe,expect,it} from "@jest/globals";
import {catalog,fixture,harness} from "./raceSession.support";
import {createFakeRaceServices} from "../testing/fakeRaceServices";

/** Supported public answer availability paths, independent of the canonical server deck. */
type Availability = "modern" | "prompt-only" | "answer-free";
/** Strips optional wire content while preserving the authority's independently owned content. */
const wire = <T extends {
  /** Authority-issued run with optional answer content. */
  run: Awaited<ReturnType<typeof fixture>>;
}>(response:T,mode:Availability):T => {
  /** Independent payload retained by rendering consumers. */
  const copy=structuredClone(response);
  if(mode!=="modern")delete copy.run.preloadedRiddles;
  if(mode==="answer-free"&&copy.run.currentRiddle)delete copy.run.currentRiddle.evaluation;
  return copy;
};
/** Establishes accepted history and an editable draft before a paid command. */
const withDraft = async (mode:Availability) => {
  /** One authority owns both initial and later command receipts. */
  const authority=createFakeRaceServices(),run=await fixture(false,authority),h=harness();
  h.respond("raceCategories",await catalog());h.session.begin("mixed");h.respond("raceStart",wire({run},mode));h.advance(3480);
  h.session.input("text","zzzzz");h.session.submit();
  h.respond("raceGuess",wire(await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle!.riddleId,guess:"zzzzz",requestId:"draft-history"}),mode));
  h.session.input("text","pi");h.session.input("slot",3);
  return {...h,authority,run};
};

describe("Race Session paid draft checkpoints",()=>{
  describe.each(["modern","prompt-only","answer-free"] as const)("%s",mode=>{
    it.each(["hint","skip"] as const)("restores the captured draft and history after rejected %s delivery",async operation=>{
      /** Retained UI references must not become the rollback source. */
      const h=await withDraft(mode),original=structuredClone(h.session.getSnapshot()),retained=h.session.getSnapshot();
      if(operation==="hint")h.session.hint();else h.session.skip();
      retained.currentLetters[0]="x";retained.raceGuesses[0].guess[0]="x";retained.raceGuesses[0].feedback[0]="green";
      h.reject(operation==="hint"?"raceHint":"raceSkip","RaceTo10.ERROR_GENERIC");
      expect(h.session.getSnapshot()).toMatchObject({error:"RaceTo10.ERROR_GENERIC",run:original.run,currentLetters:original.currentLetters,raceGuesses:original.raceGuesses,activeSlotIndex:3});
      h.session.retry();h.respond("raceResume",wire(await h.authority.resumeRace(h.run.runId),mode));
      expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:original.currentLetters,raceGuesses:original.raceGuesses,activeSlotIndex:3});
      expect(h.commands.filter(command=>command.type===(operation==="hint"?"game:requestRaceHint":"game:skipRaceRiddle"))).toHaveLength(1);
    });
    it("confirms a hint against privately captured draft letters, selection and history",async()=>{
      /** Input is locked during paid delivery, so the pre-command draft remains the player's intent. */
      const h=await withDraft(mode),history=structuredClone(h.session.getSnapshot().raceGuesses),retained=h.session.getSnapshot();h.session.hint();
      retained.currentLetters[1]="x";retained.raceGuesses[0].guess[0]="x";retained.raceGuesses[0].feedback[0]="green";
      h.session.getSnapshot().activeSlotIndex=4;
      h.respond("raceHint",wire(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"captured-hint"}),mode));
      expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","i","","",""],raceGuesses:history,activeSlotIndex:3});
    });
    it("accepts a genuine hint after retained public question identity edits",async()=>{
      /** Private command identity already targets the canonical question despite retained public edits. */
      const h=await withDraft(mode);h.session.hint();
      h.session.getSnapshot().run!.currentRiddle!.riddleId="edited-question";
      h.session.getSnapshot().run!.currentRiddle!.position=1;
      h.respond("raceHint",wire(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"private-question-hint"}),mode));
      expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","i","","",""],run:{currentRiddle:{riddleId:h.run.currentRiddle!.riddleId,position:0}}});
    });
    it("retains canonical hint behavior without consumer edits",async()=>{
      /** Successful hints merge only canonical reveals into the pre-command draft. */
      const h=await withDraft(mode);h.session.hint();
      h.respond("raceHint",wire(await h.authority.requestRaceHint({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"canonical-hint"}),mode));
      expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["p","i","","",""],activeSlotIndex:3});
    });
    it("clears the draft and history after canonical skip progression",async()=>{
      /** A successful skip always starts a fresh answer, independently of old draft references. */
      const h=await withDraft(mode);h.session.skip();
      h.respond("raceSkip",wire(await h.authority.skipRaceRiddle({runId:h.run.runId,riddleId:h.run.currentRiddle!.riddleId,requestId:"canonical-skip"}),mode));
      expect(h.session.getSnapshot()).toMatchObject({error:null,currentLetters:["","","","",""],raceGuesses:[],run:{currentRiddle:{position:1}}});
    });
  });
});
