"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSafeErrorMetadata = getSafeErrorMetadata;
/** Accepts only a short identifier-like metadata token. */
const boundedToken = (value) => typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : undefined;
/** Extracts only bounded classification fields from an unknown exception. */
function getSafeErrorMetadata(error) {
    if (typeof error !== "object" || error === null)
        return { errorClass: typeof error };
    /** Provides record behavior. */
    const record = error;
    /** Provides error class behavior. */
    const errorClass = boundedToken(error instanceof Error ? error.name : undefined) ?? "Error";
    /** Provides code behavior. */
    const code = boundedToken(record.code);
    /** Provides status behavior. */
    const status = typeof record.status === "number" && Number.isInteger(record.status) && record.status >= 100 && record.status <= 599
        ? record.status
        : undefined;
    return { errorClass, ...(code ? { code } : {}), ...(status ? { status } : {}) };
}
//# sourceMappingURL=errorMetadata.js.map