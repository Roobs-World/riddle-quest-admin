/** Hosted delivery is the default for web targets without their own notification API. */
export const HOSTED_PUSH_API_BASE = "/api/notifications";
export const HOSTED_PUSH_WORKER_PATH = "/hosted-notifications-worker.js";

/** Platform identifiers are extensible; deployment origin admission belongs to the hosted service. */
export type HostedPushTarget = string;

/** Browser-created Web Push material, sent only to the hosted subscription service. */
export type HostedPushSubscription = {
  endpoint: string;
  keys: {p256dh: string; auth: string};
};

export type HostedPushConfiguration = {
  version: 1;
  target: HostedPushTarget;
  publicKey: string;
};

export type HostedPushSubscribeRequest = {
  target: HostedPushTarget;
  revision: number;
  locale: string;
  subscription: HostedPushSubscription;
};

export type HostedPushUnsubscribeRequest = {
  target: HostedPushTarget;
  revision: number;
};

export type HostedPushActivityRequest = {target: HostedPushTarget; locale: string};

export type HostedPushReceipt = {installationId: string; revision: number};

/** Delivery content and destination are chosen by the service, never the subscribing browser. */
export type HostedPushMessage = {
  version: 1;
  kind: "notification";
  notificationId: string;
  target: HostedPushTarget;
  installationId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  expiresAtMs: number;
};
