import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requirements = new Map([
  ["AGENTS.md", ["Jest", "Facebook Instant Games", "Reddit Devvit Web", "same-origin under `/api/*`", "Facebook-only"]],
  ["readme.md", ["Reddit Devvit Web", "packages/reddit-app", "docs/reddit-games-operations.md"]],
  ["docs/privacy-data-inventory.md", ["### Reddit Devvit platform data", "reddit_<40 hex>", "Devvit Redis is not used as canonical"]],
  ["docs/credential-rotation-runbook.md", ["REDDIT_GATEWAY_SECRET", "REDDIT_UID_SECRET", "redditGatewaySecret"]],
  ["docs/reddit-games-operations.md", ["same-origin `/api/*`", "exchangeRedditIdentity", "release:gate", "physical iOS and Android"]],
  ["docs/reddit-incident-response.md", ["REDDIT_DISABLED_FEATURES", "uncertain upload", "UID-secret exposure"]],
  ["docs/reddit-moderation-runbook.md", ["not yet implemented", "must not create duplicate", "will not add chat"]],
]);

export async function auditDocumentation(base = root) {
  const errors = [];
  for (const [relative, needles] of requirements) {
    const text = await readFile(path.join(base, relative), "utf8");
    for (const needle of needles) if (!text.includes(needle)) errors.push(`${relative}: missing ${needle}`);
  }
  const agents = await readFile(path.join(base, "AGENTS.md"), "utf8");
  if (/build both standalone target artifacts/.test(agents)) errors.push("AGENTS.md: stale two-target build instruction");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await auditDocumentation();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log(`Reddit documentation audit passed (${requirements.size} files).`);
}
