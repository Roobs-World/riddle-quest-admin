import {
  createFacebookNotificationTransport,
  type FacebookNotificationSend,
  type FacebookNotificationTransportOptions,
} from "../facebook/facebookNotificationTransport";
import {createHash} from "node:crypto";

/** Test-only credential; no real provider token is read. */
const TOKEN = "synthetic-app-token|test&scope=keep-private";
/** A translated fixture, not a notification sent to a person. */
const request: FacebookNotificationSend = {
  playerId: "fixture_player_1", label: "riddlequest_d1",
  message: {title: "Riddle Quest", body: "L’énigme du jour est prête. 今日のなぞなぞ。"},
  payload: JSON.stringify({gameMode: "daily", campaign: "facebook_d1"}), scheduleInterval: 86_400,
};

/** Builds an entirely injected transport. Its synthetic acknowledgement is not a Meta response contract. */
function harness(overrides: Partial<FacebookNotificationTransportOptions> = {}) {
  /** Records HTTP calls; no real network request is made. */
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response('{"testAck":true}'));
  /** The dispatcher remains responsible for durable consent/cap/deletion checks in future wiring. */
  const authorizeAttempt = jest.fn().mockResolvedValue(true);
  /** Deliberately synthetic decoding isolates transport behavior from unproven Meta acceptance. */
  const confirmResponse = jest.fn((_scope, body) => body?.testAck === true);
  /** Every readiness gate is explicit in the test; production supplies none today. */
  const options: FacebookNotificationTransportOptions = {
    appId: "1748953042991569", getAppAccessToken: async () => TOKEN,
    isProviderReady: () => true, authorizeAttempt, confirmResponse, fetch: fetchMock, ...overrides,
  };
  return {fetchMock, authorizeAttempt, confirmResponse, options, transport: createFacebookNotificationTransport(options)};
}

