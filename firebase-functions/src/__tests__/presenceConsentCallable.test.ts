const mockUpdate = jest.fn(async () => undefined);
const mockSet = jest.fn(async () => undefined);

jest.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ref: () => ({update: mockUpdate, set: mockSet})}),
}));
jest.mock("../shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {requirePresenceConsentIdentity, setPresenceConsent} from "../presence/presenceConsentCallable";

const FACEBOOK_UID = `facebook_${"a".repeat(40)}`;
const JEST_UID = `jest_${"b".repeat(40)}`;
const request = (uid: string, token: Record<string, unknown>, data: unknown) => ({
  data,
  auth: {uid, token},
}) as CallableRequest<unknown>;
const call = setPresenceConsent as unknown as (input: CallableRequest<unknown>) => Promise<unknown>;

beforeEach(() => jest.clearAllMocks());

it("accepts only claims matching the Facebook or Jest UID namespace", () => {
  expect(requirePresenceConsentIdentity(request(FACEBOOK_UID, {provider: "facebook"}, {}))).toBe(FACEBOOK_UID);
  expect(requirePresenceConsentIdentity(request(JEST_UID, {jestPlayerId: "jest-player"}, {}))).toBe(JEST_UID);
  expect(() => requirePresenceConsentIdentity({data: {}} as CallableRequest<unknown>))
    .toThrow("Authentication is required");
  expect(() => requirePresenceConsentIdentity(request(FACEBOOK_UID, {provider: "jest"}, {})))
    .toThrow("Platform identity is invalid");
  expect(() => requirePresenceConsentIdentity(request(JEST_UID, {jestPlayerId: ""}, {})))
    .toThrow("Platform identity is invalid");
});

it("opens writes only explicitly and clears all sessions on opt-out", async () => {
  await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: true})))
    .resolves.toEqual({success: true, enabled: true});
  expect(mockUpdate).toHaveBeenLastCalledWith({[`presenceConsent/${FACEBOOK_UID}`]: true});
  await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: false})))
    .resolves.toEqual({success: true, enabled: false});
  expect(mockUpdate).toHaveBeenLastCalledWith({
    [`presenceConsent/${FACEBOOK_UID}`]: false,
    [`presenceConnections/${FACEBOOK_UID}`]: null,
    [`presenceStatus/${FACEBOOK_UID}`]: {state: "offline", updatedAt: expect.any(Number)},
    [`presenceOptIn/${FACEBOOK_UID}`]: false,
  });
  await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: "yes"})))
    .rejects.toMatchObject({code: "invalid-argument"});
  expect(mockUpdate).toHaveBeenCalledTimes(2);
});

it("denies Facebook opt-in while disabled but preserves cleanup and Jest", async () => {
  const previous = process.env.FACEBOOK_DISABLED_FEATURES;
  process.env.FACEBOOK_DISABLED_FEATURES = "presence";
  try {
    await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: true})))
      .rejects.toMatchObject({code: "unavailable"});
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenLastCalledWith(false);

    await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: false})))
      .resolves.toEqual({success: true, enabled: false});
    await expect(call(request(JEST_UID, {jestPlayerId: "jest-player"}, {enabled: true})))
      .resolves.toEqual({success: true, enabled: true});
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  } finally {
    if (previous === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
    else process.env.FACEBOOK_DISABLED_FEATURES = previous;
  }
});
