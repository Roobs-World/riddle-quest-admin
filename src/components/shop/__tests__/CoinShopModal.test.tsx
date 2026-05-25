import React from "react";
import {fireEvent, render} from "@testing-library/react-native";

import CoinShopModal from "../CoinShop";

jest.mock("react-native/Libraries/Components/Touchable/TouchableOpacity", () => {
  const React = require("react");
  const {Pressable} = require("react-native");
  const MockTouchableOpacity = ({children, ...props}: any) => React.createElement(Pressable, props, children);
  return {
    __esModule: true,
    default: MockTouchableOpacity,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({top: 10, bottom: 10, left: 0, right: 0}),
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../buttons/CloseButton", () => {
  const React = require("react");
  const {Pressable, Text} = require("react-native");

  return function MockCloseButton({onPress, accessibilityLabel}: {onPress: () => void; accessibilityLabel?: string}) {
    return (
      <Pressable onPress={onPress} testID="close-button">
        <Text>{accessibilityLabel ?? "Close"}</Text>
      </Pressable>
    );
  };
});

type ProductPricing = {
  productId: string;
  productKey: string;
  coins: number;
  sortOrder: number;
  featuredBadge?: string;
  featuredOrder?: number | null;
  regionalPrices: Array<{currency: string; displayPrice: string}>;
};

const createProduct = (overrides: Partial<ProductPricing>): ProductPricing => ({
  productId: "coins_100",
  productKey: "coins_100",
  coins: 100,
  sortOrder: 1,
  featuredBadge: undefined,
  featuredOrder: null,
  regionalPrices: [{currency: "USD", displayPrice: "$0.99"}],
  ...overrides,
});

const baseProps = {
  isVisible: true,
  onClose: jest.fn(),
  onPurchaseProduct: jest.fn(),
  products: [{id: "coins_100", displayPrice: "$0.99"}] as any[],
  loading: false,
  error: null as string | null,
  currentCoins: 1500,
};

describe("CoinShopModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state", () => {
    const {getByTestId, getByText, queryByText} = render(
      <CoinShopModal
        {...baseProps}
        loading={true}
        firestoreProducts={[createProduct({productId: "coins_100"}) as any]}
      />,
    );

    expect(getByTestId("coin-shop-loading")).toBeTruthy();
    expect(getByText("Loading shop...")).toBeTruthy();
    expect(queryByText("COIN SHOP")).toBeNull();
  });

  it("renders error state", () => {
    const {getByText} = render(
      <CoinShopModal
        {...baseProps}
        error="Store unavailable"
        firestoreProducts={[createProduct({productId: "coins_100"}) as any]}
      />,
    );

    expect(getByText("Store unavailable")).toBeTruthy();
  });

  it("shows empty state when there are no packs", () => {
    const {getByText} = render(<CoinShopModal {...baseProps} firestoreProducts={[]} />);

    expect(getByText("No coin packs are available right now.")).toBeTruthy();
  });

  it("uses store price when available", () => {
    const p1 = createProduct({
      productId: "coins_500",
      productKey: "coins_500",
      coins: 500,
      sortOrder: 2,
      regionalPrices: [{currency: "USD", displayPrice: "$4.99"}],
    });
    const p2 = createProduct({
      productId: "coins_100",
      productKey: "coins_100",
      coins: 100,
      sortOrder: 1,
      regionalPrices: [{currency: "USD", displayPrice: "$0.99"}],
    });

    const {getByText} = render(
      <CoinShopModal
        {...baseProps}
        products={
          [
            {id: "coins_100", displayPrice: "$1.09"},
            {id: "coins_500", displayPrice: "$5.49"},
          ] as any
        }
        firestoreProducts={[p1 as any, p2 as any]}
      />,
    );

    expect(getByText("$1.09")).toBeTruthy();
    expect(getByText("$5.49")).toBeTruthy();
  });

  it("uses store price from productId-shaped IAP products", () => {
    const product = createProduct({
      productId: "coins_100",
      productKey: "coins_100",
      coins: 100,
      sortOrder: 1,
      regionalPrices: [{currency: "USD", displayPrice: "$0.99"}],
    });

    const {getByText} = render(
      <CoinShopModal
        {...baseProps}
        products={[{productId: "coins_100", localizedPrice: "$1.19"}] as any}
        firestoreProducts={[product as any]}
      />,
    );

    expect(getByText("$1.19")).toBeTruthy();
  });

  it("falls back to regional USD price and then '-' when store/region prices are missing", () => {
    const withUsdFallback = createProduct({
      productId: "coins_200",
      productKey: "coins_200",
      coins: 200,
      sortOrder: 1,
      regionalPrices: [{currency: "USD", displayPrice: "$1.99"}],
    });
    const withDashFallback = createProduct({
      productId: "coins_300",
      productKey: "coins_300",
      coins: 300,
      sortOrder: 2,
      regionalPrices: [{currency: "EUR", displayPrice: "EUR 2.99"}],
    });

    const {getByText} = render(
      <CoinShopModal
        {...baseProps}
        products={[]}
        firestoreProducts={[withUsdFallback as any, withDashFallback as any]}
      />,
    );

    expect(getByText("$1.99")).toBeTruthy();
    expect(getByText("-")).toBeTruthy();
  });

  it("does not purchase when no product is selected", () => {
    const onPurchaseProduct = jest.fn();
    const product = createProduct({
      productId: "coins_100",
      productKey: "coins_100",
      coins: 100,
      sortOrder: 1,
      featuredOrder: 1,
      featuredBadge: "Best Value",
    });

    const {getByTestId} = render(
      <CoinShopModal {...baseProps} onPurchaseProduct={onPurchaseProduct} firestoreProducts={[product as any]} />,
    );

    fireEvent.press(getByTestId("purchase-button"));
    expect(onPurchaseProduct).not.toHaveBeenCalled();
  });

  it("selects a pack and purchases selected product", () => {
    const onPurchaseProduct = jest.fn();
    const product = createProduct({
      productId: "coins_100",
      productKey: "coins_100",
      coins: 100,
      sortOrder: 1,
      featuredOrder: 1,
      featuredBadge: "Best Value",
    });

    const {getByTestId} = render(
      <CoinShopModal {...baseProps} onPurchaseProduct={onPurchaseProduct} firestoreProducts={[product as any]} />,
    );

    fireEvent.press(getByTestId("pack-card-coins_100"));

    fireEvent.press(getByTestId("purchase-button"));
    expect(onPurchaseProduct).toHaveBeenCalledWith("coins_100");
  });

  it("resets selected pack when the selected product no longer exists", () => {
    const onPurchaseProduct = jest.fn();
    const selected = createProduct({
      productId: "coins_100",
      productKey: "coins_100",
      sortOrder: 1,
    });
    const other = createProduct({
      productId: "coins_500",
      productKey: "coins_500",
      sortOrder: 2,
    });

    const {getByTestId, rerender} = render(
      <CoinShopModal
        {...baseProps}
        onPurchaseProduct={onPurchaseProduct}
        firestoreProducts={[selected as any, other as any]}
      />,
    );

    fireEvent.press(getByTestId("pack-card-coins_100"));
    fireEvent.press(getByTestId("purchase-button"));
    expect(onPurchaseProduct).toHaveBeenCalledWith("coins_100");

    rerender(<CoinShopModal {...baseProps} onPurchaseProduct={onPurchaseProduct} firestoreProducts={[other as any]} />);

    fireEvent.press(getByTestId("purchase-button"));
    expect(onPurchaseProduct).toHaveBeenCalledTimes(1);
  });

  it("resets selected pack when hidden and re-opened", async () => {
    const product = createProduct({productId: "coins_100", sortOrder: 1});
    const {rerender, getByTestId} = render(
      <CoinShopModal {...baseProps} isVisible={true} firestoreProducts={[product as any]} />,
    );

    fireEvent.press(getByTestId("pack-card-coins_100"));
    fireEvent.press(getByTestId("purchase-button"));
    expect(baseProps.onPurchaseProduct).toHaveBeenCalledWith("coins_100");

    rerender(<CoinShopModal {...baseProps} isVisible={false} firestoreProducts={[product as any]} />);
    rerender(<CoinShopModal {...baseProps} isVisible={true} firestoreProducts={[product as any]} />);

    fireEvent.press(getByTestId("purchase-button"));
    expect(baseProps.onPurchaseProduct).toHaveBeenCalledTimes(1);
  });

  it("uses close button action and renders localized coin balance", () => {
    const onClose = jest.fn();
    const {getByTestId, getByText} = render(<CoinShopModal {...baseProps} onClose={onClose} currentCoins={25000} />);

    expect(getByText("25,000 coins")).toBeTruthy();
    fireEvent.press(getByTestId("close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
