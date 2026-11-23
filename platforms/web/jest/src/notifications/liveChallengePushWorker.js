/* This worker ships only with the Jest adapter. Payloads are data-only FCM messages. */
self.addEventListener("push", event => {
  let data;
  try {data = event.data.json().data;} catch {return;}
  if (data?.kind !== "liveChallenge" || !/^live_[a-f0-9]{64}$/.test(data.challengeId) ||
      !Number.isSafeInteger(Number(data.expiresAtMs)) || Number(data.expiresAtMs) <= Date.now() ||
      typeof data.title !== "string" || data.title.length > 200 || typeof data.body !== "string" || data.body.length > 2000) return;
  event.waitUntil(self.registration.showNotification(data.title, {body: data.body, tag: data.challengeId,
    data: {challengeId: data.challengeId, expiresAtMs: Number(data.expiresAtMs)}}));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data;
  if (!/^live_[a-f0-9]{64}$/.test(data?.challengeId) || data.expiresAtMs <= Date.now()) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    const client = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (client) {client.postMessage({kind: "liveChallenge", challengeId: data.challengeId}); await client.focus(); return;}
    const gameUrl = new URL(new URL(self.location.href).searchParams.get("gameUrl") || "https://jest.com/g/riddle-q");
    if (gameUrl.origin === "https://jest.com" && /^\/g\/[a-z0-9-]+$/.test(gameUrl.pathname) && !gameUrl.search && !gameUrl.hash)
      await self.clients.openWindow(gameUrl.href);
  })());
});
