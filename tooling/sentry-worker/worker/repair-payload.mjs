export function validateRepairPayload(payload) {
  if (!Array.isArray(payload?.changes) || payload.changes.length < 1 || payload.changes.length > 12) throw new Error("unsupported_repair_file_count");
  const seen = new Set();
  let size = 0;
  for (const change of payload.changes) {
    const path = change.path;
    if (typeof path !== "string" || path.length > 240 || !/^(?:packages\/(?:core|solo|hosted|portal)\/(?:src|test|tests)\/|firebase-functions\/src\/)/u.test(path) || path.split("/").some((part) => !part || part.startsWith(".") || part === ".." || /^(?:AGENTS|CLAUDE)\.md$/iu.test(part)) || /[\\\x00-\x1f]/u.test(path) || seen.has(path)) throw new Error("unsupported_repair_path");
    seen.add(path);
    if (change.deleted || change.mode && change.mode !== "100644" || typeof change.content !== "string") throw new Error("unsupported_repair_file_type");
    const bytes = Buffer.from(change.content, "base64");
    if (bytes.toString("base64") !== change.content) throw new Error("invalid_repair_encoding");
    if (bytes.includes(0)) throw new Error("unsupported_repair_binary_file");
    new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    size += bytes.length;
    if (bytes.length > 128_000 || size > 256_000) throw new Error("unsupported_repair_size");
  }
  return {changes: payload.changes, summary: typeof payload.summary === "string" ? payload.summary.slice(0, 5000) : "Automated repair prepared for review."};
}
