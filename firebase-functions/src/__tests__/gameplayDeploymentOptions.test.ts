import {getCurrentClassicRiddle, getCurrentDailyChallenge} from "../daily/dailyChallenge";
import {getClassicRiddleBuffer} from "../daily/classicRiddleBuffer";
import {completeGame} from "../gameplay/completeGameCallable";
import {submitSinglePlayerGuess} from "../gameplay/submitSinglePlayerGuessCallable";
import {getHint, spendCoins, skipRiddle} from "../gameplay/gameLogic";
import {joinLiveRace, updateLiveRace} from "../race/raceLiveCallables";
import {redditGameplay} from "../reddit/redditGameplayEndpoint";

it("declares database-adjacent gameplay alongside existing client endpoints", () => {
  for (const callable of [getCurrentClassicRiddle, getCurrentDailyChallenge, getClassicRiddleBuffer,
    completeGame, submitSinglePlayerGuess, getHint, spendCoins, skipRiddle]) {
    expect(callable.__endpoint.region).toEqual(["us-central1", "europe-west1"]);
  }
});

it("lets live transport scale to zero in both supported regions", () => {
  for (const callable of [joinLiveRace, updateLiveRace]) {
    expect(callable.__endpoint.region).toEqual(["us-central1", "europe-west1"]);
    expect(callable.__endpoint.minInstances).toBe(0);
  }
});

it("lets the single-player question, guess, hint and completion path scale to zero", () => {
  for (const callable of [getCurrentDailyChallenge, getClassicRiddleBuffer, completeGame, submitSinglePlayerGuess, getHint]) {
    expect(callable.__endpoint.minInstances).toBe(0);
  }
});

it("lets lower-frequency single-player actions scale to zero", () => {
  for (const callable of [getCurrentClassicRiddle, spendCoins, skipRiddle]) {
    expect(callable.__endpoint.minInstances).not.toBe(1);
  }
});

it("lets the shared Reddit gameplay gateway scale to zero", () => {
  expect(redditGameplay.__endpoint.minInstances).toBe(0);
});
