import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../src/data.json", import.meta.url), "utf8"));
const dashboard = await readFile(new URL("../src/content/dashboard/DashboardContent.jsx", import.meta.url), "utf8");

test("the release dashboard reports every target and a concrete output", () => {
  const expected = ["Jest", "Facebook", "Reddit", "YouTube", "Netflix", "Yahoo"];
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
    "itch.io", "CrazyGames", "Discord", "GamePix", "GameDistribution", "GameMonetize", "Yandex Games", "Poki", "Newgrounds", "Coolmath Games", "Kongregate", "Armor Games",
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
  assert.match(dashboard, /queryId="release_automation"/u);
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
