import {jestStartupOrigins, preconnectJestStartupOrigins} from "../startupWarmup";

describe("Jest startup network warm-up", () => {
  it("lists identity, Firebase and both callable regions once in first-use order", () => {
    expect(jestStartupOrigins({
      jestFunctionsBaseUrl: "https://us-central1-demo.cloudfunctions.net/",
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

  it("ignores relative, insecure and malformed configuration", () => {
    /** Origins without any usable project or backend configuration. */
    const origins = jestStartupOrigins({jestFunctionsBaseUrl: "/", projectId: "bad project"});
    expect(origins).toHaveLength(4);
    expect(jestStartupOrigins({jestFunctionsBaseUrl: "http://example.test"})).not.toContain("http://example.test");
    expect(jestStartupOrigins({jestFunctionsBaseUrl: "::"})).toHaveLength(4);
    expect(jestStartupOrigins({projectId: "demo"})).toEqual(expect.arrayContaining([
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
    preconnectJestStartupOrigins(["https://a.test", "https://b.test"], doc);
    expect(appended).toEqual([{rel: "preconnect", href: "https://b.test", crossOrigin: "anonymous"}]);
  });
});
