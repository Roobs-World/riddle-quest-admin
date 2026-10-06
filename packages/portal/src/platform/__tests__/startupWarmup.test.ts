import {firebaseStartupOrigins, preconnectStartupOrigins} from "../startupWarmup";

describe("platform startup network warm-up", () => {
  it("lists identity, Firebase and both callable regions once in first-use order", () => {
    expect(firebaseStartupOrigins({
      identityExchangeBaseUrl: "https://us-central1-demo.cloudfunctions.net/",
      functionsRegion: "us-central1",
      gameplayRegion: "europe-west1",
      projectId: "demo",
    })).toEqual([
      "https://us-central1-demo.cloudfunctions.net",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      "https://content-firebaseappcheck.googleapis.com",
      "https://europe-west1-demo.cloudfunctions.net",
    ]);
  });

  it("serves gameplay from the default region when no gameplay region is configured", () => {
    expect(firebaseStartupOrigins({functionsRegion: "us-central1", projectId: "demo"}))
      .toEqual(expect.arrayContaining(["https://us-central1-demo.cloudfunctions.net"]));
    expect(firebaseStartupOrigins({functionsRegion: "us-central1", projectId: "demo"}))
      .not.toContain("https://europe-west1-demo.cloudfunctions.net");
  });

  it("ignores relative, insecure and malformed configuration", () => {
    /** Origins without any usable project or backend configuration. */
    const origins = firebaseStartupOrigins({identityExchangeBaseUrl: "/", projectId: "bad project"});
    expect(origins).toHaveLength(4);
    expect(firebaseStartupOrigins({identityExchangeBaseUrl: "http://example.test"})).not.toContain("http://example.test");
    expect(firebaseStartupOrigins({identityExchangeBaseUrl: "::"})).toHaveLength(4);
    expect(firebaseStartupOrigins({projectId: "demo", gameplayRegion: "europe-west1"})).toEqual(expect.arrayContaining([
      "https://europe-west1-demo.cloudfunctions.net",
      "https://us-central1-demo.cloudfunctions.net",
    ]));
  });

  it("adds anonymous preconnect hints without duplicating existing ones", () => {
    /** Links appended to the fake head. */
    const appended: Array<Record<string, string>> = [];
    /** Minimal document seam. */
    const doc = {
      head: {append: (link: Record<string, string>) => appended.push(link)},
      createElement: () => ({}),
      querySelector: (selector: string) => selector.includes("https://a.test") ? {} : null,
    } as unknown as Pick<Document, "head" | "createElement" | "querySelector">;
    preconnectStartupOrigins(["https://a.test", "https://b.test"], doc);
    expect(appended).toEqual([{rel: "preconnect", href: "https://b.test", crossOrigin: "anonymous"}]);
  });
});
