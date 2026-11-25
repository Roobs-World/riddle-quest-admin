import {JWT} from "google-auth-library";
import {z} from "zod";

const ServiceAccount = z.object({
  type: z.literal("service_account"),
  project_id: z.literal("riddle-quest-ec2b2"),
  client_email: z.string().regex(/^[a-z0-9-]+@riddle-quest-ec2b2\.iam\.gserviceaccount\.com$/u),
  private_key: z.string().min(100).max(8192),
});

let client: JWT | undefined;

export async function googleAccessToken(): Promise<string> {
  if (!client) {
    const account = ServiceAccount.parse(JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "null"));
    client = new JWT({email: account.client_email, key: account.private_key,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      eagerRefreshThresholdMillis: 60_000, transporterOptions: {timeout: 4000, retry: false}});
  }
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("fcm-credential-unavailable");
  return token.token;
}

export const FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects/riddle-quest-ec2b2/messages:send";
