import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import the product details from IapService for displaying in the UI
import { COIN_PRODUCT_DETAILS } from "../../services/IapService";
import * as RNIap from "react-native-iap"; // Import RNIap types for Product
import CloseButton from "../buttons/CloseButton";
import { COLORS, TYPOGRAPHY } from "../../styles";
import { scale } from "../../utils/responsive";
import BuyCoinsSvg from "../../../assets/images/buy-coins.svg";
import CoinSvg from "../../../assets/images/coin.svg";

const { height: screenHeight } = Dimensions.get("window");

/**
 * Props for the CoinShopModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {(productId: string) => void} onPurchaseProduct - Callback function to initiate a purchase.
 * @property {RNIap.Product[]} products - Array of RNIap products.
 * @property {boolean} loading - Indicates whether the component is loading.
 * @property {string | null} error - Error message if any, or null.
 */
interface CoinShopModalProps {
  isVisible: boolean;
  onClose: () => void;
  onPurchaseProduct: (productId: string) => void;
  products: RNIap.Product[];
  loading: boolean;
  error: string | null;
  onWatchVideo?: () => void;
  onPayAndPlay?: () => void;
}

/**
 * Modal component for displaying the Coin Shop with available coin packs for purchase.
 */
const CoinShopModal: React.FC<CoinShopModalProps> = ({
  isVisible,
  onClose,
  onPurchaseProduct,
  products,
  loading,
  error,
  onWatchVideo,
  onPayAndPlay,
}) => {
  // Get safe area insets for proper positioning like profile modal
  const insets = useSafeAreaInsets();
  const availableHeight = screenHeight - insets.top - insets.bottom;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        />

        {/* Fixed Modal Container */}
        <View
          style={{
            position: "absolute",
            top: insets.top + availableHeight * 0.05,
            left: 16,
            right: 16,
            bottom: insets.bottom + availableHeight * 0.05,
            backgroundColor: "white",
            borderRadius: 20,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: -4,
            },
            shadowOpacity: 0.25,
            shadowRadius: 5,
            elevation: 10,
          }}
        >
          <ScrollView
            className="px-6"
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={false}
            scrollEnabled={true}
            contentContainerStyle={{
              paddingTop: 20,
              flexGrow: 1,
            }}
          >
            {/* Close Button */}
            <View
              style={{
                position: "absolute",
                top: 20,
                right: 0,
                zIndex: 2,
              }}
            >
              <CloseButton onPress={onClose} size={24} />
            </View>

            <Text
              className="text-gray-800 mb-6 mt-2 text-center"
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(24),
              }}
            >
              Coin Shop
            </Text>

            {/* Buy Coins Icons - 2 vertically stacked full width */}
            <View className="w-full mb-4 mt-6">
              {/* First SVG with "BEST DEAL" overlay */}
              <TouchableOpacity
                className="relative"
                onPress={() => {
                  console.log("Best Deal SVG tapped - 65000 coins");
                  onPurchaseProduct("com.qwordly.coins65000");
                }}
                activeOpacity={0.8}
              >
                <BuyCoinsSvg width="100%" height={scale(280)} />

                {/* Best Deal Banner */}
                <View className="absolute top-2 left-12 px-3 py-1 rounded-lg">
                  <Text
                    className="text-white font-bold text-xs"
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: scale(10),
                    }}
                  >
                    BEST DEAL
                  </Text>
                </View>

                {/* Coin Amount Text */}
                <View
                  className="absolute items-center"
                  style={{
                    bottom: scale(84),
                    left: 0,
                    right: 0,
                  }}
                >
                  <Text
                    className="text-gray-800 font-bold text-center"
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: scale(18),
                    }}
                  >
                    65000 coins
                  </Text>
                </View>

                {/* Price Text */}
                <View
                  className="absolute items-center"
                  style={{
                    bottom: scale(36),
                    left: 0,
                    right: 0,
                  }}
                >
                  <View className="px-4 rounded-full">
                    <Text
                      className="text-white font-bold text-center"
                      style={{
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        fontSize: scale(14),
                      }}
                    >
                      $4.99
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View className="h-2" />

              {/* Second SVG with different text */}
              <TouchableOpacity
                className="relative"
                onPress={() => {
                  console.log("Great Value SVG tapped - 25000 coins");
                  onPurchaseProduct("com.qwordly.coins25000");
                }}
                activeOpacity={0.8}
              >
                <BuyCoinsSvg width="100%" height={scale(280)} />

                {/* Value Banner */}
                <View className="absolute top-2 left-12 px-3 py-1 rounded-lg">
                  <Text
                    className="text-white font-bold text-xs"
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: scale(10),
                    }}
                  >
                    GREAT VALUE
                  </Text>
                </View>

                {/* Coin Amount Text */}
                <View
                  className="absolute items-center"
                  style={{
                    bottom: scale(84),
                    left: 0,
                    right: 0,
                  }}
                >
                  <Text
                    className="text-gray-800 font-bold text-center"
                    style={{
                      fontFamily: TYPOGRAPHY.fontPrimary,
                      fontSize: scale(18),
                    }}
                  >
                    25000 coins
                  </Text>
                </View>

                {/* Price Text */}
                <View
                  className="absolute items-center"
                  style={{
                    bottom: scale(36),
                    left: 0,
                    right: 0,
                  }}
                >
                  <View className="px-4 rounded-full">
                    <Text
                      className="text-white font-bold text-center"
                      style={{
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        fontSize: scale(14),
                      }}
                    >
                      $2.99
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {loading && (
              <View className="flex-1 justify-center items-center py-8">
                <ActivityIndicator size="large" color={COLORS.primaryOrange} />
                <Text
                  className="text-gray-600 mt-4 text-center"
                  style={{
                    fontFamily: TYPOGRAPHY.fontPrimary,
                    fontSize: scale(16),
                  }}
                >
                  Loading Coin Packs...
                </Text>
              </View>
            )}

            {error && (
              <Text
                className="text-red-500 mb-6 text-center px-4"
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: scale(14),
                }}
              >
                {error}
              </Text>
            )}

            {!loading && !error && (
              <View className="w-full">
                {/* Dynamic Products from App Stores */}
                {products.length > 0 && (
                  <View className="pb-6">
                    {products.map((product) => {
                      // Find the corresponding product detail to get the coin amount
                      const productDetail = Object.values(
                        COIN_PRODUCT_DETAILS
                      ).find((detail) => detail.id === product.productId);
                      const coinsAmount = productDetail
                        ? productDetail.coins
                        : "N/A";

                      return (
                        <TouchableOpacity
                          key={product.productId}
                          className={`flex-row items-center rounded-2xl mb-4 p-4 shadow-sm border-2 ${
                            loading
                              ? "bg-gray-200 border-gray-300"
                              : "bg-gray-100 border-transparent hover:bg-gray-200"
                          }`}
                          onPress={() => {
                            console.log(
                              "Purchase row tapped for product:",
                              product.productId
                            );
                            console.log("Loading state:", loading);
                            console.log(
                              "onPurchaseProduct callback:",
                              typeof onPurchaseProduct
                            );
                            onPurchaseProduct(product.productId);
                          }}
                          disabled={loading}
                          testID={`purchase-row-${product.productId}`}
                          activeOpacity={0.5}
                        >
                          {/* Coin Pack Icon */}
                          <View className="mr-4">
                            <CoinSvg width={scale(50)} height={scale(50)} />
                          </View>

                          {/* Product Details */}
                          <View className="flex-1 mr-4">
                            <Text
                              className={`font-semibold mb-1 ${
                                loading ? "text-gray-500" : "text-gray-800"
                              }`}
                              style={{
                                fontFamily: TYPOGRAPHY.fontPrimary,
                                fontSize: scale(16),
                              }}
                            >
                              {product.title || `${coinsAmount} Coins`}
                            </Text>
                            <Text
                              className={`${
                                loading ? "text-gray-400" : "text-gray-600"
                              }`}
                              style={{
                                fontFamily: TYPOGRAPHY.fontPrimary,
                                fontSize: scale(14),
                              }}
                            >
                              {loading
                                ? "Processing..."
                                : product.localizedPrice}
                            </Text>
                          </View>

                          {/* Price Badge */}
                          <View
                            className={`rounded-2xl px-4 py-2 ${
                              loading ? "bg-gray-300" : "bg-orange-500"
                            }`}
                          >
                            <Text
                              className={`text-center font-semibold ${
                                loading ? "text-gray-500" : "text-white"
                              }`}
                              style={{
                                fontFamily: TYPOGRAPHY.fontPrimary,
                                fontSize: scale(14),
                              }}
                            >
                              {loading ? "..." : "Buy"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Additional Coin Pack Options */}
                <View className="pb-6">
                  {/* 100 Coins Pack */}
                  <TouchableOpacity
                    className={`flex-row items-center rounded-2xl mb-4 p-4 shadow-sm border-2 ${
                      loading
                        ? "bg-gray-200 border-gray-300"
                        : "bg-gray-100 border-transparent hover:bg-gray-200"
                    }`}
                    onPress={() => {
                      console.log("Static 100 coins row tapped");
                      console.log("Loading state:", loading);
                      console.log(
                        "onPurchaseProduct callback:",
                        typeof onPurchaseProduct
                      );
                      onPurchaseProduct("com.qwordly.coins100");
                    }}
                    disabled={loading}
                    testID="purchase-row-static-100"
                    activeOpacity={0.5}
                  >
                    <View className="mr-4">
                      <CoinSvg width={scale(50)} height={scale(50)} />
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className={`font-semibold mb-1 ${
                          loading ? "text-gray-500" : "text-gray-800"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        100 coins
                      </Text>
                    </View>
                    <View
                      className={`rounded-2xl px-4 py-2 ${
                        loading ? "bg-gray-300" : "bg-orange-500"
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          loading ? "text-gray-500" : "text-white"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        {loading ? "..." : "$1.99"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 250 Coins Pack */}
                  <TouchableOpacity
                    className={`flex-row items-center rounded-2xl mb-4 p-4 shadow-sm border-2 ${
                      loading
                        ? "bg-gray-200 border-gray-300"
                        : "bg-gray-100 border-transparent hover:bg-gray-200"
                    }`}
                    onPress={() => {
                      console.log("Static 250 coins row tapped");
                      onPurchaseProduct("com.qwordly.coins250");
                    }}
                    disabled={loading}
                    testID="purchase-row-static-250"
                    activeOpacity={0.5}
                  >
                    <View className="mr-4">
                      <CoinSvg width={scale(50)} height={scale(50)} />
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className={`font-semibold mb-1 ${
                          loading ? "text-gray-500" : "text-gray-800"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        250 coins
                      </Text>
                    </View>
                    <View
                      className={`rounded-2xl px-4 py-2 ${
                        loading ? "bg-gray-300" : "bg-orange-500"
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          loading ? "text-gray-500" : "text-white"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        {loading ? "..." : "$4.99"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 500 Coins Pack */}
                  <TouchableOpacity
                    className={`flex-row items-center rounded-2xl mb-4 p-4 shadow-sm border-2 ${
                      loading
                        ? "bg-gray-200 border-gray-300"
                        : "bg-gray-100 border-transparent hover:bg-gray-200"
                    }`}
                    onPress={() => {
                      console.log("Static 500 coins row tapped");
                      onPurchaseProduct("com.qwordly.coins500");
                    }}
                    disabled={loading}
                    testID="purchase-row-static-500"
                    activeOpacity={0.5}
                  >
                    <View className="mr-4">
                      <CoinSvg width={scale(50)} height={scale(50)} />
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className={`font-semibold mb-1 ${
                          loading ? "text-gray-500" : "text-gray-800"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        500 coins
                      </Text>
                    </View>
                    <View
                      className={`rounded-2xl px-4 py-2 ${
                        loading ? "bg-gray-300" : "bg-orange-500"
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          loading ? "text-gray-500" : "text-white"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        {loading ? "..." : "$9.99"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 1000 Coins Pack */}
                  <TouchableOpacity
                    className={`flex-row items-center rounded-2xl mb-4 p-4 shadow-sm border-2 ${
                      loading
                        ? "bg-gray-200 border-gray-300"
                        : "bg-gray-100 border-transparent hover:bg-gray-200"
                    }`}
                    onPress={() => {
                      console.log("Static 1000 coins row tapped");
                      onPurchaseProduct("com.qwordly.coins1000");
                    }}
                    disabled={loading}
                    testID="purchase-row-static-1000"
                    activeOpacity={0.5}
                  >
                    <View className="mr-4">
                      <CoinSvg width={scale(50)} height={scale(50)} />
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className={`font-semibold mb-1 ${
                          loading ? "text-gray-500" : "text-gray-800"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        1000 coins
                      </Text>
                    </View>
                    <View
                      className={`rounded-2xl px-4 py-2 ${
                        loading ? "bg-gray-300" : "bg-orange-500"
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          loading ? "text-gray-500" : "text-white"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        {loading ? "..." : "$19.99"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Action Buttons - Inside ScrollView */}
                <View
                  style={{
                    paddingBottom: Math.max(20, insets.bottom + 10),
                  }}
                >
                  {/* Watch Video and Play Button */}
                  <TouchableOpacity
                    className={`w-full items-center rounded-full py-4 mb-8 border-2 border-gray-300 ${
                      loading ? "bg-gray-100" : "bg-white"
                    }`}
                    onPress={onWatchVideo}
                    disabled={loading}
                  >
                    <View className="flex-row items-center">
                      <View className="w-6 h-6 rounded-full bg-gray-800 items-center justify-center mr-3">
                        <Text
                          className="text-white text-xs font-bold"
                          style={{ fontFamily: TYPOGRAPHY.fontPrimary }}
                        >
                          ▶
                        </Text>
                      </View>
                      <Text
                        className={`font-semibold ${
                          loading ? "text-gray-400" : "text-gray-800"
                        }`}
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        WATCH VIDEO AND PLAY
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Pay and Play Button */}
                  <TouchableOpacity
                    className={`w-full items-center rounded-full py-4 ${
                      loading ? "bg-gray-300" : "bg-pink-400"
                    }`}
                    onPress={onPayAndPlay}
                    disabled={loading}
                  >
                    <Text
                      className="text-white font-semibold"
                      style={{
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        fontSize: scale(16),
                      }}
                    >
                      PAY AND PLAY
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default CoinShopModal;
