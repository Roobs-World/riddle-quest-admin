import {createClient} from "@supabase/supabase-js";
import {PublicSupabaseSettings} from "./publicConfiguration";
import {secureManagementOrigin} from "./secureTransport";

const managementFetch: typeof fetch = (input, init) => {
  secureManagementOrigin();
  return fetch(input, {...init, redirect: "error"});
};

function initializeManagementConnection() {
  secureManagementOrigin();
  const parsed = PublicSupabaseSettings.safeParse({
    url: import.meta.env.VITE_NOTIFICATION_SUPABASE_URL,
    key: import.meta.env.VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) throw new Error("Connect this Vercel project to Supabase and rebuild, or set VITE_NOTIFICATION_SUPABASE_URL and VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY. Enable Google sign-in and allow this website's redirect URL in Supabase Authentication.");
  const settings = parsed.data;
  const client = createClient(settings.url, settings.key, {
    auth: {flowType: "pkce", storageKey: "riddle-quest-notification-studio"},
    global: {fetch: managementFetch},
  });
  let currentUserId: string | null = null;
  client.auth.onAuthStateChange((_event, session) => {currentUserId = session?.user.id ?? null;});
  const credentials = async (expectedId: string) => {
    secureManagementOrigin();
    const {data, error} = await client.auth.getSession();
    if (error || !data.session) throw new Error("Your sign-in has expired. Sign in again.");
    if (data.session.user.id !== expectedId || currentUserId !== expectedId) throw new Error("The signed-in account changed. Please try again.");
    return data.session.access_token;
  };
  return {
    client,
    isCurrentUser: (id: string) => currentUserId === id,
    async requestHeaders(expectedId: string) {return {Authorization: `Bearer ${await credentials(expectedId)}`};},
    async signIn() {
      const {error} = await client.auth.signInWithOAuth({provider: "google", options: {redirectTo: window.location.origin}});
      if (error) throw new Error("Google sign-in could not be started. Check the provider and redirect settings, then try again.");
    },
    async signOut() {
      const {error} = await client.auth.signOut({scope: "local"});
      if (error) throw new Error("Sign-out could not be completed. Please try again.");
    },
    async uploadImage(file: File, userId: string, signal: AbortSignal): Promise<string> {
      const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : null;
      if (!extension || file.size === 0 || file.size > 2 * 1024 * 1024) throw new Error("Choose a PNG, JPEG, or WebP image no larger than 2 MB.");
      const token = await credentials(userId);
      if (signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
      const storage = createClient(settings.url, settings.key, {
        accessToken: async () => token,
        auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
        global: {fetch: (input, init) => managementFetch(input, {...init, signal})},
      }).storage.from("notification-images");
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const {error} = await storage.upload(path, file, {upsert: false, contentType: file.type, cacheControl: "31536000"});
      if (error) throw new Error("The image could not be uploaded. Check your access and the notification-images storage configuration, then try again. Your draft and previous image are safe.");
      if (signal.aborted || currentUserId !== userId) throw new DOMException("Upload cancelled", "AbortError");
      return storage.getPublicUrl(path).data.publicUrl;
    },
  };
}

export type ManagementConnection = ReturnType<typeof initializeManagementConnection>;
let connection: ManagementConnection | undefined;

export function createManagementConnection(): ManagementConnection {
  connection ??= initializeManagementConnection();
  return connection;
}

export function managementError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The request failed. Please try again.";
}
