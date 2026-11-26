import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import {useCallback, useEffect, useRef, useState} from "react";
import type {HostedFirebaseClient, ProvisionedAccount} from "./firebaseClient";
/** Observable account state for the hosted account screen. */
export type HostedAccountState =
  | {
      /** Nothing has been attempted yet. */
      kind: "idle";
    }
  | {
      /** Sign-in or provisioning is in progress. */
      kind: "connecting";
    }
  | {
      /** The Global Game Account is confirmed. */
      kind: "ready";
      /** Confirmed account. */
      account: ProvisionedAccount;
    }
  | {
      /** Sign-in or provisioning failed. */
      kind: "failed";
      /** Stable failure code for localized display. */
      code: "sign-in" | "provision";
      /** Raw error message for evidence; never shown verbatim to players. */
      detail: string;
    };
/** Controller returned by {@link useHostedAccount}. */
export type HostedAccountController = Readonly<{
  /** Current account state. */
  state: HostedAccountState;
  /** Signs in and provisions, or retries after a failure. */
  connect: () => void;
}>;
/** Options for {@link useHostedAccount}. */
export type HostedAccountOptions = Readonly<{
  /** Whether to connect as soon as the hook mounts; hosted-first surfaces do, the on-demand account screen does not. */
  autoConnect?: boolean;
  /** Refreshes native host authority after provisioning, before online views become available. */
  onConfirmed?: (uid: string) => Promise<unknown>;
}>;
/** Signs the device in anonymously and provisions its Global Game Account on demand or on mount. */
export function useHostedAccount(client: HostedFirebaseClient, options: HostedAccountOptions = {}): HostedAccountController {
  /** Current state. */
  const [state, setState] = useState<HostedAccountState>({kind: "idle"});
  /** Whether the component is still mounted. */
  const mounted = useRef(true);
  /** An older client callback must never provision through a replaced Firebase adapter. */
  const activeClient = useRef(client);
  activeClient.current = client;
  /** Only the latest connection attempt may publish its account identity. */
  const connection = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      connection.current++;
    };
  }, []);
  /** Current authority refresh for this root and service lifetime. */
  const onConfirmed = options.onConfirmed;
  /** Runs one sign-in plus provisioning attempt. */
  const connect = useCallback(() => {
    if (!mounted.current || activeClient.current !== client) return;
    /** This root visit and adapter own all sign-in/provisioning continuations. */
    const attempt = ++connection.current;
    /** Superseded callbacks cannot rewind the root to a previous uid. */
    const current = () => mounted.current && activeClient.current === client && attempt === connection.current;
    setState({kind: "connecting"});
    trackEvent("account_connect_requested");
    void (async () => {
      try {
        await client.signInAnonymously();
        if (!current()) return;
      } catch (error) {
        if (current()) trackEvent("account_connect_failed", {stage: "sign_in"});
        if (current()) setState({kind: "failed", code: "sign-in", detail: error instanceof Error ? error.message : String(error)});
        return;
      }
      try {
        /** Confirmed account. */
        const account = await client.provisionAccount();
        if (!current()) return;
        await onConfirmed?.(account.uid);
        if (current()) {setState({kind: "ready", account}); trackEvent("account_connected", {created: account.created});}
      } catch (error) {
        if (current()) trackEvent("account_connect_failed", {stage: "provision"});
        if (current()) setState({kind: "failed", code: "provision", detail: error instanceof Error ? error.message : String(error)});
      }
    })();
  }, [client, onConfirmed]);
  /** Whether the first connection should start without a tap. */
  const autoConnect = options.autoConnect === true;
  useEffect(() => {
    if (autoConnect) connect();
  }, [autoConnect, connect]);
  return {state, connect};
}
