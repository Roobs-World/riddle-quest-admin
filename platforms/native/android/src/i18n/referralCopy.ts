import type {YouTubeLocale} from "@riddle-quest/solo";
/** Invite copy for every supported device language. */
const COPY = {
  "en": {
    "title": "Invite a friend",
    "details": "Invite a new player. After they sign in with Google and win their first online riddle, each of you can earn {coins} coins, subject to daily limits.",
    "googleRequired": "Sign in with Google to use invites.",
    "google": "Sign in with Google",
    "share": "Share invite",
    "accept": "Accept invite",
    "bound": "Invite accepted. Win your first online riddle to claim your reward.",
    "settled": "Referral reward earned.",
    "ineligible": "This account has already played or purchased and cannot accept an invite.",
    "failed": "Could not update invites. Try again."
  },
  "es": {
    "title": "Invita a un amigo",
    "details": "Invita a alguien nuevo. Cuando inicie sesión con Google y gane su primer acertijo en línea, ambos podrán ganar {coins} monedas, con límites diarios.",
    "googleRequired": "Inicia sesión con Google para usar invitaciones.",
    "google": "Iniciar sesión con Google",
    "share": "Compartir invitación",
    "accept": "Aceptar invitación",
    "bound": "Invitación aceptada. Gana tu primer acertijo en línea para recibir la recompensa.",
    "settled": "Recompensa de invitación obtenida.",
    "ineligible": "Esta cuenta ya ha jugado o comprado y no puede aceptar una invitación.",
    "failed": "No se pudieron actualizar las invitaciones. Inténtalo de nuevo."
  },
  "pt": {
    "title": "Convide um amigo",
    "details": "Convide um novo jogador. Após entrar com Google e vencer o primeiro enigma online, cada um pode ganhar {coins} moedas, sujeito a limites diários.",
    "googleRequired": "Entre com Google para usar convites.",
    "google": "Entrar com Google",
    "share": "Compartilhar convite",
    "accept": "Aceitar convite",
    "bound": "Convite aceito. Vença seu primeiro enigma online para receber a recompensa.",
    "settled": "Recompensa de convite recebida.",
    "ineligible": "Esta conta já jogou ou comprou e não pode aceitar um convite.",
    "failed": "Não foi possível atualizar os convites. Tente novamente."
  },
  "fr": {
    "title": "Inviter un ami",
    "details": "Invitez un nouveau joueur. Après sa connexion Google et sa première énigme gagnée en ligne, chacun peut gagner {coins} pièces, dans les limites quotidiennes.",
    "googleRequired": "Connectez-vous avec Google pour utiliser les invitations.",
    "google": "Se connecter avec Google",
    "share": "Partager une invitation",
    "accept": "Accepter une invitation",
    "bound": "Invitation acceptée. Gagnez votre première énigme en ligne pour recevoir la récompense.",
    "settled": "Récompense de parrainage reçue.",
    "ineligible": "Ce compte a déjà joué ou acheté et ne peut pas accepter une invitation.",
    "failed": "Impossible de mettre à jour les invitations. Réessayez."
  },
  "de": {
    "title": "Freund einladen",
    "details": "Lade neue Spieler ein. Nach der Google-Anmeldung und dem ersten gewonnenen Online-Rätsel könnt ihr jeweils {coins} Münzen erhalten. Es gelten Tageslimits.",
    "googleRequired": "Melde dich mit Google an, um Einladungen zu nutzen.",
    "google": "Mit Google anmelden",
    "share": "Einladung teilen",
    "accept": "Einladung annehmen",
    "bound": "Einladung angenommen. Gewinne dein erstes Online-Rätsel, um die Belohnung zu erhalten.",
    "settled": "Einladungsbelohnung erhalten.",
    "ineligible": "Dieses Konto hat bereits gespielt oder gekauft und kann keine Einladung annehmen.",
    "failed": "Einladungen konnten nicht aktualisiert werden. Versuche es erneut."
  },
  "ja": {
    "title": "友達を招待",
    "details": "新しいプレイヤーを招待しましょう。Googleでログインして最初のオンラインなぞなぞに正解すると、それぞれ{coins}コインを獲得できます。1日の上限があります。",
    "googleRequired": "招待を利用するにはGoogleでログインしてください。",
    "google": "Googleでログイン",
    "share": "招待を共有",
    "accept": "招待を承認",
    "bound": "招待を承認しました。最初のオンラインなぞなぞに正解して報酬を受け取りましょう。",
    "settled": "招待報酬を獲得しました。",
    "ineligible": "このアカウントはすでにプレイまたは購入しているため、招待を承認できません。",
    "failed": "招待を更新できませんでした。もう一度お試しください。"
  },
  "ko": {
    "title": "친구 초대",
    "details": "새 플레이어를 초대하세요. Google 로그인 후 첫 온라인 수수께끼를 풀면 각자 {coins}코인을 받을 수 있습니다. 일일 한도가 적용됩니다.",
    "googleRequired": "초대를 이용하려면 Google로 로그인하세요.",
    "google": "Google로 로그인",
    "share": "초대 공유",
    "accept": "초대 수락",
    "bound": "초대를 수락했습니다. 첫 온라인 수수께끼를 풀고 보상을 받으세요.",
    "settled": "초대 보상을 받았습니다.",
    "ineligible": "이미 플레이하거나 구매한 계정은 초대를 수락할 수 없습니다.",
    "failed": "초대를 업데이트하지 못했습니다. 다시 시도하세요."
  },
  "hi": {
    "title": "मित्र को आमंत्रित करें",
    "details": "नए खिलाड़ी को आमंत्रित करें। Google से साइन इन करके पहली ऑनलाइन पहेली जीतने पर आप दोनों को {coins} सिक्के मिल सकते हैं। दैनिक सीमा लागू है।",
    "googleRequired": "निमंत्रण के लिए Google से साइन इन करें।",
    "google": "Google से साइन इन करें",
    "share": "निमंत्रण साझा करें",
    "accept": "निमंत्रण स्वीकार करें",
    "bound": "निमंत्रण स्वीकार हुआ। इनाम पाने के लिए पहली ऑनलाइन पहेली जीतें।",
    "settled": "निमंत्रण का इनाम मिला।",
    "ineligible": "यह खाता पहले खेल या खरीदारी कर चुका है और निमंत्रण स्वीकार नहीं कर सकता।",
    "failed": "निमंत्रण अपडेट नहीं हो सके। फिर प्रयास करें।"
  },
  "ru": {
    "title": "Пригласить друга",
    "details": "Пригласите нового игрока. После входа через Google и первой победы в онлайн-загадке каждый может получить {coins} монет. Действуют дневные ограничения.",
    "googleRequired": "Войдите через Google, чтобы использовать приглашения.",
    "google": "Войти через Google",
    "share": "Поделиться приглашением",
    "accept": "Принять приглашение",
    "bound": "Приглашение принято. Решите первую онлайн-загадку, чтобы получить награду.",
    "settled": "Награда за приглашение получена.",
    "ineligible": "Этот аккаунт уже играл или совершал покупки и не может принять приглашение.",
    "failed": "Не удалось обновить приглашения. Повторите попытку."
  },
  "tr": {
    "title": "Arkadaşını davet et",
    "details": "Yeni bir oyuncuyu davet et. Google ile giriş yapıp ilk çevrimiçi bilmeceyi kazandığında günlük sınırlar dahilinde ikiniz de {coins} jeton kazanabilirsiniz.",
    "googleRequired": "Davetleri kullanmak için Google ile giriş yap.",
    "google": "Google ile giriş yap",
    "share": "Daveti paylaş",
    "accept": "Daveti kabul et",
    "bound": "Davet kabul edildi. Ödül için ilk çevrimiçi bilmeceni kazan.",
    "settled": "Davet ödülü kazanıldı.",
    "ineligible": "Bu hesap daha önce oynadığı veya satın aldığı için davet kabul edemez.",
    "failed": "Davetler güncellenemedi. Tekrar dene."
  },
  "ar": {
    "title": "دعوة صديق",
    "details": "ادع لاعبًا جديدًا. بعد تسجيل دخوله باستخدام Google وفوزه بأول لغز عبر الإنترنت، يمكن لكل منكما كسب {coins} عملة، ضمن الحدود اليومية.",
    "googleRequired": "سجّل الدخول باستخدام Google لاستخدام الدعوات.",
    "google": "تسجيل الدخول باستخدام Google",
    "share": "مشاركة الدعوة",
    "accept": "قبول الدعوة",
    "bound": "تم قبول الدعوة. فز بأول لغز عبر الإنترنت لتحصل على مكافأتك.",
    "settled": "تم الحصول على مكافأة الدعوة.",
    "ineligible": "هذا الحساب لعب أو اشترى من قبل ولا يمكنه قبول دعوة.",
    "failed": "تعذر تحديث الدعوات. حاول مجددًا."
  },
  "id": {
    "title": "Undang teman",
    "details": "Undang pemain baru. Setelah masuk dengan Google dan menang dalam teka-teki daring pertamanya, kalian masing-masing dapat memperoleh {coins} koin, sesuai batas harian.",
    "googleRequired": "Masuk dengan Google untuk menggunakan undangan.",
    "google": "Masuk dengan Google",
    "share": "Bagikan undangan",
    "accept": "Terima undangan",
    "bound": "Undangan diterima. Menangkan teka-teki daring pertama untuk memperoleh hadiah.",
    "settled": "Hadiah undangan diperoleh.",
    "ineligible": "Akun ini sudah bermain atau membeli dan tidak dapat menerima undangan.",
    "failed": "Undangan tidak dapat diperbarui. Coba lagi."
  },
  "it": {
    "title": "Invita un amico",
    "details": "Invita un nuovo giocatore. Dopo l’accesso con Google e la prima vittoria in un enigma online, potrete ricevere {coins} monete ciascuno, entro i limiti giornalieri.",
    "googleRequired": "Accedi con Google per usare gli inviti.",
    "google": "Accedi con Google",
    "share": "Condividi invito",
    "accept": "Accetta invito",
    "bound": "Invito accettato. Vinci il tuo primo enigma online per ricevere la ricompensa.",
    "settled": "Ricompensa invito ricevuta.",
    "ineligible": "Questo account ha già giocato o acquistato e non può accettare un invito.",
    "failed": "Impossibile aggiornare gli inviti. Riprova."
  },
  "nl": {
    "title": "Nodig een vriend uit",
    "details": "Nodig een nieuwe speler uit. Na aanmelden met Google en de eerste gewonnen online puzzel kunnen jullie ieder {coins} munten krijgen, binnen dagelijkse limieten.",
    "googleRequired": "Meld je aan met Google om uitnodigingen te gebruiken.",
    "google": "Aanmelden met Google",
    "share": "Uitnodiging delen",
    "accept": "Uitnodiging accepteren",
    "bound": "Uitnodiging geaccepteerd. Win je eerste online puzzel om je beloning te krijgen.",
    "settled": "Uitnodigingsbeloning ontvangen.",
    "ineligible": "Dit account heeft al gespeeld of gekocht en kan geen uitnodiging accepteren.",
    "failed": "Uitnodigingen bijwerken mislukt. Probeer opnieuw."
  },
  "pl": {
    "title": "Zaproś znajomego",
    "details": "Zaproś nowego gracza. Po zalogowaniu przez Google i pierwszej wygranej zagadce online każde z was może otrzymać {coins} monet, w ramach limitów dziennych.",
    "googleRequired": "Zaloguj się przez Google, aby korzystać z zaproszeń.",
    "google": "Zaloguj się przez Google",
    "share": "Udostępnij zaproszenie",
    "accept": "Przyjmij zaproszenie",
    "bound": "Zaproszenie przyjęte. Wygraj pierwszą zagadkę online, aby odebrać nagrodę.",
    "settled": "Otrzymano nagrodę za zaproszenie.",
    "ineligible": "To konto już grało lub dokonało zakupu i nie może przyjąć zaproszenia.",
    "failed": "Nie udało się zaktualizować zaproszeń. Spróbuj ponownie."
  },
  "vi": {
    "title": "Mời bạn bè",
    "details": "Mời người chơi mới. Sau khi đăng nhập bằng Google và thắng câu đố trực tuyến đầu tiên, mỗi người có thể nhận {coins} xu, theo giới hạn hằng ngày.",
    "googleRequired": "Đăng nhập bằng Google để dùng lời mời.",
    "google": "Đăng nhập bằng Google",
    "share": "Chia sẻ lời mời",
    "accept": "Chấp nhận lời mời",
    "bound": "Đã chấp nhận lời mời. Thắng câu đố trực tuyến đầu tiên để nhận thưởng.",
    "settled": "Đã nhận thưởng lời mời.",
    "ineligible": "Tài khoản này đã chơi hoặc mua hàng nên không thể nhận lời mời.",
    "failed": "Không thể cập nhật lời mời. Hãy thử lại."
  }
} satisfies Record<YouTubeLocale, Record<string, string>>;
/** Retains referral copy for this operation. */
export const referralCopy = (locale: YouTubeLocale) => COPY[locale];
