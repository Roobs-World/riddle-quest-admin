import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator, // Import ActivityIndicator
} from "react-native";

// Import the product details from IapService for displaying in the UI
import { COIN_PRODUCT_DETAILS } from "../../services/IapService";
import * as RNIap from "react-native-iap"; // Import RNIap types for Product
import WideButton from "../buttons/WideButton";
import CloseButton from "../buttons/CloseButton";

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
  // Convert the COIN_PRODUCT_DETAILS object into an array for mapping
  // const coinProducts = Object.values(COIN_PRODUCT_DETAILS); // No longer needed

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Coin Shop
          </Text>

          {loading && (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0000ff" />
              <Text className="text-gray-600 mt-4">Loading Coin Packs...</Text>
            </View>
          )}

          {error && (
            <Text className="text-red-500 text-center mb-4">{error}</Text>
          )}

          {!loading && !error && products.length > 0 && (
            <ScrollView className="max-h-80 mb-6">
              {products.map((product) => {
                // Find the corresponding product detail to get the coin amount
                const productDetail = Object.values(COIN_PRODUCT_DETAILS).find(
                  (detail) => detail.id === product.productId
                );
                const coinsAmount = productDetail ? productDetail.coins : "N/A"; // Get coin amount

                return (
                  <View
                    key={product.productId} // Use productId as the key
                    className="flex-row items-center justify-between bg-gray-100 p-4 rounded-md mb-3"
                  >
                    {/* Coin Pack Image/Icon (Placeholder) */}
                    <View className="w-10 h-10 bg-yellow-400 rounded-full items-center justify-center mr-4">
                      <Text className="text-white font-bold">
                        {coinsAmount}
                      </Text>
                    </View>

                    {/* Product Details */}
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-800">
                        {product.title || `${coinsAmount} Coins`}{" "}
                        {/* Use product title or coin amount */}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {product.localizedPrice} {/* Display localized price */}
                      </Text>
                    </View>

                    {/* Purchase Button */}
                    <WideButton
                      buttonText="Buy"
                      onPress={() => onPurchaseProduct(product.productId)}
                      disabled={loading}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}

          {!loading && !error && products.length === 0 && (
            <Text className="text-gray-600 text-center mb-4">
              No coin packs available.
            </Text>
          )}

          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-500 px-4 py-2 rounded w-full items-center mt-4"
            disabled={loading} // Disable close button while loading/purchasing
          >
            <Text className="text-white font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default CoinShopModal;
