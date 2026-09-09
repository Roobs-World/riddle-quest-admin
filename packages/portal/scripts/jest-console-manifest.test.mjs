import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

import {
  validateInformationModalSource,
  validateJestConsoleManifest,
  validateJestConsoleManifestRecord,
} from "./validate-jest-console-manifest.mjs";

const repositoryDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const manifestPath = path.join(repositoryDirectory, "docs/jest-developer-console.json");
const readManifest = async () => JSON.parse(await readFile(manifestPath, "utf8"));

test("the desired Jest Console manifest matches repository assets and SDK configuration", async () => {
  const result = await validateJestConsoleManifest({repositoryDirectory});
  assert.deepEqual(result.unresolvedOwnerFields, []);
});

test("the owner-approved manifest passes strict release readiness", async () => {
  const manifest = await readManifest();
  assert.doesNotThrow(() => validateJestConsoleManifestRecord(manifest, {releaseReady: true}));
});

test("submission guidance cannot pin a historical build as the current active version", async () => {
  const readiness = await readFile(
    path.join(repositoryDirectory, "docs/jest-submission-readiness.html"),
    "utf8",
  );
  const requiredSection = readiness.match(
    /<section class="panel"><h2>Required before submission<\/h2>([\s\S]*?)<\/section>/u,
  )?.[1];

  assert.ok(requiredSection, "submission readiness must retain its required-actions section");
  assert.doesNotMatch(requiredSection, /[0-9a-f]{8}-[0-9a-f-]{27,}/iu);
  assert.match(requiredSection, /current active version/u);
});

test("release-readiness fails closed if publisher and privacy approval are removed", async () => {
  const manifest = await readManifest();
  const unresolvedManifest = structuredClone(manifest);
  unresolvedManifest.ownerApprovedValues.publisherDisplayName = null;
  unresolvedManifest.ownerApprovedValues.privacyPolicyUrl = null;
  assert.throws(
    () => validateJestConsoleManifestRecord(unresolvedManifest, {releaseReady: true}),
    /privacyPolicyUrl, publisherDisplayName/,
  );
});

test("approved privacy metadata stays Console-only and cannot create in-game navigation", async () => {
  const manifest = await readManifest();
  const result = await validateJestConsoleManifest({
    manifest,
    repositoryDirectory,
  });
  assert.deepEqual(result.unresolvedOwnerFields, []);

  const informationSource = await readFile(
    path.join(
      repositoryDirectory,
      "packages/portal/src/play/modalPages/information/InformationModalPages.tsx",
    ),
    "utf8",
  );
  validateInformationModalSource(informationSource, {supportEmail: manifest.supportEmail});
  assert.throws(
    () => validateInformationModalSource(
      `${informationSource}\nconst unavailableRow = "PRIVACY_POLICY";`,
      {supportEmail: manifest.supportEmail},
    ),
    /must not render unavailable row: PRIVACY_POLICY/,
  );
  assert.throws(
    () => validateInformationModalSource(
      `${informationSource}\n<a href="https://example.com/privacy">Privacy</a>`,
      {supportEmail: manifest.supportEmail},
    ),
    /must not embed external/,
  );
  assert.throws(
    () => validateInformationModalSource(
      informationSource.replace(
        'href="./third-party-licenses.txt"',
        'href="./third-party-licenses.txt" target="_blank"',
      ),
      {supportEmail: manifest.supportEmail},
    ),
    /must not open another browsing context/,
  );
});

test("ordinary builds validate known Console fields without claiming owner approval", async () => {
  const portalPackage = JSON.parse(await readFile(
    path.join(repositoryDirectory, "packages/portal/package.json"),
    "utf8",
  ));
  const rootPackage = JSON.parse(await readFile(path.join(repositoryDirectory, "package.json"), "utf8"));
  assert.match(portalPackage.scripts["build:jest"], /pnpm check:jest-console(?:\s|$)/);
  assert.doesNotMatch(portalPackage.scripts["build:jest"], /check:jest-console:release/);
  assert.doesNotMatch(rootPackage.scripts["verify:production"], /check:jest-console:release/);
});

test("known public identity and bounded listing copy cannot drift", async () => {
  const manifest = await readManifest();
  assert.throws(
    () => validateJestConsoleManifestRecord({...manifest, supportEmail: "support@example.invalid"}),
    /supportEmail must be grindheadgames@gmail\.com/,
  );
  assert.throws(
    () => validateJestConsoleManifestRecord({...manifest, shortDescription: "x".repeat(111)}),
    /at most 110 characters/,
  );
  assert.throws(
    () => validateJestConsoleManifestRecord({...manifest, keywords: []}),
    /keywords must be exactly: riddles/,
  );
  assert.throws(
    () => validateJestConsoleManifestRecord({...manifest, keywords: ["puzzles"]}),
    /keywords must be exactly: riddles/,
  );
  const insecurePrivacyManifest = structuredClone(manifest);
  insecurePrivacyManifest.ownerApprovedValues.privacyPolicyUrl = "http://example.com/privacy";
  assert.throws(
    () => validateJestConsoleManifestRecord(insecurePrivacyManifest),
    /public HTTPS URL without credentials/,
  );
  const gamePageAsPrivacyManifest = structuredClone(manifest);
  gamePageAsPrivacyManifest.ownerApprovedValues.privacyPolicyUrl = `${manifest.publicUrl}/?view=privacy#policy`;
  assert.throws(
    () => validateJestConsoleManifestRecord(gamePageAsPrivacyManifest),
    /must not be the canonical public game URL/,
  );
  for (const invalidPublisher of ["grindheadgames@gmail.com", "https://example.com/publisher"]) {
    const invalidPublisherManifest = structuredClone(manifest);
    invalidPublisherManifest.ownerApprovedValues.publisherDisplayName = invalidPublisher;
    assert.throws(
      () => validateJestConsoleManifestRecord(invalidPublisherManifest),
      /must be a publisher name, not an email address or URL/,
    );
  }
  const changedPublisherManifest = structuredClone(manifest);
  changedPublisherManifest.ownerApprovedValues.publisherDisplayName = "Another Publisher";
  assert.throws(
    () => validateJestConsoleManifestRecord(changedPublisherManifest),
    /publisherDisplayName must be Jest/,
  );
  const changedPrivacyManifest = structuredClone(manifest);
  changedPrivacyManifest.ownerApprovedValues.privacyPolicyUrl = "https://example.com/riddle-quest/privacy";
  assert.throws(
    () => validateJestConsoleManifestRecord(changedPrivacyManifest),
    /privacyPolicyUrl must be https:\/\/roobsworld\.com\/privacy/,
  );
});

test("asset bytes are bound to the reviewed checksums", async () => {
  const manifest = await readManifest();
  const changed = structuredClone(manifest);
  changed.assets.logo.sha256 = "0".repeat(64);
  await assert.rejects(
    validateJestConsoleManifest({manifest: changed, repositoryDirectory}),
    /assets\.logo checksum does not match/,
  );
});
