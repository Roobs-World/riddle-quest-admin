import {HttpsError, onRequest} from "firebase-functions/v2/https";
import {admin} from "../shared/firebaseAdmin";
import {FirebasePushAudience, FirebasePushBridgeInput} from "../../../src/notifications/contracts/firebasePush";
import {bridgeAuthorized, browserPushConfiguration, notificationBridgeSecret, notificationVapidPrivateKey} from "./notificationBridge";
import {browserDeviceStatus, enrollBrowserDevice} from "./notificationDevices";

export const notificationBrowserBridge = onRequest({region: "europe-west1", minInstances: 0, timeoutSeconds: 60,
  secrets: [notificationBridgeSecret, notificationVapidPrivateKey], cors: false}, async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {response.status(405).json({error: "method-not-allowed"}); return;}
  if (!bridgeAuthorized(request.get("Authorization"))) {response.status(401).json({error: "bridge-authorization-required"}); return;}
  const parsed = request.rawBody.length <= 12_288 ? FirebasePushBridgeInput.safeParse(request.body) : null;
  if (!parsed?.success) {response.status(400).json({error: "notification-request-invalid"}); return;}
  try {
    const input = parsed.data;
    switch (input.action) {
      case "configuration": response.json({version: 1, publicKey: browserPushConfiguration().publicKey}); return;
      case "audience": {
        const db = admin.firestore();
        const [accounts, devices] = await Promise.all([db.collection("users").count().get(),
          db.collection("accountPushDevices").where("expiresAtMs", ">", Date.now()).count().get()]);
        response.json(FirebasePushAudience.parse({accounts: accounts.data().count, registeredDevices: devices.data().count}));
        return;
      }
      case "enroll": response.json(await enrollBrowserDevice(input)); return;
      case "status": response.json(await browserDeviceStatus(input.deviceToken, false, input.renew ?? false)); return;
      case "disable": response.json(await browserDeviceStatus(input.deviceToken, true)); return;
      default: {const exhaustive: never = input; throw exhaustive;}
    }
  } catch (error) {
    const rejected = error instanceof HttpsError && ["failed-precondition", "permission-denied", "not-found"].includes(error.code);
    response.status(rejected ? 409 : 503).json({error: rejected ? "notification-setup-unavailable" : "notification-service-unavailable"});
  }
});
