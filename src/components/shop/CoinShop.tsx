import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as RNIap from "react-native-iap";
import { ProductPricing } from "../../services/ProductPricingService";
import { COLORS, TYPOGRAPHY, BORDER_RADIUS } from "../../styles";
import {
  scale,
  verticalScale,
  moderateScale,
  dimensions,
} from "../../utils/responsive";
import {
  CLOSE_BUTTON_SIZE_LG,
  MODAL_CLOSE_BUTTON_POSITION,
  MODAL_HEIGHT,
  MODAL_WIDTH,
} from "../../constants/layout";
import CoinSvg from "../../../assets/images/coin.svg";
import LargeCoinStackSvg from "../../../assets/images/large-coin-stack.svg";
import ModalBg from "../../../assets/images/modal-bg.svg";
import HomeBg from "../../../assets/images/home-bg.svg";
import { logger } from "../../utils/logger";
import CloseButton from "../buttons/CloseButton";
import WideButton from "../buttons/WideButton";
import { AppStrings } from "../../constants/AppStrings";

const { screenHeight } = dimensions;
const GRID_COIN_ICON_WIDTH = moderateScale(86);
const GRID_COIN_ICON_HEIGHT = verticalScale(51);
const GRID_CARD_HEIGHT = verticalScale(144);
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
  const deferredRenderFrameRef = useRef<number | null>(null);
  const shouldDeferContent = process.env.NODE_ENV !== "test";
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isContentReady, setIsContentReady] = useState(!shouldDeferContent);

  const sortedProducts = useMemo(
    () => [...firestoreProducts].sort((a, b) => a.sortOrder - b.sortOrder),
    [firestoreProducts],
  );

  const displayPriceByProductId = useMemo(() => {
    const priceMap = new Map<string, string>();
    products.forEach((product) => {
      priceMap.set(product.id, product.displayPrice);
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
      setSelectedProductId(null);
      return;
    }
  }, [isVisible]);

  useEffect(() => {
    if (!selectedProductId) return;

    const selectedProductStillAvailable = sortedProducts.some(
      (product) => product.productId === selectedProductId,
    );
    if (!selectedProductStillAvailable) {
      setSelectedProductId(null);
    }
  }, [selectedProductId, sortedProducts]);

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

  useEffect(() => {
    if (!isVisible) {
      setIsContentReady(false);
      if (deferredRenderFrameRef.current !== null) {
        cancelAnimationFrame(deferredRenderFrameRef.current);
        deferredRenderFrameRef.current = null;
      }
      return;
    }

    if (!shouldDeferContent) {
      setIsContentReady(true);
      return;
    }

    setIsContentReady(false);
    deferredRenderFrameRef.current = requestAnimationFrame(() => {
      deferredRenderFrameRef.current = null;
      setIsContentReady(true);
    });

    return () => {
      if (deferredRenderFrameRef.current !== null) {
        cancelAnimationFrame(deferredRenderFrameRef.current);
        deferredRenderFrameRef.current = null;
      }
    };
  }, [isVisible, shouldDeferContent]);

  const handlePackPress = (product: ProductPricing) => {
    logger.debug("Shop pack tapped:", product.productId);
    if (selectedProductId === product.productId) {
      setSelectedProductId(null);
      return;
    }

    setSelectedProductId(product.productId);
  };

  const handlePurchasePress = () => {
    if (!selectedProductId) return;
    onPurchaseProduct(selectedProductId);
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />

        <View
          style={[
            styles.modalContainer,
            {
              left: Math.max(
                COIN_SHOP_MODAL_SIDE_INSET,
                insets.left + COIN_SHOP_SAFE_EDGE_GAP,
              ),
              right: Math.max(
                COIN_SHOP_MODAL_SIDE_INSET,
                insets.right + COIN_SHOP_SAFE_EDGE_GAP,
              ),
              top: insets.top + availableHeight * 0.05,
              bottom: insets.bottom + availableHeight * 0.05,
            },
          ]}
        >
          <ModalBg
            width="100%"
            height="100%"
            style={[StyleSheet.absoluteFill]}
            preserveAspectRatio="none"
          />
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
          />
          <CloseButton
            onPress={onClose}
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
                {currentCoins.toLocaleString()}{AppStrings.CoinShop.COINS_SUFFIX}
              </Text>
            </View>

            {!isContentReady && (
              <View style={styles.loadingContainer} testID="coin-shop-loading">
                <ActivityIndicator size="large" color={COLORS.primaryOrange} />
                <Text style={styles.loadingText}>{AppStrings.CoinShop.LOADING_TEXT}</Text>
              </View>
            )}

            {isContentReady && (
              <>
                {error && <Text style={styles.errorText}>{error}</Text>}

                <View style={styles.scrollContent}>

                {!error && sortedProducts.length > 0 && (
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
                            {product.coins.toLocaleString()}{AppStrings.CoinShop.COINS_SUFFIX}
                          </Text>
                          <View style={styles.productPriceButton}>
                            <Text style={styles.productPriceText}>{displayPrice}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
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
                    disabled={!selectedProductId}
                  />
                </View>
              </View>
              </>
            )}
          </>
          )}
        </View>
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
    top: verticalScale(36)
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
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    marginLeft: scale(12),
    marginRight: scale(12)
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
    borderRadius: moderateScale(16),
    borderColor: "#F54160",
    borderWidth: 2,
    height: GRID_CARD_HEIGHT,
    justifyContent: "flex-start",
    marginBottom: verticalScale(10),
    overflow: "hidden",
    paddingTop: verticalScale(24),
    position: "relative",
    width: "48%",
  },
  gridCoinIcon: {
    marginBottom: 0,
  },
  gridCardSelected: {
    borderColor: COLORS.primaryOrange,
    borderWidth: 2,
    overflow: "visible",
    shadowColor: COLORS.primaryOrange,
    shadowOpacity: 0.7,
    shadowRadius: moderateScale(10),
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  headerRow: {
    alignItems: "center",
    marginTop: verticalScale(30),
    marginBottom: verticalScale(12),
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: verticalScale(12),
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  overlay: {
    flex: 1,
  },
  purchaseButtonContainer: {
    marginBottom: verticalScale(48),
    marginLeft: scale(12),
    marginRight: scale(12),
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
  scroll: {
    flex: 1,
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
