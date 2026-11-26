import type {YouTubeLocale} from "../../gameplay/local/types";

/** Localized account preference and native permission text. */
export type HostedNotificationCopy = Readonly<{
  on: string;
  off: string;
  allowNotifications: string;
  notConfigured: string;
  saveFailed: string;
}>;

const copyByLocale = {
  en: {
    on: "On",
    off: "Off",
    allowNotifications: "Allow notifications",
    notConfigured: "The notification service is not configured yet.",
    saveFailed: "Notification settings could not be saved. Please try again.",
  },
  es: {
    on: "Encendido",
    off: "Apagado",
    allowNotifications: "Permitir notificaciones",
    notConfigured: "El servicio de notificaciones aún no está configurado.",
    saveFailed: "No se pudieron guardar los ajustes de notificaciones. Inténtalo de nuevo.",
  },
  pt: {
    on: "Ligado",
    off: "Desligado",
    allowNotifications: "Permitir notificações",
    notConfigured: "O serviço de notificações ainda não está configurado.",
    saveFailed: "Não foi possível salvar as configurações de notificações. Tente novamente.",
  },
  fr: {
    on: "Activé",
    off: "Désactivé",
    allowNotifications: "Autoriser les notifications",
    notConfigured: "Le service de notifications n'est pas encore configuré.",
    saveFailed: "Les paramètres de notification n’ont pas pu être enregistrés. Réessayez.",
  },
  de: {
    on: "Ein",
    off: "Aus",
    allowNotifications: "Benachrichtigungen zulassen",
    notConfigured: "Der Benachrichtigungsdienst ist noch nicht eingerichtet.",
    saveFailed: "Die Benachrichtigungseinstellungen konnten nicht gespeichert werden. Versuche es erneut.",
  },
  ja: {
    on: "オン",
    off: "オフ",
    allowNotifications: "通知を許可",
    notConfigured: "通知サービスはまだ設定されていません。",
    saveFailed: "通知設定を保存できませんでした。もう一度お試しください。",
  },
  ko: {
    on: "켜기",
    off: "끄기",
    allowNotifications: "알림 허용",
    notConfigured: "알림 서비스가 아직 설정되지 않았습니다.",
    saveFailed: "알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.",
  },
  hi: {
    on: "चालू",
    off: "बंद",
    allowNotifications: "सूचनाओं की अनुमति दें",
    notConfigured: "सूचना सेवा अभी सेट अप नहीं की गई है।",
    saveFailed: "सूचना सेटिंग सहेजी नहीं जा सकीं। कृपया फिर से कोशिश करें।",
  },
  ru: {
    on: "Вкл.",
    off: "Выкл.",
    allowNotifications: "Разрешить уведомления",
    notConfigured: "Служба уведомлений ещё не настроена.",
    saveFailed: "Не удалось сохранить настройки уведомлений. Попробуйте ещё раз.",
  },
  tr: {
    on: "Açık",
    off: "Kapalı",
    allowNotifications: "Bildirimlere izin ver",
    notConfigured: "Bildirim hizmeti henüz yapılandırılmadı.",
    saveFailed: "Bildirim ayarları kaydedilemedi. Lütfen tekrar deneyin.",
  },
  ar: {
    on: "تشغيل",
    off: "إيقاف",
    allowNotifications: "السماح بالإشعارات",
    notConfigured: "خدمة الإشعارات غير مهيأة بعد.",
    saveFailed: "تعذر حفظ إعدادات الإشعارات. يُرجى المحاولة مرة أخرى.",
  },
  id: {
    on: "Hidup",
    off: "Mati",
    allowNotifications: "Izinkan notifikasi",
    notConfigured: "Layanan notifikasi belum dikonfigurasi.",
    saveFailed: "Pengaturan notifikasi tidak dapat disimpan. Silakan coba lagi.",
  },
  it: {
    on: "Acceso",
    off: "Spento",
    allowNotifications: "Consenti notifiche",
    notConfigured: "Il servizio di notifiche non è ancora configurato.",
    saveFailed: "Impossibile salvare le impostazioni delle notifiche. Riprova.",
  },
  nl: {
    on: "Aan",
    off: "Uit",
    allowNotifications: "Meldingen toestaan",
    notConfigured: "De meldingsservice is nog niet ingesteld.",
    saveFailed: "De meldingsinstellingen konden niet worden opgeslagen. Probeer het opnieuw.",
  },
  pl: {
    on: "Wł",
    off: "Wył.",
    allowNotifications: "Zezwól na powiadomienia",
    notConfigured: "Usługa powiadomień nie jest jeszcze skonfigurowana.",
    saveFailed: "Nie udało się zapisać ustawień powiadomień. Spróbuj ponownie.",
  },
  vi: {
    on: "Bật",
    off: "Tắt",
    allowNotifications: "Cho phép thông báo",
    notConfigured: "Dịch vụ thông báo chưa được cấu hình.",
    saveFailed: "Không thể lưu cài đặt thông báo. Vui lòng thử lại.",
  },
} satisfies Record<YouTubeLocale, HostedNotificationCopy>;

/** Selects a supported language without importing browser translation state. */
export function getHostedNotificationCopy(locale: string): HostedNotificationCopy {
  const language = locale.trim().toLowerCase().split(/[-_]/u)[0];
  return Object.entries(copyByLocale).find(([candidate]) => candidate === language)?.[1] ?? copyByLocale.en;
}
