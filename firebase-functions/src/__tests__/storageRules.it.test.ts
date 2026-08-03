import {readFileSync} from "node:fs";
import {join} from "node:path";
import {assertFails, initializeTestEnvironment, type RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {getBytes, ref, uploadBytes} from "firebase/storage";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {rules: readFileSync(join(__dirname, "../../storage.rules"), "utf8")},
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("Cloud Storage trust boundary", () => {
  it("denies authenticated clients direct avatar reads and writes", async () => {
    const storage = testEnvironment.authenticatedContext("player-1").storage();
    const avatar = ref(storage, "avatars/player-1/profile");
    await assertFails(uploadBytes(avatar, new Uint8Array([1, 2, 3]), {contentType: "image/png"}));
    await assertFails(getBytes(avatar));
  });

  it("denies unauthenticated clients direct object access", async () => {
    const storage = testEnvironment.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(storage, "arbitrary/file"), new Uint8Array([1])));
  });
});
