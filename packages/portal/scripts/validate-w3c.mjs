import {readFile} from "node:fs/promises";
import path from "node:path";

const documentPath = path.resolve(process.cwd(), process.argv[2] || "dist-jest/index.html");
const html = await readFile(documentPath, "utf8");
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);

let response;
try {
  response = await fetch("https://validator.w3.org/nu/?out=json", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "text/html; charset=utf-8",
      "User-Agent": "Riddle-Quest-W3C-Validation/1.0",
    },
    body: html,
    signal: controller.signal,
  });
  if (response.status === 429) {
    console.warn("W3C validator rate-limited the request; retrying with the Nu validator mirror.");
    response = await fetch("https://validator.nu/?out=json", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "text/html; charset=utf-8",
        "User-Agent": "Riddle-Quest-W3C-Validation/1.0",
      },
      body: html,
      signal: controller.signal,
    });
  }
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  throw new Error(`W3C validator request failed with HTTP ${response.status}`);
}

const result = await response.json();
const messages = Array.isArray(result.messages) ? result.messages : [];
if (messages.length > 0) {
  const details = messages.map((message) => {
    const location = message.lastLine ? `line ${message.lastLine}` : "unknown location";
    return `${message.type ?? "message"} at ${location}: ${message.message ?? "Unknown validation finding"}`;
  });
  throw new Error(`W3C HTML validation reported ${messages.length} finding(s):\n${details.join("\n")}`);
}

console.log(`W3C HTML validation passed with zero findings: ${documentPath}`);
