// One-time OAuth connection. Credentials go directly to the private monitoring
// bucket; they never enter the dashboard, repository, command line or logs.
import {createServer} from "node:http";
import {randomBytes, createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {writeFile} from "node:fs/promises";
import {googleClient, snapshotStore} from "./google.mjs";
import {readJestAnalytics, dailyActivity} from "./jest-provider.mjs";

const redirectUri = "http://127.0.0.1:4180/oauth/callback";
const state = randomBytes(32).toString("base64url");
const verifier = randomBytes(48).toString("base64url");
const registration = await fetch("https://auth.jest.com/oauth2/register", {
  method: "POST", headers: {"Content-Type": "application/json"}, redirect: "error", signal: AbortSignal.timeout(15000),
  body: JSON.stringify({client_name: "Riddle Quest automatic monitoring", redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none",
    application_type: "native", scope: "mcp:developer offline_access"}),
});
if (!registration.ok) throw new Error(`Jest OAuth client registration returned ${registration.status}`);
const client = await registration.json();
if (!client.client_id || client.token_endpoint_auth_method !== "none") throw new Error("Unexpected Jest OAuth client configuration");
const authorization = new URL("https://auth.jest.com/oauth2/auth");
for (const [key, value] of Object.entries({client_id: client.client_id, redirect_uri: redirectUri, response_type: "code",
  scope: "mcp:developer offline_access", resource: "https://jest.com/mcp", state,
  code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256"})) authorization.searchParams.set(key, value);

let used = false;
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url, "http://127.0.0.1:4180");
  if (req.method !== "GET" || url.pathname !== "/oauth/callback" || url.searchParams.get("state") !== state || used) {
    res.writeHead(400); return res.end("Invalid OAuth callback.");
  }
  used = true;
  try {
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Authorization did not return a code");
    const response = await fetch("https://auth.jest.com/oauth2/token", {method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({grant_type: "authorization_code", client_id: client.client_id, code, redirect_uri: redirectUri, code_verifier: verifier})});
    if (!response.ok) throw new Error(`Jest OAuth exchange returned ${response.status}`);
    const token = await response.json();
    if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in)) throw new Error("Offline Jest access was not granted");
    const rows = dailyActivity(await readJestAnalytics(token.access_token));
    const googleToken = execFileSync("gcloud", ["auth", "print-access-token"], {encoding: "utf8"}).trim();
    const store = snapshotStore(googleClient({accessToken: googleToken}), "riddle-quest-monitoring-ec2b2");
    const previous = await store.read("jest-oauth.json");
    await store.write("jest-oauth.json", {clientId: client.client_id, accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000}, previous?.generation ?? "0");
    console.log(`Jest connected: ${rows.length} completed reporting days verified; offline credentials stored privately.`);
    res.end("Jest analytics connected to automatic monitoring. You can close this tab.");
  } catch {
    console.error("Jest connection failed during authorization or the verification read. No credential was logged.");
    res.writeHead(502); res.end("Connection failed. Check the local setup command for a sanitized error.");
  } finally {server.close();}
});
server.listen(4180, "127.0.0.1", async () => {
  await writeFile("/tmp/riddle-monitor-jest-authorization-url.txt", authorization.toString(), {mode: 0o600});
  console.log("OAuth setup listening on 127.0.0.1:4180; authorization URL saved to /tmp/riddle-monitor-jest-authorization-url.txt");
});
setTimeout(() => {console.error("OAuth connection timed out after 15 minutes."); server.close();}, 15 * 60000).unref();
