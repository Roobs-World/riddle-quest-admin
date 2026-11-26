self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.allSettled([
      self.registration.getNotifications().then(items => items.forEach(notification => notification.close())),
      self.registration.pushManager?.getSubscription().then(subscription => subscription?.unsubscribe()),
      caches.delete("riddle-quest-push-display-v1"),
    ]);
    await self.registration.unregister();
  })());
});

self.addEventListener("notificationclick", event => event.notification.close());
