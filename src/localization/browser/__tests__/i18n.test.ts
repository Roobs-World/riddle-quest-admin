jest.mock("../../../app/testing/mocks/localeModulesMock", () => ({
  loadNonEnglishNamespace: jest.fn(),
}));

import {loadNonEnglishNamespace} from "../../../app/testing/mocks/localeModulesMock";
import {detectDeviceLanguage, isSupportedLocale, LANGUAGE_OPTIONS, setLocale, setLocaleAndWait, tr, type Locale, type NamespaceCatalog, type SharedNamespace} from "../i18n";

/** Describes deferred. */
type Deferred = {
  /** Stores promise. */
  promise: Promise<void>;
  /** Stores reject. */
  reject: (error: Error) => void;
  /** Stores resolve. */
  resolve: () => void;
};

/** Provides deferred behavior. */
const deferred = (): Deferred => {
  /** Provides reject behavior. */
  let reject!: (error: Error) => void;
  /** Provides resolve behavior. */
  let resolve!: () => void;
  /** Provides promise behavior. */
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
};

/** Provides locale loads behavior. */
const localeLoads = new Map<Locale, Deferred>();
/** Provides mocked load namespace behavior. */
const mockedLoadNamespace = jest.mocked(loadNonEnglishNamespace);
/** Provides original document behavior. */
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

/** Sets tle locale load. */
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

it("falls back to English for Chinese device languages and omits Chinese from language choices", () => {
  expect(isSupportedLocale("zh")).toBe(false);
  expect(LANGUAGE_OPTIONS.some((option) => String(option.value) === "zh")).toBe(false);
  for (const locale of ["zh", "zh-CN", "zh-TW", "zh-Hans", "zh-Hant"]) {
    expect(detectDeviceLanguage(locale)).toBe("en");
  }
});

afterAll(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else
    delete (
      globalThis as {
        /** Stores document. */
        document?: unknown;
      }
    ).document;
});

it("commits document language and translations only after the catalog loads", async () => {
  /** Provides arabic load behavior. */
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
  /** Provides german load behavior. */
  const germanLoad = deferred();
  localeLoads.set("de", germanLoad);
  /** Provides warning behavior. */
  const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  setLocale("de");
  germanLoad.reject(new Error("catalog unavailable"));
  await settleLocaleLoad();

  expect(document.documentElement).toMatchObject({lang: "en", dir: "ltr"});
  expect(tr("WebPortal.APP_TITLE")).toBe("Riddle Quest");
  expect(warning).toHaveBeenCalledWith("[riddle-quest-web] Failed to load locale", "de", expect.any(Error));
  warning.mockRestore();
});

it("ignores a stale catalog that resolves after a newer locale request", async () => {
  /** Provides french load behavior. */
  const frenchLoad = deferred();
  /** Provides spanish load behavior. */
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

it("keeps startup waiting until the requested language is usable", async () => {
  /** Controlled translation catalog isolates locale loading behavior. */
  const catalog = deferred();
  localeLoads.set("it", catalog);
  /** Settled locale loading establishes the required translation state. */
  let ready = false;
  /** In-flight operation remains observable until its controlled settlement. */
  const pending = setLocaleAndWait("it").then(() => {ready = true;});
  await settleLocaleLoad();
  expect(ready).toBe(false);
  expect(document.documentElement.lang).toBe("en");
  catalog.resolve();
  await pending;
  expect(document.documentElement.lang).toBe("it");
  expect(tr("WebPortal.APP_TITLE")).toBe("it title");
});

it("rejects awaited startup locale failures instead of authorizing English play", async () => {
  /** Controlled translation catalog isolates locale loading behavior. */
  const catalog = deferred();
  localeLoads.set("nl", catalog);
  /** In-flight operation remains observable until its controlled settlement. */
  const pending = setLocaleAndWait("nl");
  /** Controlled rejection verifies failed translation loading and retry. */
  const rejection = expect(pending).rejects.toThrow("catalog unavailable");
  catalog.reject(new Error("catalog unavailable"));
  await rejection;
  expect(document.documentElement.lang).toBe("en");
});
