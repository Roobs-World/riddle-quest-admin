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
}>;
/** Signs the device in anonymously and provisions its Global Game Account on demand or on mount. */
export function useHostedAccount(client: HostedFirebaseClient, options: HostedAccountOptions = {}): HostedAccountController {
  /** Current state. */
  const [state, setState] = useState<HostedAccountState>({kind: "idle"});
  /** Whether the component is still mounted. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  /** Runs one sign-in plus provisioning attempt. */
  const connect = useCallback(() => {
    setState({kind: "connecting"});
    void (async () => {
      try {
        await client.signInAnonymously();
      } catch (error) {
        if (mounted.current) setState({kind: "failed", code: "sign-in", detail: error instanceof Error ? error.message : String(error)});
        return;
      }
      try {
        /** Confirmed account. */
        const account = await client.provisionAccount();
        if (mounted.current) setState({kind: "ready", account});
      } catch (error) {
        if (mounted.current) setState({kind: "failed", code: "provision", detail: error instanceof Error ? error.message : String(error)});
      }
    })();
  }, [client]);
  /** Whether the first connection should start without a tap. */
  const autoConnect = options.autoConnect === true;
  useEffect(() => {
    if (autoConnect) connect();
  }, [autoConnect, connect]);
  return {state, connect};
}
