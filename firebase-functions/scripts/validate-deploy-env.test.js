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
  validateFacebookDeployEnvironment,
  validateRedditDeployEnvironment,
  validateDeployTarget,
} = require("./validate-deploy-env");

const validRedditEnvironment = () => ({
  REDDIT_APP_NAME: "riddle-quest",
  REDDIT_FIREBASE_GATEWAY_HOST: "us-central1-riddle-quest-ec2b2.cloudfunctions.net",
  REDDIT_DISABLED_FEATURES: "commerce,notifications,presence",
  REDDIT_APPROVED_FEATURES: "",
  REDDIT_COMMERCE_SANDBOX_ENABLED: "0",
});

test("requires an explicit Reddit sandbox-commerce gate", () => {
  assert.doesNotThrow(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_COMMERCE_SANDBOX_ENABLED: "1",
  }));
  for (const value of [undefined, "", "true", "2"]) {
    assert.throws(() => validateRedditDeployEnvironment({
      ...validRedditEnvironment(), REDDIT_COMMERCE_SANDBOX_ENABLED: value,
    }), /REDDIT_COMMERCE_SANDBOX_ENABLED/);
  }
});

test("accepts only externally approval-gated Reddit capability activations", () => {
  assert.doesNotThrow(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_APPROVED_FEATURES: "commerce,notifications",
  }));
  assert.throws(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_APPROVED_FEATURES: "presence",
  }), /REDDIT_APPROVED_FEATURES/);
  assert.throws(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_APPROVED_FEATURES: "notifications,notifications",
  }), /REDDIT_APPROVED_FEATURES/);
});

test("validates Reddit kill switches and rejects unknown or duplicate capabilities", () => {
  assert.doesNotThrow(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_DISABLED_FEATURES: "identity,gameplay,tournaments",
  }));
  assert.throws(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_DISABLED_FEATURES: "gameply",
  }), /REDDIT_DISABLED_FEATURES/);
  assert.throws(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_DISABLED_FEATURES: "presence,presence",
  }), /REDDIT_DISABLED_FEATURES/);
});

test("accepts only the exact Reddit app and reviewed Firebase host", () => {
  assert.doesNotThrow(() => validateRedditDeployEnvironment(validRedditEnvironment()));
  assert.throws(() => validateRedditDeployEnvironment({}), /REDDIT_APP_NAME/);
  assert.throws(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_APP_NAME: "lookalike-app",
  }), /REDDIT_APP_NAME/);
  assert.throws(() => validateRedditDeployEnvironment({
    ...validRedditEnvironment(), REDDIT_FIREBASE_GATEWAY_HOST: "example.com",
  }), /REDDIT_FIREBASE_GATEWAY_HOST/);
});

const validFacebookEnvironment = () => ({
  FACEBOOK_APP_ID: "123456789012345",
  FACEBOOK_FIREBASE_APP_ID: "1:123456789012:web:abcdef1234567890",
  FACEBOOK_GAME_ORIGINS: "https://www.facebook.com,https://apps.facebook.com",
  FACEBOOK_DELETION_STATUS_BASE_URL: "https://europe-west2-riddle-quest-ec2b2.cloudfunctions.net/facebookDataDeletionStatus",
  FACEBOOK_DISABLED_FEATURES: "commerce,rewarded_ads,notifications",
});

test("accepts the complete non-secret Facebook deployment contract", () => {
  assert.doesNotThrow(() => validateFacebookDeployEnvironment(validFacebookEnvironment()));
});

test("rejects absent or malformed Facebook deployment configuration", () => {
  assert.throws(() => validateFacebookDeployEnvironment({}), /FACEBOOK_APP_ID/);
  assert.throws(() => validateFacebookDeployEnvironment({
    ...validFacebookEnvironment(), FACEBOOK_APP_ID: "page-name",
  }), /FACEBOOK_APP_ID/);
  assert.throws(() => validateFacebookDeployEnvironment({
    ...validFacebookEnvironment(), FACEBOOK_FIREBASE_APP_ID: "not-an-app-id",
  }), /FACEBOOK_FIREBASE_APP_ID/);
});

test("rejects unsafe origins, deletion URLs, and feature switches", () => {
  assert.throws(() => validateFacebookDeployEnvironment({
    ...validFacebookEnvironment(), FACEBOOK_GAME_ORIGINS: "http://localhost:3000/path",
  }), /FACEBOOK_GAME_ORIGINS/);
  assert.throws(() => validateFacebookDeployEnvironment({
    ...validFacebookEnvironment(), FACEBOOK_DELETION_STATUS_BASE_URL: "http://example.com/#token",
  }), /FACEBOOK_DELETION_STATUS_BASE_URL/);
  assert.throws(() => validateFacebookDeployEnvironment({
    ...validFacebookEnvironment(), FACEBOOK_DISABLED_FEATURES: "commerce,unknown",
  }), /FACEBOOK_DISABLED_FEATURES/);
});

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
  assert.throws(() => validateFacebookDeployEnvironment(environment), /FACEBOOK_APP_ID/);
});

test("binds the Facebook backend command to the complete backend release unit", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["deploy:facebook-backend"],
    "pnpm preflight:facebook-backend && firebase deploy --only functions,firestore:rules,firestore:indexes,database,storage --project riddle-quest-ec2b2",
  );
  assert.match(packageJson.scripts["preflight:facebook-backend"], /REQUIRE_FACEBOOK_DEPLOY_CONFIG=1/);
  assert.doesNotMatch(packageJson.scripts["deploy:facebook-backend"], /functions:/);
});

test("binds the Reddit backend command to the complete backend release unit", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["deploy:reddit-backend"],
    "pnpm preflight:reddit-backend && firebase deploy --only functions,firestore:rules,firestore:indexes,database,storage --project riddle-quest-ec2b2",
  );
  assert.match(packageJson.scripts["preflight:reddit-backend"], /REQUIRE_REDDIT_DEPLOY_CONFIG=1/);
  assert.doesNotMatch(packageJson.scripts["deploy:reddit-backend"], /functions:/);
});

test("documents an unambiguous production Functions deploy command", () => {
  const readme = fs.readFileSync(path.resolve(__dirname, "../../docs/common/project/README.md"), "utf8");
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
