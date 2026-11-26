import {fileURLToPath} from "node:url";
import {defineConfig, loadEnv, type Plugin} from "vite";
import react from "@vitejs/plugin-react";
import {PublicSupabaseSettings} from "./src/publicConfiguration.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

function browserBoundary(environment: Readonly<Record<string, string>>): Plugin {
  return {
    name: "notification-manager-browser-boundary",
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds()) {
        const normalized = id.replaceAll("\\", "/");
        if (/\/node_modules\/(?:firebase|@firebase)\//u.test(normalized)) {
          this.error("Firebase device SDKs cannot ship in the notification manager browser bundle.");
        }
        if ((normalized.startsWith(root) && /^\/(?:server|api|supabase)\//u.test(normalized.slice(root.length - 1))) ||
            /\/(?:firebase-admin|web-push)(?:\/|@)/u.test(normalized) || normalized.includes("/platforms/native/")) {
          this.error("A server module entered the notification manager browser bundle.");
        }
      }
      const secrets = [environment.SUPABASE_SECRET_KEY, environment.SUPABASE_SERVICE_ROLE_KEY, environment.SUPABASE_JWT_SECRET,
        environment.POSTGRES_PASSWORD, environment.POSTGRES_URL, environment.POSTGRES_PRISMA_URL, environment.POSTGRES_URL_NON_POOLING,
        environment.HOSTED_PUSH_VAPID_PRIVATE_KEY, environment.CRON_SECRET, environment.NOTIFICATION_MANAGER_BRIDGE_SECRET,
        environment.NOTIFICATION_FCM_EDGE_SECRET, environment.FCM_SERVICE_ACCOUNT_JSON]
        .filter((value): value is string => Boolean(value && value.length >= 16));
      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk") continue;
        if (Object.entries(item.modules).some(([id, module]) => id.replaceAll("\\", "/").endsWith("/src/DraftWorkspace.tsx") && module.renderedLength > 0)) {
          this.error("The development drafts workspace cannot ship in a production build.");
        }
        if (/\b(?:SUPABASE_SECRET_KEY|HOSTED_PUSH_VAPID_PRIVATE_KEY|CRON_SECRET|NOTIFICATION_MANAGER_BRIDGE_SECRET|NOTIFICATION_FCM_EDGE_SECRET|FCM_SERVICE_ACCOUNT_JSON)\b/u.test(item.code) ||
            secrets.some(secret => item.code.includes(secret))) {
          this.error("A server credential entered the notification manager browser bundle.");
        }
      }
    },
  };
}

export default defineConfig(({mode}) => {
  // Read integration settings on the build host, then expose exactly two validated public values.
  const environment = loadEnv(mode, root, "");
  const explicit = environment.VITE_NOTIFICATION_SUPABASE_URL || environment.VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY;
  const integration = environment.SUPABASE_URL || environment.SUPABASE_PUBLISHABLE_KEY;
  const settings = explicit
    ? {url: environment.VITE_NOTIFICATION_SUPABASE_URL, key: environment.VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY}
    : integration ? {url: environment.SUPABASE_URL, key: environment.SUPABASE_PUBLISHABLE_KEY}
      : {url: environment.NEXT_PUBLIC_SUPABASE_URL, key: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
  const configured = settings.url || settings.key;
  const parsed = configured ? PublicSupabaseSettings.safeParse(settings) : null;
  if (parsed && !parsed.success) {
    throw new Error("Notification manager Supabase configuration requires a complete HTTPS project URL and modern publishable-key pair. Server credentials cannot be used as public keys.");
  }
  const publicSettings = parsed?.success ? parsed.data : null;
  if (publicSettings && environment.SUPABASE_URL) {
    const serverUrl = PublicSupabaseSettings.shape.url.safeParse(environment.SUPABASE_URL);
    if (!serverUrl.success || new URL(publicSettings.url).origin !== new URL(serverUrl.data).origin) {
      throw new Error("Notification manager browser and server Supabase URLs must refer to the same project.");
    }
  }
  return {
    root,
    envDir: root,
    envPrefix: "VITE_NOTIFICATION_",
    publicDir: "public",
    plugins: [react(), browserBoundary(environment)],
    define: {
      "import.meta.env.VITE_NOTIFICATION_SUPABASE_URL": JSON.stringify(publicSettings?.url ?? ""),
      "import.meta.env.VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSettings?.key ?? ""),
    },
    server: {host: "127.0.0.1", port: 5180, strictPort: true},
    build: {
      outDir: fileURLToPath(new URL("./dist", import.meta.url)),
      emptyOutDir: true,
      sourcemap: false,
    },
  };
});
