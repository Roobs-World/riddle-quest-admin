import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../src/data.json", import.meta.url), "utf8"));
const dashboard = await readFile(new URL("../src/content/dashboard/DashboardContent.jsx", import.meta.url), "utf8");

test("the release dashboard reports every target and a concrete output", () => {
  const expected = ["Jest", "Facebook", "Reddit", "YouTube", "Netflix", "Yahoo", "itch.io", "CrazyGames", "Newgrounds"];
  const releases = data.queries.provider_release_evidence.rows;

  assert.deepEqual(releases.map(({platform}) => platform).sort(), expected.sort());
  for (const release of releases) {
    assert.ok(release.providerReference.trim(), `${release.platform} is missing a provider reference`);
    assert.ok(release.artifact.trim(), `${release.platform} is missing an output`);
    assert.ok(release.state.trim(), `${release.platform} is missing a provider state`);
    assert.ok(release.submissionProgress.trim(), `${release.platform} is missing submission progress`);
    assert.ok(release.nextGate.trim(), `${release.platform} is missing a next gate`);
  }
});

test("the provider evidence table renders the output column", () => {
  assert.match(dashboard, /\{key:"artifact",label:"Output"\}/u);
  assert.match(dashboard, /\{key:"submissionProgress",label:"Submission progress"\}/u);
});

test("the dashboard tracks additional HTML5 distribution submissions", () => {
  const candidates = data.queries.html5_distribution_candidates.rows;

  assert.deepEqual(candidates.map(({platform}) => platform), [
    "itch.io", "CrazyGames", "Discord", "GamePix", "GameDistribution", "GameMonetize", "Yandex Games", "Poki", "Newgrounds", "Coolmath Games", "Kongregate", "Armor Games", "Game Jolt", "Addicting Games", "HTMLGames.com", "PlayKovo", "Lagged", "Google GameSnacks",
  ]);
  assert.ok(candidates.every(({submissionProgress}) => submissionProgress.trim()));
  assert.match(candidates.find(({platform}) => platform === "Discord").submissionProgress, /non-exclusive/iu);
  assert.match(candidates.find(({platform}) => platform === "Poki").submissionProgress, /on hold/iu);
  assert.match(dashboard, /queryId="html5_distribution_candidates"/u);
});

test("dashboard integration metrics match reviewed rows", () => {
  const platforms = data.queries.platform_status.rows;
  const services = data.queries.service_status.rows;

  assert.equal(platforms.filter(({integration}) => integration.startsWith("Implemented")).length, 5);
  assert.equal(platforms.filter(({localValidation}) => /passed/iu.test(localValidation)).length, 6);
  assert.equal(services.filter(({status}) => status === "Integrated").length, 4);
});

test("the dashboard exposes the latest release automation receipt", () => {
  const rows = data.queries.release_automation.rows;
  assert.ok(rows.some(({platform}) => platform === "All configured targets"));
  assert.ok(rows.some(({platform}) => platform === "itch.io"));
  assert.ok(rows.some(({platform}) => platform === "CrazyGames"));
  assert.ok(rows.some(({platform}) => platform === "Newgrounds"));
  assert.ok(rows.some(({platform}) => platform === "Game Jolt"));
  assert.ok(rows.some(({platform}) => platform === "Coolmath Games"));
  assert.ok(rows.some(({platform}) => platform === "Armor Games"));
  assert.ok(rows.some(({platform}) => platform === "GamePix"));
  assert.ok(rows.some(({platform}) => platform === "Addicting Games"));
  assert.ok(rows.some(({platform}) => platform === "HTMLGames.com"));
  assert.ok(rows.some(({platform}) => platform === "PlayKovo"));
  assert.ok(rows.some(({platform}) => platform === "Kongregate"));
  assert.ok(rows.some(({platform}) => platform === "Lagged"));
  assert.ok(rows.some(({platform}) => platform === "Google GameSnacks"));
  assert.match(dashboard, /queryId="release_automation"/u);
});

test("the dashboard provides one source-backed manual checklist covering every release platform", () => {
  const actions = data.queries.manual_action_checklist.rows;
  const coveredPlatforms = new Set(actions.map(({platform}) => platform));
  const expectedPlatforms = new Set([
    ...data.queries.provider_release_evidence.rows.map(({platform}) => platform),
    ...data.queries.html5_distribution_candidates.rows.map(({platform}) => platform),
  ]);

  for (const platform of expectedPlatforms) {
    assert.ok(coveredPlatforms.has(platform), `${platform} is missing from the manual checklist`);
  }
  assert.ok(actions.length >= expectedPlatforms.size);
  assert.ok(actions.every(({status, priority, action, unlocks}) =>
    status.trim() && priority.trim() && action.trim() && unlocks.trim()));
  assert.ok(actions.every(({destination}) => destination === "" || /^https:\/\//u.test(destination)));
  assert.match(dashboard, /queryId="manual_action_checklist"/u);
  assert.match(dashboard, /title="Your manual release checklist"/u);
});

test("the dashboard reports IAP and advertising policy for every release platform", () => {
  const monetization = data.queries.monetization_readiness.rows;
  const expectedPlatforms = new Set([
    ...data.queries.provider_release_evidence.rows.map(({platform}) => platform),
    ...data.queries.html5_distribution_candidates.rows.map(({platform}) => platform),
  ]);
  assert.deepEqual(new Set(monetization.map(({platform}) => platform)), expectedPlatforms);
  assert.ok(monetization.every(({iap, ads, gate}) => iap.trim() && ads.trim() && gate.trim()));
  assert.match(monetization.find(({platform}) => platform === "Facebook").ads, /Implemented/iu);
  assert.match(monetization.find(({platform}) => platform === "Reddit").iap, /Implemented/iu);
  assert.match(monetization.find(({platform}) => platform === "Yahoo").iap, /Implemented/iu);
  assert.match(monetization.find(({platform}) => platform === "YouTube").iap, /Prohibited/iu);
  assert.match(dashboard, /queryId="monetization_readiness"/u);
});

test("the dashboard uses source-owned shadcn primitives for operational UI", async () => {
  const shadcn = await readFile(new URL("../src/content/dashboard/shadcn-ui.jsx", import.meta.url), "utf8");
  const config = JSON.parse(await readFile(new URL("../components.json", import.meta.url), "utf8"));
  assert.equal(config.style, "new-york");
  for (const component of ["Badge", "Button", "Card", "Progress", "Table"]) {
    assert.match(shadcn, new RegExp(`export function ${component}\\b`, "u"));
  }
  assert.match(dashboard, /from "\.\/shadcn-ui\.jsx"/u);
  assert.match(dashboard, /id="release-queue-summary"/u);
});

test("the dashboard publishes its desktop, mobile and output-coverage E2E results", () => {
  const checks = data.queries.dashboard_verification.rows;

  assert.deepEqual(checks.map(({check}) => check), [
    "Release output coverage",
    "Desktop rendering and source inspection",
    "Responsive rendering",
  ]);
  assert.ok(checks.every(({result}) => result === "Passed"));
  assert.match(dashboard, /queryId="dashboard_verification"/u);
});
