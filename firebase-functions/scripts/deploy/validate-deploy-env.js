#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const PROJECT_ID = "riddle-quest-ec2b2";
const DEPLOY_ENV_PATH = path.resolve(__dirname, `../../.env.${PROJECT_ID}`);
const FACEBOOK_FEATURES = new Set([
  "identity", "commerce", "rewarded_ads", "interstitials", "referrals",
  "notifications", "matchmaking", "tournaments", "presence",
]);

function parseRequiredList(environment, name, errors) {
  const candidate = environment[name]?.trim();
  if (!candidate) {
    errors.push(`${name} must contain at least one value.`);
    return [];
  }
  const values = candidate.split(",").map((value) => value.trim());
  if (values.some((value) => value.length === 0)) {
    errors.push(`${name} must not contain empty values.`);
  }
  const nonEmptyValues = values.filter(Boolean);
  if (new Set(nonEmptyValues).size !== nonEmptyValues.length) {
    errors.push(`${name} must not contain duplicate values.`);
  }
  return nonEmptyValues;
}

function validateSentry(environment, errors) {
  const candidate = environment.SENTRY_DSN?.trim();
  if (!candidate) return;
  try {
    if (new URL(candidate).protocol !== "https:") {
      errors.push("SENTRY_DSN must use HTTPS when configured.");
    }
  } catch {
    errors.push("SENTRY_DSN must be a valid HTTPS URL when configured.");
  }
}

function validateFacebookDeployEnvironment(environment) {
  const errors = [];
  if (!/^\d{5,32}$/u.test(environment.FACEBOOK_APP_ID?.trim() ?? "")) {
    errors.push("FACEBOOK_APP_ID must be a 5-32 digit Meta app ID.");
  }
  if (!/^1:\d{5,32}:web:[a-f0-9]{8,64}$/u.test(environment.FACEBOOK_FIREBASE_APP_ID?.trim() ?? "")) {
    errors.push("FACEBOOK_FIREBASE_APP_ID must be a canonical Firebase web app ID.");
  }
  const origins = parseRequiredList(environment, "FACEBOOK_GAME_ORIGINS", errors);
  if (origins.length > 8) errors.push("FACEBOOK_GAME_ORIGINS must contain at most eight origins.");
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname.toLowerCase().replace(/\.$/u, "");
      if (parsed.protocol !== "https:" || parsed.origin !== origin ||
        hostname === "localhost" || hostname.endsWith(".localhost") ||
        hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
        errors.push(`FACEBOOK_GAME_ORIGINS must contain canonical non-local HTTPS origins: ${origin}`);
      }
    } catch {
      errors.push(`FACEBOOK_GAME_ORIGINS contains an invalid URL: ${origin}`);
    }
  }
  try {
    const deletionUrl = new URL(environment.FACEBOOK_DELETION_STATUS_BASE_URL?.trim() ?? "");
    if (deletionUrl.protocol !== "https:" || deletionUrl.username || deletionUrl.password || deletionUrl.hash) {
      errors.push("FACEBOOK_DELETION_STATUS_BASE_URL must be an HTTPS URL without credentials or fragment.");
    }
  } catch {
    errors.push("FACEBOOK_DELETION_STATUS_BASE_URL must be a valid HTTPS URL.");
  }
  const disabled = environment.FACEBOOK_DISABLED_FEATURES?.trim();
  if (disabled) {
    const values = disabled.split(",").map((value) => value.trim());
    if (values.some((value) => !FACEBOOK_FEATURES.has(value)) || new Set(values).size !== values.length) {
      errors.push("FACEBOOK_DISABLED_FEATURES contains an unknown or duplicate capability.");
    }
  }
  if (environment.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED !== undefined &&
    !["0", "1"].includes(environment.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED.trim())) {
    errors.push("FACEBOOK_PAYMENTS_WEBHOOK_ENABLED must be 0 or 1 when configured.");
  }
  if (environment.FACEBOOK_PAYMENT_ENVIRONMENTS !== undefined) {
    const values = environment.FACEBOOK_PAYMENT_ENVIRONMENTS.split(",").map(value => value.trim());
    if (values.some(value => !["PROD", "DEV", "DEV_EXTERNAL", "TEST"].includes(value)) ||
      new Set(values).size !== values.length) {
      errors.push("FACEBOOK_PAYMENT_ENVIRONMENTS must contain unique PROD, DEV, DEV_EXTERNAL or TEST values.");
    }
  }
  if (errors.length > 0) {
    throw new Error(`Facebook deployment environment validation failed:\n- ${errors.join("\n- ")}`);
  }
}

