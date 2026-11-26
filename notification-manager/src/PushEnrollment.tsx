import {Icon} from "./Icons";
import "./pushEnrollment.css";

const deviceKey = "riddle-quest-push-device-v1";

async function removeBrowserSubscription() {
  if (!("serviceWorker" in navigator)) return;
  const scope = new URL("/push/", location.origin).href;
  const registration = await navigator.serviceWorker.getRegistration(scope);
  if (registration?.scope !== scope) return;
  try {
    await Promise.allSettled([
      registration.getNotifications().then(notifications => notifications.forEach(notification => notification.close())),
      registration.pushManager?.getSubscription().then(subscription => subscription?.unsubscribe()),
    ]);
  } finally {
    await registration.unregister();
  }
}

async function disableExistingDevice() {
  const token = localStorage.getItem(deviceKey);
  if (!token) return;
  const response = await fetch("/api/push/disable", {method: "POST", credentials: "same-origin", redirect: "error",
    headers: {"Content-Type": "application/json"}, body: JSON.stringify({deviceToken: token}), signal: AbortSignal.timeout(15_000)});
  await response.body?.cancel();
  if (response.ok && localStorage.getItem(deviceKey) === token) localStorage.removeItem(deviceKey);
}

export function retireBrowserPush(): void {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  void Promise.allSettled([
    removeBrowserSubscription(),
    disableExistingDevice(),
    Promise.resolve().then(() => caches.delete("riddle-quest-push-display-v1")),
    Promise.resolve().then(() => sessionStorage.removeItem("riddle-quest-push-pair-v1")),
    Promise.resolve().then(() => localStorage.removeItem("riddle-quest-fcm-device-v1")),
  ]);
}

export function PushEnrollment() {
  return <main className="push-enrollment"><section className="push-enrollment-card" aria-labelledby="push-title">
    <span className="app-mark"><Icon name="bell" size={26} /></span>
    <h1 id="push-title">Browser notifications are off</h1>
    <p>You can close this page.</p>
  </section></main>;
}
