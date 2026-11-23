import {describe, expect, test} from "@jest/globals";
import {resolveActivityPresence} from "../activityPresence";

describe("resolveActivityPresence", () => {
  test("distinguishes idle, active game, modal, and race surfaces", () => {
    expect(resolveActivityPresence({raceOpen: false, hasRiddle: false, modalOpen: false})).toBe("online");
    expect(resolveActivityPresence({raceOpen: false, hasRiddle: true, modalOpen: false})).toBe("playing");
    expect(resolveActivityPresence({raceOpen: false, hasRiddle: true, modalOpen: true})).toBe("online");
    expect(resolveActivityPresence({raceOpen: true, hasRiddle: false, modalOpen: true})).toBe("racing");
  });
});
