import {describe, expect, it} from "@jest/globals";
import {
  notificationPlayerName,
  parseNotificationCopyDocument,
  renderNotificationBody,
  renderNotificationTemplate,
} from "../notifications/copy";

const english = {
  dailyBody: "Hello {name}",
  dailyCta: "Play",
  streakBody: "{wins} wins",
  streakCta: "Continue",
  weeklyBody: "Level {level}",
  weeklyCta: "Claim",
  raceTitle: "Race",
  raceBody: "Ready",
  raceCta: "Accept",
};

describe("Firestore notification copy", () => {
  it("selects the requested locale and falls back to the configured default", () => {
    const document = {
      defaultLocale: "en",
      locales: {en: english, fr: {...english, dailyCta: "Jouer"}},
    };

    expect(parseNotificationCopyDocument(document, "fr").dailyCta).toBe("Jouer");
    expect(parseNotificationCopyDocument(document, "de")).toEqual(english);
  });

  it("rejects missing or incomplete Firestore copy", () => {
    expect(() => parseNotificationCopyDocument({}, "en")).toThrow(/unavailable/i);
    expect(() => parseNotificationCopyDocument({locales: {en: {...english, raceBody: ""}}}, "en"))
      .toThrow(/raceBody/);
  });

  it("rejects copy that is unsafe for SMS delivery", () => {
    expect(() => parseNotificationCopyDocument({
      locales: {en: {...english, dailyBody: "x".repeat(101)}},
    }, "en")).toThrow(/dailyBody/);
    expect(() => parseNotificationCopyDocument({
      locales: {en: {...english, dailyBody: "A prize is ready 🎁"}},
    }, "en")).toThrow(/dailyBody/);
    expect(() => renderNotificationBody("Hello {name}", {name: "x".repeat(100)}))
      .toThrow(/safe/i);
  });

  it("renders known personalization tokens without removing unknown tokens", () => {
    expect(renderNotificationTemplate("Hi {name}: {coins} {unknown}", {name: "Nova", coins: 75}))
      .toBe("Hi Nova: 75 {unknown}");
  });

  it("removes messaging-unsafe characters from personalized names and uses a fallback", () => {
    expect(notificationPlayerName("  Nova 🚀  Star  ", "Solver")).toBe("Nova Star");
    expect(notificationPlayerName("🎁", "Solver")).toBe("Solver");
  });
});
