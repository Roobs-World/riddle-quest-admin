// Local viewer for the private Cloud Run dashboard. Collection stays in the cloud.
import {createServer} from "node:http";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const execute = promisify(execFile);
const origin = "https://riddle-quest-monitoring-329028367192.us-central1.run.app";
let credential;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1:4179").pathname;
  if (req.method !== "GET" || !["/", "/api/snapshot"].includes(path)) {res.writeHead(404); return res.end();}
  try {
    if (!credential || credential.expiresAt < Date.now()) {
      const {stdout} = await execute("gcloud", ["auth", "print-identity-token"], {timeout: 20000});
      credential = {value: stdout.trim(), expiresAt: Date.now() + 45 * 60000};
    }
    const response = await fetch(`${origin}${path}`, {headers: {Authorization: `Bearer ${credential.value}`}, redirect: "error", signal: AbortSignal.timeout(30000)});
    res.writeHead(response.status, {"Content-Type": response.headers.get("content-type") ?? "text/plain", "Cache-Control": "no-store"});
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(502, {"Content-Type": "text/plain", "Cache-Control": "no-store"});
    res.end("Private monitoring is unavailable. Check your Google Cloud sign-in and service health.");
  }
});
server.listen(4179, "127.0.0.1", () => console.log("Private monitoring viewer: http://127.0.0.1:4179"));
