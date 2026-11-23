import {NativeModules} from "react-native";

/** The bridge exposes no installation timestamps or device identifiers. */
type InstallReferrerBridge = {
  /** Reads an untrusted provider value; the adapter validates its shape and size. */
  readInstallReferrer(): unknown;
};

/** Accepts only the optional native method used by this adapter. */
function isInstallReferrerBridge(value: unknown): value is InstallReferrerBridge {
  return typeof value === "object" && value !== null &&
    "readInstallReferrer" in value && typeof value.readInstallReferrer === "function";
}

/** StrictMode and overlapping entry consumers share one active native connection. */
let pendingRead: Promise<string | null> | null = null;

/** Reads a bounded raw Play entry without making optional store delivery a startup requirement. */
export function readPlayInstallReferrer(): Promise<string | null> {
  if (pendingRead) return pendingRead;
  /** Provider metadata remains untrusted until its consumer validates the invitation codec. */
  const native: unknown = NativeModules.RiddleQuestInstallReferrer;
  if (!isInstallReferrerBridge(native)) return Promise.resolve(null);
  /** A JS deadline also protects against an unavailable or older native implementation. */
  const result = new Promise<string | null>((resolve) => {
    /** Only the first native completion or deadline owns the result. */
    let settled = false;
    /** Optional store reads expire just after the native connection's five-second deadline. */
    const timeout = setTimeout(() => finish(null), 5_500);
    /** Releases the deadline on success, refusal, malformed data and late completion. */
    function finish(value: string | null): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    }
    void Promise.resolve().then(() => native.readInstallReferrer()).then(
      (value: unknown) => finish(typeof value === "string" && value.length > 0 && value.length <= 4_096 ? value : null),
      () => finish(null),
    );
  });
  pendingRead = result;
  void result.then(() => { if (pendingRead === result) pendingRead = null; });
  return result;
}
