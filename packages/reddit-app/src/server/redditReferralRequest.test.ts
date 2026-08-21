import assert from "node:assert/strict";
import test from "node:test";
import {attachRedditReferralEnvironment} from "./redditReferralRequest.ts";

test("injects only the server environment into exact referral requests", () => {
  assert.deepEqual(attachRedditReferralEnvironment("referral.issue", {locale: "en"}, "sandbox"),
    {locale: "en", environment: "sandbox"});
  assert.deepEqual(attachRedditReferralEnvironment("referral.bind", {locale: "ar", token: "token"}, "production"),
    {locale: "ar", token: "token", environment: "production"});
});

test("rejects client environment, extra fields, malformed bodies and invalid deployment configuration", () => {
  for (const input of [
    {operation: "referral.issue", payload: {locale: "en", environment: "production"}, environment: "sandbox"},
    {operation: "referral.issue", payload: {locale: "en", inviterUid: "forged"}, environment: "sandbox"},
    {operation: "referral.bind", payload: {locale: "en"}, environment: "sandbox"},
    {operation: "referral.bind", payload: null, environment: "sandbox"},
    {operation: "referral.bind", payload: {locale: "en", token: "x"}, environment: "staging"},
  ]) assert.throws(() => attachRedditReferralEnvironment(input.operation, input.payload, input.environment));
});
