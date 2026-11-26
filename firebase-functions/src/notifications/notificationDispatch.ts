import {onRequest} from "firebase-functions/v2/https";

/** Retained for older manager deployments. Browser push delivery has been retired. */
export const dispatchFirebaseNotification = onRequest({region: "europe-west1", minInstances: 0, secrets: [], cors: false}, (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {response.status(405).json({error: "method-not-allowed"}); return;}
  response.status(410).json({error: "browser-push-disabled"});
});
