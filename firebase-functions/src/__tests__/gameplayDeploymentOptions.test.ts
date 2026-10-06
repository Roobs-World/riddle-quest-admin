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

it("keeps live transport warm in both supported regions", () => {
  for (const callable of [joinLiveRace, updateLiveRace]) {
    expect(callable.__endpoint.region).toEqual(["us-central1", "europe-west1"]);
    expect(callable.__endpoint.minInstances).toBe(1);
  }
});

it("keeps the single-player question, guess and completion path warm", () => {
  for (const callable of [getCurrentDailyChallenge, getClassicRiddleBuffer, completeGame, submitSinglePlayerGuess]) {
    expect(callable.__endpoint.minInstances).toBe(1);
  }
});

it("lets lower-frequency single-player actions scale to zero", () => {
  for (const callable of [getCurrentClassicRiddle, getHint, spendCoins, skipRiddle]) {
    expect(callable.__endpoint.minInstances).not.toBe(1);
  }
});

it("keeps the shared Reddit gameplay gateway warm", () => {
  expect(redditGameplay.__endpoint.minInstances).toBe(1);
});
