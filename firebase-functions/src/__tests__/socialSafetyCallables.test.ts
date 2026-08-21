const mockBlock = jest.fn();
const mockReport = jest.fn();

jest.mock("../shared/sentryHandlers", () => ({
  onCallWithSentry: jest.fn((_name: string, _options: unknown, handler: unknown) => handler),
}));
jest.mock("../social/socialSafety", () => ({
  SOCIAL_REPORT_CATEGORIES: ["harassment", "cheating", "inappropriate_identity", "spam", "other"],
  blockKnownRival: (...args: unknown[]) => mockBlock(...args),
  reportKnownRival: (...args: unknown[]) => mockReport(...args),
}));

import type {CallableRequest} from "firebase-functions/v2/https";
import {blockRival, reportRival} from "../social/socialSafetyCallables";

const uid = `facebook_${"a".repeat(40)}`;
const request = (data: unknown, authenticated = true) => ({
  data,
  auth: authenticated ? {uid, token: {provider: "facebook"}} : undefined,
}) as CallableRequest<unknown>;
const blockHandler = blockRival as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;
const reportHandler = reportRival as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;

describe("social safety callables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBlock.mockResolvedValue({blocked: true});
    mockReport.mockResolvedValue({reportId: "opaque", queued: true});
  });

  it("requires authentication and forwards only a strict block target", async () => {
    await expect(blockHandler(request({}, false))).rejects.toMatchObject({code: "unauthenticated"});
    await expect(blockHandler(request({targetUserId: "target", hidden: true}))).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(blockHandler(request({targetUserId: "target"}))).resolves.toEqual({blocked: true});
    expect(mockBlock).toHaveBeenCalledWith(uid, "target");
  });

  it("accepts only fixed report categories and no free-form message", async () => {
    await expect(reportHandler(request({
      targetUserId: "target", category: "spam", requestId: "request-0001",
    }))).resolves.toEqual({reportId: "opaque", queued: true});
    expect(mockReport).toHaveBeenCalledWith(uid, {
      targetUserId: "target", category: "spam", requestId: "request-0001",
    });
    await expect(reportHandler(request({
      targetUserId: "target", category: "spam", requestId: "request-0002", message: "free form",
    }))).rejects.toMatchObject({code: "invalid-argument"});
    await expect(reportHandler(request({
      targetUserId: "target", category: "unsafe", requestId: "request-0003",
    }))).rejects.toMatchObject({code: "invalid-argument"});
  });
});
