import {createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {getAuth} from "firebase-admin/auth";
import {defineSecret} from "firebase-functions/params";
import {createRemoteJWKSet, jwtVerify} from "jose";
import {onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";

/** Provides yahoo secret behavior. */
const yahooSecret = defineSecret("Yahoo");
/** Provides client id behavior. */
const clientId = "dj0yJmk9ZGlJTE42UXZoUmF0JmQ9WVdrOVJFVjJiRnBJWVZvbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTcy";
/** Provides callback url behavior. */
const callbackUrl = "https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/yahooOAuthCallback";
/** Provides game url behavior. */
const gameUrl = "https://yahoo.roobsworld.com/";
/** Provides authorization url behavior. */
const authorizationUrl = "https://api.login.yahoo.com/oauth2/request_auth";
/** Provides token url behavior. */
const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";
/** Provides yahoo keys behavior. */
const yahooKeys = createRemoteJWKSet(new URL("https://api.login.yahoo.com/openid/v1/certs"));
/** Provides options behavior. */
const options = {region: "us-central1", timeoutSeconds: 30, secrets: [yahooSecret]};

/** Provides sign state behavior. */
const signState = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(`riddle-quest:yahoo-oauth-state:${payload}`).digest("base64url");

/** Creates state. */
const createState = (secret: string) => {
  /** Provides nonce behavior. */
  const nonce = randomBytes(24).toString("base64url");
  /** Provides value behavior. */
  const value = Buffer.from(JSON.stringify({
    nonce,
    state: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + 10 * 60_000,
  })).toString("base64url");
  return {nonce, signed: `${value}.${signState(value, secret)}`};
};

/** Provides verify state behavior. */
const verifyState = (signed: string, secret: string) => {
  /** Provides [value, signature, extra] behavior. */
  const [value, signature, extra] = signed.split(".");
  if (!value || !signature || extra) throw new Error("invalid-yahoo-oauth-state");
  /** Provides expected behavior. */
  const expected = Buffer.from(signState(value, secret));
  /** Provides received behavior. */
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("invalid-yahoo-oauth-state");
  }
  /** Provides parsed behavior. */
  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (
    !parsed || typeof parsed !== "object" ||
    typeof (parsed as {/** Stores nonce. */
    /** Stores nonce. */
    nonce?: unknown}).nonce !== "string" ||
    typeof (parsed as {/** Stores state. */
    /** Stores state. */
    state?: unknown}).state !== "string" ||
    typeof (parsed as {/** Stores expires at. */
    /** Stores expires at. */
    expiresAt?: unknown}).expiresAt !== "number" ||
    (parsed as {/** Stores expires at. */
    /** Stores expires at. */
    expiresAt: number}).expiresAt < Date.now()
  ) throw new Error("invalid-yahoo-oauth-state");
  return parsed as {/** Stores nonce. */
  /** Stores nonce. */
  nonce: string; /** Stores state. */
  /** Stores state. */
  state: string; /** Stores expires at. */
  /** Stores expires at. */
  expiresAt: number};
};

/** Provides state cookie name behavior. */
const stateCookieName = "rq_yahoo_state";
/** Reads cookie. */
const readCookie = (header: string | undefined, name: string) => header?.split(";").map((part) => part.trim())
  .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";

/** Provides state matches cookie behavior. */
const stateMatchesCookie = (signedState: string, cookieState: string) => {
  /** Provides expected behavior. */
  const expected = Buffer.from(signedState);
  /** Provides received behavior. */
  const received = Buffer.from(cookieState);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

/** Provides yahoo o auth start behavior. */
export const yahooOAuthStart = onRequestWithSentry("yahooOAuthStart", options, async (request, response) => {
  if (request.method !== "GET") { response.status(405).send("Method not allowed"); return; }
  /** Provides state behavior. */
  const state = createState(yahooSecret.value());
  /** Provides url behavior. */
  const url = new URL(authorizationUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("nonce", state.nonce);
  url.searchParams.set("state", state.signed);
  response.set("Cache-Control", "no-store");
  response.set("Set-Cookie", `${stateCookieName}=${state.signed}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  response.redirect(302, url.toString());
});

/** Provides yahoo o auth callback behavior. */
export const yahooOAuthCallback = onRequestWithSentry("yahooOAuthCallback", options, async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (request.method !== "GET") { response.status(405).send("Method not allowed"); return; }
  if (request.query.error) { response.redirect(302, `${gameUrl}?yahoo=cancelled`); return; }
  /** Provides code behavior. */
  const code = typeof request.query.code === "string" ? request.query.code : "";
  /** Provides signed state behavior. */
  const signedState = typeof request.query.state === "string" ? request.query.state : "";
  /** Provides cookie state behavior. */
  const cookieState = readCookie(request.get("cookie"), stateCookieName);
  response.set("Set-Cookie", `${stateCookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  if (!code || code.length > 4096 || !signedState || signedState.length > 2048 ||
      !stateMatchesCookie(signedState, cookieState)) {
    response.status(400).send("Invalid Yahoo authorization response"); return;
  }
  try {
    /** Provides state behavior. */
    const state = verifyState(signedState, yahooSecret.value());
    /** Provides body behavior. */
    const body = new URLSearchParams({grant_type: "authorization_code", redirect_uri: callbackUrl, code});
    /** Provides token response behavior. */
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${yahooSecret.value()}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    /** Provides tokens behavior. */
    if (!tokenResponse.ok) throw new Error("yahoo-token-exchange-failed");
    /** Untrusted token body remains unknown until its ID token is validated. */
    const tokens: unknown = await tokenResponse.json();
    /** Provides id token behavior. */
    const idToken = tokens && typeof tokens === "object" && typeof (tokens as {/** Stores id token. */
    /** Stores id token. */
    id_token?: unknown}).id_token === "string"
      ? (tokens as {/** Stores id token. */
      /** Stores id token. */
      id_token: string}).id_token : "";
    if (!tokenResponse.ok || !idToken) throw new Error("yahoo-token-exchange-failed");
    /** Provides verified behavior. */
    const verified = await jwtVerify(idToken, yahooKeys, {
      issuer: "https://api.login.yahoo.com",
      audience: clientId,
      // https://api.login.yahoo.com/.well-known/openid-configuration advertises both.
      algorithms: ["ES256", "RS256"],
    });
    if (verified.payload.nonce !== state.nonce || typeof verified.payload.sub !== "string") {
      throw new Error("invalid-yahoo-id-token");
    }
    /** Provides uid behavior. */
    const uid = `yahoo:${verified.payload.sub}`;
    /** Provides custom token behavior. */
    const customToken = await getAuth().createCustomToken(uid, {provider: "yahoo"});
    response.redirect(302, `${gameUrl}#yahoo_token=${encodeURIComponent(customToken)}`);
  } catch {
    response.status(502).send(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yahoo sign-in unavailable</title><h1>Yahoo sign-in could not be completed</h1><p>Your sign-in may have expired or Yahoo may be unavailable. Please start again.</p><a href="https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/yahooOAuthStart">Try Yahoo sign-in again</a></html>',
    );
  }
});
