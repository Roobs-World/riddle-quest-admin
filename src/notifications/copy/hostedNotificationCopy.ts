import type {YouTubeLocale} from "../../gameplay/local/types";

/** Copy for hosted notification settings and browser permission. */
export type HostedNotificationCopy = Readonly<{
  notifications: string;
  on: string;
  off: string;
  allowNotifications: string;
  permissionRequired: string;
  blocked: string;
  unavailable: string;
  notConfigured: string;
  saveFailed: string;
}>;

const copyByLocale = {
  en: {
    notifications: "Notifications",
    on: "On",
    off: "Off",
    allowNotifications: "Allow notifications",
    permissionRequired: "Allow browser notifications to receive reminders when the game is closed.",
    blocked: "Notifications are blocked in your browser settings.",
    unavailable: "Notifications are unavailable in this browser.",
    notConfigured: "The notification service is not configured yet.",
    saveFailed: "Notification settings could not be saved. Please try again.",
  },
  es: {
    notifications: "Notificaciones",
    on: "Encendido",
    off: "Apagado",
    allowNotifications: "Permitir notificaciones",
    permissionRequired: "Permite las notificaciones del navegador para recibir recordatorios cuando el juego esté cerrado.",
    blocked: "Las notificaciones están bloqueadas en los ajustes del navegador.",
    unavailable: "Las notificaciones no están disponibles en este navegador.",
    notConfigured: "El servicio de notificaciones aún no está configurado.",
    saveFailed: "No se pudieron guardar los ajustes de notificaciones. Inténtalo de nuevo.",
  },
  pt: {
    notifications: "Notificações",
    on: "Ligado",
    off: "Desligado",
    allowNotifications: "Permitir notificações",
    permissionRequired: "Permita notificações do navegador para receber lembretes quando o jogo estiver fechado.",
    blocked: "As notificações estão bloqueadas nas configurações do navegador.",
    unavailable: "As notificações não estão disponíveis neste navegador.",
    notConfigured: "O serviço de notificações ainda não está configurado.",
    saveFailed: "Não foi possível salvar as configurações de notificações. Tente novamente.",
  },
  fr: {
    notifications: "Notifications",
    on: "Activé",
    off: "Désactivé",
    allowNotifications: "Autoriser les notifications",
    permissionRequired: "Autorisez les notifications du navigateur pour recevoir des rappels quand le jeu est fermé.",
    blocked: "Les notifications sont bloquées dans les paramètres de votre navigateur.",
    unavailable: "Les notifications ne sont pas disponibles dans ce navigateur.",
    notConfigured: "Le service de notifications n'est pas encore configuré.",
    saveFailed: "Les paramètres de notification n’ont pas pu être enregistrés. Réessayez.",
  },
  de: {
    notifications: "Benachrichtigungen",
    on: "Ein",
    off: "Aus",
    allowNotifications: "Benachrichtigungen zulassen",
    permissionRequired: "Erlaube Browser-Benachrichtigungen, um Erinnerungen zu erhalten, wenn das Spiel geschlossen ist.",
    blocked: "Benachrichtigungen sind in deinen Browsereinstellungen blockiert.",
    unavailable: "Benachrichtigungen sind in diesem Browser nicht verfügbar.",
    notConfigured: "Der Benachrichtigungsdienst ist noch nicht eingerichtet.",
    saveFailed: "Die Benachrichtigungseinstellungen konnten nicht gespeichert werden. Versuche es erneut.",
  },
  ja: {
    notifications: "通知",
    on: "オン",
    off: "オフ",
    allowNotifications: "通知を許可",
    permissionRequired: "ゲームを閉じている間もリマインダーを受け取るには、ブラウザーの通知を許可してください。",
    blocked: "ブラウザーの設定で通知がブロックされています。",
    unavailable: "このブラウザーでは通知を利用できません。",
    notConfigured: "通知サービスはまだ設定されていません。",
    saveFailed: "通知設定を保存できませんでした。もう一度お試しください。",
  },
  ko: {
    notifications: "알림",
    on: "켜기",
    off: "끄기",
    allowNotifications: "알림 허용",
    permissionRequired: "게임이 닫혀 있을 때도 알림을 받으려면 브라우저 알림을 허용하세요.",
    blocked: "브라우저 설정에서 알림이 차단되어 있습니다.",
    unavailable: "이 브라우저에서는 알림을 사용할 수 없습니다.",
    notConfigured: "알림 서비스가 아직 설정되지 않았습니다.",
    saveFailed: "알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.",
  },
  hi: {
    notifications: "सूचनाएँ",
    on: "चालू",
    off: "बंद",
    allowNotifications: "सूचनाओं की अनुमति दें",
    permissionRequired: "गेम बंद होने पर भी रिमाइंडर पाने के लिए ब्राउज़र सूचनाओं की अनुमति दें।",
    blocked: "आपके ब्राउज़र की सेटिंग में सूचनाएँ ब्लॉक हैं।",
    unavailable: "इस ब्राउज़र में सूचनाएँ उपलब्ध नहीं हैं।",
    notConfigured: "सूचना सेवा अभी सेट अप नहीं की गई है।",
    saveFailed: "सूचना सेटिंग सहेजी नहीं जा सकीं। कृपया फिर से कोशिश करें।",
  },
  ru: {
    notifications: "Уведомления",
    on: "Вкл.",
    off: "Выкл.",
    allowNotifications: "Разрешить уведомления",
    permissionRequired: "Разрешите уведомления браузера, чтобы получать напоминания, когда игра закрыта.",
    blocked: "Уведомления заблокированы в настройках браузера.",
    unavailable: "В этом браузере уведомления недоступны.",
    notConfigured: "Служба уведомлений ещё не настроена.",
    saveFailed: "Не удалось сохранить настройки уведомлений. Попробуйте ещё раз.",
  },
  tr: {
    notifications: "Bildirimler",
    on: "Açık",
    off: "Kapalı",
    allowNotifications: "Bildirimlere izin ver",
    permissionRequired: "Oyun kapalıyken hatırlatma almak için tarayıcı bildirimlerine izin verin.",
    blocked: "Bildirimler tarayıcı ayarlarınızda engellenmiş.",
    unavailable: "Bu tarayıcıda bildirimler kullanılamıyor.",
    notConfigured: "Bildirim hizmeti henüz yapılandırılmadı.",
    saveFailed: "Bildirim ayarları kaydedilemedi. Lütfen tekrar deneyin.",
  },
  ar: {
    notifications: "الإشعارات",
    on: "تشغيل",
    off: "إيقاف",
    allowNotifications: "السماح بالإشعارات",
    permissionRequired: "اسمح بإشعارات المتصفح لتلقي التذكيرات عندما تكون اللعبة مغلقة.",
    blocked: "الإشعارات محظورة في إعدادات المتصفح.",
    unavailable: "الإشعارات غير متاحة في هذا المتصفح.",
    notConfigured: "خدمة الإشعارات غير مهيأة بعد.",
    saveFailed: "تعذر حفظ إعدادات الإشعارات. يُرجى المحاولة مرة أخرى.",
  },
  id: {
    notifications: "Notifikasi",
    on: "Hidup",
    off: "Mati",
    allowNotifications: "Izinkan notifikasi",
    permissionRequired: "Izinkan notifikasi browser untuk menerima pengingat saat game ditutup.",
    blocked: "Notifikasi diblokir di pengaturan browser Anda.",
    unavailable: "Notifikasi tidak tersedia di browser ini.",
    notConfigured: "Layanan notifikasi belum dikonfigurasi.",
    saveFailed: "Pengaturan notifikasi tidak dapat disimpan. Silakan coba lagi.",
  },
  it: {
    notifications: "Notifiche",
    on: "Acceso",
    off: "Spento",
    allowNotifications: "Consenti notifiche",
    permissionRequired: "Consenti le notifiche del browser per ricevere promemoria quando il gioco è chiuso.",
    blocked: "Le notifiche sono bloccate nelle impostazioni del browser.",
    unavailable: "Le notifiche non sono disponibili in questo browser.",
    notConfigured: "Il servizio di notifiche non è ancora configurato.",
    saveFailed: "Impossibile salvare le impostazioni delle notifiche. Riprova.",
  },
  nl: {
    notifications: "Meldingen",
    on: "Aan",
    off: "Uit",
    allowNotifications: "Meldingen toestaan",
    permissionRequired: "Sta browsermeldingen toe om herinneringen te ontvangen wanneer het spel gesloten is.",
    blocked: "Meldingen zijn geblokkeerd in je browserinstellingen.",
    unavailable: "Meldingen zijn niet beschikbaar in deze browser.",
    notConfigured: "De meldingsservice is nog niet ingesteld.",
    saveFailed: "De meldingsinstellingen konden niet worden opgeslagen. Probeer het opnieuw.",
  },
  pl: {
    notifications: "Powiadomienia",
    on: "Wł",
    off: "Wył.",
    allowNotifications: "Zezwól na powiadomienia",
    permissionRequired: "Zezwól na powiadomienia w przeglądarce, aby otrzymywać przypomnienia, gdy gra jest zamknięta.",
    blocked: "Powiadomienia są zablokowane w ustawieniach przeglądarki.",
    unavailable: "Powiadomienia są niedostępne w tej przeglądarce.",
    notConfigured: "Usługa powiadomień nie jest jeszcze skonfigurowana.",
    saveFailed: "Nie udało się zapisać ustawień powiadomień. Spróbuj ponownie.",
  },
  vi: {
    notifications: "Thông báo",
    on: "Bật",
    off: "Tắt",
    allowNotifications: "Cho phép thông báo",
    permissionRequired: "Cho phép thông báo của trình duyệt để nhận lời nhắc khi trò chơi đã đóng.",
    blocked: "Thông báo bị chặn trong phần cài đặt trình duyệt.",
    unavailable: "Trình duyệt này không hỗ trợ thông báo.",
    notConfigured: "Dịch vụ thông báo chưa được cấu hình.",
    saveFailed: "Không thể lưu cài đặt thông báo. Vui lòng thử lại.",
  },
} satisfies Record<YouTubeLocale, HostedNotificationCopy>;

/** Selects a supported language without importing browser translation state. */
export function getHostedNotificationCopy(locale: string): HostedNotificationCopy {
  const language = locale.trim().toLowerCase().split(/[-_]/u)[0];
  return Object.entries(copyByLocale).find(([candidate]) => candidate === language)?.[1] ?? copyByLocale.en;
}
