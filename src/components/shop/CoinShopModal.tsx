import React from "react";
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
import { ProductPricing, ProductPricingService } from "../../services/ProductPricingService";
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../../styles";
import { scale, verticalScale, moderateScale, dimensions } from "../../utils/responsive";
import { MODAL_CONTENT_PADDING } from "../../constants/layout";
import Shop1Svg from "../../../assets/images/shop-1.svg";
import CoinSvg from "../../../assets/images/coin.svg";
import ModalBg from "../../../assets/images/modal-bg.svg";
import { logger } from "../../utils/logger";

const { screenHeight } = dimensions;

const FEATURED_COIN_IMG_SIZE = moderateScale(100);
const ROW_COIN_ICON_SIZE = moderateScale(44);

interface CoinShopModalProps {
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

const CoinShopModal: React.FC<CoinShopModalProps> = ({
  isVisible,
  onClose,
  onPurchaseProduct,
  products,
  loading,
  error,
  onWatchVideo,
  onPayAndPlay,
  firestoreProducts = [],
  currentCoins = 0,
}) => {
  const insets = useSafeAreaInsets();
  const availableHeight = screenHeight - insets.top - insets.bottom;

  const featuredProducts = ProductPricingService.getFeaturedProducts(firestoreProducts);
  const regularProducts = firestoreProducts.filter(
    (p) => p.featuredOrder === undefined || p.featuredOrder === null
  );

  const getDisplayPrice = (product: ProductPricing) => {
    const storeProduct = products.find((p) => p.id === product.productId);
    return (
      storeProduct?.displayPrice ??
      product.regionalPrices.find((r) => r.currency === "USD")?.displayPrice ??
      "—"
    );
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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <Text style={styles.title}>COIN SHOP</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Current coins pill */}
            <View style={styles.coinsPill}>
              <View style={styles.coinsPillLeft}>
                <CoinSvg width={moderateScale(32)} height={moderateScale(32)} />
                <View style={styles.coinsPillText}>
                  <Text style={styles.coinsPillLabel}>Your balance</Text>
                </View>
              </View>
              <Text style={styles.coinsPillAmount}>{currentCoins.toLocaleString()} coins</Text>
            </View>

            {/* Featured packs — side by side */}
            {featuredProducts.length > 0 && (
              <View style={styles.featuredRow}>
                {featuredProducts.map((featured) => {
                  const displayPrice = getDisplayPrice(featured);
                  return (
                    <TouchableOpacity
                      key={featured.productId}
                      style={styles.featuredCard}
                      onPress={() => {
                        logger.debug(`Featured pack tapped: ${featured.productId}`);
                        onPurchaseProduct(featured.productId);
                      }}
                      activeOpacity={0.8}
                      testID={`featured-pack-${featured.productId}`}
                    >
                      {featured.featuredBadge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{featured.featuredBadge}</Text>
                        </View>
                      )}

                      <Shop1Svg
                        width={FEATURED_COIN_IMG_SIZE}
                        height={FEATURED_COIN_IMG_SIZE}
                        style={styles.featuredImage}
                      />

                      <Text style={styles.featuredCoins}>{featured.coins.toLocaleString()} coins</Text>

                      <View style={styles.featuredPriceButton}>
                        <Text style={styles.featuredPriceText}>{displayPrice}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Loading / Error */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primaryOrange} />
              </View>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Regular coin rows */}
            {!loading && !error && regularProducts.map((product) => {
              const displayPrice = getDisplayPrice(product);
              return (
                <TouchableOpacity
                  key={product.productId}
                  style={styles.productRow}
                  onPress={() => {
                    logger.debug("Purchase row tapped:", product.productId);
                    onPurchaseProduct(product.productId);
                  }}
                  activeOpacity={0.7}
                  testID={`purchase-row-${product.productId}`}
                >
                  <CoinSvg width={ROW_COIN_ICON_SIZE} height={ROW_COIN_ICON_SIZE} />
                  <Text style={styles.productCoins}>{product.coins.toLocaleString()} coins</Text>
                  <View style={styles.productPriceButton}>
                    <Text style={styles.productPriceText}>{displayPrice}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Bottom buttons */}
            <View style={styles.bottomButtons}>
              <TouchableOpacity
                style={styles.watchVideoButton}
                onPress={onWatchVideo}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.watchVideoText}>WATCH VIDEO AND PLAY</Text>
                <View style={styles.infoIcon}>
                  <Text style={styles.infoIconText}>i</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payAndPlayButton, loading && styles.payAndPlayDisabled]}
                onPress={onPayAndPlay}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.payAndPlayText}>PAY AND PLAY</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const FEATURED_CARD_BORDER = "#E91E8C";
const PRICE_BUTTON_BG = "#2D1B69";
const PAY_AND_PLAY_BG = "#F9A8D4";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    borderRadius: BORDER_RADIUS["2xl"],
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingTop: MODAL_CONTENT_PADDING,
    paddingBottom: verticalScale(16),
    flexGrow: 1,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(12),
  },
  headerSpacer: {
    width: moderateScale(32),
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "700",
    color: COLORS.gray800,
    letterSpacing: 1,
  },
  closeButton: {
    width: moderateScale(32),
    height: moderateScale(32),
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: moderateScale(18),
    color: COLORS.gray700,
    fontWeight: "600",
  },

  // Coins pill
  coinsPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.figmaCream,
    borderRadius: moderateScale(50),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  coinsPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  coinsPillText: {
    marginLeft: scale(8),
  },
  coinsPillLabel: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.gray600,
  },
  coinsPillAmount: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
    color: COLORS.gray800,
  },

