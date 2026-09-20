import {createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {getAuth} from "firebase-admin/auth";
import {defineSecret} from "firebase-functions/params";
import {createRemoteJWKSet, jwtVerify} from "jose";
import {onRequestWithSentry} from "../shared/sentryHandlers";

const yahooSecret = defineSecret("Yahoo");
const clientId = "dj0yJmk9ZGlJTE42UXZoUmF0JmQ9WVdrOVJFVjJiRnBJWVZvbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTcy";
const callbackUrl = "https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/yahooOAuthCallback";
const gameUrl = "https://yahoo.roobsworld.com/";
const authorizationUrl = "https://api.login.yahoo.com/oauth2/request_auth";
const tokenUrl = "https://api.login.yahoo.com/oauth2/get_token";
const yahooKeys = createRemoteJWKSet(new URL("https://api.login.yahoo.com/openid/v1/certs"));
const options = {region: "us-central1", timeoutSeconds: 30, secrets: [yahooSecret]};

const signState = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(`riddle-quest:yahoo-oauth-state:${payload}`).digest("base64url");

const createState = (secret: string) => {
  const nonce = randomBytes(24).toString("base64url");
  const value = Buffer.from(JSON.stringify({
    nonce,
    state: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + 10 * 60_000,
  })).toString("base64url");
  return {nonce, signed: `${value}.${signState(value, secret)}`};
};

const verifyState = (signed: string, secret: string) => {
  const [value, signature, extra] = signed.split(".");
  if (!value || !signature || extra) throw new Error("invalid-yahoo-oauth-state");
  const expected = Buffer.from(signState(value, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("invalid-yahoo-oauth-state");
  }
  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (
    !parsed || typeof parsed !== "object" ||
    typeof (parsed as {nonce?: unknown}).nonce !== "string" ||
    typeof (parsed as {state?: unknown}).state !== "string" ||
    typeof (parsed as {expiresAt?: unknown}).expiresAt !== "number" ||
    (parsed as {expiresAt: number}).expiresAt < Date.now()
  ) throw new Error("invalid-yahoo-oauth-state");
  return parsed as {nonce: string; state: string; expiresAt: number};
};

const stateCookieName = "rq_yahoo_state";
const readCookie = (header: string | undefined, name: string) => header?.split(";").map((part) => part.trim())
  .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";

const stateMatchesCookie = (signedState: string, cookieState: string) => {
  const expected = Buffer.from(signedState);
  const received = Buffer.from(cookieState);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const yahooOAuthStart = onRequestWithSentry("yahooOAuthStart", options, async (request, response) => {
  if (request.method !== "GET") { response.status(405).send("Method not allowed"); return; }
  const state = createState(yahooSecret.value());
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

export const yahooOAuthCallback = onRequestWithSentry("yahooOAuthCallback", options, async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (request.method !== "GET") { response.status(405).send("Method not allowed"); return; }
  if (request.query.error) { response.redirect(302, `${gameUrl}?yahoo=cancelled`); return; }
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const signedState = typeof request.query.state === "string" ? request.query.state : "";
  const cookieState = readCookie(request.get("cookie"), stateCookieName);
  response.set("Set-Cookie", `${stateCookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  if (!code || code.length > 4096 || !signedState || signedState.length > 2048 ||
      !stateMatchesCookie(signedState, cookieState)) {
    response.status(400).send("Invalid Yahoo authorization response"); return;
  }
  const state = verifyState(signedState, yahooSecret.value());
  const body = new URLSearchParams({grant_type: "authorization_code", redirect_uri: callbackUrl, code});
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${yahooSecret.value()}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const tokens: unknown = await tokenResponse.json();
  const idToken = tokens && typeof tokens === "object" && typeof (tokens as {id_token?: unknown}).id_token === "string"
    ? (tokens as {id_token: string}).id_token : "";
  if (!tokenResponse.ok || !idToken) throw new Error("yahoo-token-exchange-failed");
  const verified = await jwtVerify(idToken, yahooKeys, {
    issuer: "https://api.login.yahoo.com",
    audience: clientId,
    algorithms: ["RS256"],
  });
  if (verified.payload.nonce !== state.nonce || typeof verified.payload.sub !== "string") {
    throw new Error("invalid-yahoo-id-token");
  }
  const uid = `yahoo:${verified.payload.sub}`;
  const customToken = await getAuth().createCustomToken(uid, {provider: "yahoo"});
  response.redirect(302, `${gameUrl}#yahoo_token=${encodeURIComponent(customToken)}`);
});
