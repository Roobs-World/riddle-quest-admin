import {createHash} from "node:crypto";

export const FIXTURE_TYPES = new Set([
  "auth", "payment", "refund", "post-entry", "realtime", "notification",
]);

const SECRET_KEY = /(?:authorization|cookie|secret|signature|token|credential|session)/iu;
const ID_KEY = /(?:^|_)(?:app|account|buyer|installation|order|player|post|subreddit|user)?id$/iu;
const PROFILE_KEY = /(?:avatar|displayname|email|snoovatar|username)/iu;
const FORBIDDEN_VALUE = /(?:bearer\s+\S+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|t[1-6]_[A-Za-z0-9]{5,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/iu;

const placeholder = (key, value) => `<redacted:${key.toLowerCase()}:${typeof value}>`;

function sanitizeValue(value, key = "value") {
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey,
      SECRET_KEY.test(childKey) || ID_KEY.test(childKey) || PROFILE_KEY.test(childKey)
        ? placeholder(childKey, child)
        : sanitizeValue(child, childKey),
    ]));
  }
  if (typeof value === "string") {
    if (value.length > 256 || FORBIDDEN_VALUE.test(value)) return placeholder(key, value);
    try {
      const url = new URL(value);
      url.username = ""; url.password = ""; url.search = ""; url.hash = "";
      return url.toString();
    } catch { return value; }
  }
  return value;
}

function assertExactKeys(value, keys, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new Error(`invalid-reddit-${name}-fixture`);
  }
}

export function createRedditContractFixture({type, payload, capturedAt, sourceSha256}) {
  if (!FIXTURE_TYPES.has(type)) throw new Error("invalid-reddit-fixture-type");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid-reddit-fixture-payload");
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 256 * 1024) throw new Error("unsafe-reddit-contract-fixture");
  if (typeof capturedAt !== "string" || new Date(capturedAt).toISOString() !== capturedAt) {
    throw new Error("invalid-reddit-fixture-time");
  }
  if (typeof sourceSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(sourceSha256)) {
    throw new Error("invalid-reddit-fixture-source");
  }
  const fixture = {schemaVersion: 1, platform: "reddit", type, capturedAt, sourceSha256,
    sanitized: true, payload: sanitizeValue(payload)};
  validateRedditContractFixture(fixture);
  return fixture;
}

export function validateRedditContractFixture(fixture) {
  assertExactKeys(fixture,
    ["schemaVersion", "platform", "type", "capturedAt", "sourceSha256", "sanitized", "payload"], "contract");
  if (fixture.schemaVersion !== 1 || fixture.platform !== "reddit" || fixture.sanitized !== true ||
    !FIXTURE_TYPES.has(fixture.type) || typeof fixture.capturedAt !== "string" ||
    new Date(fixture.capturedAt).toISOString() !== fixture.capturedAt ||
    !/^[a-f0-9]{64}$/u.test(fixture.sourceSha256) || !fixture.payload ||
    typeof fixture.payload !== "object" || Array.isArray(fixture.payload)) {
    throw new Error("invalid-reddit-contract-fixture");
  }
  const serialized = JSON.stringify(fixture);
  if (Buffer.byteLength(serialized, "utf8") > 256 * 1024 || FORBIDDEN_VALUE.test(serialized)) {
    throw new Error("unsafe-reddit-contract-fixture");
  }
  return fixture;
}

export const sourceDigest = (raw) => createHash("sha256").update(raw).digest("hex");
