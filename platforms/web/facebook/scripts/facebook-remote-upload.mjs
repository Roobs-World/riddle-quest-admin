import {createHash} from "node:crypto";

export const FACEBOOK_APP_ID = "1748953042991569";
export const FACEBOOK_UPLOAD_GUIDE_URL = "https://developers.facebook.com/documentation/games/launch/upload-bundle";

const maximumArchiveBytes = 200 * 1024 * 1024;
const maximumResponseBytes = 1024 * 1024;
const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");

/** Contains only fixed diagnostics and response fingerprints, without provider payloads or credentials. */
export class FacebookUploadError extends Error {
  constructor(message, stage, stages = []) {
    super(message);
    this.name = "FacebookUploadError";
    this.stage = stage;
    this.stages = stages.map((entry) => ({...entry}));
  }
}

/** Selects the upload namespace without accepting an app-secret credential or changing the token. */
export function validateFacebookAssetUploadToken(token) {
  if (typeof token !== "string" || token.length < 16 || token.length > 16_384 ||
      !/^(?:GG|EAA)[A-Za-z0-9._~+/-]+=*$/u.test(token)) {
    throw new FacebookUploadError("A valid Facebook asset-upload user token is required.", "validation");
  }
  return token.startsWith("GG") ? "gg_graph_api" : "fb_game_bundle";
}

/** Reads a bounded response while retaining only a digest in the receipt. */
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
  if (!response.ok) {
    throw new FacebookUploadError("Facebook rejected the upload request. Reconcile the retained attempt before retrying.", stage, stages);
  }
  try {
    return JSON.parse(contents.toString("utf8"));
  } catch {
    throw new FacebookUploadError("Facebook returned an unrecognized upload response. Reconcile the retained attempt before retrying.", stage, stages);
  }
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
