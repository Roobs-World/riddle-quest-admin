import {fileURLToPath} from "node:url";
import {defineConfig, type Plugin} from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

function browserBoundary(): Plugin {
  return {
    name: "notification-manager-browser-boundary",
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds()) {
        const normalized = id.replaceAll("\\", "/");
        if ((normalized.startsWith(root) && /^\/(?:server|api|supabase)\//u.test(normalized.slice(root.length - 1))) ||
            /\/(?:firebase(?:-admin)?|web-push)(?:\/|@)/u.test(normalized) || normalized.includes("/platforms/native/")) {
          this.error("A server module entered the notification manager browser bundle.");
        }
      }
      const secrets = [process.env.SUPABASE_SECRET_KEY, process.env.HOSTED_PUSH_VAPID_PRIVATE_KEY, process.env.CRON_SECRET,
        process.env.NOTIFICATION_MANAGER_BRIDGE_SECRET]
        .filter((value): value is string => Boolean(value && value.length >= 16));
      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk") continue;
        if (Object.entries(item.modules).some(([id, module]) => id.replaceAll("\\", "/").endsWith("/src/DraftWorkspace.tsx") && module.renderedLength > 0)) {
          this.error("The development drafts workspace cannot ship in a production build.");
        }
        if (/\b(?:SUPABASE_SECRET_KEY|HOSTED_PUSH_VAPID_PRIVATE_KEY|CRON_SECRET|NOTIFICATION_MANAGER_BRIDGE_SECRET)\b/u.test(item.code) ||
            secrets.some(secret => item.code.includes(secret))) {
          this.error("A server credential entered the notification manager browser bundle.");
        }
      }
    },
  };
}

export default defineConfig({
  root,
  envDir: root,
  envPrefix: "VITE_NOTIFICATION_",
  publicDir: false,
  plugins: [react(), browserBoundary()],
  server: {host: "127.0.0.1", port: 5180, strictPort: true},
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
