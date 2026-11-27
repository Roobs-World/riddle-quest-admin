import {describe, expect, it} from "@jest/globals";
import {createRedditGuestHostServices} from "../../../../platforms/web/reddit/src/RedditGuestHostServices";
import {createHostAuthorityModules} from "../HostAuthorityModules";
import {createFakeHostServices} from "../../../gameplay/fixtures/fakeServices";

describe("host authority modules", () => {
  it("permits Facebook username and deletion without platform upgrade, but denies avatar uploads", () => {
    /** Fake services used to exercise target authority selection. */
    const services = createFakeHostServices();
    /** Authority granted without a platform registration capability. */
    const modules = createHostAuthorityModules(services, {
      accountManagement: {username: true, avatar: false, deletion: true},
    });
    expect(modules.account?.updateUsername).toBe(services.updateUsername);
    expect(modules.account?.deleteAccount).toBe(services.deleteAccount);
    expect(modules.account?.updateAvatar).toBeUndefined();
  });
  it("represents Reddit guest Capability Gaps as absent modules", () => {
    /** Provides modules behavior. */
    const modules = createHostAuthorityModules(createRedditGuestHostServices(), {}, false, false);

    expect(modules.gameplay).toBeDefined();
    expect(modules.leaderboard).toBeDefined();
    expect(modules.commerce).toBeUndefined();
    expect(modules.economy).toBeUndefined();
    expect(modules.race).toBeUndefined();
    expect(modules.account).toBeUndefined();
  });
});
