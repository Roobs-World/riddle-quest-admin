import {createHash} from "node:crypto";

export const FACEBOOK_APP_ID = "1748953042991569";
export const FACEBOOK_UPLOAD_GUIDE_URL = "https://developers.facebook.com/documentation/games/launch/upload-bundle";

const maximumArchiveBytes = 200 * 1024 * 1024;
const maximumResponseBytes = 1024 * 1024;
const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");
const providerExceptionTypes = new Set([
  "OAuthException",
  "GraphMethodException",
  "FacebookApiException",
  "InvalidRequestException",
  "PermissionException",
]);

/** Contains only fixed diagnostics and response fingerprints, without provider payloads or credentials. */
export class FacebookUploadError extends Error {
  constructor(message, stage, stages = []) {
    super(message);
    this.name = "FacebookUploadError";
    this.stage = stage;
    this.stages = stages.map((entry) => ({...entry}));
  }
}

/** Selects the upload namespace and binds Gaming app credentials to this game's app ID. */
export function validateFacebookAssetUploadToken(token) {
  if (typeof token !== "string" || token.length < 16 || token.length > 16_384 || /\s/u.test(token)) {
    throw new FacebookUploadError("A complete Facebook upload token is required.", "validation");
  }
  const gamingAppToken = /^GG\|([0-9]{5,32})\|[A-Za-z0-9._~+/-]+=*$/u.exec(token);
  if (gamingAppToken) {
    if (gamingAppToken[1] !== FACEBOOK_APP_ID) {
      throw new FacebookUploadError("The Facebook Gaming app token belongs to a different app.", "validation");
    }
    return "gg_graph_api";
  }
  if (!/^(?:GG|EAA)[A-Za-z0-9._~+/-]+=*$/u.test(token)) {
    throw new FacebookUploadError("A complete Gaming token or Facebook User/System User token is required.", "validation");
  }
  return token.startsWith("GG") ? "gg_graph_api" : "fb_game_bundle";
}

/** Classifies provider text without retaining the text or identifiers it may contain. */
function providerFailureReason(message) {
  if (/\bapp(?:lication)?(?: access)? tokens?\b.*\b(?:not allowed|not supported|cannot|unsupported)\b/iu.test(message) ||
      /\b(?:user|system user)(?: access)? tokens?\b.*\brequired\b|\brequires?\b.*\b(?:user|system user)(?: access)? tokens?\b/iu.test(message)) {
    return "user-token-required";
  }
  if (/\bexpir(?:ed|ation|y)\b/iu.test(message)) return "expired-token";
  if (/\b(?:rate limit(?:ed)?|too many requests|throttl(?:ed|ing))\b/iu.test(message)) return "upload-rate-limited";
  if (/\b(?:token|oauth|authentication|credential)\b/iu.test(message)) return "credential-rejected";
  if (/\b(?:permissions?|not authorized|unauthorized|forbidden|access denied)\b/iu.test(message)) return "permission-denied";
  if (/\b(?:invalid|malformed|unsupported)\b/iu.test(message)) return "invalid-upload-request";
  return "provider-rejected";
}

/** Copies only bounded public error metadata into the private attempt receipt. */
function safeProviderError(payload) {
  const envelope = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const error = envelope.error;
  const details = error && typeof error === "object" && !Array.isArray(error) ? error : envelope;
  const message = (typeof error === "string" ? error :
    typeof details.message === "string" ? details.message :
      typeof details.error_msg === "string" ? details.error_msg : "").slice(0, 4096);
  const diagnostic = {reason: providerFailureReason(message)};
  const code = details.code ?? details.error_code;
  const subcode = details.error_subcode;
  if (Number.isInteger(code) && code >= 0 && code <= 2_147_483_647) diagnostic.code = code;
  if (Number.isInteger(subcode) && subcode >= 0 && subcode <= 2_147_483_647) diagnostic.subcode = subcode;
  if (providerExceptionTypes.has(details.type)) diagnostic.type = details.type;
  return diagnostic;
}

/** Reads a bounded response while retaining only a digest and safe error metadata. */
async function readResponse(response, stage, stages) {
  const entry = {stage, httpStatus: response.status};
  stages.push(entry);
  const chunks = [];
  let length = 0;
  const reader = response.body?.getReader();
  try {
    if (reader) {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximumResponseBytes) {
          await reader.cancel();
          throw new Error("Response limit exceeded");
        }
        chunks.push(Buffer.from(value));
      }
    }
  } catch {
    throw new FacebookUploadError("Facebook upload response could not be read safely.", stage, stages);
  } finally {
    reader?.releaseLock();
  }
  const contents = Buffer.concat(chunks, length);
  entry.responseSha256 = sha256(contents);
  let payload;
  let parsed = false;
  try {
    payload = JSON.parse(contents.toString("utf8"));
    parsed = true;
  } catch {
    // An error response need not be JSON; its body still stays out of diagnostics.
  }
  const providerError = payload && typeof payload === "object" && !Array.isArray(payload) &&
    Object.hasOwn(payload, "error");
  if (!response.ok || providerError) {
    entry.providerError = safeProviderError(payload);
    throw new FacebookUploadError("Facebook rejected the upload request. Reconcile the retained attempt before retrying.", stage, stages);
  }
  if (!parsed) {
    throw new FacebookUploadError("Facebook returned an unrecognized upload response. Reconcile the retained attempt before retrying.", stage, stages);
  }
  return payload;
}

