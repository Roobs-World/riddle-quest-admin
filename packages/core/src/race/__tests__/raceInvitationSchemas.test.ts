import {describe, expect, it} from "@jest/globals";
import {CancelRaceInviteRequestSchema, RaceEntryResponseSchema} from "../raceSchemas";

describe("Race Invitation wire contract", () => {
  it("requires independent facts while waiting and rejects private identities", () => {
    /** Public lifecycle facts carry capabilities without account identifiers. */
    const waiting = {status: "waiting", serverNowMs: 10000, invitation: {claimState: "claimed", publicationState: "pending", role: "recipient", canCancel: false, expiresAtMs: 20000}};
    expect(RaceEntryResponseSchema.safeParse(waiting).success).toBe(true);
    expect(RaceEntryResponseSchema.safeParse({...waiting, invitation: undefined}).success).toBe(false);
    expect(RaceEntryResponseSchema.safeParse({...waiting, invitation: {...waiting.invitation, recipientId: "private-account"}}).success).toBe(false);
    expect(RaceEntryResponseSchema.safeParse({...waiting, status: "claimed"}).success).toBe(false);
  });
  it("allows only creator recovery facts on invalid recorded readiness", () => {
    /** A valid reservation can still authorize cancellation of incompatible recording metadata. */
    const recovery = {status:"unavailable",reason:"invalid",serverNowMs:10000,invitation:{claimState:"unclaimed",publicationState:"published",role:"creator",canCancel:true,expiresAtMs:20000}};
    expect(RaceEntryResponseSchema.safeParse(recovery).success).toBe(true);
    expect(RaceEntryResponseSchema.safeParse({...recovery,invitation:undefined}).success).toBe(true);
    expect(RaceEntryResponseSchema.safeParse({...recovery,reason:"blocked"}).success).toBe(false);
    expect(RaceEntryResponseSchema.safeParse({...recovery,invitation:{...recovery.invitation,role:"recipient"}}).success).toBe(false);
    expect(RaceEntryResponseSchema.safeParse({...recovery,invitation:{...recovery.invitation,creatorId:"private-account"}}).success).toBe(false);
  });
  it("requires cancellation receipts and prevents client-authored lifecycle state", () => {
    /** Authenticated identity and cancellation time belong to the authority adapter. */
    const request = {challengeId: "opaque-seat", locale: "en", requestId: "cancel-seat-1"};
    expect(CancelRaceInviteRequestSchema.safeParse(request).success).toBe(true);
    expect(CancelRaceInviteRequestSchema.safeParse({...request, requestId: undefined}).success).toBe(false);
    expect(CancelRaceInviteRequestSchema.safeParse({...request, creatorId: "victim"}).success).toBe(false);
    expect(CancelRaceInviteRequestSchema.safeParse({...request, cancelledAtMs: 10000}).success).toBe(false);
  });
});
