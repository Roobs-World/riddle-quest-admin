import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as RNIap from "react-native-iap";
import { ProductPricing } from "../../services/ProductPricingService";
import { analyticsService } from "../../services/AnalyticsService";
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../../styles";
import {
  scale,
  verticalScale,
  moderateScale,
  dimensions,
} from "../../utils/responsive";
import {
  MODAL_CONTENT_PADDING,
  CLOSE_BUTTON_SIZE_LG,
  MODAL_CLOSE_BUTTON_POSITION,
} from "../../constants/layout";
import CoinSvg from "../../../assets/images/coin.svg";
import BuyCoinsBg from "../../../assets/images/buy-coins.svg";
import BuyCoinsBasicBg from "../../../assets/images/buy-coins-basic.svg";
import ModalBg from "../../../assets/images/modal-bg.svg";
import { logger } from "../../utils/logger";
import CloseButton from "../buttons/CloseButton";

const { screenHeight } = dimensions;
const GRID_COIN_ICON_SIZE = moderateScale(54);

interface CoinShopProps {
  isVisible: boolean;
  onClose: () => void;
  onPurchaseProduct: (productId: string) => void;
  products: RNIap.Product[];
  loading: boolean;
  error: string | null;
  onWatchVideo?: () => void;
  onPayAndPlay?: () => void;
  firestoreProducts?: ProductPricing[];
  currentCoins?: number;
}

