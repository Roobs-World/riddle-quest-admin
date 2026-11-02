import type {YouTubeLocale} from "@riddle-quest/solo";
/**
 * Copy that only the hosted (server-authoritative) Android screens need.
 *
 * @remarks
 * Keys shared with self-contained play (`submit`, `hint`, `victory`, …) stay in
 * `@riddle-quest/solo`'s tables; this table only adds the account, connectivity and
 * server-session strings so the YouTube artifact never carries them.
 */
export type HostedCopyKey =
  | "connecting"
  | "signInFailed"
  | "provisionFailed"
  | "playOffline"
  | "playOnline"
  | "offlineNote"
  | "online"
  | "account"
  | "accountIntro"
  | "accountCreated"
  | "accountConfirmed"
  | "serverCoins"
  | "playerId"
  | "loadingPuzzle"
  | "serviceUnavailable"
  | "puzzleUnavailable"
  | "puzzleLoadFailed"
  | "dailyAlreadySolved"
  | "nextRiddle"
  | "done"
  | "classicCaption"
  | "riddlesLoadFailed";
/** One locale's hosted copy. */
type HostedDictionary = Readonly<Record<HostedCopyKey, string>>;
/** English hosted copy. */
const en: HostedDictionary = {
  connecting: "Connecting to the Riddle Quest servers…",
  signInFailed: "Sign-in failed. Check your connection and try again.",
  provisionFailed: "The account could not be confirmed. Try again.",
  playOffline: "Play offline",
  playOnline: "Play online",
  offlineNote: "Offline progress stays on this device.",
  online: "Online",
  account: "Account",
  accountIntro:
    "Your progress, coins and races are kept on the Riddle Quest servers. This device is signed in anonymously; a Google sign-in can be linked later to recover the account on another phone.",
  accountCreated: "Account created.",
  accountConfirmed: "Account confirmed.",
  serverCoins: "Server coins",
  playerId: "Player id",
  loadingPuzzle: "Loading your puzzle from the server…",
  serviceUnavailable: "The service is temporarily unavailable. Try again.",
  puzzleUnavailable: "Puzzle unavailable",
  puzzleLoadFailed: "The puzzle could not be loaded.",
  dailyAlreadySolved: "Today's Daily is already solved on this account.",
  nextRiddle: "Next riddle",
  done: "Done",
  classicCaption: "Endless riddles",
  riddlesLoadFailed: "The riddles could not be loaded.",
};
/** Spanish hosted copy. */
const es: HostedDictionary = {
  connecting: "Conectando con los servidores de Riddle Quest…",
  signInFailed: "No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.",
  provisionFailed: "No se pudo confirmar la cuenta. Inténtalo de nuevo.",
  playOffline: "Jugar sin conexión",
  playOnline: "Jugar en línea",
  offlineNote: "El progreso sin conexión se queda en este dispositivo.",
  online: "En línea",
  account: "Cuenta",
  accountIntro:
    "Tu progreso, monedas y carreras se guardan en los servidores de Riddle Quest. Este dispositivo ha iniciado sesión de forma anónima; más adelante podrás vincular una cuenta de Google para recuperarla en otro teléfono.",
  accountCreated: "Cuenta creada.",
  accountConfirmed: "Cuenta confirmada.",
  serverCoins: "Monedas en el servidor",
  playerId: "Id de jugador",
  loadingPuzzle: "Cargando tu acertijo desde el servidor…",
  serviceUnavailable: "El servicio no está disponible temporalmente. Inténtalo de nuevo.",
  puzzleUnavailable: "Acertijo no disponible",
  puzzleLoadFailed: "No se pudo cargar el acertijo.",
  dailyAlreadySolved: "El Diario de hoy ya está resuelto en esta cuenta.",
  nextRiddle: "Siguiente acertijo",
  done: "Listo",
  classicCaption: "Acertijos sin fin",
  riddlesLoadFailed: "No se pudieron cargar los acertijos.",
};
/** Portuguese hosted copy. */
const pt: HostedDictionary = {
  connecting: "Conectando aos servidores do Riddle Quest…",
  signInFailed: "Falha ao entrar. Verifique sua conexão e tente novamente.",
  provisionFailed: "Não foi possível confirmar a conta. Tente novamente.",
  playOffline: "Jogar offline",
  playOnline: "Jogar online",
  offlineNote: "O progresso offline fica neste dispositivo.",
  online: "Online",
  account: "Conta",
  accountIntro:
    "Seu progresso, moedas e corridas ficam nos servidores do Riddle Quest. Este dispositivo está conectado anonimamente; um login do Google pode ser vinculado depois para recuperar a conta em outro telefone.",
  accountCreated: "Conta criada.",
  accountConfirmed: "Conta confirmada.",
  serverCoins: "Moedas no servidor",
  playerId: "Id do jogador",
  loadingPuzzle: "Carregando seu enigma do servidor…",
  serviceUnavailable: "O serviço está temporariamente indisponível. Tente novamente.",
  puzzleUnavailable: "Enigma indisponível",
  puzzleLoadFailed: "Não foi possível carregar o enigma.",
  dailyAlreadySolved: "O Diário de hoje já foi resolvido nesta conta.",
  nextRiddle: "Próximo enigma",
  done: "Concluído",
  classicCaption: "Enigmas sem fim",
  riddlesLoadFailed: "Não foi possível carregar os enigmas.",
};
/** French hosted copy. */
const fr: HostedDictionary = {
  connecting: "Connexion aux serveurs Riddle Quest…",
  signInFailed: "La connexion a échoué. Vérifiez votre réseau et réessayez.",
  provisionFailed: "Le compte n'a pas pu être confirmé. Réessayez.",
  playOffline: "Jouer hors ligne",
  playOnline: "Jouer en ligne",
  offlineNote: "La progression hors ligne reste sur cet appareil.",
  online: "En ligne",
  account: "Compte",
  accountIntro:
    "Votre progression, vos pièces et vos courses sont conservées sur les serveurs Riddle Quest. Cet appareil est connecté anonymement ; une connexion Google pourra être associée plus tard pour récupérer le compte sur un autre téléphone.",
  accountCreated: "Compte créé.",
  accountConfirmed: "Compte confirmé.",
  serverCoins: "Pièces sur le serveur",
  playerId: "Identifiant joueur",
  loadingPuzzle: "Chargement de votre énigme depuis le serveur…",
  serviceUnavailable: "Le service est temporairement indisponible. Réessayez.",
  puzzleUnavailable: "Énigme indisponible",
  puzzleLoadFailed: "L'énigme n'a pas pu être chargée.",
  dailyAlreadySolved: "L'énigme quotidienne d'aujourd'hui est déjà résolue sur ce compte.",
  nextRiddle: "Énigme suivante",
  done: "Terminé",
  classicCaption: "Énigmes sans fin",
  riddlesLoadFailed: "Les énigmes n'ont pas pu être chargées.",
};
/** German hosted copy. */
const de: HostedDictionary = {
  connecting: "Verbindung zu den Riddle-Quest-Servern wird hergestellt…",
  signInFailed: "Anmeldung fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.",
  provisionFailed: "Das Konto konnte nicht bestätigt werden. Versuche es erneut.",
  playOffline: "Offline spielen",
  playOnline: "Online spielen",
  offlineNote: "Offline-Fortschritt bleibt auf diesem Gerät.",
  online: "Online",
  account: "Konto",
  accountIntro:
    "Dein Fortschritt, deine Münzen und Rennen werden auf den Riddle-Quest-Servern gespeichert. Dieses Gerät ist anonym angemeldet; eine Google-Anmeldung kann später verknüpft werden, um das Konto auf einem anderen Telefon wiederherzustellen.",
  accountCreated: "Konto erstellt.",
  accountConfirmed: "Konto bestätigt.",
  serverCoins: "Münzen auf dem Server",
  playerId: "Spieler-ID",
  loadingPuzzle: "Dein Rätsel wird vom Server geladen…",
  serviceUnavailable: "Der Dienst ist vorübergehend nicht verfügbar. Versuche es erneut.",
  puzzleUnavailable: "Rätsel nicht verfügbar",
  puzzleLoadFailed: "Das Rätsel konnte nicht geladen werden.",
  dailyAlreadySolved: "Das heutige Tagesrätsel ist auf diesem Konto bereits gelöst.",
  nextRiddle: "Nächstes Rätsel",
  done: "Fertig",
  classicCaption: "Endlose Rätsel",
  riddlesLoadFailed: "Die Rätsel konnten nicht geladen werden.",
};
/** Japanese hosted copy. */
const ja: HostedDictionary = {
  connecting: "Riddle Quest のサーバーに接続しています…",
  signInFailed: "サインインに失敗しました。接続を確認してもう一度お試しください。",
  provisionFailed: "アカウントを確認できませんでした。もう一度お試しください。",
  playOffline: "オフラインで遊ぶ",
  playOnline: "オンラインで遊ぶ",
  offlineNote: "オフラインの進行状況はこの端末にのみ保存されます。",
  online: "オンライン",
  account: "アカウント",
  accountIntro:
    "進行状況、コイン、レースは Riddle Quest のサーバーに保存されます。この端末は匿名でサインインしています。後で Google サインインを連携すると、別の端末でアカウントを復元できます。",
  accountCreated: "アカウントを作成しました。",
  accountConfirmed: "アカウントを確認しました。",
  serverCoins: "サーバーのコイン",
  playerId: "プレイヤー ID",
  loadingPuzzle: "サーバーからなぞなぞを読み込んでいます…",
  serviceUnavailable: "サービスは一時的に利用できません。もう一度お試しください。",
  puzzleUnavailable: "なぞなぞを利用できません",
  puzzleLoadFailed: "なぞなぞを読み込めませんでした。",
  dailyAlreadySolved: "今日のデイリーはこのアカウントで解答済みです。",
  nextRiddle: "次のなぞなぞ",
  done: "完了",
  classicCaption: "無限のなぞなぞ",
  riddlesLoadFailed: "なぞなぞを読み込めませんでした。",
};
/** Korean hosted copy. */
const ko: HostedDictionary = {
  connecting: "Riddle Quest 서버에 연결하는 중…",
  signInFailed: "로그인에 실패했습니다. 연결을 확인하고 다시 시도하세요.",
  provisionFailed: "계정을 확인할 수 없습니다. 다시 시도하세요.",
  playOffline: "오프라인으로 플레이",
  playOnline: "온라인으로 플레이",
  offlineNote: "오프라인 진행 상황은 이 기기에만 저장됩니다.",
  online: "온라인",
  account: "계정",
  accountIntro:
    "진행 상황, 코인, 레이스는 Riddle Quest 서버에 보관됩니다. 이 기기는 익명으로 로그인되어 있으며, 나중에 Google 로그인을 연결하면 다른 휴대폰에서 계정을 복구할 수 있습니다.",
  accountCreated: "계정이 생성되었습니다.",
  accountConfirmed: "계정이 확인되었습니다.",
  serverCoins: "서버 코인",
  playerId: "플레이어 ID",
  loadingPuzzle: "서버에서 수수께끼를 불러오는 중…",
  serviceUnavailable: "서비스를 일시적으로 사용할 수 없습니다. 다시 시도하세요.",
  puzzleUnavailable: "수수께끼를 사용할 수 없음",
  puzzleLoadFailed: "수수께끼를 불러올 수 없습니다.",
  dailyAlreadySolved: "오늘의 데일리는 이 계정에서 이미 해결했습니다.",
  nextRiddle: "다음 수수께끼",
  done: "완료",
  classicCaption: "끝없는 수수께끼",
  riddlesLoadFailed: "수수께끼를 불러올 수 없습니다.",
};
/** Hindi hosted copy. */
const hi: HostedDictionary = {
  connecting: "Riddle Quest सर्वर से कनेक्ट हो रहा है…",
  signInFailed: "साइन-इन विफल रहा। अपना कनेक्शन जाँचें और फिर से कोशिश करें।",
  provisionFailed: "खाते की पुष्टि नहीं हो सकी। फिर से कोशिश करें।",
  playOffline: "ऑफ़लाइन खेलें",
  playOnline: "ऑनलाइन खेलें",
  offlineNote: "ऑफ़लाइन प्रगति इसी डिवाइस पर रहती है।",
  online: "ऑनलाइन",
  account: "खाता",
  accountIntro:
    "आपकी प्रगति, सिक्के और रेस Riddle Quest सर्वर पर रखी जाती हैं। यह डिवाइस गुमनाम रूप से साइन-इन है; बाद में Google साइन-इन जोड़कर खाते को दूसरे फ़ोन पर वापस पाया जा सकता है।",
  accountCreated: "खाता बन गया।",
  accountConfirmed: "खाते की पुष्टि हो गई।",
  serverCoins: "सर्वर सिक्के",
  playerId: "खिलाड़ी आईडी",
  loadingPuzzle: "सर्वर से आपकी पहेली लोड हो रही है…",
  serviceUnavailable: "सेवा अस्थायी रूप से उपलब्ध नहीं है। फिर से कोशिश करें।",
  puzzleUnavailable: "पहेली उपलब्ध नहीं",
  puzzleLoadFailed: "पहेली लोड नहीं हो सकी।",
  dailyAlreadySolved: "आज की डेली इस खाते पर पहले ही हल हो चुकी है।",
  nextRiddle: "अगली पहेली",
  done: "हो गया",
  classicCaption: "अनगिनत पहेलियाँ",
  riddlesLoadFailed: "पहेलियाँ लोड नहीं हो सकीं।",
};
/** Russian hosted copy. */
const ru: HostedDictionary = {
  connecting: "Подключение к серверам Riddle Quest…",
  signInFailed: "Не удалось войти. Проверьте подключение и попробуйте снова.",
  provisionFailed: "Не удалось подтвердить аккаунт. Попробуйте снова.",
  playOffline: "Играть офлайн",
  playOnline: "Играть онлайн",
  offlineNote: "Офлайн-прогресс хранится только на этом устройстве.",
  online: "Онлайн",
  account: "Аккаунт",
  accountIntro:
    "Ваш прогресс, монеты и гонки хранятся на серверах Riddle Quest. Это устройство вошло анонимно; позже можно привязать вход через Google, чтобы восстановить аккаунт на другом телефоне.",
  accountCreated: "Аккаунт создан.",
  accountConfirmed: "Аккаунт подтверждён.",
  serverCoins: "Монеты на сервере",
  playerId: "ID игрока",
  loadingPuzzle: "Загрузка загадки с сервера…",
  serviceUnavailable: "Сервис временно недоступен. Попробуйте снова.",
  puzzleUnavailable: "Загадка недоступна",
  puzzleLoadFailed: "Не удалось загрузить загадку.",
  dailyAlreadySolved: "Сегодняшняя ежедневная загадка уже решена в этом аккаунте.",
  nextRiddle: "Следующая загадка",
  done: "Готово",
  classicCaption: "Бесконечные загадки",
  riddlesLoadFailed: "Не удалось загрузить загадки.",
};
/** Turkish hosted copy. */
const tr: HostedDictionary = {
  connecting: "Riddle Quest sunucularına bağlanılıyor…",
  signInFailed: "Oturum açılamadı. Bağlantını kontrol edip tekrar dene.",
  provisionFailed: "Hesap doğrulanamadı. Tekrar dene.",
  playOffline: "Çevrimdışı oyna",
  playOnline: "Çevrimiçi oyna",
  offlineNote: "Çevrimdışı ilerleme bu cihazda kalır.",
  online: "Çevrimiçi",
  account: "Hesap",
  accountIntro:
    "İlerlemen, paraların ve yarışların Riddle Quest sunucularında tutulur. Bu cihaz anonim olarak oturum açtı; hesabı başka bir telefonda kurtarmak için daha sonra bir Google oturumu bağlanabilir.",
  accountCreated: "Hesap oluşturuldu.",
  accountConfirmed: "Hesap doğrulandı.",
  serverCoins: "Sunucudaki paralar",
  playerId: "Oyuncu kimliği",
  loadingPuzzle: "Bilmecen sunucudan yükleniyor…",
  serviceUnavailable: "Hizmet geçici olarak kullanılamıyor. Tekrar dene.",
  puzzleUnavailable: "Bilmece kullanılamıyor",
  puzzleLoadFailed: "Bilmece yüklenemedi.",
  dailyAlreadySolved: "Bugünün Günlük bilmecesi bu hesapta zaten çözüldü.",
  nextRiddle: "Sonraki bilmece",
  done: "Bitti",
  classicCaption: "Sonsuz bilmeceler",
  riddlesLoadFailed: "Bilmeceler yüklenemedi.",
};
/** Arabic hosted copy. */
const ar: HostedDictionary = {
  connecting: "جارٍ الاتصال بخوادم Riddle Quest…",
  signInFailed: "فشل تسجيل الدخول. تحقق من اتصالك وحاول مرة أخرى.",
  provisionFailed: "تعذر تأكيد الحساب. حاول مرة أخرى.",
  playOffline: "اللعب دون اتصال",
  playOnline: "اللعب عبر الإنترنت",
  offlineNote: "يبقى التقدم دون اتصال على هذا الجهاز.",
  online: "متصل",
  account: "الحساب",
  accountIntro:
    "يُحفظ تقدمك وعملاتك وسباقاتك على خوادم Riddle Quest. هذا الجهاز مسجّل الدخول بشكل مجهول؛ ويمكن ربط تسجيل دخول Google لاحقًا لاستعادة الحساب على هاتف آخر.",
  accountCreated: "تم إنشاء الحساب.",
  accountConfirmed: "تم تأكيد الحساب.",
  serverCoins: "العملات على الخادم",
  playerId: "معرّف اللاعب",
  loadingPuzzle: "جارٍ تحميل لغزك من الخادم…",
  serviceUnavailable: "الخدمة غير متاحة مؤقتًا. حاول مرة أخرى.",
  puzzleUnavailable: "اللغز غير متاح",
  puzzleLoadFailed: "تعذر تحميل اللغز.",
  dailyAlreadySolved: "تم حل لغز اليوم بالفعل على هذا الحساب.",
  nextRiddle: "اللغز التالي",
  done: "تم",
  classicCaption: "ألغاز بلا نهاية",
  riddlesLoadFailed: "تعذر تحميل الألغاز.",
};
/** Indonesian hosted copy. */
const id: HostedDictionary = {
  connecting: "Menghubungkan ke server Riddle Quest…",
  signInFailed: "Gagal masuk. Periksa koneksi Anda dan coba lagi.",
  provisionFailed: "Akun tidak dapat dikonfirmasi. Coba lagi.",
  playOffline: "Main offline",
  playOnline: "Main online",
  offlineNote: "Progres offline tetap di perangkat ini.",
  online: "Online",
  account: "Akun",
  accountIntro:
    "Progres, koin, dan balapan Anda disimpan di server Riddle Quest. Perangkat ini masuk secara anonim; login Google dapat ditautkan nanti untuk memulihkan akun di ponsel lain.",
  accountCreated: "Akun dibuat.",
  accountConfirmed: "Akun dikonfirmasi.",
  serverCoins: "Koin di server",
  playerId: "Id pemain",
  loadingPuzzle: "Memuat teka-teki Anda dari server…",
  serviceUnavailable: "Layanan sementara tidak tersedia. Coba lagi.",
  puzzleUnavailable: "Teka-teki tidak tersedia",
  puzzleLoadFailed: "Teka-teki tidak dapat dimuat.",
  dailyAlreadySolved: "Harian hari ini sudah diselesaikan di akun ini.",
  nextRiddle: "Teka-teki berikutnya",
  done: "Selesai",
  classicCaption: "Teka-teki tanpa akhir",
  riddlesLoadFailed: "Teka-teki tidak dapat dimuat.",
};
/** Italian hosted copy. */
const it: HostedDictionary = {
  connecting: "Connessione ai server di Riddle Quest…",
  signInFailed: "Accesso non riuscito. Controlla la connessione e riprova.",
  provisionFailed: "Impossibile confermare l'account. Riprova.",
  playOffline: "Gioca offline",
  playOnline: "Gioca online",
  offlineNote: "I progressi offline restano su questo dispositivo.",
  online: "Online",
  account: "Account",
  accountIntro:
    "I tuoi progressi, le monete e le gare sono conservati sui server di Riddle Quest. Questo dispositivo ha effettuato l'accesso in modo anonimo; in seguito potrai collegare un accesso Google per recuperare l'account su un altro telefono.",
  accountCreated: "Account creato.",
  accountConfirmed: "Account confermato.",
  serverCoins: "Monete sul server",
  playerId: "Id giocatore",
  loadingPuzzle: "Caricamento dell'indovinello dal server…",
  serviceUnavailable: "Il servizio è temporaneamente non disponibile. Riprova.",
  puzzleUnavailable: "Indovinello non disponibile",
  puzzleLoadFailed: "Impossibile caricare l'indovinello.",
  dailyAlreadySolved: "L'indovinello giornaliero di oggi è già risolto su questo account.",
  nextRiddle: "Prossimo indovinello",
  done: "Fatto",
  classicCaption: "Indovinelli senza fine",
  riddlesLoadFailed: "Impossibile caricare gli indovinelli.",
};
/** Dutch hosted copy. */
const nl: HostedDictionary = {
  connecting: "Verbinden met de Riddle Quest-servers…",
  signInFailed: "Aanmelden mislukt. Controleer je verbinding en probeer het opnieuw.",
  provisionFailed: "Het account kon niet worden bevestigd. Probeer het opnieuw.",
  playOffline: "Offline spelen",
  playOnline: "Online spelen",
  offlineNote: "Offline voortgang blijft op dit apparaat.",
  online: "Online",
  account: "Account",
  accountIntro:
    "Je voortgang, munten en races worden bewaard op de Riddle Quest-servers. Dit apparaat is anoniem aangemeld; later kan een Google-aanmelding worden gekoppeld om het account op een andere telefoon terug te halen.",
  accountCreated: "Account aangemaakt.",
  accountConfirmed: "Account bevestigd.",
  serverCoins: "Munten op de server",
  playerId: "Speler-id",
  loadingPuzzle: "Je raadsel wordt van de server geladen…",
  serviceUnavailable: "De service is tijdelijk niet beschikbaar. Probeer het opnieuw.",
  puzzleUnavailable: "Raadsel niet beschikbaar",
  puzzleLoadFailed: "Het raadsel kon niet worden geladen.",
  dailyAlreadySolved: "De dagelijkse van vandaag is al opgelost op dit account.",
  nextRiddle: "Volgend raadsel",
  done: "Klaar",
  classicCaption: "Eindeloze raadsels",
  riddlesLoadFailed: "De raadsels konden niet worden geladen.",
};
/** Polish hosted copy. */
const pl: HostedDictionary = {
  connecting: "Łączenie z serwerami Riddle Quest…",
  signInFailed: "Logowanie nie powiodło się. Sprawdź połączenie i spróbuj ponownie.",
  provisionFailed: "Nie udało się potwierdzić konta. Spróbuj ponownie.",
  playOffline: "Graj offline",
  playOnline: "Graj online",
  offlineNote: "Postępy offline pozostają na tym urządzeniu.",
  online: "Online",
  account: "Konto",
  accountIntro:
    "Twoje postępy, monety i wyścigi są przechowywane na serwerach Riddle Quest. To urządzenie jest zalogowane anonimowo; później można połączyć logowanie Google, aby odzyskać konto na innym telefonie.",
  accountCreated: "Konto utworzone.",
  accountConfirmed: "Konto potwierdzone.",
  serverCoins: "Monety na serwerze",
  playerId: "Id gracza",
  loadingPuzzle: "Ładowanie zagadki z serwera…",
  serviceUnavailable: "Usługa jest tymczasowo niedostępna. Spróbuj ponownie.",
  puzzleUnavailable: "Zagadka niedostępna",
  puzzleLoadFailed: "Nie udało się załadować zagadki.",
  dailyAlreadySolved: "Dzisiejsza zagadka dnia jest już rozwiązana na tym koncie.",
  nextRiddle: "Następna zagadka",
  done: "Gotowe",
  classicCaption: "Niekończące się zagadki",
  riddlesLoadFailed: "Nie udało się załadować zagadek.",
};
/** Vietnamese hosted copy. */
const vi: HostedDictionary = {
  connecting: "Đang kết nối với máy chủ Riddle Quest…",
  signInFailed: "Đăng nhập không thành công. Kiểm tra kết nối và thử lại.",
  provisionFailed: "Không thể xác nhận tài khoản. Hãy thử lại.",
  playOffline: "Chơi ngoại tuyến",
  playOnline: "Chơi trực tuyến",
  offlineNote: "Tiến trình ngoại tuyến chỉ lưu trên thiết bị này.",
  online: "Trực tuyến",
  account: "Tài khoản",
  accountIntro:
    "Tiến trình, xu và các cuộc đua của bạn được lưu trên máy chủ Riddle Quest. Thiết bị này đang đăng nhập ẩn danh; sau này có thể liên kết đăng nhập Google để khôi phục tài khoản trên điện thoại khác.",
  accountCreated: "Đã tạo tài khoản.",
  accountConfirmed: "Đã xác nhận tài khoản.",
  serverCoins: "Xu trên máy chủ",
  playerId: "Id người chơi",
  loadingPuzzle: "Đang tải câu đố của bạn từ máy chủ…",
  serviceUnavailable: "Dịch vụ tạm thời không khả dụng. Hãy thử lại.",
  puzzleUnavailable: "Câu đố không khả dụng",
  puzzleLoadFailed: "Không thể tải câu đố.",
  dailyAlreadySolved: "Câu đố hằng ngày hôm nay đã được giải trên tài khoản này.",
  nextRiddle: "Câu đố tiếp theo",
  done: "Xong",
  classicCaption: "Câu đố vô tận",
  riddlesLoadFailed: "Không thể tải các câu đố.",
};
/** Hosted copy for every supported locale. */
export const HOSTED_COPY: Readonly<Record<YouTubeLocale, HostedDictionary>> = Object.freeze({
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
/** Resolves one hosted copy string. */
export const hostedText = (locale: YouTubeLocale, key: HostedCopyKey): string => HOSTED_COPY[locale][key];
/** Host-service copy keys raised by the shared services, mapped to hosted copy. */
const HOST_SERVICE_COPY: Readonly<Record<string, HostedCopyKey>> = Object.freeze({
  "ErrorMessages.UNABLE_TO_LOAD_RIDDLES": "riddlesLoadFailed",
  "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE": "serviceUnavailable",
});
/** Resolves host-service copy, falling back to the key so a missing entry is visible rather than silent. */
export const translateHostCopy = (locale: YouTubeLocale, key: string): string => {
  /** Hosted key for the service message, when one is mapped. */
  const mapped = HOST_SERVICE_COPY[key];
  return mapped ? hostedText(locale, mapped) : key;
};
