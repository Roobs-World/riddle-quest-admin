import {useEffect, useState} from "react";
import {FirebaseFcmPushConfiguration, FirebasePushDeviceStatus, type FirebasePushSubscription} from "../../src/notifications/contracts/firebasePush";
import {createFcmEnrollment, fcmSupported, revokeFcmEnrollment, savedFcmConfiguration} from "./fcmEnrollment";
import {Icon} from "./Icons";
import "./pushEnrollment.css";

const TOKEN_KEY = "riddle-quest-push-device-v1";
const PAIR_KEY = "riddle-quest-push-pair-v1";
const GATE_CACHE = "riddle-quest-push-display-v1";
const GATE_PATH = "/push/display-permission";
const Code = /^[a-f0-9]{64}$/u;

function deviceToken(): string {
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved && Code.test(saved)) return saved;
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(TOKEN_KEY, token);
  if (localStorage.getItem(TOKEN_KEY) !== token) throw new Error("Allow browser storage to enable notifications on this device.");
  return token;
}

async function registeredSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/push/");
  return await registration?.pushManager.getSubscription() ?? null;
}

async function hash(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function request(action: "config-fcm" | "enroll" | "enroll-fcm" | "status" | "disable", input: unknown): Promise<unknown> {
  const response = await fetch(`/api/push/${action}`, {method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store",
    headers: {"Content-Type": "application/json", Accept: "application/json"}, body: JSON.stringify(input), signal: AbortSignal.timeout(15_000)});
  if (!response.ok) {
    void response.body?.cancel();
    throw new Error(action === "enroll" || action === "enroll-fcm" ? "This connection could not be completed. Open a new notification link from your game settings and try again."
      : "The notification service is unavailable. Please try again shortly.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The notification service returned an empty response.");
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) throw new Error("The notification service returned an invalid response.");
      text += decoder.decode(part.value, {stream: true});
    }
    return JSON.parse(text + decoder.decode());
  } finally {await reader.cancel().catch(() => undefined); reader.releaseLock();}
}

async function setDisplayGate(enabled: boolean, token: string, revision = 0): Promise<void> {
  const update = async () => {
    const cache = await caches.open(GATE_CACHE);
    const previous = await cache.match(GATE_PATH);
    if (enabled && previous && (await previous.json()).revision > revision) return;
    await cache.put(GATE_PATH, new Response(JSON.stringify({enabled, deviceHash: await hash(token), deviceToken: token, revision}), {headers: {"Content-Type": "application/json"}}));
    if (!enabled) {
      const registration = await navigator.serviceWorker.getRegistration("/push/");
      for (const notification of await registration?.getNotifications() ?? []) notification.close();
    }
  };
  if (navigator.locks) await navigator.locks.request("riddle-quest-push-display-lock", update);
  else await update();
}

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), character => character.charCodeAt(0));
}

function readPair(): string {
  const value = new URLSearchParams(location.hash.slice(1)).get("pair");
  if (value && Code.test(value)) {
    sessionStorage.setItem(PAIR_KEY, value);
    history.replaceState(null, "", location.pathname);
    return value;
  }
  return sessionStorage.getItem(PAIR_KEY) ?? "";
}

type State = {kind: "checking"} | {kind: "available"} | {kind: "ready"} | {kind: "busy"} | {kind: "error"; message: string};

