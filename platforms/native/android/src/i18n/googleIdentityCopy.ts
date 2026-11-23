import type {YouTubeLocale} from "@riddle-quest/solo";

/** Native durable-account copy is complete in every supported locale. */
const copy = {
  "en": {
    "title": "Keep your progress",
    "intro": "Link Google to recover this account, progress and purchases after reinstalling or on another device.",
    "link": "Continue with Google",
    "linked": "This game account is linked to Google. Use the same Google Account to recover it.",
    "unavailable": "Google sign-in is not available in this version yet.",
    "conflict": "This Google Account already has another game account. Switching will not merge your current progress, coins or purchases, and they may become inaccessible.",
    "switchAccount": "Open existing Google account",
    "keepCurrent": "Keep this account",
    "failed": "Google sign-in could not finish. Please try again.",
    "signOut": "Sign out"
  },
  "es": {
    "title": "Conserva tu progreso",
    "intro": "Vincula Google para recuperar esta cuenta, su progreso y sus compras al reinstalar o en otro dispositivo.",
    "link": "Continuar con Google",
    "linked": "Esta cuenta está vinculada a Google. Usa la misma cuenta de Google para recuperarla.",
    "unavailable": "El inicio de sesión con Google aún no está disponible en esta versión.",
    "conflict": "Esta cuenta de Google ya tiene otra cuenta del juego. Al cambiar no se combinarán tu progreso, monedas ni compras actuales, y podrías perder el acceso a ellos.",
    "switchAccount": "Abrir la cuenta de Google existente",
    "keepCurrent": "Conservar esta cuenta",
    "failed": "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
    "signOut": "Cerrar sesión"
  },
  "pt": {
    "title": "Guarde o seu progresso",
    "intro": "Associe o Google para recuperar esta conta, o progresso e as compras após reinstalar ou noutro dispositivo.",
    "link": "Continuar com o Google",
    "linked": "Esta conta está associada ao Google. Use a mesma Conta Google para a recuperar.",
    "unavailable": "O início de sessão com o Google ainda não está disponível nesta versão.",
    "conflict": "Esta Conta Google já tem outra conta do jogo. A mudança não junta o progresso, as moedas ou as compras atuais, que poderão ficar inacessíveis.",
    "switchAccount": "Abrir a conta Google existente",
    "keepCurrent": "Manter esta conta",
    "failed": "Não foi possível iniciar sessão com o Google. Tente novamente.",
    "signOut": "Terminar sessão"
  },
  "fr": {
    "title": "Conservez votre progression",
    "intro": "Associez Google pour retrouver ce compte, sa progression et ses achats après une réinstallation ou sur un autre appareil.",
    "link": "Continuer avec Google",
    "linked": "Ce compte est associé à Google. Utilisez le même compte Google pour le retrouver.",
    "unavailable": "La connexion Google n’est pas encore disponible dans cette version.",
    "conflict": "Ce compte Google possède déjà un autre compte de jeu. Le changement ne fusionnera pas votre progression, vos pièces ni vos achats actuels, qui pourraient devenir inaccessibles.",
    "switchAccount": "Ouvrir le compte Google existant",
    "keepCurrent": "Conserver ce compte",
    "failed": "La connexion Google a échoué. Réessayez.",
    "signOut": "Se déconnecter"
  },
  "de": {
    "title": "Fortschritt behalten",
    "intro": "Verknüpfe Google, um dieses Konto, den Fortschritt und Käufe nach einer Neuinstallation oder auf einem anderen Gerät wiederherzustellen.",
    "link": "Weiter mit Google",
    "linked": "Dieses Spielkonto ist mit Google verknüpft. Verwende dasselbe Google-Konto zur Wiederherstellung.",
    "unavailable": "Die Google-Anmeldung ist in dieser Version noch nicht verfügbar.",
    "conflict": "Dieses Google-Konto hat bereits ein anderes Spielkonto. Beim Wechsel werden dein aktueller Fortschritt, Münzen und Käufe nicht zusammengeführt und sind möglicherweise nicht mehr zugänglich.",
    "switchAccount": "Vorhandenes Google-Konto öffnen",
    "keepCurrent": "Dieses Konto behalten",
    "failed": "Die Google-Anmeldung konnte nicht abgeschlossen werden. Versuche es erneut.",
    "signOut": "Abmelden"
  },
  "ja": {
    "title": "進行状況を保存",
    "intro": "Googleと連携すると、再インストール後や別の端末で、このアカウントの進行状況と購入内容を復元できます。",
    "link": "Googleで続行",
    "linked": "このゲームアカウントはGoogleと連携済みです。同じGoogleアカウントで復元できます。",
    "unavailable": "このバージョンではGoogleログインをまだ利用できません。",
    "conflict": "このGoogleアカウントには別のゲームアカウントがあります。切り替えても現在の進行状況、コイン、購入内容は統合されず、利用できなくなる場合があります。",
    "switchAccount": "既存のGoogleアカウントを開く",
    "keepCurrent": "このアカウントを使い続ける",
    "failed": "Googleログインを完了できませんでした。もう一度お試しください。",
    "signOut": "ログアウト"
  },
  "ko": {
    "title": "진행 상황 보관",
    "intro": "Google을 연결하면 앱을 다시 설치하거나 다른 기기에서 이 계정의 진행 상황과 구매 내역을 복원할 수 있습니다.",
    "link": "Google로 계속하기",
    "linked": "이 게임 계정은 Google에 연결되어 있습니다. 같은 Google 계정으로 복원하세요.",
    "unavailable": "이 버전에서는 아직 Google 로그인을 사용할 수 없습니다.",
    "conflict": "이 Google 계정에 이미 다른 게임 계정이 있습니다. 전환해도 현재 진행 상황, 코인, 구매 내역은 합쳐지지 않으며 접근할 수 없게 될 수 있습니다.",
    "switchAccount": "기존 Google 계정 열기",
    "keepCurrent": "이 계정 유지",
    "failed": "Google 로그인을 완료하지 못했습니다. 다시 시도하세요.",
    "signOut": "로그아웃"
  },
  "hi": {
    "title": "अपनी प्रगति सुरक्षित रखें",
    "intro": "दोबारा इंस्टॉल करने या दूसरे डिवाइस पर इस खाते, प्रगति और खरीदारी को वापस पाने के लिए Google लिंक करें।",
    "link": "Google के साथ जारी रखें",
    "linked": "यह गेम खाता Google से जुड़ा है। इसे वापस पाने के लिए वही Google खाता इस्तेमाल करें।",
    "unavailable": "इस संस्करण में Google साइन-इन अभी उपलब्ध नहीं है।",
    "conflict": "इस Google खाते से पहले से एक दूसरा गेम खाता जुड़ा है। बदलने पर आपकी मौजूदा प्रगति, सिक्के और खरीदारी मर्ज नहीं होंगे और उनकी पहुँच खो सकती है।",
    "switchAccount": "मौजूदा Google खाता खोलें",
    "keepCurrent": "यही खाता रखें",
    "failed": "Google साइन-इन पूरा नहीं हो सका। फिर से कोशिश करें।",
    "signOut": "साइन आउट"
  },
  "ru": {
    "title": "Сохраните прогресс",
    "intro": "Свяжите Google, чтобы восстановить этот аккаунт, прогресс и покупки после переустановки или на другом устройстве.",
    "link": "Продолжить с Google",
    "linked": "Этот игровой аккаунт связан с Google. Используйте тот же аккаунт Google для восстановления.",
    "unavailable": "Вход через Google пока недоступен в этой версии.",
    "conflict": "У этого аккаунта Google уже есть другой игровой аккаунт. При переключении текущие прогресс, монеты и покупки не объединятся и могут стать недоступны.",
    "switchAccount": "Открыть существующий аккаунт Google",
    "keepCurrent": "Оставить этот аккаунт",
    "failed": "Не удалось завершить вход через Google. Попробуйте ещё раз.",
    "signOut": "Выйти"
  },
  "tr": {
    "title": "İlerlemeni koru",
    "intro": "Yeniden yükledikten sonra veya başka bir cihazda bu hesabı, ilerlemeyi ve satın alımları kurtarmak için Google’ı bağla.",
    "link": "Google ile devam et",
    "linked": "Bu oyun hesabı Google’a bağlı. Kurtarmak için aynı Google Hesabını kullan.",
    "unavailable": "Bu sürümde Google ile giriş henüz kullanılamıyor.",
    "conflict": "Bu Google Hesabında zaten başka bir oyun hesabı var. Geçiş, mevcut ilerlemeni, paralarını veya satın alımlarını birleştirmez ve bunlara erişimi kaybedebilirsin.",
    "switchAccount": "Mevcut Google hesabını aç",
    "keepCurrent": "Bu hesabı koru",
    "failed": "Google ile giriş tamamlanamadı. Tekrar dene.",
    "signOut": "Çıkış yap"
  },
  "ar": {
    "title": "احتفظ بتقدمك",
    "intro": "اربط Google لاستعادة هذا الحساب والتقدم والمشتريات بعد إعادة التثبيت أو على جهاز آخر.",
    "link": "المتابعة باستخدام Google",
    "linked": "حساب اللعبة هذا مرتبط بـ Google. استخدم حساب Google نفسه لاستعادته.",
    "unavailable": "تسجيل الدخول باستخدام Google غير متاح بعد في هذا الإصدار.",
    "conflict": "حساب Google هذا لديه حساب لعبة آخر بالفعل. لن يدمج التبديل تقدمك أو عملاتك أو مشترياتك الحالية، وقد تفقد إمكانية الوصول إليها.",
    "switchAccount": "فتح حساب Google الحالي",
    "keepCurrent": "الاحتفاظ بهذا الحساب",
    "failed": "تعذر إكمال تسجيل الدخول باستخدام Google. حاول مرة أخرى.",
    "signOut": "تسجيل الخروج"
  },
  "id": {
    "title": "Simpan progresmu",
    "intro": "Tautkan Google untuk memulihkan akun, progres, dan pembelian ini setelah memasang ulang atau di perangkat lain.",
    "link": "Lanjutkan dengan Google",
    "linked": "Akun game ini ditautkan ke Google. Gunakan Akun Google yang sama untuk memulihkannya.",
    "unavailable": "Login Google belum tersedia dalam versi ini.",
    "conflict": "Akun Google ini sudah memiliki akun game lain. Beralih tidak akan menggabungkan progres, koin, atau pembelian saat ini, dan aksesnya mungkin hilang.",
    "switchAccount": "Buka akun Google yang sudah ada",
    "keepCurrent": "Pertahankan akun ini",
    "failed": "Login Google tidak dapat diselesaikan. Coba lagi.",
    "signOut": "Keluar"
  },
  "it": {
    "title": "Conserva i tuoi progressi",
    "intro": "Collega Google per recuperare questo account, i progressi e gli acquisti dopo una reinstallazione o su un altro dispositivo.",
    "link": "Continua con Google",
    "linked": "Questo account di gioco è collegato a Google. Usa lo stesso Account Google per recuperarlo.",
    "unavailable": "L’accesso con Google non è ancora disponibile in questa versione.",
    "conflict": "Questo Account Google ha già un altro account di gioco. Il passaggio non unirà progressi, monete o acquisti attuali, che potrebbero diventare inaccessibili.",
    "switchAccount": "Apri l’account Google esistente",
    "keepCurrent": "Mantieni questo account",
    "failed": "Impossibile completare l’accesso con Google. Riprova.",
    "signOut": "Esci"
  },
  "nl": {
    "title": "Bewaar je voortgang",
    "intro": "Koppel Google om dit account, je voortgang en aankopen na herinstallatie of op een ander apparaat te herstellen.",
    "link": "Doorgaan met Google",
    "linked": "Dit spelaccount is gekoppeld aan Google. Gebruik hetzelfde Google-account om het te herstellen.",
    "unavailable": "Inloggen met Google is nog niet beschikbaar in deze versie.",
    "conflict": "Dit Google-account heeft al een ander spelaccount. Bij wisselen worden je huidige voortgang, munten en aankopen niet samengevoegd en kun je er mogelijk niet meer bij.",
    "switchAccount": "Bestaand Google-account openen",
    "keepCurrent": "Dit account behouden",
    "failed": "Inloggen met Google kon niet worden voltooid. Probeer het opnieuw.",
    "signOut": "Uitloggen"
  },
  "pl": {
    "title": "Zachowaj postępy",
    "intro": "Połącz Google, aby odzyskać to konto, postępy i zakupy po ponownej instalacji lub na innym urządzeniu.",
    "link": "Kontynuuj z Google",
    "linked": "To konto gry jest połączone z Google. Użyj tego samego konta Google, aby je odzyskać.",
    "unavailable": "Logowanie przez Google nie jest jeszcze dostępne w tej wersji.",
    "conflict": "To konto Google ma już inne konto gry. Zmiana nie połączy bieżących postępów, monet ani zakupów i możesz utracić do nich dostęp.",
    "switchAccount": "Otwórz istniejące konto Google",
    "keepCurrent": "Zachowaj to konto",
    "failed": "Nie udało się dokończyć logowania przez Google. Spróbuj ponownie.",
    "signOut": "Wyloguj"
  },
  "vi": {
    "title": "Giữ tiến trình của bạn",
    "intro": "Liên kết Google để khôi phục tài khoản, tiến trình và giao dịch mua này sau khi cài lại hoặc trên thiết bị khác.",
    "link": "Tiếp tục với Google",
    "linked": "Tài khoản trò chơi này đã liên kết với Google. Dùng cùng Tài khoản Google để khôi phục.",
    "unavailable": "Phiên bản này chưa hỗ trợ đăng nhập Google.",
    "conflict": "Tài khoản Google này đã có tài khoản trò chơi khác. Việc chuyển sẽ không hợp nhất tiến trình, xu hay giao dịch mua hiện tại và bạn có thể mất quyền truy cập vào chúng.",
    "switchAccount": "Mở tài khoản Google hiện có",
    "keepCurrent": "Giữ tài khoản này",
    "failed": "Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.",
    "signOut": "Đăng xuất"
  }
} satisfies Record<YouTubeLocale, Record<"title" | "intro" | "link" | "linked" | "unavailable" | "conflict" | "switchAccount" | "keepCurrent" | "failed" | "signOut", string>>;
/** Returns the content-language copy for optional Google account protection. */
export const googleIdentityCopy = (locale: YouTubeLocale) => copy[locale];