const CoinShop: React.FC<CoinShopProps> = ({
  isVisible,
  onClose,
  onPurchaseProduct,
  products,
  loading,
  error,
  firestoreProducts = [],
  currentCoins = 0,
}) => {
  const insets = useSafeAreaInsets();
  const availableHeight = screenHeight - insets.top - insets.bottom;
  const trackedImpressionsRef = useRef<Set<string>>(new Set());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const sortedProducts = useMemo(
    () => [...firestoreProducts].sort((a, b) => a.sortOrder - b.sortOrder),
    [firestoreProducts],
  );

  const getDisplayPrice = useCallback(
    (product: ProductPricing) => {
      const storeProduct = products.find((p) => p.id === product.productId);
      return (
        storeProduct?.displayPrice ??
        product.regionalPrices.find((r) => r.currency === "USD")?.displayPrice ??
        "-"
      );
    },
    [products],
  );

  useEffect(() => {
    if (!isVisible) {
      trackedImpressionsRef.current.clear();
      setSelectedProductId(null);
      return;
    }
    if (loading || error) return;

    sortedProducts.forEach((product) => {
      if (trackedImpressionsRef.current.has(product.productId)) return;

      trackedImpressionsRef.current.add(product.productId);
      void analyticsService.logShopPackImpression({
        productId: product.productId,
        productKey: product.productKey,
        coins: product.coins,
        sortOrder: product.sortOrder,
        featured:
          product.featuredOrder !== undefined && product.featuredOrder !== null,
        displayPrice: getDisplayPrice(product),
      });
    });
  }, [isVisible, loading, error, sortedProducts, getDisplayPrice]);

  useEffect(() => {
    if (!selectedProductId) return;

    const selectedProductStillAvailable = sortedProducts.some(
      (product) => product.productId === selectedProductId,
    );
    if (!selectedProductStillAvailable) {
      setSelectedProductId(null);
    }
  }, [selectedProductId, sortedProducts]);

  const handlePackPress = (product: ProductPricing) => {
    logger.debug("Shop pack tapped:", product.productId);
    setSelectedProductId(product.productId);
    void analyticsService.logShopPackSelected({
      productId: product.productId,
      productKey: product.productKey,
      coins: product.coins,
      sortOrder: product.sortOrder,
      featured:
        product.featuredOrder !== undefined && product.featuredOrder !== null,
      displayPrice: getDisplayPrice(product),
    });
  };

  const handlePurchasePress = () => {
    if (!selectedProductId) return;
    onPurchaseProduct(selectedProductId);
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />

        <View
          style={[
            styles.modalContainer,
            {
              top: insets.top + availableHeight * 0.05,
              bottom: insets.bottom + availableHeight * 0.05,
            },
          ]}
        >
          <ModalBg
            width="100%"
            height="100%"
            style={StyleSheet.absoluteFill}
            preserveAspectRatio="xMidYMid slice"
          />
          <CloseButton
            onPress={onClose}
            size={CLOSE_BUTTON_SIZE_LG}
            style={styles.closeButton}
            accessibilityLabel="Close coin shop"
          />

            <View style={styles.headerRow}>
              <Text style={styles.title}>COIN SHOP</Text>
            </View>

            <View style={styles.coinsPill}>
              <View style={styles.coinsPillLeft}>
                <CoinSvg width={moderateScale(32)} height={moderateScale(32)} />
                <View style={styles.coinsPillText}>
                  <Text style={styles.coinsPillLabel}>Your balance</Text>
                </View>
              </View>
              <Text style={styles.coinsPillAmount}>
                {currentCoins.toLocaleString()} coins
              </Text>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primaryOrange} />
              </View>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >

            {!loading && !error && sortedProducts.length > 0 && (
              <View style={styles.grid}>
                {sortedProducts.map((product) => {
                  const displayPrice = getDisplayPrice(product);
                  const isSelected = selectedProductId === product.productId;
                  return (
                    <TouchableOpacity
                      key={product.productId}
                      style={[styles.gridCard, isSelected && styles.gridCardSelected]}
                      onPress={() => handlePackPress(product)}
                      activeOpacity={0.8}
                      testID={`pack-card-${product.productId}`}
                    >
                      
                    {product.featuredBadge && (
                        <BuyCoinsBg
                          width="100%"
                          height="100%"
                          style={styles.gridCardBackground}
                          preserveAspectRatio="xMidYMid slice"
                          pointerEvents="none"
                        />
                      )}
                      {product.featuredBadge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{product.featuredBadge}</Text>
                        </View>
                      )}
                      
                      {!product.featuredBadge && (
                        <BuyCoinsBasicBg
                          width="100%"
                          height="100%"
                          style={styles.gridCardBackground}
                          preserveAspectRatio="xMidYMid slice"
                          pointerEvents="none"
                        />
                      )}


                      <CoinSvg
                        width={GRID_COIN_ICON_SIZE}
                        height={GRID_COIN_ICON_SIZE}
                      />
                      <View style={styles.productPriceButton}>
                        <Text style={styles.productPriceText}>{displayPrice}</Text>
                      </View>

                      <Text style={styles.productCoins}>
                        {product.coins.toLocaleString()} coins
                      </Text>
                      
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {!loading && !error && sortedProducts.length === 0 && (
              <Text style={styles.errorText}>No coin packs are available right now.</Text>
            )}

            
          </ScrollView>

          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                (loading || !selectedProductId) && styles.purchaseButtonDisabled,
              ]}
              onPress={handlePurchasePress}
              disabled={loading || !selectedProductId}
              activeOpacity={0.7}
              testID="purchase-button"
            >
              <Text style={styles.purchaseButtonText}>PURCHASE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FEATURED_CARD_BORDER = "#E91E8C";

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badge: {
    left: 0,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    position: "absolute",
    top: 0,
  },
  badgeText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bottomButtons: {
    gap: verticalScale(10),
    marginTop: verticalScale(8),
  },
  closeButton: {
    ...MODAL_CLOSE_BUTTON_POSITION,
    top: verticalScale(28)
  },
  coinsPill: {
    alignItems: "center",
    backgroundColor: COLORS.figmaCream,
    borderColor: COLORS.gray200,
    borderRadius: moderateScale(50),
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    marginLeft: scale(12),
    marginRight: scale(12)
  },
  coinsPillAmount: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
  },
  coinsPillLabel: {
    color: COLORS.gray600,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  coinsPillLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: scale(8),
  },
  coinsPillText: {
    marginLeft: scale(8),
  },
  errorText: {
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: verticalScale(12),
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: verticalScale(8),
  },
  gridCard: {
    alignItems: "center",
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: COLORS.black,
    marginBottom: verticalScale(10),
    overflow: "hidden",
    paddingBottom: verticalScale(14),
    paddingTop: verticalScale(36),
    width: "48%",
  },
  gridCardSelected: {
    borderColor: COLORS.primaryOrange,
    borderWidth: 2,
  },
  gridCardBackground: {
    ...StyleSheet.absoluteFill,
  },
  headerRow: {
    alignItems: "center",
    marginTop: verticalScale(24),
    marginBottom: verticalScale(12),
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: verticalScale(24),
  },
  modalContainer: {
    borderRadius: BORDER_RADIUS["2xl"],
    elevation: 10,
    left: SPACING.md,
    overflow: "hidden",
    position: "absolute",
    right: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  overlay: {
    flex: 1,
  },
  purchaseButton: {
    alignItems: "center",
    backgroundColor: COLORS.primaryOrange,
    borderRadius: moderateScale(50),
    paddingVertical: verticalScale(14),
    marginBottom: verticalScale(24),
    marginLeft: scale(12),
    marginRight: scale(12)
  },
  purchaseButtonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
    letterSpacing: 1,
  },
  productCoins: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
    paddingTop:verticalScale(18), 
    marginTop: verticalScale(14),
    textAlign: "center",
  },
  productPriceButton: {
    marginTop: verticalScale(10),
    marginBottom: verticalScale(24),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
  },
  productPriceText: {
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: verticalScale(16),
    paddingHorizontal: scale(16),
    paddingTop: MODAL_CONTENT_PADDING,
  },
  title: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
});

export default CoinShop;
