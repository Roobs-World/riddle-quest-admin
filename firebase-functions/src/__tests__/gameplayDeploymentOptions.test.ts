import {getCurrentClassicRiddle, getCurrentDailyChallenge} from "../daily/dailyChallenge";
import {getClassicRiddleBuffer} from "../daily/classicRiddleBuffer";
import {completeGame} from "../gameplay/completeGameCallable";
import {submitSinglePlayerGuess} from "../gameplay/submitSinglePlayerGuessCallable";
import {getHint, spendCoins, skipRiddle} from "../gameplay/gameLogic";
import {joinLiveRace, updateLiveRace} from "../race/raceLiveCallables";

it("declares database-adjacent gameplay alongside existing client endpoints", () => {
  for (const callable of [getCurrentClassicRiddle, getCurrentDailyChallenge, getClassicRiddleBuffer,
    completeGame, submitSinglePlayerGuess, getHint, spendCoins, skipRiddle]) {
    expect(callable.__endpoint.region).toEqual(["us-central1", "europe-west1"]);
  }
});

it("keeps live transport warm in both supported regions", () => {
  for (const callable of [joinLiveRace, updateLiveRace]) {
    expect(callable.__endpoint.region).toEqual(["us-central1", "europe-west1"]);
    expect(callable.__endpoint.minInstances).toBe(1);
  }
});
