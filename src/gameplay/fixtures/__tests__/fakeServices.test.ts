import {createFakeHostServices} from "../fakeServices";

describe("fake host services", () => {
  /** Provides classic session token behavior. */
  const classicSessionToken = "00000000-0000-4000-8000-000000000001";
  /** Provides daily session token behavior. */
  const dailySessionToken = "00000000-0000-4000-8000-000000000003";

  beforeAll(() => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {setTimeout}});
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("supports the complete authenticated local gameplay flow", async () => {
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Provides snapshots behavior. */
    const snapshots: unknown[] = [];
    /** Provides unsubscribe behavior. */
    const unsubscribe = services.auth.subscribe((snapshot) => snapshots.push(snapshot));
    expect((await services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 2})).riddleId).toBe(
      "classic-fake-2",
    );
    expect(await services.loadRiddle({gameMode: "challenge", locale: "en"})).toMatchObject({
      riddleId: "daily-fake-1",
      answerLength: 4,
    });
    expect(await services.loadRiddle({gameMode: "challenge", locale: "en"})).not.toHaveProperty("answer");
    expect(await services.loadProfile("jest-guest")).toMatchObject({coins: 300});

    await expect(
      services.requestHint({
        riddleId: "unknown",
        gameMode: "classic",
        sessionToken: classicSessionToken,
        requestId: "hint-request-1",
        currentAttempt: [],
      }),
    ).resolves.toMatchObject({index: 0, coinsCost: 25, newCoins: 275});
    await expect(
      services.requestHint({
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: classicSessionToken,
        requestId: "hint-request-2",
        currentAttempt: ["P", "I", "A", "N", "O"],
      }),
    ).resolves.toBeNull();
    await expect(
      services.spendCoins({
        reason: "continue",
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: classicSessionToken,
        requestId: "continue-request-1",
        amount: 50,
      }),
    ).resolves.toEqual({newCoins: 225});
    await expect(
      services.spendCoins({
        reason: "continue",
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: classicSessionToken,
        requestId: "continue-request-wrong-cost",
        amount: 99,
      }),
    ).rejects.toThrow(/costs 50 coins/i);

    await services.submitGuess({
      riddleId: "classic-fake-1",
      gameMode: "classic",
      sessionToken: classicSessionToken,
      guess: "piano",
      requestId: "guess-request-1",
    });
    await expect(
      services.completeGame({
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: classicSessionToken,
      }),
    ).resolves.toMatchObject({coinsEarned: 25});
    /** Provides enough coins for the now more expensive skip action. */
    const product = services.products[0];
    await expect(services.requestPurchase(product.productId)).resolves.toMatchObject({success: true});
    await expect(
      services.skipRiddle({
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: classicSessionToken,
        requestId: "skip-request-1",
      }),
    ).resolves.toMatchObject({success: true, costDeducted: 100});
    await expect(
      services.skipRiddle({
        riddleId: "daily-fake-1",
        gameMode: "challenge",
        sessionToken: dailySessionToken,
        requestId: "skip-request-2",
      }),
    ).rejects.toThrow(/cannot be skipped/i);

    await expect(services.requestPurchase("missing")).rejects.toThrow(/not found/i);
    await expect(services.updateUsername("New Solver")).resolves.toMatchObject({username: "New Solver"});
    await expect(services.updateAvatar("data:image/png;base64,YQ==")).resolves.toMatchObject({
      avatarUrl: "data:image/png;base64,YQ==",
    });
    expect((await services.loadLeaderboard("xp")).entries[0].xp).toBeGreaterThan(0);
    expect((await services.loadLeaderboard("totalWins")).entries[0].totalWins).toBeGreaterThan(0);
    expect((await services.loadLeaderboard("bestStreak")).entries[0].bestStreak).toBeGreaterThan(0);
    expect(await services.getRaceAccess()).toMatchObject({enabled: true});
    expect(
      await services.recordRaceAnalytics({eventId: "event-0001", eventName: "race_mode_viewed", params: {}}),
    ).toEqual({accepted: true});
    unsubscribe();
    expect(snapshots.length).toBeGreaterThan(1);
  });

  it("handles unauthenticated local state and insufficient currency", async () => {
    /** Provides services behavior. */
    const services = createFakeHostServices({initiallyAuthenticated: false});
    expect(await services.loadProfile("guest")).toBeNull();
    await expect(
      services.spendCoins({
        reason: "continue",
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: classicSessionToken,
        requestId: "continue-request-2",
      }),
    ).rejects.toThrow(/not enough coins/i);
    expect(await services.updateUsername("Nobody")).toBeNull();
  });

  it("models completed Daily before unavailable content for Classic-only browser scenarios", async () => {
    /** Trusted fake authority reproduces the production request contract. */
    const services = createFakeHostServices({dailyCompleted: true, dailyUnavailable: true});
    await expect(services.loadRiddle({gameMode: "challenge", locale: "en"})).rejects.toMatchObject({code: "daily-completed"});
    await expect(services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 1})).resolves.toMatchObject({gameMode: "classic", riddleId: "classic-fake-1"});
  });
});
