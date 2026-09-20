import {getYahooAuthState} from "../authState";

describe("Yahoo auth state", () => {
  it("keeps anonymous players in the shared guest experience", () => {
    expect(getYahooAuthState({isAnonymous: true})).toBe("guest");
  });

  it("marks Yahoo custom-token identities as registered", () => {
    expect(getYahooAuthState({isAnonymous: false})).toBe("authenticated");
  });

  it("fails closed when Firebase has no identity", () => {
    expect(getYahooAuthState(null)).toBe("failed");
  });
});
