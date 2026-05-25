jest.mock("../IapService", () => ({
  IapService: {
    getProducts: jest.fn(),
  },
}));

jest.mock("../ProductPricingService", () => ({
  ProductPricingService: {
    getActiveProducts: jest.fn(),
  },
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

import {preloadShopCatalog} from "../ShopCatalogPreloader";
import {IapService} from "../IapService";
import {ProductPricingService} from "../ProductPricingService";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";

const mockIapGetProducts = IapService.getProducts as jest.MockedFunction<typeof IapService.getProducts>;
const mockGetActiveProducts = ProductPricingService.getActiveProducts as jest.MockedFunction<
  typeof ProductPricingService.getActiveProducts
>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockCaptureException = captureException as jest.MockedFunction<typeof captureException>;
const devGlobal = globalThis as typeof globalThis & {__DEV__?: boolean};

describe("preloadShopCatalog", () => {
  const originalDev = devGlobal.__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIapGetProducts.mockResolvedValue([]);
    mockGetActiveProducts.mockResolvedValue([]);
    devGlobal.__DEV__ = true;
  });

  afterAll(() => {
    devGlobal.__DEV__ = originalDev;
  });

  it("preloads Firestore pricing but skips native IAP in dev-client builds", async () => {
    await preloadShopCatalog();

    expect(mockGetActiveProducts).toHaveBeenCalledTimes(1);
    expect(mockIapGetProducts).not.toHaveBeenCalled();
    expect(mockedLogger.warn).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("preloads native IAP products in production builds", async () => {
    devGlobal.__DEV__ = false;

    await preloadShopCatalog();

    expect(mockIapGetProducts).toHaveBeenCalledTimes(1);
    expect(mockGetActiveProducts).toHaveBeenCalledTimes(1);
  });

  it("captures production IAP preload failures without blocking Firestore pricing", async () => {
    devGlobal.__DEV__ = false;
    const iapError = new Error("Billing unavailable");
    mockIapGetProducts.mockRejectedValueOnce(iapError);

    await preloadShopCatalog();

    expect(mockGetActiveProducts).toHaveBeenCalledTimes(1);
    expect(mockedLogger.warn).toHaveBeenCalledWith("Shop catalog preload: failed to preload IAP products", iapError);
    expect(mockCaptureException).toHaveBeenCalledWith(iapError, {
      context: "ShopCatalogPreloader.iap",
    });
  });
});
