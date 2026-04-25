import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import * as RNIap from "react-native-iap";
import {ProductPricing} from "../../services/ProductPricingService";
import {COLORS, TYPOGRAPHY, BORDER_RADIUS} from "../../styles";
import {scale, verticalScale, moderateScale, dimensions} from "../../utils/responsive";
import {CLOSE_BUTTON_SIZE_LG, MODAL_CLOSE_BUTTON_POSITION, MODAL_HEIGHT, MODAL_WIDTH} from "../../constants/layout";
import CoinSvg from "../../../assets/images/coin.svg";
import LargeCoinStackSvg from "../../../assets/images/large-coin-stack.svg";
import ModalBg from "../../../assets/images/modal-bg.svg";
import HomeBg from "../../../assets/images/home-bg.svg";
import {logger} from "../../utils/logger";
import CloseButton from "../buttons/CloseButton";
import WideButton from "../buttons/WideButton";
import {AppStrings} from "../../constants/AppStrings";
import SlideInModalContent from "../shared/SlideInModalContent";

const {screenHeight} = dimensions;
const GRID_COIN_ICON_WIDTH = moderateScale(86);
const GRID_COIN_ICON_HEIGHT = verticalScale(51);
const GRID_CARD_HEIGHT = verticalScale(144);
const LIST_COIN_ICON_SIZE = moderateScale(34);
const COIN_SHOP_MODAL_SIDE_INSET = scale(28);
const COIN_SHOP_SAFE_EDGE_GAP = scale(12);

