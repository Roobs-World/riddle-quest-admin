import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
/**
 * Copy for the Google Play shop.
 *
 * @remarks
 * Strings shared with the web coin shop reuse its translations from
 * `src/locales` (with transliteration and wording fixes for de, fr, it, pt, ru
 * and tr); the Play-specific strings are Android-only.
 */
export type ShopCopyKey =
  | "shopTitle"
  | "yourBalance"
  | "loadingShop"
  | "noProducts"
  | "subscribe"
  | "premiumActive"
  | "perMonth"
  | "perYear"
  | "premiumBenefitCoins"
  | "badgeStarter"
  | "badgePopular"
  | "badgeBestValue"
  | "coinsAdded"
  | "purchaseFailed"
  | "shopLoadFailed"
  | "shopUnavailable"
  | "purchasePending"
  | "restorePurchases"
  | "purchasesRestored"
  | "manageSubscription";
/** One locale's shop copy. */
type ShopDictionary = Readonly<Record<ShopCopyKey, string>>;
/** Shop copy (en). */
const en: ShopDictionary = {
  shopTitle: "COIN SHOP",
  yourBalance: "Your balance",
  loadingShop: "Loading shop...",
  noProducts: "No coin packs are available right now.",
  subscribe: "SUBSCRIBE",
  premiumActive: "Premium active",
  perMonth: "month",
  perYear: "year",
  premiumBenefitCoins: "{coins} coins added to your balance every 30 days",
  badgeStarter: "STARTER",
  badgePopular: "POPULAR",
  badgeBestValue: "BEST VALUE",
  coinsAdded: "{coins} coins added.",
  purchaseFailed: "Purchase failed. Please try again.",
  shopLoadFailed: "Failed to load shop products",
  shopUnavailable: "Google Play purchases aren't available on this device.",
  purchasePending: "Your purchase is pending. Coins arrive once Google Play confirms it.",
  restorePurchases: "Restore purchases",
  purchasesRestored: "Purchases restored.",
  manageSubscription: "Manage subscription",
};
/** Shop copy (es). */
const es: ShopDictionary = {
  shopTitle: "TIENDA DE MONEDAS",
  yourBalance: "Tu saldo",
  loadingShop: "Cargando tienda...",
  noProducts: "No hay paquetes de monedas disponibles ahora.",
  subscribe: "SUSCRIBIRSE",
  premiumActive: "Premium activo",
  perMonth: "mes",
  perYear: "año",
  premiumBenefitCoins: "{coins} monedas añadidas a tu saldo cada 30 días",
  badgeStarter: "INICIAL",
  badgePopular: "POPULAR",
  badgeBestValue: "MEJOR OFERTA",
  coinsAdded: "{coins} monedas agregadas.",
  purchaseFailed: "La compra falló. Por favor inténtalo de nuevo.",
  shopLoadFailed: "No se pudieron cargar los productos de la tienda",
  shopUnavailable: "Las compras de Google Play no están disponibles en este dispositivo.",
  purchasePending: "Tu compra está pendiente. Las monedas llegarán cuando Google Play la confirme.",
  restorePurchases: "Restaurar compras",
  purchasesRestored: "Compras restauradas.",
  manageSubscription: "Gestionar suscripción",
};
/** Shop copy (pt). */
const pt: ShopDictionary = {
  shopTitle: "LOJA DE MOEDAS",
  yourBalance: "Seu saldo",
  loadingShop: "Carregando loja...",
  noProducts: "Nenhum pacote de moedas disponível agora.",
  subscribe: "ASSINAR",
  premiumActive: "Premium ativo",
  perMonth: "mês",
  perYear: "ano",
  premiumBenefitCoins: "{coins} moedas adicionadas ao seu saldo a cada 30 dias",
  badgeStarter: "INICIAL",
  badgePopular: "POPULAR",
  badgeBestValue: "MELHOR OFERTA",
  coinsAdded: "{coins} moedas adicionadas.",
  purchaseFailed: "Falha na compra. Por favor, tente novamente.",
  shopLoadFailed: "Falha ao carregar produtos da loja",
  shopUnavailable: "As compras do Google Play não estão disponíveis neste dispositivo.",
  purchasePending: "Sua compra está pendente. As moedas chegam assim que o Google Play confirmar.",
  restorePurchases: "Restaurar compras",
  purchasesRestored: "Compras restauradas.",
  manageSubscription: "Gerenciar assinatura",
};
/** Shop copy (fr). */
const fr: ShopDictionary = {
  shopTitle: "BOUTIQUE DE PIÈCES",
  yourBalance: "Votre solde",
  loadingShop: "Chargement de la boutique...",
  noProducts: "Aucun pack de pièces disponible pour le moment.",
  subscribe: "S’ABONNER",
  premiumActive: "Premium actif",
  perMonth: "mois",
  perYear: "an",
  premiumBenefitCoins: "{coins} pièces ajoutées à votre solde tous les 30 jours",
  badgeStarter: "DÉBUTANT",
  badgePopular: "POPULAIRE",
  badgeBestValue: "MEILLEURE OFFRE",
  coinsAdded: "{coins} pièces ajoutées.",
  purchaseFailed: "L'achat a échoué. Veuillez réessayer.",
  shopLoadFailed: "Échec du chargement des produits de la boutique",
  shopUnavailable: "Les achats Google Play ne sont pas disponibles sur cet appareil.",
  purchasePending: "Votre achat est en attente. Les pièces arriveront dès que Google Play l'aura confirmé.",
  restorePurchases: "Restaurer les achats",
  purchasesRestored: "Achats restaurés.",
  manageSubscription: "Gérer l'abonnement",
};
/** Shop copy (de). */
const de: ShopDictionary = {
  shopTitle: "MÜNZSHOP",
  yourBalance: "Ihr Guthaben",
  loadingShop: "Shop wird geladen...",
  noProducts: "Derzeit sind keine Münzpakete verfügbar.",
  subscribe: "ABONNIEREN",
  premiumActive: "Premium aktiv",
  perMonth: "Monat",
  perYear: "Jahr",
  premiumBenefitCoins: "{coins} Münzen alle 30 Tage auf dein Guthaben",
  badgeStarter: "EINSTIEG",
  badgePopular: "BELIEBT",
  badgeBestValue: "BESTES ANGEBOT",
  coinsAdded: "{coins} Münzen hinzugefügt.",
  purchaseFailed: "Kauf gescheitert. Bitte versuchen Sie es erneut.",
  shopLoadFailed: "Fehler beim Laden der Shop-Produkte",
  shopUnavailable: "Google-Play-Käufe sind auf diesem Gerät nicht verfügbar.",
  purchasePending: "Dein Kauf ist ausstehend. Die Münzen kommen an, sobald Google Play ihn bestätigt.",
  restorePurchases: "Käufe wiederherstellen",
  purchasesRestored: "Käufe wiederhergestellt.",
  manageSubscription: "Abo verwalten",
};
/** Shop copy (ja). */
const ja: ShopDictionary = {
  shopTitle: "コインショップ",
  yourBalance: "残高",
  loadingShop: "ショップを読み込み中...",
  noProducts: "現在コインパックはありません。",
  subscribe: "登録する",
  premiumActive: "プレミアム有効",
  perMonth: "月",
  perYear: "年",
  premiumBenefitCoins: "30日ごとに{coins}コインを残高に追加",
  badgeStarter: "スターター",
  badgePopular: "人気",
  badgeBestValue: "最もお得",
  coinsAdded: "{coins} コインを追加しました。",
  purchaseFailed: "購入に失敗しました。もう一度試してください。",
  shopLoadFailed: "ショップ商品の読み込みに失敗しました",
  shopUnavailable: "この端末ではGoogle Playでの購入を利用できません。",
  purchasePending: "購入は保留中です。Google Playで確認されるとコインが追加されます。",
  restorePurchases: "購入を復元",
  purchasesRestored: "購入を復元しました。",
  manageSubscription: "定期購入を管理",
};
/** Shop copy (ko). */
const ko: ShopDictionary = {
  shopTitle: "코인 상점",
  yourBalance: "잔액",
  loadingShop: "상점 로딩 중...",
  noProducts: "현재 코인 팩이 없습니다.",
  subscribe: "구독",
  premiumActive: "프리미엄 활성",
  perMonth: "월",
  perYear: "년",
  premiumBenefitCoins: "30일마다 잔액에 코인 {coins}개 추가",
  badgeStarter: "스타터",
  badgePopular: "인기",
  badgeBestValue: "최고의 혜택",
  coinsAdded: "{coins} 코인이 추가되었습니다.",
  purchaseFailed: "구매에 실패했습니다. 다시 시도해 주세요.",
  shopLoadFailed: "상점 제품을 로드하지 못했습니다",
  shopUnavailable: "이 기기에서는 Google Play 구매를 사용할 수 없습니다.",
  purchasePending: "구매가 대기 중입니다. Google Play에서 확인되면 코인이 지급됩니다.",
  restorePurchases: "구매 복원",
  purchasesRestored: "구매가 복원되었습니다.",
  manageSubscription: "구독 관리",
};
/** Shop copy (hi). */
const hi: ShopDictionary = {
  shopTitle: "सिक्का दुकान",
  yourBalance: "आपका बैलेंस",
  loadingShop: "दुकान लोड हो रही है...",
  noProducts: "अभी कोई सिक्का पैक उपलब्ध नहीं है।",
  subscribe: "सदस्यता लें",
  premiumActive: "प्रीमियम सक्रिय",
  perMonth: "महीना",
  perYear: "वर्ष",
  premiumBenefitCoins: "हर 30 दिन में आपके बैलेंस में {coins} सिक्के जोड़े जाते हैं",
  badgeStarter: "शुरुआती",
  badgePopular: "लोकप्रिय",
  badgeBestValue: "सबसे किफ़ायती",
  coinsAdded: "{coins} सिक्के जोड़े गए।",
  purchaseFailed: "खरीदारी विफल। कृपया पुन: प्रयास करें।",
  shopLoadFailed: "दुकान के उत्पादों को लोड करने में विफल",
  shopUnavailable: "इस डिवाइस पर Google Play ख़रीदारी उपलब्ध नहीं है।",
  purchasePending: "आपकी ख़रीदारी लंबित है। Google Play द्वारा पुष्टि होते ही सिक्के मिल जाएँगे।",
  restorePurchases: "ख़रीदारी पुनर्स्थापित करें",
  purchasesRestored: "ख़रीदारी पुनर्स्थापित हो गई।",
  manageSubscription: "सदस्यता प्रबंधित करें",
};
/** Shop copy (ru). */
const ru: ShopDictionary = {
  shopTitle: "МАГАЗИН МОНЕТ",
  yourBalance: "Ваш баланс",
  loadingShop: "Загрузка магазина...",
  noProducts: "Наборы монет сейчас недоступны.",
  subscribe: "ПОДПИСАТЬСЯ",
  premiumActive: "Премиум активен",
  perMonth: "месяц",
  perYear: "год",
  premiumBenefitCoins: "{coins} монет на ваш баланс каждые 30 дней",
  badgeStarter: "СТАРТОВЫЙ",
  badgePopular: "ПОПУЛЯРНЫЙ",
  badgeBestValue: "ЛУЧШАЯ ЦЕНА",
  coinsAdded: "Добавлено монет: {coins}.",
  purchaseFailed: "Покупка не удалась. Пожалуйста, попробуйте еще раз.",
  shopLoadFailed: "Не удалось загрузить товары из магазина",
  shopUnavailable: "Покупки в Google Play недоступны на этом устройстве.",
  purchasePending: "Покупка ожидает подтверждения. Монеты поступят, когда Google Play её подтвердит.",
  restorePurchases: "Восстановить покупки",
  purchasesRestored: "Покупки восстановлены.",
  manageSubscription: "Управлять подпиской",
};
/** Shop copy (tr). */
const tr: ShopDictionary = {
  shopTitle: "JETON MAĞAZASI",
  yourBalance: "Bakiyeniz",
  loadingShop: "Mağaza yükleniyor...",
  noProducts: "Şu anda jeton paketi yok.",
  subscribe: "ABONE OL",
  premiumActive: "Premium aktif",
  perMonth: "ay",
  perYear: "yıl",
  premiumBenefitCoins: "Her 30 günde bir bakiyenize {coins} jeton eklenir",
  badgeStarter: "BAŞLANGIÇ",
  badgePopular: "POPÜLER",
  badgeBestValue: "EN İYİ FİYAT",
  coinsAdded: "{coins} jeton eklendi.",
  purchaseFailed: "Satın alma işlemi başarısız oldu. Lütfen tekrar deneyin.",
  shopLoadFailed: "Mağaza ürünleri yüklenemedi",
  shopUnavailable: "Google Play satın alımları bu cihazda kullanılamıyor.",
  purchasePending: "Satın alma işleminiz beklemede. Google Play onayladığında jetonlar hesabınıza eklenecek.",
  restorePurchases: "Satın alımları geri yükle",
  purchasesRestored: "Satın alımlar geri yüklendi.",
  manageSubscription: "Aboneliği yönet",
};
/** Shop copy (ar). */
const ar: ShopDictionary = {
  shopTitle: "متجر العملات",
  yourBalance: "رصيدك",
  loadingShop: "جارٍ تحميل المتجر...",
  noProducts: "لا تتوفر حزم العملات المعدنية في الوقت الحالي.",
  subscribe: "اشترك",
  premiumActive: "الاشتراك المميز نشط",
  perMonth: "شهر",
  perYear: "سنة",
  premiumBenefitCoins: "{coins} عملة تُضاف إلى رصيدك كل 30 يومًا",
  badgeStarter: "للمبتدئين",
  badgePopular: "شائع",
  badgeBestValue: "أفضل قيمة",
  coinsAdded: "تمت إضافة {coins} عملة.",
  purchaseFailed: "فشل الشراء. يرجى المحاولة مرة أخرى.",
  shopLoadFailed: "فشل في تحميل منتجات المتجر",
  shopUnavailable: "عمليات الشراء عبر Google Play غير متاحة على هذا الجهاز.",
  purchasePending: "عملية الشراء قيد الانتظار. ستصل العملات بعد أن يؤكدها Google Play.",
  restorePurchases: "استعادة المشتريات",
  purchasesRestored: "تمت استعادة المشتريات.",
  manageSubscription: "إدارة الاشتراك",
};
/** Shop copy (id). */
const id: ShopDictionary = {
  shopTitle: "TOKO KOIN",
  yourBalance: "Saldo Anda",
  loadingShop: "Memuat toko...",
  noProducts: "Tidak ada paket koin yang tersedia saat ini.",
  subscribe: "BERLANGGANAN",
  premiumActive: "Premium aktif",
  perMonth: "bulan",
  perYear: "tahun",
  premiumBenefitCoins: "{coins} koin ditambahkan ke saldo Anda setiap 30 hari",
  badgeStarter: "PEMULA",
  badgePopular: "POPULER",
  badgeBestValue: "PALING HEMAT",
  coinsAdded: "{coins} koin ditambahkan.",
  purchaseFailed: "Pembelian gagal. Silakan coba lagi.",
  shopLoadFailed: "Gagal memuat produk toko",
  shopUnavailable: "Pembelian Google Play tidak tersedia di perangkat ini.",
  purchasePending: "Pembelian Anda tertunda. Koin akan masuk setelah Google Play mengonfirmasinya.",
  restorePurchases: "Pulihkan pembelian",
  purchasesRestored: "Pembelian dipulihkan.",
  manageSubscription: "Kelola langganan",
};
/** Shop copy (it). */
const it: ShopDictionary = {
  shopTitle: "NEGOZIO DI MONETE",
  yourBalance: "Il tuo saldo",
  loadingShop: "Caricamento negozio...",
  noProducts: "Nessun pacchetto di monete è disponibile al momento.",
  subscribe: "ABBONATI",
  premiumActive: "Premium attivo",
  perMonth: "mese",
  perYear: "anno",
  premiumBenefitCoins: "{coins} monete aggiunte al tuo saldo ogni 30 giorni",
  badgeStarter: "INIZIALE",
  badgePopular: "POPOLARE",
  badgeBestValue: "MIGLIOR OFFERTA",
  coinsAdded: "{coins} monete aggiunte.",
  purchaseFailed: "Acquisto fallito. Per favore riprova.",
  shopLoadFailed: "Impossibile caricare i prodotti del negozio",
  shopUnavailable: "Gli acquisti Google Play non sono disponibili su questo dispositivo.",
  purchasePending: "Il tuo acquisto è in attesa. Le monete arriveranno quando Google Play lo confermerà.",
  restorePurchases: "Ripristina acquisti",
  purchasesRestored: "Acquisti ripristinati.",
  manageSubscription: "Gestisci abbonamento",
};
/** Shop copy (nl). */
const nl: ShopDictionary = {
  shopTitle: "MUNTWINKEL",
  yourBalance: "Jouw saldo",
  loadingShop: "Winkel laden...",
  noProducts: "Er zijn momenteel geen muntpakketten beschikbaar.",
  subscribe: "ABONNEREN",
  premiumActive: "Premium actief",
  perMonth: "maand",
  perYear: "jaar",
  premiumBenefitCoins: "Elke 30 dagen {coins} munten op je saldo",
  badgeStarter: "STARTER",
  badgePopular: "POPULAIR",
  badgeBestValue: "BESTE AANBIEDING",
  coinsAdded: "{coins} munten toegevoegd.",
  purchaseFailed: "Aankoop mislukt. Probeer het opnieuw.",
  shopLoadFailed: "Kan winkelproducten niet laden",
  shopUnavailable: "Aankopen via Google Play zijn niet beschikbaar op dit apparaat.",
  purchasePending: "Je aankoop is in behandeling. De munten komen zodra Google Play hem bevestigt.",
  restorePurchases: "Aankopen herstellen",
  purchasesRestored: "Aankopen hersteld.",
  manageSubscription: "Abonnement beheren",
};
/** Shop copy (pl). */
const pl: ShopDictionary = {
  shopTitle: "SKLEP Z MONETAMI",
  yourBalance: "Twoje saldo",
  loadingShop: "Ładowanie sklepu...",
  noProducts: "W tej chwili nie są dostępne żadne pakiety monet.",
  subscribe: "SUBSKRYBUJ",
  premiumActive: "Premium aktywne",
  perMonth: "miesiąc",
  perYear: "rok",
  premiumBenefitCoins: "{coins} monet dodawanych do salda co 30 dni",
  badgeStarter: "STARTOWY",
  badgePopular: "POPULARNY",
  badgeBestValue: "NAJLEPSZA OFERTA",
  coinsAdded: "Dodano {coins} monet.",
  purchaseFailed: "Zakup nie powiódł się. Spróbuj ponownie.",
  shopLoadFailed: "Nie udało się załadować produktów ze sklepu",
  shopUnavailable: "Zakupy w Google Play są niedostępne na tym urządzeniu.",
  purchasePending: "Twój zakup oczekuje. Monety pojawią się, gdy Google Play go potwierdzi.",
  restorePurchases: "Przywróć zakupy",
  purchasesRestored: "Przywrócono zakupy.",
  manageSubscription: "Zarządzaj subskrypcją",
};
/** Shop copy (vi). */
const vi: ShopDictionary = {
  shopTitle: "CỬA HÀNG ĐỒNG XU",
  yourBalance: "Số dư của bạn",
  loadingShop: "Đang tải cửa hàng...",
  noProducts: "Hiện tại không có gói tiền xu nào có sẵn.",
  subscribe: "ĐĂNG KÝ",
  premiumActive: "Premium đang hoạt động",
  perMonth: "tháng",
  perYear: "năm",
  premiumBenefitCoins: "{coins} xu được cộng vào số dư của bạn mỗi 30 ngày",
  badgeStarter: "KHỞI ĐẦU",
  badgePopular: "PHỔ BIẾN",
  badgeBestValue: "GIÁ TRỊ TỐT NHẤT",
  coinsAdded: "Đã thêm {coins} xu.",
  purchaseFailed: "Mua hàng không thành công. Vui lòng thử lại.",
  shopLoadFailed: "Không tải được sản phẩm của cửa hàng",
  shopUnavailable: "Không thể mua qua Google Play trên thiết bị này.",
  purchasePending: "Giao dịch mua của bạn đang chờ xử lý. Xu sẽ được cộng khi Google Play xác nhận.",
  restorePurchases: "Khôi phục giao dịch mua",
  purchasesRestored: "Đã khôi phục giao dịch mua.",
  manageSubscription: "Quản lý gói đăng ký",
};
/** Shop copy for every supported locale. */
export const SHOP_COPY: Readonly<Record<YouTubeLocale, ShopDictionary>> = Object.freeze({
  en,
  es,
  pt,
  fr,
  de,
  ja,
  ko,
  hi,
  ru,
  tr,
  ar,
  id,
  it,
  nl,
  pl,
  vi,
});
/** Resolves one shop string, filling `{name}` placeholders. */
export const shopText = (locale: YouTubeLocale, key: ShopCopyKey, values: Readonly<Record<string, string | number>> = {}): string =>
  SHOP_COPY[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
