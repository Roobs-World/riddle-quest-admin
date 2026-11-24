import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
/** Native notification settings in every supported locale. */
const COPY = {
  en: {
    title: "Notifications",
    failed: "Notification settings could not be saved. Check permission in Android Settings and try again.",
    unavailable: "Notifications are unavailable on this build.",
  },
  es: {
    title: "Notificaciones",
    failed: "No se pudo guardar la configuración. Comprueba el permiso en Ajustes de Android e inténtalo de nuevo.",
    unavailable: "Las notificaciones no están disponibles en esta versión.",
  },
  fr: {
    title: "Notifications",
    failed:
      "Impossible d’enregistrer les paramètres. Vérifiez l’autorisation dans les paramètres Android et réessayez.",
    unavailable: "Les notifications ne sont pas disponibles dans cette version.",
  },
  de: {
    title: "Benachrichtigungen",
    failed:
      "Die Einstellungen konnten nicht gespeichert werden. Prüfe die Berechtigung in den Android-Einstellungen und versuche es erneut.",
    unavailable: "Benachrichtigungen sind in dieser Version nicht verfügbar.",
  },
  it: {
    title: "Notifiche",
    failed: "Impossibile salvare le impostazioni. Controlla l’autorizzazione nelle impostazioni Android e riprova.",
    unavailable: "Le notifiche non sono disponibili in questa versione.",
  },
  pt: {
    title: "Notificações",
    failed:
      "Não foi possível guardar as definições. Verifique a permissão nas definições do Android e tente novamente.",
    unavailable: "As notificações não estão disponíveis nesta versão.",
  },
  ru: {
    title: "Уведомления",
    failed: "Не удалось сохранить настройки. Проверьте разрешение в настройках Android и повторите попытку.",
    unavailable: "Уведомления недоступны в этой версии.",
  },
  ja: {
    title: "通知",
    failed: "設定を保存できませんでした。Androidの設定で権限を確認し、もう一度お試しください。",
    unavailable: "このバージョンでは通知を利用できません。",
  },
  ko: {
    title: "알림",
    failed: "설정을 저장하지 못했습니다. Android 설정에서 권한을 확인한 후 다시 시도하세요.",
    unavailable: "이 버전에서는 알림을 사용할 수 없습니다.",
  },
  pl: {
    title: "Powiadomienia",
    failed: "Nie można zapisać ustawień. Sprawdź uprawnienie w ustawieniach Androida i spróbuj ponownie.",
    unavailable: "Powiadomienia nie są dostępne w tej wersji.",
  },
  nl: {
    title: "Meldingen",
    failed:
      "De instellingen konden niet worden opgeslagen. Controleer de toestemming in Android-instellingen en probeer opnieuw.",
    unavailable: "Meldingen zijn niet beschikbaar in deze versie.",
  },
  tr: {
    title: "Bildirimler",
    failed: "Ayarlar kaydedilemedi. Android Ayarları’nda izni kontrol edip tekrar deneyin.",
    unavailable: "Bu sürümde bildirimler kullanılamıyor.",
  },
  vi: {
    title: "Thông báo",
    failed: "Không lưu được cài đặt. Kiểm tra quyền trong Cài đặt Android rồi thử lại.",
    unavailable: "Thông báo không khả dụng trong phiên bản này.",
  },
  id: {
    title: "Notifikasi",
    failed: "Pengaturan tidak dapat disimpan. Periksa izin di Setelan Android lalu coba lagi.",
    unavailable: "Notifikasi tidak tersedia pada versi ini.",
  },
  hi: {
    title: "सूचनाएँ",
    failed: "सेटिंग सहेजी नहीं जा सकी। Android सेटिंग में अनुमति जाँचें और फिर कोशिश करें।",
    unavailable: "इस संस्करण में सूचनाएँ उपलब्ध नहीं हैं।",
  },
  ar: {
    title: "الإشعارات",
    failed: "تعذر حفظ الإعدادات. تحقق من الإذن في إعدادات Android وحاول مجددًا.",
    unavailable: "الإشعارات غير متاحة في هذا الإصدار.",
  },
} satisfies Record<YouTubeLocale, Record<string, string>>;
/** Resolves native notification labels. */
export const notificationCopy = (locale: YouTubeLocale) => COPY[locale];
