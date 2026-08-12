#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const PROJECT_ID = "riddle-quest-ec2b2";
const EXPECTED_GAME_ID = "019faa68-f3ec-755d-9ab5-c887fb426801";
const DEPLOY_ENV_PATH = path.resolve(__dirname, `../.env.${PROJECT_ID}`);
const PRIMARY_JEST_ORIGIN = "https://jest.com";
const TRUSTED_JEST_ORIGINS = new Set([
  PRIMARY_JEST_ORIGIN,
  `https://${EXPECTED_GAME_ID}.builds.jest.com`,
]);
const TRUSTED_CONSUMABLE_SKUS = Object.freeze([
  "com.roobsworld.riddlequest.coinpack1",
  "com.roobsworld.riddlequest.coinpack2",
  "com.roobsworld.riddlequest.coinpack3",
  "com.roobsworld.riddlequest.coinpack4",
  "com.roobsworld.riddlequest.coinpack5",
  "com.roobsworld.riddlequest.coinpack6",
]);
const TRUSTED_SUBSCRIPTION_SKUS = new Set([
  "com.roobsworld.riddlequest.premium.monthly",
  "com.roobsworld.riddlequest.premium.yearly",
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

function validateOrigins(environment, errors) {
  const origins = parseRequiredList(environment, "JEST_GAME_ORIGIN", errors);
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      errors.push(`JEST_GAME_ORIGIN contains an invalid URL: ${origin}`);
      continue;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (parsed.protocol !== "https:") {
      errors.push(`JEST_GAME_ORIGIN must use HTTPS: ${origin}`);
    }
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      errors.push(`JEST_GAME_ORIGIN must not contain a localhost origin: ${origin}`);
    }
    if (parsed.origin !== origin || !TRUSTED_JEST_ORIGINS.has(origin)) {
      errors.push(`JEST_GAME_ORIGIN contains an untrusted Jest origin: ${origin}`);
    }
  }
  if (!origins.includes(PRIMARY_JEST_ORIGIN)) {
    errors.push(`JEST_GAME_ORIGIN must include ${PRIMARY_JEST_ORIGIN}.`);
  }
}

function validateConsumables(environment, errors) {
  const configured = parseRequiredList(environment, "JEST_PRODUCT_SKUS", errors);
  const trusted = new Set(TRUSTED_CONSUMABLE_SKUS);
  const missing = TRUSTED_CONSUMABLE_SKUS.filter((sku) => !configured.includes(sku));
  const untrusted = configured.filter((sku) => !trusted.has(sku));
  if (configured.length !== TRUSTED_CONSUMABLE_SKUS.length || missing.length > 0 || untrusted.length > 0) {
    errors.push("JEST_PRODUCT_SKUS must contain exactly the six trusted consumable SKUs.");
  }
}

function validateSubscriptions(environment, errors) {
  const configured = parseRequiredList(environment, "JEST_SUBSCRIPTION_SKUS", errors);
  const untrusted = configured.filter((sku) => !TRUSTED_SUBSCRIPTION_SKUS.has(sku));
  if (untrusted.length > 0) {
    errors.push(`JEST_SUBSCRIPTION_SKUS contains an untrusted SKU: ${untrusted.join(", ")}`);
  }
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

function validateDeployEnvironment(environment) {
  const errors = [];
  if (environment.JEST_GAME_ID?.trim() !== EXPECTED_GAME_ID) {
    errors.push(`JEST_GAME_ID must equal ${EXPECTED_GAME_ID}.`);
  }
  validateOrigins(environment, errors);
  validateConsumables(environment, errors);
  validateSubscriptions(environment, errors);
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
  console.log(`Validated Firebase deployment environment: ${filePath}`);
}

module.exports = {
  DEPLOY_ENV_PATH,
  EXPECTED_GAME_ID,
  PROJECT_ID,
  PRIMARY_JEST_ORIGIN,
  TRUSTED_CONSUMABLE_SKUS,
  TRUSTED_SUBSCRIPTION_SKUS,
  validateDeployEnvironment,
  validateDeployEnvironmentFile,
  validateDeployTarget,
};
