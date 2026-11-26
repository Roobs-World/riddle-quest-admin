import {onRequest} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {FirebasePushBridgeInput} from "../../../src/notifications/contracts/firebasePush";
import {bridgeAuthorized, notificationBridgeSecret} from "./notificationBridge";
import {disableBrowserDevice, inactiveBrowserStatus} from "./notificationDevices";

export const notificationBrowserBridge = onRequest({region: "europe-west1", minInstances: 0, timeoutSeconds: 60,
  secrets: [notificationBridgeSecret], cors: false}, async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {response.status(405).json({error: "method-not-allowed"}); return;}
  if (["configuration", "configuration-fcm", "enroll", "enroll-fcm"].includes(request.body?.action)) {
    response.status(410).json({error: "browser-push-disabled"});
    return;
  }
  if (!bridgeAuthorized(request.get("Authorization"))) {response.status(401).json({error: "bridge-authorization-required"}); return;}
  const parsed = request.rawBody.length <= 12_288 ? FirebasePushBridgeInput.safeParse(request.body) : null;
  if (!parsed?.success) {response.status(400).json({error: "notification-request-invalid"}); return;}
  try {
    const input = parsed.data;
    switch (input.action) {
      case "audience": {
        const accounts = await admin.firestore().collection("users").count().get();
        response.json({accounts: accounts.data().count, registeredDevices: 0});
        return;
      }
      case "status": response.json(inactiveBrowserStatus); return;
      case "disable": response.json(await disableBrowserDevice(input.deviceToken)); return;
      default: {const exhaustive: never = input; throw exhaustive;}
    }
  } catch {response.status(503).json({error: "notification-service-unavailable"});}
});
