import {sizeCheckedScreenshotProvider} from "../screenshots";

it("rejects non-PNG and oversized screenshots", async () => {
  expect(await sizeCheckedScreenshotProvider(() => "data:image/jpeg;base64,YQ==")()).toBeNull();
  expect(await sizeCheckedScreenshotProvider(() => `data:image/png;base64,${"A".repeat(2_800_000)}`)()).toBeNull();
});
it("accepts a small PNG data URL", async () => expect(await sizeCheckedScreenshotProvider(() => "data:image/png;base64,YQ==")()).toBe("data:image/png;base64,YQ=="));
