import {createRegistrationEntryPayload} from "../registrationAttribution";

it("preserves acquisition and challenge context through platform registration", () => {
  expect(
    createRegistrationEntryPayload("authoritative_win", {
      gameMode: "classic",
      campaign: "friend_challenge",
      reference: "race_share_v1",
      challengeDestination: "race",
      customName: "Nova",
      inviterName: "Orion",
      challengeId: "challenge-42",
      utmSource: "creator",
      utmMedium: "social",
      utmCampaign: "launch",
      utmTerm: "riddles",
      utmContent: "victory-card",
    }),
  ).toEqual({
    source: "authoritative_win",
    campaign: "friend_challenge",
    reference: "registration_authoritative_win_v1",
    acquisition_reference: "race_share_v1",
    gameMode: "classic",
    challengeDestination: "race",
    customName: "Nova",
    inviterName: "Orion",
    challengeId: "challenge-42",
    utm_source: "creator",
    utm_medium: "social",
    utm_campaign: "launch",
    utm_term: "riddles",
    utm_content: "victory-card",
  });
});

it("uses a stable direct-registration campaign when acquisition context is absent", () => {
  expect(createRegistrationEntryPayload("post_instructions", {})).toEqual({
    source: "post_instructions",
    campaign: "direct_to_game_registration_v2",
    reference: "registration_post_instructions_v1",
  });
});
