/** Provides mock block behavior. */
const mockBlock = jest.fn();
/** Provides mock report behavior. */
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

/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** Provides request behavior. */
const request = (data: unknown, authenticated = true) =>
  ({
    data,
    auth: authenticated ? {uid, token: {provider: "facebook"}} : undefined,
  }) as CallableRequest<unknown>;
/** Provides block handler behavior. */
const blockHandler = blockRival as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;
/** Provides report handler behavior. */
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

  it("accepts an owned opaque live seat instead of exposing a rival identity", async () => {
    /** The server resolves the rival; the client supplies only its own seat. */
    const liveTicketId = "a".repeat(64);
    await expect(blockHandler(request({liveTicketId}))).resolves.toEqual({blocked: true});
    expect(mockBlock).toHaveBeenCalledWith(uid, {liveTicketId});
    await expect(reportHandler(request({liveTicketId, category: "spam", requestId: "live-report-0001"})))
      .resolves.toEqual({reportId: "opaque", queued: true});
    expect(mockReport).toHaveBeenCalledWith(uid, {liveTicketId, category: "spam", requestId: "live-report-0001"});
  });

  it("accepts only fixed report categories and no free-form message", async () => {
    await expect(
      reportHandler(
        request({
          targetUserId: "target",
          category: "spam",
          requestId: "request-0001",
        }),
      ),
    ).resolves.toEqual({reportId: "opaque", queued: true});
    expect(mockReport).toHaveBeenCalledWith(uid, {
      targetUserId: "target",
      category: "spam",
      requestId: "request-0001",
    });
    await expect(
      reportHandler(
        request({
          targetUserId: "target",
          category: "spam",
          requestId: "request-0002",
          message: "free form",
        }),
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});
    await expect(
      reportHandler(
        request({
          targetUserId: "target",
          category: "unsafe",
          requestId: "request-0003",
        }),
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("rejects mixed target selectors and private narrative fields before invoking the service", async () => {
    /** A caller can supply its own live seat or an established legacy rival, never both. */
    const liveTicketId = "a".repeat(64);
    for (const data of [{liveTicketId, targetUserId: "target"}, {liveTicketId, message: "private narrative"}, {liveTicketId: "not-a-seat"}]) {
      await expect(blockHandler(request(data))).rejects.toMatchObject({code: "invalid-argument"});
      await expect(reportHandler(request({...data, category: "spam", requestId: "strict-report-0001"})))
        .rejects.toMatchObject({code: "invalid-argument"});
    }
    expect(mockBlock).not.toHaveBeenCalled();
    expect(mockReport).not.toHaveBeenCalled();
  });
});
