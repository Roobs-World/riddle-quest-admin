import {context, createServer, getServerPort, payments, reddit, redis, settings} from "@devvit/web/server";
import {serve} from "@hono/node-server";
import {Hono} from "hono";
import {createSignedGatewayAssertion} from "./gatewayAssertion";
import {normalizeIdentitySessionResult} from "./featureFallback";
import {normalizeRedditAvatar} from "./redditProfile";
import type {PaymentHandlerResponse} from "@devvit/web/server";
import type {MenuItemRequest, UiResponse} from "@devvit/web/shared";
import {parseRedditPaymentHook} from "./redditPaymentOrder";
import {attachRedditReferralEnvironment} from "./redditReferralRequest";
import {REDDIT_RECOVERY_METADATA_KEY, redditCommerceRecoveryKey} from "./redditCommerceRecovery";
import {recoverRedditCommerceOrders} from "./recoverRedditCommerce";

/** Provides app behavior. */
const app = new Hono();
/** Defines the canonical post key value. */
const CANONICAL_POST_KEY = "riddle-quest:canonical-post:v1";
/** Indicates whether is reddit post id. */
const isRedditPostId = (value: string): value is `t3_${string}` => /^t3_[a-z0-9]{1,20}$/u.test(value);

/** Ensures riddle quest post. */
async function ensureRiddleQuestPost() {
  /** Provides existing id behavior. */
  const existingId = await redis.get(CANONICAL_POST_KEY);
  if (existingId && isRedditPostId(existingId)) return reddit.getPostById(existingId);
  if (existingId) await redis.del(CANONICAL_POST_KEY);
  if (!context.subredditName) throw new Error("subreddit-context-required");
  /** Provides post behavior. */
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: "Play Riddle Quest",
    entry: "default",
  });
  await redis.set(CANONICAL_POST_KEY, post.id);
  return post;
}

/** Provides call firebase behavior. */
async function callFirebase(
  operation: string,
  functionName: string,
  payload: unknown = {},
  trusted?: {
    /** Stores user id. */
    userId: string; /** Stores post id. */
    /** Stores post id. */
    postId: string;
  },
): Promise<{
  /** Stores payload. */
  payload: unknown; /** Stores status. */
  /** Stores status. */
  status: number;
}> {
  /** Provides r id. */
  const userId = trusted?.userId ?? context.userId;
  /** Provides post id behavior. */
  const postId = trusted?.postId ?? context.postId;
  if (!userId) return {payload: {ok: false, error: "login-required"}, status: 401};
  if (!postId) return {payload: {ok: false, error: "post-context-required"}, status: 400};
  /** Provides gateway secret behavior. */
  const gatewaySecret = await settings.get<string>("redditGatewaySecret");
  if (typeof gatewaySecret !== "string" || Buffer.byteLength(gatewaySecret, "utf8") < 32) {
    return {payload: {ok: false, error: "gateway-not-configured"}, status: 503};
  }
  /** Provides signed behavior. */
  const signed = createSignedGatewayAssertion(
    {
      appName: context.appSlug,
      installationId: `${context.appSlug}:${context.subredditId}`,
      subredditId: context.subredditId,
      postId,
      userId,
      operation,
    },
    gatewaySecret,
    payload,
  );
  /** Provides response behavior. */
  const response = await fetch(`https://www.roobsworld.com/api/reddit-gateway/${functionName}`, {
    method: "POST",
    headers: {"content-type": "application/json", "x-riddle-quest-reddit-signature": signed.signature},
    body: JSON.stringify({assertion: signed.assertion, payload: signed.payload}),
    signal: AbortSignal.timeout(10_000),
  });
  /** Provides response body behavior. */
  const responseBody = await response.text();
  if (Buffer.byteLength(responseBody, "utf8") > 64 * 1024) {
    return {payload: {ok: false, error: "gateway-response-too-large"}, status: 502};
  }
  try {
    return {payload: JSON.parse(responseBody), status: response.status};
  } catch {
    return {payload: {ok: false, error: "gateway-invalid-response"}, status: 502};
  }
}

