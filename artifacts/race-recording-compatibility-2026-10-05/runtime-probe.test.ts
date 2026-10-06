import {resolveChallengeRiddles, type RaceChallengeRecord} from "../../firebase-functions/src/race/raceSetupService";
import {raceDeckContentVersion, validateRaceDeckSnapshot} from "../../firebase-functions/src/race/raceDeckSnapshot";
import {liveRun} from "../../firebase-functions/src/race/raceLiveState";
import {applyRaceGuess} from "../../firebase-functions/src/race/raceEngine";
it("reproduces a hash-consistent frozen recording whose padded answer cannot be guessed", async () => {
 const riddles=Array.from({length:15},(_,position)=>({riddleId:`recorded-${position}`,canonicalRiddleId:`history:${position}`,text:`Original clue ${position}`,answer:position===0?" cat ":"piano",position}));
 const canonicalRiddleIds=riddles.map(r=>r.canonicalRiddleId),contentVersion=raceDeckContentVersion(riddles);
 expect(validateRaceDeckSnapshot(riddles,canonicalRiddleIds,contentVersion)).toEqual(riddles);
 const challenge={locale:"en",riddles,canonicalRiddleIds,contentVersion,snapshotVersion:1} as RaceChallengeRecord;
 const resolved=await resolveChallengeRiddles({} as FirebaseFirestore.Firestore,"en",challenge);expect(resolved).toEqual(riddles);
 const run=liveRun({riddles:resolved,locale:"en",categoryId:"history",contentVersion},"viewer","recording-probe",1000);
 expect(()=>applyRaceGuess(run,{riddleId:resolved[0].riddleId,guess:"cat"},2000)).toThrow("exactly 5 characters");
 console.info(JSON.stringify({hashConsistent:true,archiveResolved:true,storedAnswerUnits:5,normalGuessUnits:3,engineGuess:"rejected"}));
});
