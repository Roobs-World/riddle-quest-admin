"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSecureSentryDsn = resolveSecureSentryDsn;
exports.resolveSentryRelease = resolveSentryRelease;
exports.redactSensitiveTelemetry = redactSensitiveTelemetry;
exports.redactSentryEvent = redactSentryEvent;
exports.captureException = captureException;
exports.flushSentry = flushSentry;
exports.withSentrySpan = withSentrySpan;
/**
 * Thin wrapper around @sentry/node for Firebase Functions.
 *
 * Initialises Sentry only when SENTRY_DSN is set in the environment so
 * functions work safely without Sentry configured. All exported helpers
 * are no-ops when the DSN is absent.
 */
const Sentry = __importStar(require("@sentry/node"));
/**
 * Validates that an optional telemetry DSN uses encrypted HTTPS transport.
 *
 * @param value Configured telemetry DSN, if telemetry is enabled.
 * @returns The normalized HTTPS DSN or `undefined` when telemetry is disabled.
 * @throws When a configured DSN is malformed or uses plaintext transport.
 */
function resolveSecureSentryDsn(value) {
    /** Provides candidate behavior. */
    const candidate = value?.trim();
    if (!candidate)
        return undefined;
    /** Parses d. */
    let parsed;
    try {
        parsed = new URL(candidate);
    }
    catch {
        throw new Error("SENTRY_DSN must be a valid HTTPS URL.");
    }
    if (parsed.protocol !== "https:")
        throw new Error("SENTRY_DSN must use HTTPS.");
    return parsed.toString();
}
/**
 * Resolves the immutable runtime release attached to backend telemetry.
 *
 * @param environment Function runtime environment variables.
 * @returns The Cloud Run revision when available, otherwise the configured release.
 */
function resolveSentryRelease(environment) {
    return environment.K_REVISION?.trim() || environment.SENTRY_RELEASE?.trim() || undefined;
}
/** Provides dsn behavior. */
const dsn = resolveSecureSentryDsn(process.env.SENTRY_DSN);
/** Provides sensitive field pattern behavior. */
const sensitiveFieldPattern = /(?:answer|authorization|cookie|email|guess|imageDataUrl|password|secret|token|uid|userId)/i;
/** Provides bearer pattern behavior. */
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
/** Provides compact token pattern behavior. */
const compactTokenPattern = /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;
/** Provides data image pattern behavior. */
const dataImagePattern = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
/** Removes query strings and fragments from URLs embedded in diagnostics. */
const redactUrlDetails = (value) => value.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
    try {
        /** Parses d. */
        const parsed = new URL(match);
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString();
    }
    catch {
        return "[REDACTED_URL]";
    }
});
/**
 * Removes credentials, player identifiers, guesses, and answer material from
 * telemetry objects before they can leave the trusted backend.
 *
 * @param value Arbitrary telemetry value.
 * @param depth Current recursion depth used to bound hostile/cyclic objects.
 * @param seen Objects already visited during recursion.
 * @returns A telemetry-safe copy of the value.
 */
function redactSensitiveTelemetry(value, depth = 0, seen = new WeakSet()) {
    if (typeof value === "string") {
        return redactUrlDetails(value
            .replace(bearerPattern, "Bearer [REDACTED]")
            .replace(compactTokenPattern, "[REDACTED_TOKEN]")
            .replace(dataImagePattern, "[REDACTED_IMAGE]"));
    }
    if (value instanceof URL)
        return redactUrlDetails(value.toString());
    if (value === null || typeof value !== "object" || depth >= 8)
        return value;
    if (seen.has(value))
        return "[CIRCULAR]";
    seen.add(value);
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveTelemetry(item, depth + 1, seen));
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveFieldPattern.test(key) ? "[REDACTED]" : redactSensitiveTelemetry(entry, depth + 1, seen),
    ]));
}
/**
 * Removes Sentry's free-form exception and log messages while preserving
 * stack frames and privacy-safe structured context.
 */
function redactSentryEvent(event) {
    /** Provides redacted behavior. */
    const redacted = redactSensitiveTelemetry(event);
    if (!redacted || typeof redacted !== "object")
        return redacted;
    // SDK integrations can attach these fields without going through the
    // application's explicit, already-redacted diagnostic context. Error-only
    // reporting does not need them, and request/user context can identify a
    // player even when sendDefaultPii is disabled.
    delete redacted.user;
    delete redacted.request;
    delete redacted.contexts;
    delete redacted.breadcrumbs;
    if (typeof redacted.message === "string")
        redacted.message = "[REDACTED_MESSAGE]";
    /** Provides logentry behavior. */
    const logentry = redacted.logentry;
    if (logentry && typeof logentry === "object") {
        /** Provides safe logentry behavior. */
        const safeLogentry = logentry;
        if (typeof safeLogentry.message === "string")
            safeLogentry.message = "[REDACTED_MESSAGE]";
        if (typeof safeLogentry.formatted === "string")
            safeLogentry.formatted = "[REDACTED_MESSAGE]";
    }
    /** Provides exception behavior. */
    const exception = redacted.exception;
    if (exception && typeof exception === "object") {
        /** Provides values behavior. */
        const values = exception.values;
        if (Array.isArray(values)) {
            for (const value of values) {
                if (value &&
                    typeof value === "object" &&
                    typeof value.value === "string") {
                    value.value = "[REDACTED_MESSAGE]";
                }
            }
        }
    }
    return redacted;
}
if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT?.trim() || process.env.GCLOUD_PROJECT || "production",
        release: resolveSentryRelease(process.env),
        sampleRate: 1,
        // The automatic OpenAI integration consumes structured response bodies twice
        // with the current SDK. Keep error reporting and our explicit AI spans.
        integrations: (integrations) => integrations.filter((integration) => integration.name !== "OpenAI"),
        // Keep operational reporting errors-only; performance traces are
        // nonessential and require a separate, owner-approved telemetry decision.
        // Preserve the transaction redaction hook with Sentry v11.
        traceLifecycle: "static",
        tracesSampleRate: 0,
        beforeSend: (event) => redactSentryEvent(event),
        beforeSendTransaction: (event) => redactSentryEvent(event),
    });
    Sentry.setTag("runtime", "firebase-functions");
}
/**
 * Captures an exception and sends it to Sentry (no-op if DSN not configured).
 *
 * @param error   - Any caught value (Error, string, unknown).
 * @param context - Optional key/value pairs attached as extra context.
 */
function captureException(error, context) {
    if (!dsn)
        return;
    if (context) {
        Sentry.withScope((scope) => {
            scope.setExtras(redactSensitiveTelemetry(context));
            Sentry.captureException(error);
        });
    }
    else {
        Sentry.captureException(error);
    }
}
/**
 * Flushes queued server events before a short-lived function invocation exits.
 *
 * @param timeout Maximum time in milliseconds to wait for delivery.
 * @returns Whether the SDK queue drained before the timeout.
 */
async function flushSentry(timeout = 2_000) {
    if (!dsn)
        return false;
    return Sentry.flush(timeout);
}
/** Runs sentry span. */
function withSentrySpan(name, op, callback, attributes) {
    if (!dsn)
        return callback();
    return Sentry.startSpan({ name, op, attributes }, callback);
}
//# sourceMappingURL=sentry.js.map