function validateRedditDeployEnvironment(environment) {
  const errors = [];
  const redditFeatures = new Set([
    "identity", "gameplay", "commerce", "referrals", "notifications",
    "matchmaking", "tournaments", "presence",
  ]);
  const redditApprovalGatedFeatures = new Set(["commerce", "notifications"]);
  if (environment.REDDIT_APP_NAME?.trim() !== "riddle-quest") {
    errors.push("REDDIT_APP_NAME must equal riddle-quest.");
  }
  if (environment.REDDIT_FIREBASE_GATEWAY_HOST?.trim() !==
    "us-central1-riddle-quest-ec2b2.cloudfunctions.net") {
    errors.push("REDDIT_FIREBASE_GATEWAY_HOST must equal the reviewed production Functions host.");
  }
  const disabled = environment.REDDIT_DISABLED_FEATURES?.trim();
  if (disabled) {
    const values = disabled.split(",").map((value) => value.trim());
    if (values.some((value) => !redditFeatures.has(value)) || new Set(values).size !== values.length) {
      errors.push("REDDIT_DISABLED_FEATURES contains an unknown or duplicate capability.");
    }
  }
  const approved = environment.REDDIT_APPROVED_FEATURES?.trim();
  if (approved) {
    const values = approved.split(",").map((value) => value.trim());
    if (values.some((value) => !redditApprovalGatedFeatures.has(value)) || new Set(values).size !== values.length) {
      errors.push("REDDIT_APPROVED_FEATURES contains an unknown or duplicate capability.");
    }
  }
  if (!/^[01]$/.test(environment.REDDIT_COMMERCE_SANDBOX_ENABLED?.trim() ?? "")) {
    errors.push("REDDIT_COMMERCE_SANDBOX_ENABLED must equal 0 or 1.");
  }
  if (errors.length > 0) throw new Error(`Reddit deployment environment validation failed:\n- ${errors.join("\n- ")}`);
}

function validateDeployEnvironment(environment) {
  const errors = [];
  validateFacebookDeployEnvironment(environment);
  validateSentry(environment, errors);
  if (errors.length > 0) {
    throw new Error(`Deployment environment validation failed:\n- ${errors.join("\n- ")}`);
  }
}

/** Rejects a Firebase CLI hook targeting any project other than production. */
function validateDeployTarget(environment) {
  const activeProject = environment.GCLOUD_PROJECT?.trim();
  if (activeProject && activeProject !== PROJECT_ID) {
    throw new Error(
      `Deployment target must equal ${PROJECT_ID}; Firebase CLI selected ${activeProject}.`,
    );
  }
}

function validateDeployEnvironmentFile(filePath = DEPLOY_ENV_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment environment file is missing: ${filePath}`);
  }
  const environment = dotenv.parse(fs.readFileSync(filePath));
  validateDeployEnvironment(environment);
  return filePath;
}

if (require.main === module) {
  validateDeployTarget(process.env);
  const filePath = validateDeployEnvironmentFile();
  if (process.env.REQUIRE_FACEBOOK_DEPLOY_CONFIG === "1") {
    const environment = dotenv.parse(fs.readFileSync(filePath));
    validateFacebookDeployEnvironment(environment);
  }
  if (process.env.REQUIRE_REDDIT_DEPLOY_CONFIG === "1") {
    const environment = dotenv.parse(fs.readFileSync(filePath));
    validateRedditDeployEnvironment(environment);
  }
  console.log(`Validated Firebase deployment environment: ${filePath}`);
}

module.exports = {
  DEPLOY_ENV_PATH,
  PROJECT_ID,
  validateDeployEnvironment,
  validateDeployEnvironmentFile,
  validateFacebookDeployEnvironment,
  validateRedditDeployEnvironment,
  validateDeployTarget,
};