app.get("/api/health", (request) => request.json({ok: true, service: "riddle-quest-reddit-gateway"}));
app.post("/internal/menu/post-create", async (request) => {
  try {
    await request.req.json<MenuItemRequest>();
    /** Provides post behavior. */
    const post = await ensureRiddleQuestPost();
    return request.json<UiResponse>({navigateTo: post});
  } catch {
    return request.json<UiResponse>({
      showToast: {text: "Could not create the Riddle Quest post. Please try again.", appearance: "neutral"},
    });
  }
});
/** Ensures post for lifecycle. */
const ensurePostForLifecycle = async () => {
  try {
    /** Provides post behavior. */
    const post = await ensureRiddleQuestPost();
    return Response.json({ok: true, postId: post.id});
  } catch {
    return Response.json({ok: false, error: "post-create-failed"}, {status: 500});
  }
};
app.post("/internal/triggers/app-install", () => ensurePostForLifecycle());
app.post("/internal/triggers/app-upgrade", () => ensurePostForLifecycle());
app.post("/api/session", async (request) => {
  if (!context.userId) return request.json({ok: true, authenticated: false});
  /** Provides environment behavior. */
  const environment = await settings.get<string>("redditEnvironment");
  if (environment !== "sandbox" && environment !== "production") {
    return request.json({ok: false, error: "reddit-environment-not-configured"}, 503);
  }
  /** Provides payload behavior. */
  let payload: {
    /** Stores environment. */
    environment: "sandbox" | "production"; /** Stores profile. */
    /** Stores profile. */
    profile?: {
      /** Stores username. */
      username: string; /** Stores avatar url. */
      /** Stores avatar url. */
      avatarUrl: string | null;
    };
  } = {environment};
  try {
    /** Provides r. */
    const user = await reddit.getCurrentUser();
    if (user && user.id === context.userId)
      payload = {environment, profile: {username: user.username, avatarUrl: normalizeRedditAvatar(context.snoovatar)}};
  } catch {
    // Identity remains available when Reddit's optional public-profile lookup is unavailable.
  }
  /** Provides result behavior. */
  const result = normalizeIdentitySessionResult(
    await callFirebase("identity.exchange", "exchangeRedditIdentity", payload),
  );
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: {"content-type": "application/json", "cache-control": "no-store"},
  });
});
app.post("/api/account/delete", async (request) => {
  /** Provides payload behavior. */
  let payload: unknown;
  try {
    payload = await request.req.json();
  } catch {
    return request.json({ok: false, error: "invalid-json"}, 400);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 1 ||
    !("accountGeneration" in payload) ||
    !Number.isSafeInteger(payload.accountGeneration) ||
    (payload.accountGeneration as number) < 1 ||
    (payload.accountGeneration as number) > 1_000_000
  ) {
    return request.json({ok: false, error: "invalid-account-generation"}, 400);
  }
  /** Provides result behavior. */
  const result = await callFirebase("account.delete", "deleteRedditAccount", payload);
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: {"content-type": "application/json", "cache-control": "no-store"},
  });
});
app.post("/api/storage/read", async () => {
  /** Provides result behavior. */
  const result = await callFirebase("storage.read", "redditStorage");
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: {"content-type": "application/json", "cache-control": "no-store"},
  });
});
app.post("/api/storage/write", async (request) => {
  /** Provides payload behavior. */
  let payload: unknown;
  try {
    payload = await request.req.json();
  } catch {
    return request.json({ok: false, error: "invalid-json"}, 400);
  }
  /** Provides result behavior. */
  const result = await callFirebase("storage.write", "redditStorage", payload);
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: {"content-type": "application/json", "cache-control": "no-store"},
  });
});
app.post("/api/storage/clear", async () => {
  /** Provides result behavior. */
  const result = await callFirebase("storage.clear", "redditStorage");
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: {"content-type": "application/json", "cache-control": "no-store"},
  });
});
/** Provides recovery scope behavior. */
const recoveryScope = async () => {
  if (!context.userId) throw new Error("login-required");
  /** Provides secret behavior. */
  const secret = await settings.get<string>("redditGatewaySecret");
  if (typeof secret !== "string") throw new Error("gateway-not-configured");
  return {userId: context.userId, key: redditCommerceRecoveryKey(context.appSlug, context.userId, secret)};
};
app.post("/api/commerce/key", async (request) => {
  try {
    /** Provides {key} behavior. */
    const {key} = await recoveryScope();
    return request.json({ok: true, key, metadataKey: REDDIT_RECOVERY_METADATA_KEY});
  } catch {
    return request.json({ok: false, error: "commerce-recovery-unavailable"}, 503);
  }
});
app.post("/api/commerce/recover", async (request) => {
  try {
    /** Provides {user id, key} behavior. */
    const {userId, key} = await recoveryScope();
    /** Provides post id behavior. */
    const postId = context.postId;
    if (!postId) throw new Error("post-context-required");
    /** Provides configured environment behavior. */
    const configuredEnvironment = await settings.get<string>("redditEnvironment");
    if (configuredEnvironment !== "sandbox" && configuredEnvironment !== "production") {
      throw new Error("commerce-environment-not-configured");
    }
    /** Provides recovered behavior. */
    const recovered = await recoverRedditCommerceOrders({
      recoveryKey: key,
      environment: configuredEnvironment,
      getPage: (cursor) => payments.getOrders({limit: 100, buyer: userId, ...(cursor ? {cursor} : {})}),
      grant: async (order) => {
        /** Provides result behavior. */
        const result = await callFirebase(
          "gameplay.commerce.fulfill",
          "redditGameplay",
          {
            orderId: order.orderId,
            productId: order.productId,
            environment: order.environment,
            purchasedAtMs: order.purchasedAtMs,
          },
          {userId, postId},
        );
        if (
          result.status < 200 ||
          result.status >= 300 ||
          typeof result.payload !== "object" ||
          result.payload === null ||
          (
            result.payload as {
              /** Stores ok. */
              ok?: unknown;
            }
          ).ok !== true
        ) {
          throw new Error("commerce-recovery-grant-failed");
        }
      },
    });
    return request.json({ok: true, recovered});
  } catch {
    return request.json({ok: false, error: "commerce-recovery-unavailable"}, 503);
  }
});
app.post("/api/game/:operation", async (request) => {
  /** Provides operation behavior. */
  const operation = request.req.param("operation");
  /** Provides allowed behavior. */
  const allowed = new Set([
    "profile.load",
    "riddle.classic",
    "riddle.classic-buffer",
    "riddle.daily",
    "guess.submit",
    "game.complete",
    "hint.request",
    "coins.spend",
    "riddle.skip",
    "leaderboard.list",
    "profile.username",
    "race.access",
    "race.categories",
    "race.start",
    "race.guess",
    "race.hint",
    "race.skip",
    "race.resume",
    "race.abandon",
    "race.publish",
    "race.challenge",
    "race.outcome",
    "race.inbox",
    "race.match",
    "tournament.list",
    "tournament.record",
    "presence.poll",
    "presence.disconnect",
    "safety.block",
    "safety.report",
    "referral.issue",
    "referral.bind",
  ]);
  if (!allowed.has(operation)) return request.json({ok: false, error: "operation-not-found"}, 404);
  /** Provides payload behavior. */
  let payload: unknown;
  try {
    payload = await request.req.json();
  } catch {
    return request.json({ok: false, error: "invalid-json"}, 400);
  }
  if (operation === "referral.issue" || operation === "referral.bind") {
    /** Provides environment behavior. */
    const environment = await settings.get<string>("redditEnvironment");
    try {
      payload = attachRedditReferralEnvironment(operation, payload, environment);
    } catch {
      return request.json({ok: false, error: "referral-environment-not-configured"}, 503);
    }
  }
  /** Provides result behavior. */
  const result = await callFirebase(`gameplay.${operation}`, "redditGameplay", payload);
  return new Response(JSON.stringify(result.payload), {
    status: result.status,
    headers: {"content-type": "application/json", "cache-control": "no-store"},
  });
});
/** Handles payment. */
const handlePayment = async (request: Parameters<typeof app.fetch>[0], kind: "fulfill" | "refund") => {
  try {
    /** Provides order behavior. */
    const order = parseRedditPaymentHook(await request.json(), kind);
    if (context.userId && context.userId !== order.userId) {
      return Response.json({success: false, reason: "Payment identity mismatch"} satisfies PaymentHandlerResponse, {
        status: 403,
      });
    }
    /** Provides result behavior. */
    const result = await callFirebase(
      `gameplay.commerce.${kind}`,
      "redditGameplay",
      kind === "fulfill"
        ? {
            orderId: order.orderId,
            productId: order.productId,
            environment: order.environment,
            purchasedAtMs: order.occurredAtMs,
          }
        : {
            orderId: order.orderId,
            productId: order.productId,
            environment: order.environment,
            refundedAtMs: order.occurredAtMs,
          },
      {userId: order.userId, postId: order.postId},
    );
    return Response.json(
      result.status >= 200 &&
        result.status < 300 &&
        typeof result.payload === "object" &&
        result.payload !== null &&
        (
          result.payload as {
            /** Stores ok. */
            ok?: unknown;
          }
        ).ok === true
        ? ({success: true} satisfies PaymentHandlerResponse)
        : ({success: false, reason: "Authoritative fulfillment failed"} satisfies PaymentHandlerResponse),
      {status: result.status >= 200 && result.status < 300 ? 200 : 502},
    );
  } catch {
    return Response.json({success: false, reason: "Invalid payment order"} satisfies PaymentHandlerResponse, {
      status: 400,
    });
  }
};
app.post("/internal/payments/fulfill", (request) => handlePayment(request.req.raw, "fulfill"));
app.post("/internal/payments/refund", (request) => handlePayment(request.req.raw, "refund"));
app.notFound((request) => request.json({ok: false, error: "route-not-found"}, 404));

serve({fetch: app.fetch, createServer, port: getServerPort()});
