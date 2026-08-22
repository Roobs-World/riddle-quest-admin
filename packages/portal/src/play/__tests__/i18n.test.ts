jest.mock("../../test/localeModulesMock", () => ({
  loadNonEnglishNamespace: jest.fn(),
}));

import {loadNonEnglishNamespace} from "../../test/localeModulesMock";
import {setLocale, tr, type Locale, type NamespaceCatalog, type SharedNamespace} from "../i18n";

type Deferred = {
  promise: Promise<void>;
  reject: (error: Error) => void;
  resolve: () => void;
};

const deferred = (): Deferred => {
  let reject!: (error: Error) => void;
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
};

const localeLoads = new Map<Locale, Deferred>();
const mockedLoadNamespace = jest.mocked(loadNonEnglishNamespace);
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

const settleLocaleLoad = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  localeLoads.clear();
  mockedLoadNamespace.mockReset();
  mockedLoadNamespace.mockImplementation(async (locale: Exclude<Locale, "en">, namespace: SharedNamespace) => {
    await localeLoads.get(locale)?.promise;
    return (namespace === "game" ? {WebPortal: {APP_TITLE: `${locale} title`}} : {}) as NamespaceCatalog;
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {documentElement: {dir: "ltr", lang: "en"}},
  });
  setLocale("en");
});

afterAll(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else delete (globalThis as {document?: unknown}).document;
});

it("commits document language and translations only after the catalog loads", async () => {
  const arabicLoad = deferred();
  localeLoads.set("ar", arabicLoad);

  setLocale("ar");

  expect(document.documentElement).toMatchObject({lang: "en", dir: "ltr"});
  expect(tr("WebPortal.APP_TITLE")).toBe("Riddle Quest");

  arabicLoad.resolve();
  await settleLocaleLoad();

  expect(document.documentElement).toMatchObject({lang: "ar", dir: "rtl"});
  expect(tr("WebPortal.APP_TITLE")).toBe("ar title");
});

it("retains the last committed locale when a catalog load fails", async () => {
  const germanLoad = deferred();
  localeLoads.set("de", germanLoad);
  const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  setLocale("de");
  germanLoad.reject(new Error("catalog unavailable"));
  await settleLocaleLoad();

  expect(document.documentElement).toMatchObject({lang: "en", dir: "ltr"});
  expect(tr("WebPortal.APP_TITLE")).toBe("Riddle Quest");
  expect(warning).toHaveBeenCalledWith(
    "[riddle-quest-web] Failed to load locale",
    "de",
    expect.any(Error),
  );
  warning.mockRestore();
});

it("ignores a stale catalog that resolves after a newer locale request", async () => {
  const frenchLoad = deferred();
  const spanishLoad = deferred();
  localeLoads.set("fr", frenchLoad);
  localeLoads.set("es", spanishLoad);

  setLocale("fr");
  setLocale("es");
  frenchLoad.resolve();
  await settleLocaleLoad();

  expect(document.documentElement).toMatchObject({lang: "en", dir: "ltr"});

  spanishLoad.resolve();
  await settleLocaleLoad();

  expect(document.documentElement).toMatchObject({lang: "es", dir: "ltr"});
  expect(tr("WebPortal.APP_TITLE")).toBe("es title");
});