/** Sends one request without redirects or retries; thrown network details never escape this boundary. */
async function request(url, options, stage, stages, timeoutMs) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new FacebookUploadError("Facebook upload request did not complete. Reconcile the retained attempt before retrying.", stage, stages);
  }
  return readResponse(response, stage, stages);
}

/** Keeps a signed upload-session identifier in memory and on Meta's fixed upload origin. */
function sessionUploadUrl(namespace, session, stages) {
  if (!session || typeof session !== "object" || Array.isArray(session) ||
      typeof session.id !== "string" || !/^upload:[A-Za-z0-9._~:/?=&%+-]{1,4096}$/u.test(session.id)) {
    throw new FacebookUploadError("Facebook returned an invalid upload session. Reconcile the retained attempt before retrying.", "session", stages);
  }
  const url = new URL(`https://rupload.facebook.com/${namespace}/${session.id}`);
  if (url.origin !== "https://rupload.facebook.com" || !url.pathname.startsWith(`/${namespace}/upload:`) ||
      url.username || url.password || url.hash) {
    throw new FacebookUploadError("Facebook returned an invalid upload session. Reconcile the retained attempt before retrying.", "session", stages);
  }
  return url;
}

/** Returns an optional provider link only when it has a known Meta host and contains no opaque query values. */
function safePlayableUrl(value, token) {
  if (typeof value !== "string" || value.length > 4096 || value.includes(token)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
        !(url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com") ||
          url.hostname === "fbsbx.com" || url.hostname.endsWith(".fbsbx.com")) ||
        decodeURIComponent(value).includes(token) ||
        [...url.searchParams].some(([key, part]) =>
          !["version", "bundle_instance_id", "game_id"].includes(key) || !/^\d+$/u.test(part))) {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}

/** Uploads exact archive bytes once. A successful submission does not prove processing or draft acceptance. */
export async function uploadFacebookArchive({contents, archiveSha256, token}) {
  const uploadNamespace = validateFacebookAssetUploadToken(token);
  if (!Buffer.isBuffer(contents) || contents.length === 0 || contents.length > maximumArchiveBytes ||
      typeof archiveSha256 !== "string" || !/^[0-9a-f]{64}$/u.test(archiveSha256)) {
    throw new FacebookUploadError("A bounded verified Facebook ZIP archive is required.", "validation");
  }
  const archive = Buffer.from(contents);
  if (sha256(archive) !== archiveSha256) {
    throw new FacebookUploadError("Facebook archive bytes do not match the approved hash.", "validation");
  }
  const filename = `artifact-${archiveSha256}.zip`;
  const stages = [];
  const sessionUrl = new URL(`https://graph.facebook.com/v24.0/${FACEBOOK_APP_ID}/uploads`);
  sessionUrl.searchParams.set("file_name", filename);
  sessionUrl.searchParams.set("file_length", String(archive.length));
  sessionUrl.searchParams.set("file_type", "application/zip");
  const session = await request(sessionUrl, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`},
  }, "session", stages, 60_000);
  const response = await request(sessionUploadUrl(uploadNamespace, session, stages), {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      Offset: "0",
      "X-Entity-Length": String(archive.length),
      "Content-Length": String(archive.length),
      type: "BUNDLE",
      comment: `Non-production draft sha256 ${archiveSha256}`,
      name: filename,
    },
    body: archive,
  }, "archive", stages, 180_000);
  if (!response || typeof response !== "object" || Array.isArray(response) || response.error !== undefined) {
    throw new FacebookUploadError("Facebook returned an unrecognized bundle result. Reconcile the retained attempt before retrying.", "archive", stages);
  }
  const receipt = {
    schemaVersion: 1,
    provider: "facebook",
    intent: "non-production-draft",
    appId: FACEBOOK_APP_ID,
    archiveSha256,
    uploadNamespace,
    submittedAt: new Date().toISOString(),
    stages,
  };
  if (typeof response.bundle_instance_id === "string" && /^\d+$/u.test(response.bundle_instance_id)) {
    receipt.bundleInstanceId = response.bundle_instance_id;
  }
  const playableUrl = safePlayableUrl(response.playable_url, token);
  if (playableUrl) receipt.playableUrl = playableUrl;
  return receipt;
}
