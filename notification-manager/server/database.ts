import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {ApiError} from "./errors.js";
import {localDevelopmentEnabled} from "./configuration.js";
import {deadlineSignal, type Deadline} from "./deadline.js";

const clients = new WeakMap<Deadline, SupabaseClient>();

/** A secret-key client is confined to Vercel's server bundle and never stores a browser session. */
export function notificationDatabase(deadline: Deadline): SupabaseClient {
  const cached = clients.get(deadline);
  if (cached) return cached;
  const endpoint = process.env.SUPABASE_URL ?? "", secret = process.env.SUPABASE_SECRET_KEY ?? "";
  let url: URL;
  try {url = new URL(endpoint);} catch {throw new Error("notification-database-unconfigured");}
  const local = localDevelopmentEnabled() && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || secret.length < 32)
    throw new Error("notification-database-unconfigured");
  const database = createClient(endpoint, secret, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: (input, init) => {
      const signal = deadlineSignal(deadline, 12_000);
      return fetch(input, {...init, redirect: "error", signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal});
    }}});
  clients.set(deadline, database);
  return database;
}

/** Database RPCs are service-role-only, and every returned value is parsed by its caller. */
export async function notificationRpc(deadline: Deadline, name: string, input: Record<string, unknown> = {}): Promise<unknown> {
  const {data, error} = await notificationDatabase(deadline).rpc(name, input);
  if (error) {
    const status = /^PT(400|401|403|404|409|410|429)$/u.exec(error.code)?.[1];
    if (status && /^[a-z][a-z0-9-]{1,100}$/u.test(error.message)) throw new ApiError(Number(status), error.message);
    throw new Error("notification-database-operation-failed");
  }
  return data;
}
