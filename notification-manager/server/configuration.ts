import {createECDH} from "node:crypto";
import {z} from "zod";
import {Platform} from "./model.js";

export function localDevelopmentEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NOTIFICATION_ALLOW_LOCALHOST === "true";
}

const AllowedOrigins = z.record(Platform, z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && value.replace(/\/$/u, "") === url.origin &&
      (url.protocol === "https:" || localDevelopmentEnabled() && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {return false;}
}));

/** Every admitted game origin is explicit; deployments cannot enable wildcard browser access. */
export function admittedOrigins(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(process.env.NOTIFICATION_ALLOWED_ORIGINS ?? "{}");
    const parsed = AllowedOrigins.parse(value);
    return Object.fromEntries(Object.entries(parsed).map(([target, origin]) => [target, new URL(origin).origin]));
  } catch {throw new Error("notification-origin-configuration-invalid");}
}

export type VapidConfiguration = Readonly<{publicKey: string; privateKey: string; subject: string}>;
let cachedVapid: VapidConfiguration | undefined;

/** Loads a stable matching key pair without returning private material to browser handlers. */
export function vapidConfiguration(): VapidConfiguration {
  if (cachedVapid) return cachedVapid;
  const publicKey = process.env.HOSTED_PUSH_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.HOSTED_PUSH_VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.HOSTED_PUSH_VAPID_SUBJECT ?? "";
  if (!/^[A-Za-z0-9_-]{87}$/u.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/u.test(privateKey)) throw new Error("notification-vapid-unconfigured");
  let contact: URL;
  try {contact = new URL(subject);} catch {throw new Error("notification-vapid-contact-invalid");}
  if (subject.length > 256 || !(contact.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.pathname) ||
      contact.protocol === "https:" && !contact.username && !contact.password && !contact.hash && contact.hostname !== "localhost"))
    throw new Error("notification-vapid-contact-invalid");
  const key = createECDH("prime256v1");
  try {
    key.setPrivateKey(Buffer.from(privateKey, "base64url"));
    if (key.getPublicKey().toString("base64url") !== publicKey) throw new Error("mismatch");
  } catch {throw new Error("notification-vapid-key-mismatch");}
  cachedVapid = {publicKey, privateKey, subject};
  return cachedVapid;
}
