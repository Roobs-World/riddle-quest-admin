const phases = [
  "completion", "incorrect", "cadence-one", "cadence-two", "opportunity", "admission", "account-inactive",
  "foreground-invalid", "disabled-after-bookkeeping-failure", "format-unavailable", "interstitial-busy", "rewarded-busy",
  "preparation-pending", "wrong-placement", "result-no-longer-current", "eligibility-initial", "eligibility-initial-resolved",
  "eligibility-after-load", "eligibility-after-load-resolved", "eligibility-denied", "ad-free-gate", "clock-invalid",
  "session-cap", "interstitial-cooldown", "rewarded-cooldown", "dialog-guard", "dialog-operation", "dialog-busy",
  "surface-not-hidden", "create-invoked", "create-resolved", "placement-before-load", "load-invoked", "load-resolved",
  "placement-before-show", "show-invoked", "show-resolved", "success", "cancelled", "unavailable", "retryable-failure",
  "terminal-failure", "finished", "retired", "provider-too-many-instances", "provider-unsupported-operation",
  "provider-frequent-load", "provider-no-fill", "provider-invalid-param", "provider-network-failure",
  "provider-not-loaded", "provider-invalid-operation", "provider-rate-limited", "provider-user-input",
] as const;
const prefix = "riddle-quest:facebook:interstitial:";
let latestToken: object | undefined;

export type FacebookInterstitialTracePhase = typeof phases[number];
export type FacebookInterstitialTraceLease = {
  record(phase: FacebookInterstitialTracePhase): void;
  close(): void;
};
export type FacebookInterstitialTrace = {
  begin(): FacebookInterstitialTraceLease;
  capture(): FacebookInterstitialTraceLease | undefined;
  retire(): void;
};

/** Unknown codes and provider getters cannot change the existing failure result. */
export function recordFacebookInterstitialError(trace: FacebookInterstitialTraceLease | undefined, error: unknown): void {
  if (!trace) return;
  try {
    if (typeof error !== "object" || error === null) return;
    const phasesByCode = {
      ADS_TOO_MANY_INSTANCES: "provider-too-many-instances",
      CLIENT_UNSUPPORTED_OPERATION: "provider-unsupported-operation",
      ADS_FREQUENT_LOAD: "provider-frequent-load",
      ADS_NO_FILL: "provider-no-fill",
      INVALID_PARAM: "provider-invalid-param",
      NETWORK_FAILURE: "provider-network-failure",
      ADS_NOT_LOADED: "provider-not-loaded",
      INVALID_OPERATION: "provider-invalid-operation",
      RATE_LIMITED: "provider-rate-limited",
      USER_INPUT: "provider-user-input",
    } as const;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    const code: unknown = descriptor && "value" in descriptor ? descriptor.value : undefined;
    if (typeof code === "string" && Object.hasOwn(phasesByCode, code)) {
      trace.record(phasesByCode[code as keyof typeof phasesByCode]);
    }
  } catch {}
}

export function createFacebookInterstitialTrace(): FacebookInterstitialTrace {
  let retired = false;
  let activeToken: object | undefined;
  let activeLease: FacebookInterstitialTraceLease | undefined;
  return {
    begin: () => {
      if (retired) return {record: () => undefined, close: () => undefined};
      activeLease?.close();
      const token = {};
      activeToken = latestToken = token;
      let closed = false;
      let timeline: Performance | undefined;
      try {
        timeline = globalThis.performance;
        for (const phase of phases) timeline.clearMarks(prefix + phase);
      } catch {
        closed = true;
      }
      const lease: FacebookInterstitialTraceLease = {
        record: phase => {
          if (closed || retired || latestToken !== token || !timeline || !phases.includes(phase)) return;
          try {
            timeline.clearMarks(prefix + phase);
            timeline.mark(prefix + phase);
          } catch {}
        },
        close: () => {
          closed = true;
          if (activeLease === lease) activeLease = undefined;
        },
      };
      activeLease = closed ? undefined : lease;
      lease.record("completion");
      return lease;
    },
    capture: () => retired || latestToken !== activeToken ? undefined : activeLease,
    retire: () => {
      if (retired) return;
      activeLease?.record("retired");
      activeLease?.close();
      retired = true;
    },
  };
}
