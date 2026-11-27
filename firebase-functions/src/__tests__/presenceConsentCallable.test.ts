/** Provides mock update behavior. */
const mockUpdate = jest.fn(async () => undefined);
/** Provides mock set behavior. */
const mockSet = jest.fn(async () => undefined);

jest.mock("firebase-admin/database", () => ({
  getDatabase: () => ({ref: () => ({update: mockUpdate, set: mockSet})}),
}));
jest.mock("../shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {requirePresenceConsentIdentity, setPresenceConsent} from "../presence/presenceConsentCallable";

/** Defines the facebook uid value. */
const FACEBOOK_UID = `facebook_${"a".repeat(40)}`;
/** Provides request behavior. */
const request = (uid: string, token: Record<string, unknown>, data: unknown) =>
  ({
    data,
    auth: {uid, token},
  }) as CallableRequest<unknown>;
/** Provides call behavior. */
const call = setPresenceConsent as unknown as (input: CallableRequest<unknown>) => Promise<unknown>;

beforeEach(() => jest.clearAllMocks());

it("accepts only claims matching the Facebook UID namespace", () => {
  expect(requirePresenceConsentIdentity(request(FACEBOOK_UID, {provider: "facebook"}, {}))).toBe(FACEBOOK_UID);
  expect(() => requirePresenceConsentIdentity({data: {}} as CallableRequest<unknown>)).toThrow(
    "Authentication is required",
  );
  expect(() => requirePresenceConsentIdentity(request(FACEBOOK_UID, {provider: "unsupported"}, {}))).toThrow(
    "Platform identity is invalid",
  );
  expect(() => requirePresenceConsentIdentity(request("invalid-player", {provider: "facebook"}, {}))).toThrow(
    "Platform identity is invalid",
  );
});

it("opens writes only explicitly and clears all sessions on opt-out", async () => {
  await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: true}))).resolves.toEqual({
    success: true,
    enabled: true,
  });
  expect(mockUpdate).toHaveBeenLastCalledWith({[`presenceConsent/${FACEBOOK_UID}`]: true});
  await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: false}))).resolves.toEqual({
    success: true,
    enabled: false,
  });
  expect(mockUpdate).toHaveBeenLastCalledWith({
    [`presenceConsent/${FACEBOOK_UID}`]: false,
    [`presenceConnections/${FACEBOOK_UID}`]: null,
    [`presenceStatus/${FACEBOOK_UID}`]: {state: "offline", updatedAt: expect.any(Number)},
    [`presenceOptIn/${FACEBOOK_UID}`]: false,
  });
  await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: "yes"}))).rejects.toMatchObject({
    code: "invalid-argument",
  });
  expect(mockUpdate).toHaveBeenCalledTimes(2);
});

it("denies Facebook opt-in while disabled but preserves opt-out cleanup", async () => {
  /** Provides previous behavior. */
  const previous = process.env.FACEBOOK_DISABLED_FEATURES;
  process.env.FACEBOOK_DISABLED_FEATURES = "presence";
  try {
    await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: true}))).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenLastCalledWith(false);

    await expect(call(request(FACEBOOK_UID, {provider: "facebook"}, {enabled: false}))).resolves.toEqual({
      success: true,
      enabled: false,
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  } finally {
    if (previous === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
    else process.env.FACEBOOK_DISABLED_FEATURES = previous;
  }
});
