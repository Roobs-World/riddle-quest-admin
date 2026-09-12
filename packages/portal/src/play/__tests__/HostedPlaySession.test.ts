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
