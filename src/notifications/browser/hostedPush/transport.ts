import type {HostedPushConfiguration, HostedPushReceipt, HostedPushSubscription, HostedPushTarget} from "../../contracts/hostedPush";

/** Adapts the independently hosted service contract to browser enrollment. */
export type HostedPushTransport = {
  configuration(signal: AbortSignal): Promise<HostedPushConfiguration>;
  subscribe(input: {revision: number; locale: string; subscription: HostedPushSubscription}, signal: AbortSignal): Promise<HostedPushReceipt>;
  unsubscribe(revision: number, signal: AbortSignal): Promise<HostedPushReceipt>;
  activity(locale: string, signal: AbortSignal): Promise<void>;
};

/** The service adapter receives an installation credential that never enters worker state. */
export type HostedPushTransportFactory = (installation: {target: HostedPushTarget; token: string}) => HostedPushTransport;
