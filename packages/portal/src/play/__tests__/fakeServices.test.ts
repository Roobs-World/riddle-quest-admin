import {createFakeHostServices} from "../fakeServices";

describe("fake host services", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {setTimeout}});
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("supports the complete authenticated local gameplay flow", async () => {
    const services = createFakeHostServices();
    const snapshots: unknown[] = [];
    const unsubscribe = services.auth.subscribe((snapshot) => snapshots.push(snapshot));
    expect((await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 2})).riddleId)
      .toBe("classic-fake-2");
    expect((await services.loadRiddle({gameMode: "challenge", locale: "en"})).answer).toBe("echo");
    expect(await services.loadProfile("jest-guest")).toMatchObject({coins: 180});

    await expect(services.requestHint({riddleId: "unknown", gameMode: "classic", currentAttempt: []}))
      .resolves.toMatchObject({index: 0, coinsCost: 50, newCoins: 130});
    await expect(services.requestHint({
      riddleId: "classic-fake-1",
      gameMode: "classic",
      currentAttempt: ["P", "I", "A", "N", "O"],
    })).resolves.toBeNull();
    await expect(services.spendCoins({reason: "hint"})).resolves.toEqual({newCoins: 80});
    await expect(services.spendCoins({reason: "skip", gameMode: "challenge"})).rejects.toThrow(/cannot be skipped/i);

    await expect(services.completeGame({riddleId: "classic-fake-1", gameMode: "classic", attempts: 2, isCorrect: true}))
      .resolves.toMatchObject({coinsEarned: 50});
    await expect(services.skipRiddle({riddleId: "classic-fake-1", gameMode: "classic"}))
      .resolves.toMatchObject({success: true, costDeducted: 100});
    await expect(services.skipRiddle({riddleId: "daily-fake-1", gameMode: "challenge"}))
      .rejects.toThrow(/cannot be skipped/i);

    const product = services.products[0];
    await expect(services.requestPurchase(product.productId)).resolves.toMatchObject({success: true});
    await expect(services.requestPurchase("missing")).rejects.toThrow(/not found/i);
    await expect(services.updateUsername("New Solver")).resolves.toMatchObject({username: "New Solver"});
    await expect(services.updateAvatar("data:image/png;base64,YQ=="))
      .resolves.toMatchObject({avatarUrl: "data:image/png;base64,YQ=="});
    expect((await services.loadLeaderboard("xp"))[0].xp).toBeGreaterThan(0);
    expect((await services.loadLeaderboard("totalWins"))[0].totalWins).toBeGreaterThan(0);
    expect((await services.loadLeaderboard("bestStreak"))[0].bestStreak).toBeGreaterThan(0);
    expect(await services.getRaceAccess()).toMatchObject({enabled: true});
    expect(await services.recordRaceAnalytics({eventId: "event-0001", eventName: "race_mode_viewed", params: {}}))
      .toEqual({accepted: true});
    unsubscribe();
    expect(snapshots.length).toBeGreaterThan(1);
  });

  it("handles unauthenticated local state and insufficient currency", async () => {
    const services = createFakeHostServices({initiallyAuthenticated: false});
    expect(await services.loadProfile("guest")).toBeNull();
    await expect(services.spendCoins({reason: "continue"})).rejects.toThrow(/not enough coins/i);
    expect(await services.updateUsername("Nobody")).toBeNull();
  });
});
