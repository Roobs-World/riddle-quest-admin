import {harness} from "./raceSession.support.ts";

it("opens native tournament presentation without consuming an existing race resume or issuing a mutation", () => {
  /** Entry navigation leaves the owned resume record available for an explicit later race journey. */
  const read = jest.fn(() => "retained-run");
  /** No provider invitation may clear a saved authoritative run by itself. */
  const clear = jest.fn();
  /** Fake transport uses the production session entry seam. */
  const h = harness({tournamentLocale: "en", challengeId: "ignored-challenge", openInbox: true}, null,
    {persistence: {read, clear, save: jest.fn()}});
  expect(h.session.getSnapshot()).toMatchObject({stage: "tournaments", activeChallengeId: undefined, pending: null, error: null});
  expect(h.commands).toEqual([]);
  expect(read).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
  h.session.navigate("categories");
  expect(h.session.getSnapshot().stage).toBe("categories");
  expect(h.last().type).toBe("game:listRaceCategories");
});

it("retains selected content language and localized mismatch guidance across fresh authority reads", () => {
  /** Foreign-language invitation cannot silently select another deck or supply a result. */
  const h = harness({locale: "fr", tournamentLocale: "en"});
  expect(h.session.getSnapshot()).toMatchObject({stage: "tournaments", error: "RaceTo10.ERROR_LOCALE_MISMATCH"});
  expect(h.commands).toEqual([]);
  /** A replacement account/locale invalidates the complete incoming journey. */
  const current = h.session.captureJourney();
  h.session.enter({ownerId: "replacement", locale: "en", tournamentLocale: "en"});
  expect(current()).toBe(false);
  expect(h.session.getSnapshot()).toMatchObject({stage: "tournaments", error: null});
  h.session.navigate("categories");
  expect(h.last().payload).toEqual({locale: "en"});
});
