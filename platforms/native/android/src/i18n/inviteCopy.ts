import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";

/** Shared race and referral guidance keeps the original link available after installation. */
const guidance = {
  en: "Open the invite link. No app yet? Install using the Play Store link, then reopen the original invite if it does not open automatically.",
  es: "Abre la invitación. ¿Aún no tienes la app? Instálala desde Google Play y vuelve a abrir la invitación original si no se abre automáticamente.",
  pt: "Abra o convite. Ainda não tem o app? Instale pelo Google Play e reabra o convite original se ele não abrir automaticamente.",
  fr: "Ouvrez l'invitation. Vous n'avez pas l'application ? Installez-la depuis Google Play, puis rouvrez l'invitation d'origine si elle ne s'ouvre pas automatiquement.",
  de: "Öffne die Einladung. Noch keine App? Installiere sie über Google Play und öffne danach die ursprüngliche Einladung erneut, falls sie nicht automatisch erscheint.",
  ja: "招待リンクを開いてください。アプリがない場合は Google Play からインストールし、招待が自動で開かなければ元の招待リンクをもう一度開いてください。",
  ko: "초대 링크를 여세요. 앱이 없나요? Google Play에서 설치한 뒤 초대가 자동으로 열리지 않으면 원래 초대 링크를 다시 여세요.",
  hi: "निमंत्रण लिंक खोलें। ऐप नहीं है? Google Play से इंस्टॉल करें। निमंत्रण अपने आप न खुले तो मूल निमंत्रण लिंक दोबारा खोलें।",
  ru: "Откройте приглашение. Нет приложения? Установите его через Google Play и снова откройте исходную ссылку, если приглашение не появится автоматически.",
  tr: "Davet bağlantısını açın. Uygulama yok mu? Google Play üzerinden yükleyin; davet otomatik açılmazsa ilk davet bağlantısını yeniden açın.",
  ar: "افتح رابط الدعوة. ليس لديك التطبيق؟ ثبّته من Google Play، ثم أعد فتح رابط الدعوة الأصلي إذا لم تفتح الدعوة تلقائيًا.",
  id: "Buka tautan undangan. Belum punya aplikasi? Instal melalui Google Play, lalu buka lagi undangan asli jika tidak terbuka otomatis.",
  it: "Apri l'invito. Non hai l'app? Installala da Google Play, poi riapri il link originale se l'invito non si apre automaticamente.",
  nl: "Open de uitnodiging. Nog geen app? Installeer via Google Play en open de oorspronkelijke uitnodiging opnieuw als die niet automatisch verschijnt.",
  pl: "Otwórz zaproszenie. Nie masz aplikacji? Zainstaluj ją z Google Play i ponownie otwórz oryginalny link, jeśli zaproszenie nie otworzy się automatycznie.",
  vi: "Mở liên kết lời mời. Chưa có ứng dụng? Cài đặt qua Google Play, rồi mở lại lời mời ban đầu nếu lời mời không tự mở.",
} satisfies Record<YouTubeLocale, string>;
/** Resolves installation and reopen guidance in every supported device language. */
export const androidInviteGuidance = (locale: YouTubeLocale): string => guidance[locale];
