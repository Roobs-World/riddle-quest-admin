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
}) => {
  // Get safe area insets for proper positioning like profile modal
  const insets = useSafeAreaInsets();
  const availableHeight = screenHeight - insets.top - insets.bottom;
  const maxModalHeight = availableHeight * 0.85;

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
            top: insets.top + (availableHeight * 0.1) / 2,
            left: 16,
            right: 16,
            backgroundColor: "white",
            borderRadius: 20,
            height: maxModalHeight,
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
            className="flex-1 px-6"
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            alwaysBounceVertical={false}
            scrollEnabled={true}
            contentContainerStyle={{
              paddingTop: 20,
              paddingBottom: Math.max(30, insets.bottom + 20),
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

            {/* Buy Coins Icons - 2 horizontally at the top */}
            <View className="flex-row justify-center items-center mb-4 mt-6 px-2">
              <View className="flex-1">
                <BuyCoinsSvg width="100%" height={scale(280)} />
              </View>
              <View className="w-1" />
              <View className="flex-1">
                <BuyCoinsSvg width="100%" height={scale(280)} />
              </View>
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
              <ScrollView
                className="max-h-96 w-full"
                showsVerticalScrollIndicator={false}
              >
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
                        <View
                          key={product.productId}
                          className="flex-row items-center bg-gray-100 rounded-2xl mb-4 p-4 shadow-sm"
                        >
                          {/* Coin Pack Icon */}
                          <View
                            className="rounded-full mr-4 items-center justify-center"
                            style={{
                              backgroundColor: COLORS.primaryOrange,
                              width: scale(50),
                              height: scale(50),
                            }}
                          >
                            <Text
                              className="text-white font-bold text-center"
                              style={{
                                fontFamily: TYPOGRAPHY.fontPrimary,
                                fontSize: scale(12),
                              }}
                            >
                              {coinsAmount}
                            </Text>
                          </View>

                          {/* Product Details */}
                          <View className="flex-1 mr-4">
                            <Text
                              className="text-gray-800 font-semibold mb-1"
                              style={{
                                fontFamily: TYPOGRAPHY.fontPrimary,
                                fontSize: scale(16),
                              }}
                            >
                              {product.title || `${coinsAmount} Coins`}
                            </Text>
                            <Text
                              className="text-gray-600"
                              style={{
                                fontFamily: TYPOGRAPHY.fontPrimary,
                                fontSize: scale(14),
                              }}
                            >
                              {product.localizedPrice}
                            </Text>
                          </View>

                          {/* Purchase Button */}
                          <TouchableOpacity
                            className={`rounded-2xl px-6 py-3 min-w-18 ${
                              loading ? "bg-gray-300" : "bg-orange-500"
                            }`}
                            onPress={() => onPurchaseProduct(product.productId)}
                            disabled={loading}
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
                              Buy
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Additional Coin Pack Options */}
                <View className="pb-6">
                  {/* 100 Coins Pack */}
                  <View className="flex-row items-center bg-gray-100 rounded-2xl mb-4 p-4 shadow-sm">
                    <View
                      className="rounded-full mr-4 items-center justify-center"
                      style={{
                        backgroundColor: COLORS.primaryOrange,
                        width: scale(50),
                        height: scale(50),
                      }}
                    >
                      <Text
                        className="text-white font-bold text-center"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(12),
                        }}
                      >
                        100
                      </Text>
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className="text-gray-800 font-semibold mb-1"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        100 coins
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="rounded-2xl px-6 py-3 min-w-18 bg-orange-500"
                      onPress={() => onPurchaseProduct("com.qwordly.coins100")}
                      disabled={loading}
                    >
                      <Text
                        className="text-center font-semibold text-white"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        $1.99
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 250 Coins Pack */}
                  <View className="flex-row items-center bg-gray-100 rounded-2xl mb-4 p-4 shadow-sm">
                    <View
                      className="rounded-full mr-4 items-center justify-center"
                      style={{
                        backgroundColor: COLORS.primaryOrange,
                        width: scale(50),
                        height: scale(50),
                      }}
                    >
                      <Text
                        className="text-white font-bold text-center"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(12),
                        }}
                      >
                        250
                      </Text>
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className="text-gray-800 font-semibold mb-1"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        250 coins
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="rounded-2xl px-6 py-3 min-w-18 bg-orange-500"
                      onPress={() => onPurchaseProduct("com.qwordly.coins250")}
                      disabled={loading}
                    >
                      <Text
                        className="text-center font-semibold text-white"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        $4.99
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 500 Coins Pack */}
                  <View className="flex-row items-center bg-gray-100 rounded-2xl mb-4 p-4 shadow-sm">
                    <View
                      className="rounded-full mr-4 items-center justify-center"
                      style={{
                        backgroundColor: COLORS.primaryOrange,
                        width: scale(50),
                        height: scale(50),
                      }}
                    >
                      <Text
                        className="text-white font-bold text-center"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(12),
                        }}
                      >
                        500
                      </Text>
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className="text-gray-800 font-semibold mb-1"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        500 coins
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="rounded-2xl px-6 py-3 min-w-18 bg-orange-500"
                      onPress={() => onPurchaseProduct("com.qwordly.coins500")}
                      disabled={loading}
                    >
                      <Text
                        className="text-center font-semibold text-white"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        $9.99
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 1000 Coins Pack */}
                  <View className="flex-row items-center bg-gray-100 rounded-2xl mb-4 p-4 shadow-sm">
                    <View
                      className="rounded-full mr-4 items-center justify-center"
                      style={{
                        backgroundColor: COLORS.primaryOrange,
                        width: scale(50),
                        height: scale(50),
                      }}
                    >
                      <Text
                        className="text-white font-bold text-center"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(11),
                        }}
                      >
                        1000
                      </Text>
                    </View>
                    <View className="flex-1 mr-4">
                      <Text
                        className="text-gray-800 font-semibold mb-1"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(16),
                        }}
                      >
                        1000 coins
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="rounded-2xl px-6 py-3 min-w-18 bg-orange-500"
                      onPress={() => onPurchaseProduct("com.qwordly.coins1000")}
                      disabled={loading}
                    >
                      <Text
                        className="text-center font-semibold text-white"
                        style={{
                          fontFamily: TYPOGRAPHY.fontPrimary,
                          fontSize: scale(14),
                        }}
                      >
                        $19.99
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Close Button */}
            <TouchableOpacity
              className={`w-full items-center rounded-2xl mt-6 py-4 ${
                loading ? "bg-gray-300" : "bg-gray-500"
              }`}
              onPress={onClose}
              disabled={loading}
            >
              <Text
                className="text-white font-semibold"
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: scale(16),
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default CoinShopModal;