interface CoinShopProps {
  isVisible: boolean;
  onClose: () => void;
  onPurchaseProduct: (productId: string) => void;
  products: RNIap.Product[];
  loading?: boolean;
  error: string | null;
  onFirstPaint?: () => void;
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
  loading = false,
  error,
  onFirstPaint,
  firestoreProducts = [],
  currentCoins = 0,
}) => {
  const insets = useSafeAreaInsets();
  const availableHeight = screenHeight - insets.top - insets.bottom;
  const hasPaintedForCurrentOpenRef = useRef(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const sortedProducts = useMemo(
    () => [...firestoreProducts].sort((a, b) => a.sortOrder - b.sortOrder),
    [firestoreProducts],
  );
  const featuredProducts = useMemo(
    () =>
      sortedProducts
        .filter((product) => product.featuredOrder !== undefined && product.featuredOrder !== null)
        .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0)),
    [sortedProducts],
  );
  const standardProducts = useMemo(
    () => sortedProducts.filter((product) => product.featuredOrder === undefined || product.featuredOrder === null),
    [sortedProducts],
  );

  const displayPriceByProductId = useMemo(() => {
    const priceMap = new Map<string, string>();
    products.forEach((product) => {
      const productId = product.id ?? (product as {productId?: string}).productId;
      const displayPrice =
        product.displayPrice ??
        (product as {localizedPrice?: string; price?: string}).localizedPrice ??
        (product as {localizedPrice?: string; price?: string}).price;
      if (productId && displayPrice) {
        priceMap.set(productId, displayPrice);
      }
    });
    return priceMap;
  }, [products]);

  const getDisplayPrice = useCallback(
    (product: ProductPricing) => {
      return (
        displayPriceByProductId.get(product.productId) ??
        product.regionalPrices.find((r) => r.currency === "USD")?.displayPrice ??
        "-"
      );
    },
    [displayPriceByProductId],
  );

  useEffect(() => {
    if (!isVisible) {
      hasPaintedForCurrentOpenRef.current = false;
      return;
    }
    if (hasPaintedForCurrentOpenRef.current) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      if (hasPaintedForCurrentOpenRef.current) {
        return;
      }
      hasPaintedForCurrentOpenRef.current = true;
      onFirstPaint?.();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isVisible, onFirstPaint]);

  const selectedProductStillAvailable =
    selectedProductId === null || sortedProducts.some((product) => product.productId === selectedProductId);
  const effectiveSelectedProductId = selectedProductStillAvailable ? selectedProductId : null;

  useEffect(() => {
    if (isVisible || selectedProductId === null) {
      return;
    }
    // Keep selection scoped to a single visible session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedProductId(null);
  }, [isVisible, selectedProductId]);

  const handleClose = useCallback(() => {
    setSelectedProductId(null);
    onClose();
  }, [onClose]);

  const handlePackPress = (product: ProductPricing) => {
    logger.debug("Shop pack tapped:", product.productId);
    if (effectiveSelectedProductId === product.productId) {
      setSelectedProductId(null);
      return;
    }

    setSelectedProductId(product.productId);
  };

  const handlePurchasePress = () => {
    if (!effectiveSelectedProductId) return;
    onPurchaseProduct(effectiveSelectedProductId);
  };

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.backdrop} />

        <SlideInModalContent
          isVisible={isVisible}
          style={[
            styles.modalContainer,
            {
              left: Math.max(COIN_SHOP_MODAL_SIDE_INSET, insets.left + COIN_SHOP_SAFE_EDGE_GAP),
              right: Math.max(COIN_SHOP_MODAL_SIDE_INSET, insets.right + COIN_SHOP_SAFE_EDGE_GAP),
              top: insets.top + availableHeight * 0.05,
              bottom: insets.bottom + availableHeight * 0.05,
            },
          ]}
        >
          <ModalBg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" />
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
          />
          <CloseButton
            onPress={handleClose}
            size={CLOSE_BUTTON_SIZE_LG}
            style={styles.closeButton}
            accessibilityLabel={AppStrings.Accessibility.CLOSE_COIN_SHOP}
          />

          {loading ? (
            <View style={styles.loadingContainer} testID="coin-shop-loading">
              <ActivityIndicator size="large" color={COLORS.primaryOrange} />
              <Text style={styles.loadingText}>{AppStrings.CoinShop.LOADING_TEXT}</Text>
            </View>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{AppStrings.CoinShop.TITLE}</Text>
              </View>

              <View style={styles.coinsPill}>
                <View style={styles.coinsPillLeft}>
                  <CoinSvg width={moderateScale(32)} height={moderateScale(32)} />
                  <View style={styles.coinsPillText}>
                    <Text style={styles.coinsPillLabel}>{AppStrings.CoinShop.YOUR_BALANCE}</Text>
                  </View>
                </View>
                <Text style={styles.coinsPillAmount}>
                  {currentCoins.toLocaleString()}
                  {AppStrings.CoinShop.COINS_SUFFIX}
                </Text>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.scrollContent}>
                {!error && sortedProducts.length > 0 && (
                  <>
                    {featuredProducts.length > 0 && (
                      <View style={styles.grid}>
                        {featuredProducts.map((product) => {
                          const displayPrice = getDisplayPrice(product);
                          const isSelected = effectiveSelectedProductId === product.productId;
                          return (
                            <TouchableOpacity
                              key={product.productId}
                              style={[styles.gridCard, isSelected && styles.gridCardSelected]}
                              onPress={() => handlePackPress(product)}
                              activeOpacity={0.8}
                              testID={`pack-card-${product.productId}`}
                            >
                              {product.featuredBadge && (
                                <View style={styles.badge}>
                                  <Text style={styles.badgeText}>{product.featuredBadge}</Text>
                                </View>
                              )}

                              <LargeCoinStackSvg
                                width={GRID_COIN_ICON_WIDTH}
                                height={GRID_COIN_ICON_HEIGHT}
                                style={styles.gridCoinIcon}
                              />
                              <Text style={styles.productCoins}>
                                {product.coins.toLocaleString()}
                                {AppStrings.CoinShop.COINS_SUFFIX}
                              </Text>
                              <View style={styles.productPriceButton}>
                                <Text style={styles.productPriceText}>{displayPrice}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {standardProducts.length > 0 && (
                      <View style={styles.listContainer}>
                        {standardProducts.map((product) => {
                          const displayPrice = getDisplayPrice(product);
                          const isSelected = effectiveSelectedProductId === product.productId;
                          return (
                            <TouchableOpacity
                              key={product.productId}
                              style={[styles.listCard, isSelected && styles.listCardSelected]}
                              onPress={() => handlePackPress(product)}
                              activeOpacity={0.8}
                              testID={`pack-card-${product.productId}`}
                            >
                              <View style={styles.listCardLeft}>
                                <CoinSvg width={LIST_COIN_ICON_SIZE} height={LIST_COIN_ICON_SIZE} />
                                <Text style={styles.listCoins}>
                                  {product.coins.toLocaleString()}
                                  {AppStrings.CoinShop.COINS_SUFFIX}
                                </Text>
                              </View>
                              <View style={styles.listPriceButton}>
                                <Text style={styles.productPriceText}>{displayPrice}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}

                {!error && sortedProducts.length === 0 && (
                  <Text style={styles.errorText}>{AppStrings.CoinShop.NO_PACKS_AVAILABLE}</Text>
                )}
              </View>

              <View style={styles.bottomButtons}>
                <View style={styles.purchaseButtonContainer}>
                  <WideButton
                    testID="purchase-button"
                    buttonText={AppStrings.CoinShop.PURCHASE_BUTTON}
                    onPress={handlePurchasePress}
                    disabled={!effectiveSelectedProductId}
                  />
                </View>
              </View>
            </>
          )}
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badge: {
    backgroundColor: "#F54160",
    borderBottomRightRadius: moderateScale(12),
    left: 0,
    minWidth: "52%",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    position: "absolute",
    top: 0,
  },
  badgeText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    letterSpacing: 0.5,
  },
  bottomButtons: {
    gap: verticalScale(10),
  },
  closeButton: {
    ...MODAL_CLOSE_BUTTON_POSITION,
    top: verticalScale(24),
  },
  coinsPill: {
    alignItems: "center",
    backgroundColor: COLORS.figmaCream,
    borderColor: COLORS.gray200,
    borderRadius: moderateScale(50),
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(8),
    marginLeft: scale(12),
    marginRight: scale(12),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
  },
  coinsPillAmount: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
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
  },
  gridCard: {
    alignItems: "center",
    backgroundColor: "#EAE1C4",
    borderColor: "#F54160",
    borderRadius: moderateScale(16),
    borderWidth: 2,
    height: GRID_CARD_HEIGHT,
    justifyContent: "flex-start",
    marginBottom: verticalScale(10),
    overflow: "hidden",
    paddingTop: verticalScale(24),
    position: "relative",
    width: "48%",
  },
  gridCardSelected: {
    borderColor: COLORS.primaryOrange,
    borderWidth: 2,
    elevation: 10,
    overflow: "visible",
    shadowColor: COLORS.primaryOrange,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.7,
    shadowRadius: moderateScale(10),
  },
  gridCoinIcon: {
    marginBottom: 0,
  },
  headerRow: {
    alignItems: "center",
    marginBottom: verticalScale(12),
    marginTop: verticalScale(30),
  },
  listCard: {
    alignItems: "center",
    backgroundColor: "#F8F5EE",
    borderColor: "#DDD4C2",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: verticalScale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
  },
  listCardLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: scale(10),
  },
  listCardSelected: {
    borderColor: COLORS.primaryOrange,
    elevation: 7,
    shadowColor: COLORS.primaryOrange,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.45,
    shadowRadius: moderateScale(6),
  },
  listCoins: {
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  listContainer: {
    marginTop: verticalScale(2),
  },
  listPriceButton: {
    alignItems: "center",
    backgroundColor: "#401F40",
    borderColor: "#FEC880",
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    minWidth: scale(72),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(7),
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    gap: verticalScale(12),
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  modalContainer: {
    borderRadius: BORDER_RADIUS["2xl"],
    elevation: 10,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  overlay: {
    flex: 1,
  },
  productCoins: {
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    marginTop: verticalScale(-12),
    textAlign: "center",
  },
  productPriceButton: {
    alignItems: "center",
    backgroundColor: "#401F40",
    borderColor: "#FEC880",
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    bottom: verticalScale(8),
    left: scale(8),
    paddingVertical: verticalScale(7),
    position: "absolute",
    right: scale(8),
  },
  productPriceText: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  purchaseButtonContainer: {
    marginBottom: verticalScale(48),
    marginLeft: scale(12),
    marginRight: scale(12),
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(16),
  },
  title: {
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    letterSpacing: 1,
    textAlign: "center",
  },
});

export default CoinShop;
