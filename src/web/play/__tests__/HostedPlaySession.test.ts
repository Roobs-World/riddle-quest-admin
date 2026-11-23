import {describe, expect, it} from "@jest/globals";
import {createFakeHostServices} from "../fakeServices";
import {createHostedPlaySession} from "../HostedPlaySession";

describe("hosted-play session assembly", () => {
  it("concentrates target defaults behind one session interface", () => {
    /** Provides session behavior. */
    const session = createHostedPlaySession({hostServices: createFakeHostServices()});

    expect(session.initialGameMode).toBe("classic");
    expect(session.externalInteractionBlocked).toBe(false);
    expect(session.raceLocalePolicy).toBe("english-only");
    expect(session.authority.gameplay).toBeDefined();
    expect(session.authority.leaderboard).toBeDefined();
    expect(session.authority.commerce).toBeUndefined();
  });

  it("exposes target-owned backend race authority independently of provider capabilities", () => {
    /** Provides session behavior. */
    const session = createHostedPlaySession({hostServices: createFakeHostServices(), raceAvailable: true});

    expect(session.authority.race).toBeDefined();
    expect(session.platformCapabilities).toBeUndefined();
  });
});

it("rechecks the current target gate before prepared questions can be consumed", () => {
  /** Cross-tab retirement changes admission without rebuilding the host session. */
  let open = true;
  /** Stable gate preserves normal authority coordination and synchronous revocation. */
  const gate = {isOpen: () => open, run: async <T>(operation: () => Promise<T>) => operation(),
    runExclusive: async (operation: () => Promise<void>) => operation()};
  /** Target session exposes only its own gate's current admission. */
  const session = createHostedPlaySession({hostServices: createFakeHostServices(), accountDeletionServiceGate: gate});
  expect(session.canUsePreparedQuestions?.()).toBe(true); open = false;
  expect(session.canUsePreparedQuestions?.()).toBe(false);
});
it("disables prepared consumption when a target gate has no synchronous admission contract", () => {
  /** Unknown admission cannot be bypassed using a previously issued local question. */
  const gate = {run: async <T>(operation: () => Promise<T>) => operation(),
    runExclusive: async (operation: () => Promise<void>) => operation()};
  /** Ordinary calls remain coordinated, while the optional optimization stays disabled. */
  const session = createHostedPlaySession({hostServices: createFakeHostServices(), accountDeletionServiceGate: gate});
  expect(session.canUsePreparedQuestions?.()).toBe(false);
});
it("preserves gameplay and admission identity while applying the latest commerce callback", async () => {
  /** Catalog saves and checkout callbacks can change without replacing the content provider. */
  const hostServices = createFakeHostServices();
  /** First target checkout belongs to the first commerce presentation. */
  const first = createHostedPlaySession({hostServices, platformPurchase: async productId => ({success: false, productId})});
  /** A refreshed callback must be used for purchases while prepared gameplay remains owned. */
  const second = createHostedPlaySession({hostServices, platformPurchase: async productId => ({success: true, productId})});
  expect(second.authority.gameplay).toBe(first.authority.gameplay);
  expect(second.authority.identity).toBe(first.authority.identity);
  expect(second.canUsePreparedQuestions).toBe(first.canUsePreparedQuestions);
  expect(await first.authority.commerce!.requestPurchase("coins")).toMatchObject({success: false});
  expect(await second.authority.commerce!.requestPurchase("coins")).toMatchObject({success: true});
});
it("reuses the current assembly and preserves live gameplay when older commerce inputs return", async () => {
  /** Long-lived provider and gate remain shared across catalog and callback refreshes. */
  const hostServices = createFakeHostServices();
  /** First commerce callback remains owned by any caller keeping that session. */
  const firstInput = {hostServices, platformPurchase: async (productId: string) => ({success: false, productId})};
  /** Explicitly held older session survives replacement of the current cached commerce view. */
  const first = createHostedPlaySession(firstInput);
  /** A new checkout view must become the current assembly. */
  const currentInput = {hostServices, platformPurchase: async (productId: string) => ({success: true, productId})};
  /** Reusing identical current inputs keeps authority identities unchanged. */
  const current = createHostedPlaySession(currentInput);
  expect(createHostedPlaySession(currentInput).authority).toBe(current.authority);
  /** Returning to older metadata may rebuild commerce but must not replace active gameplay. */
  const restored = createHostedPlaySession(firstInput);
  expect(restored.authority.gameplay).toBe(first.authority.gameplay);
  expect(restored.canUsePreparedQuestions).toBe(first.canUsePreparedQuestions);
  expect(await current.authority.commerce!.requestPurchase("coins")).toMatchObject({success: true});
  expect(await first.authority.commerce!.requestPurchase("coins")).toMatchObject({success: false});
  expect(await restored.authority.commerce!.requestPurchase("coins")).toMatchObject({success: false});
});
it("keeps a retained caller bound to its original deletion gate after cache replacement", async () => {
  /** Gate admission is local to its own provider lifetime even when another gate becomes current. */
  const createGate = () => ({open: true,
    /** Synchronous prepared-content admission follows this exact gate. */
    isOpen() {return this.open;},
    /** Every retained service call rechecks its own gate rather than the current cache entry. */
    async run<T>(operation: () => Promise<T>) {if (!this.open) throw new Error("closed"); return operation();},
    /** Exclusive retirement closes only this provider lifetime. */
    async runExclusive(operation: () => Promise<void>) {this.open = false; return operation();}});
  /** Both target visits use the same provider without sharing deletion admission. */
  const hostServices = createFakeHostServices(), oldGate = createGate(), currentGate = createGate();
  /** Older checkout view is kept by a caller while a new target lifetime is assembled. */
  const old = createHostedPlaySession({hostServices, accountDeletionServiceGate: oldGate,
    platformPurchase: async productId => ({success: false, productId})});
  /** Current target lifetime continues to own its own guarded provider operations. */
  const current = createHostedPlaySession({hostServices, accountDeletionServiceGate: currentGate,
    platformPurchase: async productId => ({success: true, productId})});
  oldGate.open = false;
  expect(old.canUsePreparedQuestions?.()).toBe(false); expect(current.canUsePreparedQuestions?.()).toBe(true);
  await expect(old.authority.commerce!.requestPurchase("coins")).rejects.toThrow("closed");
  await expect(old.authority.gameplay.loadRiddle({gameMode: "classic", locale: "en"})).rejects.toThrow("closed");
  expect(await current.authority.commerce!.requestPurchase("coins")).toMatchObject({success: true});
  expect(await current.authority.gameplay.loadRiddle({gameMode: "classic", locale: "en"})).toMatchObject({gameMode: "classic", index: 1});
});
