"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const dotenv = require("dotenv");
const {
  EXPECTED_GAME_ID,
  PRIMARY_JEST_ORIGIN,
  PROJECT_ID,
  TRUSTED_CONSUMABLE_SKUS,
  validateDeployEnvironment,
  validateDeployEnvironmentFile,
  validateDeployTarget,
} = require("./validate-deploy-env");

const validEnvironment = () => ({
  JEST_GAME_ID: EXPECTED_GAME_ID,
  JEST_GAME_ORIGIN: PRIMARY_JEST_ORIGIN,
  JEST_PRODUCT_SKUS: TRUSTED_CONSUMABLE_SKUS.join(","),
  JEST_SUBSCRIPTION_SKUS: "com.roobsworld.riddlequest.premium.monthly",
  SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
});

test("accepts the production deployment contract", () => {
  assert.doesNotThrow(() => validateDeployEnvironment(validEnvironment()));
});

test("binds Firebase predeploy validation to the production project", () => {
  assert.doesNotThrow(() => validateDeployTarget({GCLOUD_PROJECT: PROJECT_ID}));
  assert.doesNotThrow(() => validateDeployTarget({}));
  assert.throws(
    () => validateDeployTarget({GCLOUD_PROJECT: "unexpected-project"}),
    /Deployment target must equal.*unexpected-project/,
  );
});

test("keeps the tracked environment example deploy-valid", () => {
  const examplePath = path.resolve(__dirname, "../.env.example");
  const environment = dotenv.parse(fs.readFileSync(examplePath));
  assert.doesNotThrow(() => validateDeployEnvironment(environment));
});

test("documents an unambiguous production Functions deploy command", () => {
  const readme = fs.readFileSync(path.resolve(__dirname, "../../readme.md"), "utf8");
  assert.match(
    readme,
    new RegExp(`pnpm --dir firebase-functions run deploy --project ${PROJECT_ID}`),
  );
  assert.doesNotMatch(
    readme,
    new RegExp(`pnpm --dir firebase-functions deploy --project ${PROJECT_ID}`),
  );
});

test("requires the exact Jest game UUID", () => {
  assert.throws(
    () => validateDeployEnvironment({...validEnvironment(), JEST_GAME_ID: "riddle-quest"}),
    /JEST_GAME_ID must equal/,
  );
});

for (const [label, origin] of [
  ["plaintext", "http://jest.com"],
  ["localhost", "https://localhost:3000"],
  ["untrusted", "https://example.com"],
  ["non-origin URL", "https://jest.com/path"],
]) {
  test(`rejects a ${label} Jest origin`, () => {
    assert.throws(
      () => validateDeployEnvironment({...validEnvironment(), JEST_GAME_ORIGIN: origin}),
      /JEST_GAME_ORIGIN/,
    );
  });
}

test("requires the primary Jest origin", () => {
  assert.throws(
    () => validateDeployEnvironment({
      ...validEnvironment(),
      JEST_GAME_ORIGIN: `https://${EXPECTED_GAME_ID}.builds.jest.com`,
    }),
    /must include https:\/\/jest\.com/,
  );
});

for (const productSkus of [
  TRUSTED_CONSUMABLE_SKUS.slice(0, -1).join(","),
  [...TRUSTED_CONSUMABLE_SKUS, "untrusted.coinpack"].join(","),
  [...TRUSTED_CONSUMABLE_SKUS, TRUSTED_CONSUMABLE_SKUS[0]].join(","),
]) {
  test("rejects incomplete, untrusted, or duplicated consumable configuration", () => {
    assert.throws(
      () => validateDeployEnvironment({...validEnvironment(), JEST_PRODUCT_SKUS: productSkus}),
      /JEST_PRODUCT_SKUS/,
    );
  });
}

for (const subscriptionSkus of [
  "",
  "com.roobsworld.riddlequest.premium.weekly",
  "com.roobsworld.riddlequest.premium.monthly,com.roobsworld.riddlequest.premium.monthly",
]) {
  test("rejects missing, untrusted, or duplicated subscription allowlists", () => {
    assert.throws(
      () => validateDeployEnvironment({...validEnvironment(), JEST_SUBSCRIPTION_SKUS: subscriptionSkus}),
      /JEST_SUBSCRIPTION_SKUS/,
    );
  });
}

for (const sentryDsn of ["http://example.ingest.sentry.io/1", "not-a-url"]) {
  test("rejects insecure or malformed Sentry transport", () => {
    assert.throws(
      () => validateDeployEnvironment({...validEnvironment(), SENTRY_DSN: sentryDsn}),
      /SENTRY_DSN.*HTTPS/,
    );
  });
}

test("allows Sentry to be deliberately disabled", () => {
  const environment = validEnvironment();
  delete environment.SENTRY_DSN;
  assert.doesNotThrow(() => validateDeployEnvironment(environment));
});

test("fails closed when the project-specific environment file is absent", () => {
  const missingPath = path.join(os.tmpdir(), `missing-riddle-quest-env-${process.pid}`);
  assert.throws(() => validateDeployEnvironmentFile(missingPath), /environment file is missing/);
});