describe("Facebook server notification transport (synthetic HTTP fixtures only)", () => {
  it("binds authorization to the exact serialized provider body before transmitting", async () => {
    /** Independently composed expected bytes include translated copy and the original scheduled payload. */
    const expected = JSON.stringify({player_id: request.playerId, message: request.message, label: request.label,
      payload: request.payload, schedule_interval: request.scheduleInterval});
    /** Receipt commitment is compared with bytes produced by the actual transport. */
    const requestDigest = createHash("sha256").update(expected).digest("hex");
    /** Authorization admits only the exact work item, rather than the same recipient and label. */
    const test = harness({authorizeAttempt: async scope => Reflect.get(scope, "requestDigest") === requestDigest});
    await expect(test.transport.send(request)).resolves.toMatchObject({outcome: "confirmed"});
    expect(String(test.fetchMock.mock.calls[0][1]?.body)).toBe(expected);
    expect(test.confirmResponse.mock.calls[0][0]).toMatchObject({requestDigest});
    await expect(test.transport.send({...request, message: {...request.message, body: "Different copy"}}))
      .resolves.toEqual({outcome: "not-sent", reason: "unauthorized"});
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
  });
  it("can make one explicitly unconfirmed send without inventing a provider acknowledgement contract", async () => {
    /** Provides test behavior. */
    const test = harness({confirmResponse: undefined, allowUnconfirmedResponse: true});
    await expect(test.transport.send(request)).resolves.toEqual({outcome: "unconfirmed", httpStatus: 200});
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
    expect(test.authorizeAttempt).toHaveBeenCalledTimes(1);
  });
  /** Restores emergency switches without altering another test's default environment. */
  const originalOff = process.env.FACEBOOK_DISABLED_FEATURES;
  beforeEach(() => { delete process.env.FACEBOOK_DISABLED_FEATURES; });
  afterEach(() => {
    jest.useRealTimers();
    if (originalOff === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
    else process.env.FACEBOOK_DISABLED_FEATURES = originalOff;
  });

  it("sends documented JSON to the fixed Gaming Domain with one encoded app token and no redirect following", async () => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    await expect(test.transport.send(request)).resolves.toEqual({outcome: "confirmed", httpStatus: 200});
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
    /** Inspects the emitted provider endpoint and JSON body. */
    const [url, init] = test.fetchMock.mock.calls[0];
    /** Parsed destination exposes whether credentials escaped their fixed scope. */
    const target = new URL(String(url));
    expect(target.origin).toBe("https://graph.fb.gg");
    expect(target.pathname).toBe("/1748953042991569/notifications");
    expect([...target.searchParams]).toEqual([["access_token", TOKEN]]);
    expect(init).toMatchObject({method: "POST", redirect: "manual", headers: {"Content-Type": "application/json"}});
    expect(JSON.parse(String(init?.body))).toEqual({
      player_id: request.playerId, label: request.label, message: request.message,
      payload: request.payload, schedule_interval: 86_400,
    });
    expect(test.authorizeAttempt).toHaveBeenCalledWith({
      operation: "send", playerId: request.playerId, label: request.label, scheduleInterval: 86_400,
      requestDigest: createHash("sha256").update(String(init?.body), "utf8").digest("hex"),
    });
    expect(test.confirmResponse.mock.calls[0][0]).toEqual(test.authorizeAttempt.mock.calls[0][0]);
    expect(Object.isFrozen(test.confirmResponse.mock.calls[0][0])).toBe(true);
  });

  it("cancels only the authorized label even after the sending switch is disabled", async () => {
    process.env.FACEBOOK_DISABLED_FEATURES = "notifications";
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    await expect(test.transport.send(request)).resolves.toEqual({outcome: "not-sent", reason: "inactive"});
    await expect(test.transport.cancel(request.playerId, request.label)).resolves.toEqual({outcome: "confirmed", httpStatus: 200});
    /** Inspects the emitted provider endpoint and JSON body. */
    const [url, init] = test.fetchMock.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe("/1748953042991569/notifications_cancel_all");
    expect(JSON.parse(String(init?.body))).toEqual({player_id: request.playerId, label: request.label});
    expect(test.authorizeAttempt).toHaveBeenCalledWith({operation: "cancel", playerId: request.playerId, label: request.label,
      requestDigest: createHash("sha256").update(String(init?.body), "utf8").digest("hex")});
  });

  it.each([undefined, 300, 2_592_000])("accepts documented immediate/delay boundary %s", async scheduleInterval => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    await expect(test.transport.send({...request, scheduleInterval})).resolves.toMatchObject({outcome: "confirmed"});
    /** Captured provider JSON with the documented optional delay. */
    const body = JSON.parse(String(test.fetchMock.mock.calls[0][1]?.body));
    if (scheduleInterval === undefined) expect(body).not.toHaveProperty("schedule_interval");
    else expect(body.schedule_interval).toBe(scheduleInterval);
  });

  it.each([299, 2_592_001, 300.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid delay %s before authorization", async scheduleInterval => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    await expect(test.transport.send({...request, scheduleInterval})).resolves.toEqual({outcome: "not-sent", reason: "invalid-request"});
    expect(test.authorizeAttempt).not.toHaveBeenCalled();
    expect(test.fetchMock).not.toHaveBeenCalled();
  });

  it("prevents requests without readiness, a response contract or exact authorization", async () => {
    for (const overrides of [
      {isProviderReady: () => false}, {confirmResponse: undefined},
      {authorizeAttempt: async () => false}, {authorizeAttempt: async () => { throw new Error(TOKEN); }},
      {getAppAccessToken: async () => { throw new Error(TOKEN); }}, {getAppAccessToken: async () => "bad\ntoken"},
    ]) {
      /** Injected dispatcher and HTTP boundary for this case. */
      const test = harness(overrides);
      /** Safe result must not include private transport details. */
      const result = await test.transport.send(request);
      expect(result.outcome).toBe("not-sent");
      expect(JSON.stringify(result)).not.toContain(TOKEN);
      expect(test.fetchMock).not.toHaveBeenCalled();
    }
  });

  it("rechecks emergency-off and readiness after asynchronous authorization", async () => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness({authorizeAttempt: async () => { process.env.FACEBOOK_DISABLED_FEATURES = "notifications"; return true; }});
    await expect(test.transport.send(request)).resolves.toEqual({outcome: "not-sent", reason: "inactive"});
    expect(test.fetchMock).not.toHaveBeenCalled();
    delete process.env.FACEBOOK_DISABLED_FEATURES;
    /** Simulates a readiness change while authorization is in flight. */
    let ready = true;
    /** Uses a revoked provider readiness gate. */
    const changed = harness({isProviderReady: () => ready, authorizeAttempt: async () => { ready = false; return true; }});
    await expect(changed.transport.send(request)).resolves.toEqual({outcome: "not-sent", reason: "inactive"});
    expect(changed.fetchMock).not.toHaveBeenCalled();
  });

  it("snapshots app/content before asynchronous dependencies can mutate inputs", async () => {
    /** Models input mutation while the server awaits an authorization dependency. */
    const mutable = {...request, message: {...request.message}};
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness({authorizeAttempt: async () => {
      mutable.message.body = "changed"; mutable.playerId = "other_player";
      Object.assign(test.options, {appId: "other-app"}); return true;
    }});
    await test.transport.send(mutable);
    /** Inspects the emitted provider endpoint and JSON body. */
    const [url, init] = test.fetchMock.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe("/1748953042991569/notifications");
    expect(JSON.parse(String(init?.body))).toMatchObject({player_id: request.playerId, message: request.message});
    expect(test.confirmResponse.mock.calls[0][0].requestDigest)
      .toBe(createHash("sha256").update(String(init?.body), "utf8").digest("hex"));
  });

  it("rejects unsafe identities, labels, copy and oversized multibyte bodies without fetching", async () => {
    for (const invalid of [
      {...request, playerId: "player/other"}, {...request, label: "../cancel"}, {...request, label: "another_app_d1"},
      {...request, message: {title: "", body: "body"}}, {...request, message: {title: "Title", body: "bad\ncopy"}},
      {...request, message: {title: "Title", body: "界".repeat(1400)}},
    ]) {
      /** Injected dispatcher and HTTP boundary for this case. */
      const test = harness();
      await expect(test.transport.send(invalid)).resolves.toMatchObject({outcome: "not-sent", reason: "invalid-request"});
      expect(test.fetchMock).not.toHaveBeenCalled();
    }
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness({appId: "1748953042991569/other"});
    await expect(test.transport.cancel(request.playerId, request.label)).resolves.toMatchObject({outcome: "not-sent"});
    expect(test.fetchMock).not.toHaveBeenCalled();
  });

  it.each(["{}", "{\"success\":true}", "not json", "x".repeat(16_385)])("never confirms an unrecognized, invalid or oversized HTTP 200 body", async body => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    test.fetchMock.mockResolvedValueOnce(new Response(body));
    await expect(test.transport.send(request)).resolves.toEqual({outcome: "unconfirmed", httpStatus: 200});
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([302, 400, 429, 500])("does not follow/retry status %s or expose its body", async status => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    test.fetchMock.mockResolvedValueOnce(new Response(TOKEN, {status, headers: {Location: "https://other.invalid/"}}));
    await expect(test.transport.cancel(request.playerId, request.label)).resolves.toEqual({outcome: "unconfirmed", httpStatus: status});
    expect(test.confirmResponse).not.toHaveBeenCalled();
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("suppresses credential-bearing transport/decoder errors and does not retry an uncertain outcome", async () => {
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    test.fetchMock.mockRejectedValueOnce(new Error(`POST https://graph.fb.gg/?access_token=${TOKEN}`));
    await expect(test.transport.send(request)).resolves.toEqual({outcome: "unconfirmed"});
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
    /** A broken response decoder must leave the provider outcome uncertain. */
    const decoder = harness({confirmResponse: () => { throw new Error(TOKEN); }});
    await expect(decoder.transport.send(request)).resolves.toEqual({outcome: "unconfirmed", httpStatus: 200});
    expect(decoder.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts at ten seconds and never confirms a late response even if the transport ignores abort", async () => {
    jest.useFakeTimers();
    /** Injected dispatcher and HTTP boundary for this case. */
    const test = harness();
    /** Completes the fake transport after its deadline. */
    let release!: (response: Response) => void;
    test.fetchMock.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    /** Pending request whose late response must remain uncertain. */
    const attempt = test.transport.send(request);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(test.fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    release(new Response('{"testAck":true}'));
    await expect(attempt).resolves.toEqual({outcome: "unconfirmed", httpStatus: 200});
    expect(test.confirmResponse).not.toHaveBeenCalled();
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
  });
});
