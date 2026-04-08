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
import {
  ProductPricing,
  ProductPricingService,
} from "../../services/ProductPricingService";
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../../styles";
import {
  scale,
  verticalScale,
  moderateScale,
  dimensions,
} from "../../utils/responsive";
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

  const featuredProducts =
    ProductPricingService.getFeaturedProducts(firestoreProducts);
  const regularProducts = firestoreProducts.filter(
    (p) => p.featuredOrder === undefined || p.featuredOrder === null,
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
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
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
              <Text style={styles.coinsPillAmount}>
                {currentCoins.toLocaleString()} coins
              </Text>
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
                        logger.debug(
                          `Featured pack tapped: ${featured.productId}`,
                        );
                        onPurchaseProduct(featured.productId);
                      }}
                      activeOpacity={0.8}
                      testID={`featured-pack-${featured.productId}`}
                    >
                      {featured.featuredBadge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {featured.featuredBadge}
                          </Text>
                        </View>
                      )}

                      <Shop1Svg
                        width={FEATURED_COIN_IMG_SIZE}
                        height={FEATURED_COIN_IMG_SIZE}
                        style={styles.featuredImage}
                      />

                      <Text style={styles.featuredCoins}>
                        {featured.coins.toLocaleString()} coins
                      </Text>

                      <View style={styles.featuredPriceButton}>
                        <Text style={styles.featuredPriceText}>
                          {displayPrice}
                        </Text>
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
            {!loading &&
              !error &&
              regularProducts.map((product) => {
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
                    <CoinSvg
                      width={ROW_COIN_ICON_SIZE}
                      height={ROW_COIN_ICON_SIZE}
                    />
                    <Text style={styles.productCoins}>
                      {product.coins.toLocaleString()} coins
                    </Text>
                    <View style={styles.productPriceButton}>
                      <Text style={styles.productPriceText}>
                        {displayPrice}
                      </Text>
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
                style={[
                  styles.payAndPlayButton,
                  loading && styles.payAndPlayDisabled,
                ]}
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badge: {
    backgroundColor: FEATURED_CARD_BORDER,
    borderBottomRightRadius: moderateScale(10),
    borderTopLeftRadius: moderateScale(14),
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
    alignItems: "center",
    height: moderateScale(32),
    justifyContent: "center",
    width: moderateScale(32),
  },
  closeText: {
    color: COLORS.gray700,
    fontSize: moderateScale(18),
    fontWeight: "600",
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
  featuredCard: {
    alignItems: "center",
    backgroundColor: COLORS.figmaCream,
    borderColor: FEATURED_CARD_BORDER,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    flex: 1,
    overflow: "hidden",
    paddingBottom: verticalScale(12),
    paddingHorizontal: scale(8),
    paddingTop: verticalScale(28),
  },
  featuredCoins: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
    marginBottom: verticalScale(8),
  },
  featuredImage: {
    marginBottom: verticalScale(8),
  },
  featuredPriceButton: {
    alignItems: "center",
    backgroundColor: PRICE_BUTTON_BG,
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(8),
    width: "100%",
  },
  featuredPriceText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
  },
  featuredRow: {
    flexDirection: "row",
    gap: scale(10),
    marginBottom: verticalScale(16),
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: verticalScale(12),
  },
  headerSpacer: {
    width: moderateScale(32),
  },
  infoIcon: {
    alignItems: "center",
    backgroundColor: COLORS.gray300,
    borderRadius: moderateScale(10),
    height: moderateScale(20),
    justifyContent: "center",
    width: moderateScale(20),
  },
  infoIconText: {
    color: COLORS.gray700,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "700",
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
  payAndPlayButton: {
    alignItems: "center",
    backgroundColor: PAY_AND_PLAY_BG,
    borderRadius: moderateScale(50),
    paddingVertical: verticalScale(14),
  },
  payAndPlayDisabled: {
    backgroundColor: COLORS.gray300,
  },
  payAndPlayText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "700",
    letterSpacing: 1,
  },
  productCoins: {
    color: COLORS.gray800,
    flex: 1,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "600",
    marginLeft: scale(12),
  },
  productPriceButton: {
    backgroundColor: PRICE_BUTTON_BG,
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
  },
  productPriceText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
  },
  productRow: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(14),
    elevation: 2,
    flexDirection: "row",
    marginBottom: verticalScale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
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
    flex: 1,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
  watchVideoButton: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.gray300,
    borderRadius: moderateScale(50),
    borderWidth: 1.5,
    flexDirection: "row",
    gap: scale(8),
    justifyContent: "center",
    paddingVertical: verticalScale(12),
  },
  watchVideoText: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default CoinShopModal;