  // Featured row
  featuredRow: {
    flexDirection: "row",
    gap: scale(10),
    marginBottom: verticalScale(16),
  },
  featuredCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.figmaCream,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: FEATURED_CARD_BORDER,
    paddingTop: verticalScale(28),
    paddingBottom: verticalScale(12),
    paddingHorizontal: scale(8),
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: FEATURED_CARD_BORDER,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderBottomRightRadius: moderateScale(10),
    borderTopLeftRadius: moderateScale(14),
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  featuredImage: {
    marginBottom: verticalScale(8),
  },
  featuredCoins: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
    color: COLORS.gray800,
    marginBottom: verticalScale(8),
  },
  featuredPriceButton: {
    backgroundColor: PRICE_BUTTON_BG,
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(8),
    width: "100%",
    alignItems: "center",
  },
  featuredPriceText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
    color: COLORS.white,
  },

  // Loading / error
  loadingContainer: {
    paddingVertical: verticalScale(24),
    alignItems: "center",
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: verticalScale(12),
  },

  // Regular product rows
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    marginBottom: verticalScale(8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  productCoins: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "600",
    color: COLORS.gray800,
    marginLeft: scale(12),
  },
  productPriceButton: {
    backgroundColor: PRICE_BUTTON_BG,
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
  },
  productPriceText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
    color: COLORS.white,
  },

  // Bottom buttons
  bottomButtons: {
    marginTop: verticalScale(8),
    gap: verticalScale(10),
  },
  watchVideoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: moderateScale(50),
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    paddingVertical: verticalScale(12),
    gap: scale(8),
  },
  watchVideoText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "600",
    color: COLORS.gray800,
    letterSpacing: 0.5,
  },
  infoIcon: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    backgroundColor: COLORS.gray300,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIconText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "700",
    color: COLORS.gray700,
  },
  payAndPlayButton: {
    borderRadius: moderateScale(50),
    backgroundColor: PAY_AND_PLAY_BG,
    paddingVertical: verticalScale(14),
    alignItems: "center",
  },
  payAndPlayDisabled: {
    backgroundColor: COLORS.gray300,
  },
  payAndPlayText: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 1,
  },
});

export default CoinShopModal;
