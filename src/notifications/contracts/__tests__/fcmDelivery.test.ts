import {FcmDeliveryRequest} from "../fcmDelivery";

const expiresAtMs = 1_800_000_000_000;
const request = {
  version: 1, transport: "android", token: "managed-test-registration-token", expiresAtMs,
  data: {version: "1", kind: "campaign", notificationId: "a".repeat(64), registrationRevision: "42",
    title: "Challenge ready", body: "A new challenge is available.", expiresAtMs: String(expiresAtMs), accountId: "player"},
};

it("preserves the native Android campaign payload sent by the dispatcher", () => {
  expect(FcmDeliveryRequest.parse(request)).toEqual(request);
});

it("rejects a previously accepted browser FCM request", () => {
  const {accountId: _accountId, ...common} = request.data;
  const web = {...request, transport: "web",
    data: {...common, kind: "notification", deviceHash: "b".repeat(64), target: "jest", launchUrl: "https://example.com/game"}};
  expect(FcmDeliveryRequest.safeParse(web).success).toBe(false);
  expect(FcmDeliveryRequest.safeParse({...web, transport: "android"}).success).toBe(false);
});
