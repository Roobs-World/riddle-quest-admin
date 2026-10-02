import {createFakeHostServices} from "../../play/fakeServices";
import {createJestHostedPlaySession} from "../JestHostedPlaySession";

it.each([undefined, "classic" as const, "challenge" as const])("checks today's Daily before solo play for entry mode %s", initialGameMode => {
  /** Hosted solo entry retains Daily-first routing for every incoming solo mode. */
  const session = createJestHostedPlaySession({hostServices: createFakeHostServices(), initialGameMode});
  expect(session.initialGameMode).toBe("challenge");
});

it("preserves incoming Race destinations while checking Daily for solo play", () => {
  /** Race destinations survive the hosted session's default solo-mode selection. */
  const session = createJestHostedPlaySession({hostServices: createFakeHostServices(), initialRaceChallengeId: "race-42", initialRaceInbox: true});
  expect(session.initialRaceChallengeId).toBe("race-42");
  expect(session.initialRaceInbox).toBe(true);
  expect(session.initialGameMode).toBe("challenge");
});
