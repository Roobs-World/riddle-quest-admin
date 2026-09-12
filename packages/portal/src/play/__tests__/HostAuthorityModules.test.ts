import {describe, expect, it} from "@jest/globals";
import {createRedditGuestHostServices} from "../../reddit/RedditGuestHostServices";
import {createHostAuthorityModules} from "../HostAuthorityModules";

describe("host authority modules", () => {
  it("represents Reddit guest Capability Gaps as absent modules", () => {
    /** Provides modules behavior. */
    const modules = createHostAuthorityModules(createRedditGuestHostServices(), {}, false, false);

    expect(modules.gameplay).toBeDefined();
    expect(modules.commerce).toBeUndefined();
    expect(modules.economy).toBeUndefined();
    expect(modules.race).toBeUndefined();
    expect(modules.account).toBeUndefined();
  });
});