export function PushEnrollment() {
  const [pairingCode, setPairingCode] = useState(() => {try {return readPair();} catch {return "";}});
  const [state, setState] = useState<State>({kind: "checking"});
  const supported = isSecureContext && "Notification" in globalThis && "serviceWorker" in navigator && "PushManager" in globalThis;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || "standalone" in navigator && navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/u.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  useEffect(() => {
    let current = true;
    if (!supported) {setState({kind: "available"}); return;}
    void (async () => {
      try {
        const token = deviceToken();
        if (Code.test(pairingCode)) {
          await setDisplayGate(false, token);
          if (current && Notification.permission === "granted") await enable(Promise.resolve("granted"));
          else if (current) setState({kind: "available"});
          return;
        }
        const subscription = await registeredSubscription();
        if (!subscription) {await setDisplayGate(false, token); if (current) setState({kind: "available"}); return;}
        const status = FirebasePushDeviceStatus.parse(await request("status", {deviceToken: token, renew: true}));
        if (!current) return;
        const ready = status.registered && status.enabled && Notification.permission === "granted";
        await setDisplayGate(status.registered && Notification.permission === "granted", token, status.revision);
        if (current) setState({kind: ready ? "ready" : "available"});
      } catch (error) {
        if (current) setState({kind: "error", message: error instanceof Error ? error.message : "Your device could not be checked. Please try again."});
      }
    })();
    return () => {current = false;};
  }, [supported]);

  const enable = async (permission: Promise<NotificationPermission>) => {
    if (!Code.test(pairingCode)) {setState({kind: "error", message: "Open this page from your game’s notification settings, or paste the connection code from that link."}); return;}
    setState({kind: "busy"});
    try {
      const token = deviceToken();
      await setDisplayGate(false, token);
      if (await permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser’s site settings, then try again.");
      const configuration = FirebaseFcmPushConfiguration.parse(await request("config-fcm", {}));
      const registration = await navigator.serviceWorker.register("/push/worker.js", {scope: "/push/", updateViaCache: "none"});
      await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("Notification setup took too long. Please try again.")), 12_000))]);
      let subscription = await registration.pushManager.getSubscription();
      const previous = FirebasePushDeviceStatus.parse(await request("status", {deviceToken: token}));
      if (subscription && !previous.registered) {await revokeFcmEnrollment(registration); await subscription.unsubscribe(); subscription = null;}
      const savedFcm = savedFcmConfiguration();
      const locale = navigator.language.split("-")[0] || "en";
      let result: unknown;
      if (configuration.fcm && (!subscription || savedFcm) && await fcmSupported()) {
        if (subscription && savedFcm && (savedFcm.appId !== configuration.fcm.appId || savedFcm.vapidKey !== configuration.fcm.vapidKey)) {
          throw new Error("This device’s notification connection has changed. Disable it on this page, then open a new link from your game settings.");
        }
        const fcmToken = await createFcmEnrollment(configuration.fcm, registration);
        result = await request("enroll-fcm", {pairingCode, deviceToken: token, locale, fcmToken});
      } else {
        if (subscription && savedFcm) throw new Error("This device’s notification connection cannot be refreshed right now. Please try again shortly.");
        subscription ??= await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: applicationKey(configuration.publicKey)});
        const serialized = subscription.toJSON();
        const keys = serialized.keys;
        if (!serialized.endpoint || !keys?.p256dh || !keys.auth) throw new Error("Your browser could not register for notifications.");
        const input: FirebasePushSubscription = {endpoint: serialized.endpoint, keys: {p256dh: keys.p256dh, auth: keys.auth}};
        result = await request("enroll", {pairingCode, deviceToken: token, locale, subscription: input});
      }
      const status = FirebasePushDeviceStatus.parse(result);
      if (!status.registered || !status.enabled) throw new Error("Notifications are disabled for this game account. Enable them in the game settings first.");
      await setDisplayGate(true, token, status.revision);
      const pairHash = await hash(pairingCode);
      window.opener?.postMessage({kind: "riddle-quest-notification-enrolled", pairHash}, "*");
      sessionStorage.removeItem(PAIR_KEY);
      setPairingCode("");
      setState({kind: "ready"});
    } catch (error) {
      setState({kind: "error", message: error instanceof Error ? error.message : "Notifications could not be enabled. Please try again."});
    }
  };

  const disable = async () => {
    setState({kind: "busy"});
    try {
      const token = deviceToken();
      await setDisplayGate(false, token);
      FirebasePushDeviceStatus.parse(await request("disable", {deviceToken: token}));
      const registration = await navigator.serviceWorker.getRegistration("/push/");
      await revokeFcmEnrollment(registration).catch(() => undefined);
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      setState({kind: "available"});
    } catch (error) {setState({kind: "error", message: error instanceof Error ? error.message : "The change could not be saved. Please try again."});}
  };

  return <main className="push-enrollment"><section className="push-enrollment-card" aria-labelledby="push-title">
    <span className="app-mark"><Icon name="bell" size={26} /></span><p className="push-eyebrow">RIDDLE QUEST</p>
    <h1 id="push-title">{state.kind === "ready" ? "This device is connected." : "Your game. Your notifications."}</h1>
    <p>Connect this browser to the account you already use in your game. No extra account or Google sign-in is needed.</p>
    <div className="push-explanation"><Icon name="shield" /><p>Notifications can arrive after you close the game. Your game’s notification setting controls delivery across your connected devices.</p></div>
    {ios && !standalone && <div className="inline-message"><strong>Add this page to your Home Screen first.</strong><p>In Safari, choose Share, then Add to Home Screen. Open the installed app and paste the connection code below before enabling notifications.</p>{Code.test(pairingCode) && <><label htmlFor="copy-pair">Your one-time connection code</label><input id="copy-pair" readOnly value={pairingCode} onFocus={event => event.currentTarget.select()} /><p>Keep this code private. It expires shortly; you can request a new link from the game.</p></>}</div>}
    {!supported && !ios && <p role="alert">This browser does not support push notifications. Open the link in a current supported browser on this device.</p>}
    {state.kind === "error" && <p role="alert" className="inline-message error-message">{state.message}</p>}
    {state.kind === "checking" || state.kind === "busy" ? <p role="status">{state.kind === "checking" ? "Checking this device…" : "Saving your notification settings…"}</p> : state.kind === "ready" ? <><p role="status" className="push-connected">Notifications are enabled on this device. You can return to your game.</p><button className="button-secondary" onClick={() => {void disable();}}>Disable on this device</button></> : <>
      <label htmlFor="pairing-code">Connection code</label><input id="pairing-code" autoComplete="off" spellCheck={false} value={pairingCode} onChange={event => setPairingCode(event.target.value.trim())} placeholder="Open the link from your game, or paste its code" />
      <button className="button-primary" disabled={!supported || ios && !standalone || !Code.test(pairingCode)} onClick={() => {void enable(Notification.permission === "default" ? Notification.requestPermission() : Promise.resolve(Notification.permission));}}>Enable notifications on this device</button>
      {supported && savedFcmConfiguration() && <button className="button-secondary" onClick={() => {void disable();}}>Disable on this device</button>}
    </>}
    <p className="push-small">Repeat this setup once on each device you want to receive notifications on. Permission stays under your control.</p>
  </section></main>;
}
