const CACHE = "riddleQuest:hostedNotifications:v1";
const TARGET = /^[a-z][a-z0-9-]{0,63}$/u;
const INSTALLATION = /^[A-Za-z0-9_-]{1,128}$/u;
const MESSAGE_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;

function validImage(value) {
  if (value === null) return true;
  if (typeof value !== "string" || value.length === 0 || value.length > 2048 || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  try {
    const image = new URL(value);
    return image.protocol === "https:" && !image.username && !image.password && !image.hash;
  } catch {return false;}
}

async function readGate(target) {
  const cache = await caches.open(CACHE);
  const key = new URL(`/api/notifications/display-gate?target=${encodeURIComponent(target)}`, self.location.origin);
  const response = await cache.match(key);
  if (!response) return null;
  const gate = await response.json();
  if (gate?.target !== target || gate.enabled !== true || typeof gate.installationId !== "string" ||
      !INSTALLATION.test(gate.installationId) || typeof gate.launchPath !== "string" ||
      !gate.launchPath.startsWith("/") || gate.launchPath.startsWith("//")) return null;
  const launch = new URL(gate.launchPath, self.location.origin);
  if (launch.origin !== self.location.origin || launch.search || launch.hash) return null;
  return {...gate, launchUrl: launch.href};
}

function validMessage(value) {
  return value?.version === 1 && value.kind === "notification" && typeof value.notificationId === "string" && MESSAGE_ID.test(value.notificationId) &&
    typeof value.target === "string" && TARGET.test(value.target) &&
    typeof value.installationId === "string" && INSTALLATION.test(value.installationId) &&
    typeof value.title === "string" && value.title.length > 0 && value.title.length <= 200 &&
    typeof value.body === "string" && value.body.length > 0 && value.body.length <= 2000 &&
    validImage(value.imageUrl) &&
    Number.isSafeInteger(value.expiresAtMs) && value.expiresAtMs > Date.now() && value.expiresAtMs <= Date.now() + 7 * 86_400_000;
}

self.addEventListener("install", event => {event.waitUntil(self.skipWaiting());});
self.addEventListener("activate", event => {event.waitUntil(self.clients.claim());});
self.addEventListener("push", event => {
  let message;
  try {message = event.data.json();} catch {return;}
  if (!validMessage(message)) return;
  event.waitUntil((async () => {
    try {
      const gate = await readGate(message.target);
      if (!gate || gate.installationId !== message.installationId) return;
      await self.registration.showNotification(message.title, {
        body: message.body,
        ...(message.imageUrl === null ? {} : {image: message.imageUrl}),
        tag: `riddle-quest:${message.target}:${message.installationId}:${message.notificationId}`,
        data: {target: message.target, installationId: message.installationId, expiresAtMs: message.expiresAtMs},
      });
    } catch { /* Unreadable consent cannot authorize display. */ }
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const message = event.notification.data;
  if (typeof message?.target !== "string" || !TARGET.test(message.target) ||
      typeof message.installationId !== "string" || !INSTALLATION.test(message.installationId) ||
      !Number.isSafeInteger(message.expiresAtMs) || message.expiresAtMs <= Date.now()) return;
  event.waitUntil((async () => {
    try {
      const gate = await readGate(message.target);
      if (!gate || gate.installationId !== message.installationId) return;
      const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
      const current = windows.find(client => client.url === gate.launchUrl);
      if (current) {await current.focus(); return;}
      await self.clients.openWindow(gate.launchUrl);
    } catch { /* Delivery and navigation both require current persisted consent. */ }
  })());
});
