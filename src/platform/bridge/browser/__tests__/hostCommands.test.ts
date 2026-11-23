import {describe, expect, it, jest} from "@jest/globals";
import {createHostedPlayCommandModule} from "../hostMessageHandlers";
import {createFakeHostServices} from "../../../../gameplay/fixtures/fakeServices";
import {createHostAuthorityModules} from "../../../../app/session/HostAuthorityModules";

describe("hosted-play command module", () => {
  it("parses and executes a command through one interface", async () => {
    /** Sets frame ready. */
    const setFrameReady = jest.fn((_ready: boolean) => undefined);
    /** Provides post operation behavior. */
    const postOperation = jest.fn(() => undefined);
    /** Provides services behavior. */
    const services = createFakeHostServices();
    /** Provides commands behavior. */
    const commands = createHostedPlayCommandModule({
      authSnapshot: {user: null, profile: null},
      gameMode: "classic",
      locale: "en",
      loadedUserIdRef: {current: null},
      playableReportedRef: {current: false},
      accountDeletionCompletedRef: {current: false},
      setFrameReady,
      setNotice: () => undefined,
      sendInit: () => undefined,
      loadAndPostRiddle: async () => false,
      postOperation,
      authority: createHostAuthorityModules(services, undefined),
      runRaceOperation: async (_requestId, _operation, action) => void (await action()),
      withServerActivity: async (operation) => operation(),
      applyPurchaseBalance: () => undefined,
      syncRaceAchievementProgress: async () => undefined,
      persistAchievementProjection: () => undefined,
    });

    /** Provides message behavior. */
    const message = await commands.execute({
      type: "game:ready",
      requestId: "ready-1",
      payload: {protocolVersion: 1, surface: "html5"},
    });

    expect(message.type).toBe("game:ready");
    expect(setFrameReady).toHaveBeenCalledWith(true);

    await commands.execute({
      type: "game:requestHint",
      requestId: "hint-1",
      payload: {
        riddleId: "classic-fake-1",
        gameMode: "classic",
        sessionToken: "00000000-0000-4000-8000-000000000001",
        requestId: "hint-operation-1",
        currentAttempt: ["", "", "", "", ""],
      },
    });
    expect(postOperation).toHaveBeenLastCalledWith("hint-1", "hint", true, expect.anything());
  });
});
