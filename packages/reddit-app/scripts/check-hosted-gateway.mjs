const url = "https://www.roobsworld.com/api/reddit-gateway/redditStorage";

let response;
try {
  response = await fetch(url, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: "{}",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
} catch (error) {
  throw new Error(`hosted-reddit-gateway-unreachable: ${error instanceof Error ? error.message : String(error)}`);
}

const contentType = response.headers.get("content-type") ?? "";
let body;
if (contentType.includes("application/json")) {
  try {
    body = await response.json();
  } catch {
    // A broken JSON response cannot satisfy the route contract.
  }
}
if (response.status !== 401 || body?.error !== "signature-required") {
  throw new Error(`hosted-reddit-gateway-not-live: HTTP ${response.status}, content-type ${contentType || "missing"}`);
}
console.log("Hosted Reddit gateway route is live and rejects unsigned requests");
