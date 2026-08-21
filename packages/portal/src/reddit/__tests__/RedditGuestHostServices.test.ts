import {createRedditGuestHostServices} from "../RedditGuestHostServices";

it("plays classic riddles locally without gateway calls or economic rewards", async () => {
  global.fetch = jest.fn();
  const services = createRedditGuestHostServices();
  const snapshots: unknown[] = [];
  services.auth.subscribe((snapshot) => snapshots.push(snapshot));
  const riddle = await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1});
  await expect(services.submitGuess({
    riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
    guess: "piano", requestId: "guest-guess",
  })).resolves.toMatchObject({isCorrect: true, gameOver: true});
  await expect(services.completeGame({
    riddleId: riddle.riddleId, gameMode: "classic", sessionToken: riddle.sessionToken,
  })).resolves.toMatchObject({coinsEarned: 0, newXp: 0, rewardBreakdown: {newBalance: 0, totalAwarded: 0}});
  expect(snapshots.at(-1)).toMatchObject({profile: {coins: 0, xp: 0, wins: 1, classicIndex: 2}});
  expect(global.fetch).not.toHaveBeenCalled();
});

it("fails closed for economic, daily, identity, and social capabilities", async () => {
  const services = createRedditGuestHostServices();
  expect(services.products).toEqual([]);
  await expect(services.loadRiddle({gameMode: "challenge", locale: "en"})).rejects.toThrow("reddit-login-required");
  await expect(services.requestPurchase("coins")).rejects.toThrow("reddit-login-required");
  await expect(services.requestHint({} as never)).rejects.toThrow("reddit-login-required");
  await expect(services.startRace({} as never)).rejects.toThrow("reddit-login-required");
  await expect(services.updateUsername("forged")).rejects.toThrow("reddit-login-required");
});

it("restores only bounded non-economic guest progression", async () => {
  const services = createRedditGuestHostServices({
    username: "Forged", coins: 99_999, level: 99, xp: 99_999, winStreak: 99,
    gamesPlayed: 4, wins: 3, achievements: ["forged"], classicIndex: 2,
  });
  await expect(services.loadProfile("reddit-guest")).resolves.toMatchObject({
    username: "Guest Solver", coins: 0, level: 1, xp: 0, winStreak: 0,
    gamesPlayed: 4, wins: 3, achievements: [], classicIndex: 2,
  });
});
