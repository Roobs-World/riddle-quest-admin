const CACHE = "riddle-quest-push-display-v1";
const HASH = /^[a-f0-9]{64}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]{0,15})$/u;
let pushProcessing = Promise.resolve();

self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  const process = async () => {
    let message;
    try {
      message = event.data?.json();
      if (message?.data?.version === "1" && message.data.kind === "notification") {
        const data = message.data;
        if (typeof data.registrationRevision !== "string" || typeof data.expiresAtMs !== "string" ||
            !DECIMAL.test(data.registrationRevision) || !DECIMAL.test(data.expiresAtMs)) return;
        message = {...data, version: 1, registrationRevision: Number(data.registrationRevision), expiresAtMs: Number(data.expiresAtMs)};
      }
    } catch {return;}
    if (!message || message.version !== 1 || message.kind !== "notification" || !HASH.test(message.deviceHash) ||
        !HASH.test(message.notificationId) || typeof message.title !== "string" || !message.title.length || message.title.length > 200 ||
        typeof message.body !== "string" || !message.body.length || message.body.length > 2000 ||
        !Number.isSafeInteger(message.expiresAtMs) || message.expiresAtMs <= Date.now() || !Number.isSafeInteger(message.registrationRevision)) return;
    const cache = await caches.open(CACHE);
    const gate = await cache.match("/push/display-permission");
    const permission = gate ? await gate.json() : null;
    if (permission?.enabled !== true || permission.deviceHash !== message.deviceHash || permission.revision !== message.registrationRevision || !HASH.test(permission.deviceToken)) return;
    // Recheck account consent and ownership after queued delivery, immediately before display.
    const response = await fetch("/api/push/status", {method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store",
      headers: {"Content-Type": "application/json"}, body: JSON.stringify({deviceToken: permission.deviceToken}), signal: AbortSignal.timeout(10_000)});
    if (!response.ok || Number(response.headers.get("content-length")) > 8192) {await response.body?.cancel(); return;}
    const statusText = await response.text();
    if (statusText.length > 8192) return;
    const status = JSON.parse(statusText);
    if (status.registered !== true || status.enabled !== true || status.revision !== message.registrationRevision || status.expiresAtMs <= Date.now()) return;
    const receiptKey = `/push/received/${message.notificationId}`;
    if (await cache.match(receiptKey)) return;
    // Claim before showing; a duplicate delivery never creates another notification.
    await cache.put(receiptKey, new Response(String(message.expiresAtMs)));
    let image;
    if (typeof message.imageUrl === "string") {
      try {const url = new URL(message.imageUrl); if (url.protocol === "https:" && !url.username && !url.password) image = url.href;} catch {return;}
    }
    const latestGate = await cache.match("/push/display-permission");
    const latest = latestGate ? await latestGate.json() : null;
    if (latest?.enabled !== true || latest.deviceHash !== message.deviceHash || latest.revision !== message.registrationRevision) return;
    await self.registration.showNotification(message.title, {body: message.body, icon: "/push/icon.png", tag: message.notificationId,
      ...(image ? {image} : {}), data: {launchUrl: message.launchUrl}});
    // Retain only live receipt markers so long-running installations stay bounded.
    for (const request of await cache.keys()) {
      if (!new URL(request.url).pathname.startsWith("/push/received/")) continue;
      const marker = await cache.match(request);
      if (!marker || Number(await marker.text()) <= Date.now()) await cache.delete(request);
    }
  };
  pushProcessing = pushProcessing.catch(() => undefined).then(() => self.navigator.locks
    ? self.navigator.locks.request("riddle-quest-push-display-lock", process) : process());
  event.waitUntil(pushProcessing);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  let destination = "/push/";
  try {
    const url = new URL(event.notification.data?.launchUrl);
    if (url.protocol === "https:" && !url.username && !url.password) destination = url.href;
  } catch { /* Unknown deployments return to the device settings page. */ }
  event.waitUntil(self.clients.openWindow(destination));
});
