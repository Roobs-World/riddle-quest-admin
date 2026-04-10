const EN_APP_STRINGS = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Join millions of people to play QWORDLY.",
      TAGLINE_2: "Ready to have fun while training your mind?",
      SIGN_IN_BUTTON: "Sign in",
      OR_SIGN_IN_WITH: "or Sign in with",
      NO_ACCOUNT_PROMPT: "Don't have an account? ",
    },
    Login: {
      TITLE: "Log in",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Enter your email",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "Enter your password",
      FORGOT_PASSWORD: "Forgot password?",
      LOGIN_BUTTON: "Log In",
      NO_ACCOUNT_PROMPT: "Don't have an account? ",
      REGISTER_NOW: "Register Now",
      INVALID_EMAIL_FORMAT_ERROR: "Invalid email format ✗",
      OR_LOGIN_WITH: "Or login with",
      CONTINUE_WITH_GOOGLE: "Continue with Google",
      CONTINUE_WITH_FACEBOOK: "Continue with Facebook",
      PASSWORD_CANNOT_BE_EMPTY: "Password cannot be empty",
      USER_NOT_FOUND_ERROR: "User not found. Please check your email.",
      WRONG_PASSWORD_ERROR: "Incorrect password. Please try again.",
      USER_DISABLED_ERROR: "This account has been disabled.",
      ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
        "Account exists with different credential. Please use a different login method.",
      OPERATION_NOT_SUPPORTED_ERROR:
        "Operation not supported in this environment.",
      LOGIN_FAILED_GENERIC: "Login failed. Please check your credentials.",
    },
    SignUp: {
      TITLE: "Create your account",
      USERNAME_LABEL: "Username",
      USERNAME_PLACEHOLDER: "Enter your username",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Enter your email",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "Enter your password",
      CONFIRM_PASSWORD_LABEL: "Confirm Password",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirm your password",
      PASSWORD_DOES_NOT_MATCH: "Passwords do not match ✗",
      PASSWORD_DOES_NOT_LONG_ENOUGH: "Password is too short ✗",
      PASSWORD_VALIDATION_GOOD: "Passwords match ✓",
      TERMS_AGREEMENT_PART1: "I agree to the ",
      TERMS_USER_AGREEMENT: "user agreement",
      TERMS_AGREEMENT_PART2: " and ",
      TERMS_PRIVACY_POLICY: "privacy policy",
      NEXT_BUTTON: "Next",
      HAS_ACCOUNT_PROMPT: "Do you have an account? ",
      LOGIN_NOW: "Log in now",
      USERNAME_CANNOT_BE_EMPTY: "Username cannot be empty",
      EMAIL_ALREADY_IN_USE_ERROR: "This email address is already in use.",
      INVALID_EMAIL_ERROR: "The email address is invalid.",
      OPERATION_NOT_ALLOWED_ERROR: "Email and password sign-up is not enabled.",
      WEAK_PASSWORD_ERROR: "The password is too weak.",
    },
    NewPassword: {
      TITLE: "Set New Password",
      NEW_PASSWORD_DESCRIPTION:
        "Reset your password to recovery & login to your account.",
      NEW_PASSWORD_LABEL: "New Password",
      NEW_PASSWORD_PLACEHOLDER: "Enter your new password",
      CONFIRM_PASSWORD_LABEL: "Confirm New Password",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirm your new password",
      SET_PASSWORD_BUTTON: "Confirm",
    },
  },
  Navigation: {
    LOGIN: "Login",
    SIGN_UP: "SignUp",
    LANDING: "Landing",
    FORGOT_PASSWORD: "ForgotPassword",
    NEW_PASSWORD: "NewPassword",
    GAME: "Game",
    CREDITS: "Credits",
    PLAY_BUTTON: "Play",
    PROFILE_BUTTON: "Profile",
    SETTINGS_BUTTON: "Settings",
    HINT_BUTTON: "Hint",
  },
  NavigationMessages: {
    NO_CLASSIC_RIDDLE_FOUND: "⚠️ No classic riddle found at index ",
    SERVER_GENERATES_RIDDLES:
      ". Server will generate new riddles automatically when you submit guesses.",
    ERROR_LOADING_NEXT_RIDDLE: "Error loading next classic riddle:",
  },
  Settings: {
    TITLE: "Settings",
    SOUND_TOGGLE: "Sound",
    HAPTICS_TOGGLE: "Haptics",
    HARD_MODE_TOGGLE: "Hard Mode",
    LANGUAGE_LABEL: "Language",
    HELP_BUTTON: "Help",
    LOGOUT_BUTTON: "Logout",
    CREDITS_BUTTON: "Credits",
    TEST_CRASH_BUTTON: "Test Crash",
    TEST_CRASH_ALERT_TITLE: "Test Crash",
    TEST_CRASH_ALERT_MESSAGE:
      "This will crash the app to test Firebase Crashlytics. Continue?",
    TEST_CRASH_ALERT_CANCEL: "Cancel",
    TEST_CRASH_ALERT_CRASH: "Crash",
    CLOSE_BUTTON: "Close",
    LOGOUT_ERROR_TITLE: "Error",
    LOGOUT_ERROR_MESSAGE: "Could not log out. Please try again.",
  },
  Credits: {
    TITLE: "Credits",
    SUBTITLE: "Meet the amazing team behind Qwordly",
    THANK_YOU_TITLE: "Thank You!",
    THANK_YOU_TEXT:
      "Special thanks to all our contributors who made Qwordly possible. Your creativity, dedication, and passion brought this project to life.",
  },
  Profile: {
    LOADING_MESSAGE: "Loading profile data...",
    TITLE: "Profile",
    USERNAME_LABEL: "Username:",
    SAVE_BUTTON: "Save",
    EDIT_BUTTON: "Edit",
    ACCOUNT_SETTINGS_TITLE: "Account Settings",
    CHANGE_PASSWORD_BUTTON: "Change Password",
    LINK_ACCOUNTS_BUTTON: "Link Accounts",
    STATS_TITLE: "Stats",
    DAILY_PUZZLES_STAT: "Daily Puzzles",
    BEST_STREAK_STAT: "Best Streak",
    WORDS_GUESSED_STAT: "Words Guessed",
    WIN_RATE_STAT: "Win Rate",
    AVG_GUESSES_STAT: "Avg. Guesses",
    TOTAL_SCORE_STAT: "Total Score",
    HIGHEST_CLASSIC_LEVEL_STAT: "Highest Classic Level",
    GAMES_PLAYED_STAT: "Games Played",
    TOTAL_WINS_STAT: "Total Wins",
    ALERT_ERROR_TITLE: "Error",
    ALERT_USERNAME_EMPTY: "Username cannot be empty.",
    ALERT_SUCCESS_TITLE: "Success",
    ALERT_USERNAME_UPDATE_SUCCESS: "Username updated successfully!",
    ALERT_USERNAME_UPDATE_FAIL: "Failed to update username. Please try again.",
    CHANGE_AVATAR_TITLE: "Change Avatar",
    SELECT_PRELOADED_AVATAR_SUBTITLE: "Select a Preloaded Avatar:",
    UPLOAD_CUSTOM_AVATAR_SUBTITLE: "Or Upload Your Own:",
    CHOOSE_FROM_GALLERY_BUTTON: "Choose from Gallery",
    CANCEL_BUTTON: "Cancel",
    ALERT_AVATAR_SELECT_FAIL: "Could not select avatar. Please try again.",
    ALERT_AVATAR_UPDATE_SUCCESS: "Avatar updated successfully!",
    ALERT_PRELOADED_AVATAR_SELECT_FAIL:
      "Failed to select preloaded avatar. Please try again.",
  },
  TestStrings: {
    MOCK_SVG_TEXT: "Mock SVG Text",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "You're out of guesses! Watch an ad to earn some coins?",
    WATCH_AD_BUTTON: "Watch Ad",
    NO_THANKS_BUTTON: "No Thanks",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Unable to load any riddles. Please check your connection and try again.",
  },
  GameMessages: {
    GAME_WON: "Game Won: Attempts - ",
    IN_MODE: " in ",
    MODE_SUFFIX: " mode.",
    COINS_EARNED: "Coins Earned: ",
    GAME_LOST: "Game Lost: Correct Answer - ",
    HINT_USED: "Hint Used: Cost - ",
    RETRY_BUTTON_PRESSED: "Retry button pressed",
  },
  LogMessages: {
    SHOWING_LOADING_SPINNER_USER_DATA:
      "⏳ Showing loading spinner - Loading user data...",
    TIMESTAMP: "timestamp:",
    SHOWING_LOADING_SPINNER_AUTH:
      "⏳ Showing loading spinner - authentication state being determined",
    NAVIGATION_RENDERING: "🧭 Navigation rendering - isAuthenticated:",
    IS_LOADING: "isLoading:",
    SHOWING_NAVIGATION_STACK: "🎯 Showing navigation stack - initialRoute:",
  },
  GameScreenAlerts: {
    SUBMIT_GUESS_ERROR_TITLE: "Error",
    SUBMIT_GUESS_ERROR_MESSAGE: "Could not submit guess. Please try again.",
    NOT_ENOUGH_COINS_TITLE: "Not enough coins",
    NOT_ENOUGH_COINS_MESSAGE: "You need more coins to use a hint.",
    HINT_ERROR_TITLE: "Error",
  },
  Achievements: {
    UNLOCKED_ALERT_TITLE: "Achievement(s) Unlocked!",
    UNLOCKED_ALERT_MESSAGE: "Check your profile to see your new achievements.",
    UNLOCKED_ALERT_OK: "OK",
  },
} as const;
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type WidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends object
        ? { [K in keyof T]: WidenLiteral<T[K]> }
        : T;

export type AppStringsSchema = WidenLiteral<typeof EN_APP_STRINGS>;
export type SupportedLanguage =
  | "en"
  | "es"
  | "pt"
  | "fr"
  | "de"
  | "ja"
  | "ko"
  | "zh"
  | "ru"
  | "tr";

export const SUPPORTED_LANGUAGES: ReadonlyArray<SupportedLanguage> = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
  "zh",
  "ru",
  "tr",
] as const;

export const APP_LANGUAGE_STORAGE_KEY = "appLanguage";

export const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: SupportedLanguage;
  label: string;
}> = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "简体中文" },
  { code: "ru", label: "Русский" },
  { code: "tr", label: "Türkçe" },
] as const;

const esOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Unete a millones de personas para jugar QWORDLY.",
      TAGLINE_2: "Listo para divertirte mientras entrenas tu mente?",
      SIGN_IN_BUTTON: "Iniciar sesion",
      OR_SIGN_IN_WITH: "o inicia sesion con",
      NO_ACCOUNT_PROMPT: "No tienes una cuenta? ",
    },
    Login: {
      TITLE: "Iniciar sesion",
      EMAIL_LABEL: "Correo",
      EMAIL_PLACEHOLDER: "Ingresa tu correo",
      PASSWORD_LABEL: "Contrasena",
      PASSWORD_PLACEHOLDER: "Ingresa tu contrasena",
      FORGOT_PASSWORD: "Olvidaste tu contrasena?",
      LOGIN_BUTTON: "Entrar",
      NO_ACCOUNT_PROMPT: "No tienes una cuenta? ",
      REGISTER_NOW: "Registrate ahora",
    },
    SignUp: {
      TITLE: "Crea tu cuenta",
      USERNAME_LABEL: "Nombre de usuario",
      USERNAME_PLACEHOLDER: "Ingresa tu nombre de usuario",
      EMAIL_LABEL: "Correo",
      EMAIL_PLACEHOLDER: "Ingresa tu correo",
      PASSWORD_LABEL: "Contrasena",
      PASSWORD_PLACEHOLDER: "Ingresa tu contrasena",
      CONFIRM_PASSWORD_LABEL: "Confirmar contrasena",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirma tu contrasena",
      NEXT_BUTTON: "Siguiente",
      HAS_ACCOUNT_PROMPT: "Ya tienes una cuenta? ",
      LOGIN_NOW: "Inicia sesion",
    },
  },
  Settings: {
    TITLE: "Configuracion",
    SOUND_TOGGLE: "Sonido",
    HAPTICS_TOGGLE: "Vibracion",
    HARD_MODE_TOGGLE: "Modo dificil",
    LANGUAGE_LABEL: "Idioma",
    HELP_BUTTON: "Ayuda",
    LOGOUT_BUTTON: "Cerrar sesion",
    CREDITS_BUTTON: "Creditos",
    CLOSE_BUTTON: "Cerrar",
  },
  Profile: {
    TITLE: "Perfil",
    SAVE_BUTTON: "Guardar",
    EDIT_BUTTON: "Editar",
    STATS_TITLE: "Estadisticas",
  },
};

const ptOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Junte-se a milhoes de pessoas para jogar QWORDLY.",
      TAGLINE_2: "Pronto para se divertir enquanto treina sua mente?",
      SIGN_IN_BUTTON: "Entrar",
      OR_SIGN_IN_WITH: "ou entre com",
      NO_ACCOUNT_PROMPT: "Nao tem conta? ",
    },
    Login: {
      TITLE: "Entrar",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Digite seu email",
      PASSWORD_LABEL: "Senha",
      PASSWORD_PLACEHOLDER: "Digite sua senha",
      FORGOT_PASSWORD: "Esqueceu a senha?",
      LOGIN_BUTTON: "Entrar",
      NO_ACCOUNT_PROMPT: "Nao tem conta? ",
      REGISTER_NOW: "Cadastre-se agora",
      OR_LOGIN_WITH: "Ou entre com",
      CONTINUE_WITH_GOOGLE: "Continuar com Google",
      CONTINUE_WITH_FACEBOOK: "Continuar com Facebook",
      PASSWORD_CANNOT_BE_EMPTY: "A senha nao pode estar vazia",
      USER_NOT_FOUND_ERROR: "Usuario nao encontrado. Verifique seu email.",
      WRONG_PASSWORD_ERROR: "Senha incorreta. Tente novamente.",
      USER_DISABLED_ERROR: "Esta conta foi desativada.",
      ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
        "Conta existente com outra credencial. Use outro metodo de login.",
      OPERATION_NOT_SUPPORTED_ERROR:
        "Operacao nao suportada neste ambiente.",
      LOGIN_FAILED_GENERIC: "Falha no login. Verifique suas credenciais.",
    },
    SignUp: {
      TITLE: "Crie sua conta",
      USERNAME_LABEL: "Nome de usuario",
      USERNAME_PLACEHOLDER: "Digite seu nome de usuario",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Digite seu email",
      PASSWORD_LABEL: "Senha",
      PASSWORD_PLACEHOLDER: "Digite sua senha",
      CONFIRM_PASSWORD_LABEL: "Confirmar senha",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirme sua senha",
      PASSWORD_DOES_NOT_MATCH: "As senhas nao coincidem x",
      PASSWORD_DOES_NOT_LONG_ENOUGH: "A senha e muito curta x",
      PASSWORD_VALIDATION_GOOD: "As senhas coincidem",
      TERMS_AGREEMENT_PART1: "Eu concordo com o ",
      TERMS_USER_AGREEMENT: "acordo do usuario",
      TERMS_AGREEMENT_PART2: " e ",
      TERMS_PRIVACY_POLICY: "politica de privacidade",
      NEXT_BUTTON: "Proximo",
      HAS_ACCOUNT_PROMPT: "Ja tem conta? ",
      LOGIN_NOW: "Entrar agora",
      USERNAME_CANNOT_BE_EMPTY: "Nome de usuario nao pode estar vazio",
      EMAIL_ALREADY_IN_USE_ERROR: "Este email ja esta em uso.",
      INVALID_EMAIL_ERROR: "O email e invalido.",
      OPERATION_NOT_ALLOWED_ERROR: "Cadastro com email e senha nao habilitado.",
      WEAK_PASSWORD_ERROR: "A senha e fraca.",
    },
    NewPassword: {
      TITLE: "Definir nova senha",
      NEW_PASSWORD_DESCRIPTION:
        "Redefina sua senha para recuperar e entrar na sua conta.",
      NEW_PASSWORD_LABEL: "Nova senha",
      NEW_PASSWORD_PLACEHOLDER: "Digite sua nova senha",
      CONFIRM_PASSWORD_LABEL: "Confirmar nova senha",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirme sua nova senha",
      SET_PASSWORD_BUTTON: "Confirmar",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Jogar",
    PROFILE_BUTTON: "Perfil",
    SETTINGS_BUTTON: "Configuracoes",
    HINT_BUTTON: "Dica",
  },
  NavigationMessages: {
    NO_CLASSIC_RIDDLE_FOUND: "Nenhum enigma classico no indice ",
    SERVER_GENERATES_RIDDLES:
      ". O servidor gera novos enigmas quando voce envia tentativas.",
    ERROR_LOADING_NEXT_RIDDLE: "Erro ao carregar o proximo enigma classico:",
  },
  Settings: {
    TITLE: "Configuracoes",
    SOUND_TOGGLE: "Som",
    HAPTICS_TOGGLE: "Haptica",
    HARD_MODE_TOGGLE: "Modo dificil",
    LANGUAGE_LABEL: "Idioma",
    HELP_BUTTON: "Ajuda",
    LOGOUT_BUTTON: "Sair",
    CREDITS_BUTTON: "Creditos",
    TEST_CRASH_BUTTON: "Testar falha",
    TEST_CRASH_ALERT_TITLE: "Testar falha",
    TEST_CRASH_ALERT_MESSAGE:
      "Isso vai travar o app para testar o Crashlytics. Continuar?",
    TEST_CRASH_ALERT_CANCEL: "Cancelar",
    TEST_CRASH_ALERT_CRASH: "Falhar",
    CLOSE_BUTTON: "Fechar",
    LOGOUT_ERROR_TITLE: "Erro",
    LOGOUT_ERROR_MESSAGE: "Nao foi possivel sair. Tente novamente.",
  },
  Credits: {
    TITLE: "Creditos",
    SUBTITLE: "Conheca a equipe incrivel por tras do Qwordly",
    THANK_YOU_TITLE: "Obrigado!",
    THANK_YOU_TEXT:
      "Agradecimento especial a todos os contribuidores que tornaram o Qwordly possivel.",
  },
  Profile: {
    LOADING_MESSAGE: "Carregando dados do perfil...",
    TITLE: "Perfil",
    USERNAME_LABEL: "Nome de usuario:",
    SAVE_BUTTON: "Salvar",
    EDIT_BUTTON: "Editar",
    ACCOUNT_SETTINGS_TITLE: "Configuracoes da conta",
    CHANGE_PASSWORD_BUTTON: "Alterar senha",
    LINK_ACCOUNTS_BUTTON: "Vincular contas",
    STATS_TITLE: "Estatisticas",
    DAILY_PUZZLES_STAT: "Desafios diarios",
    BEST_STREAK_STAT: "Melhor sequencia",
    WORDS_GUESSED_STAT: "Palavras acertadas",
    WIN_RATE_STAT: "Taxa de vitoria",
    AVG_GUESSES_STAT: "Media de tentativas",
    TOTAL_SCORE_STAT: "Pontuacao total",
    HIGHEST_CLASSIC_LEVEL_STAT: "Maior nivel classico",
    GAMES_PLAYED_STAT: "Partidas jogadas",
    TOTAL_WINS_STAT: "Total de vitorias",
    ALERT_ERROR_TITLE: "Erro",
    ALERT_USERNAME_EMPTY: "Nome de usuario nao pode estar vazio.",
    ALERT_SUCCESS_TITLE: "Sucesso",
    ALERT_USERNAME_UPDATE_SUCCESS: "Nome de usuario atualizado com sucesso!",
    ALERT_USERNAME_UPDATE_FAIL:
      "Falha ao atualizar nome de usuario. Tente novamente.",
    CHANGE_AVATAR_TITLE: "Alterar avatar",
    SELECT_PRELOADED_AVATAR_SUBTITLE: "Selecione um avatar pre-carregado:",
    UPLOAD_CUSTOM_AVATAR_SUBTITLE: "Ou envie o seu:",
    CHOOSE_FROM_GALLERY_BUTTON: "Escolher da galeria",
    CANCEL_BUTTON: "Cancelar",
    ALERT_AVATAR_SELECT_FAIL: "Nao foi possivel selecionar avatar.",
    ALERT_AVATAR_UPDATE_SUCCESS: "Avatar atualizado com sucesso!",
    ALERT_PRELOADED_AVATAR_SELECT_FAIL:
      "Falha ao selecionar avatar pre-carregado.",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT: "Sem tentativas! Assistir anuncio para ganhar moedas?",
    WATCH_AD_BUTTON: "Ver anuncio",
    NO_THANKS_BUTTON: "Agora nao",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Nao foi possivel carregar enigmas. Verifique sua conexao.",
  },
  GameMessages: {
    GAME_WON: "Vitoria: Tentativas - ",
    IN_MODE: " em ",
    MODE_SUFFIX: " modo.",
    COINS_EARNED: "Moedas ganhas: ",
    GAME_LOST: "Derrota: Resposta correta - ",
    HINT_USED: "Dica usada: Custo - ",
    RETRY_BUTTON_PRESSED: "Botao tentar novamente pressionado",
  },
  GameScreenAlerts: {
    SUBMIT_GUESS_ERROR_TITLE: "Erro",
    SUBMIT_GUESS_ERROR_MESSAGE: "Nao foi possivel enviar tentativa.",
    NOT_ENOUGH_COINS_TITLE: "Moedas insuficientes",
    NOT_ENOUGH_COINS_MESSAGE: "Voce precisa de mais moedas para usar dica.",
    HINT_ERROR_TITLE: "Erro",
  },
  Achievements: {
    UNLOCKED_ALERT_TITLE: "Conquista(s) desbloqueada(s)!",
    UNLOCKED_ALERT_MESSAGE: "Veja seu perfil para ver novas conquistas.",
    UNLOCKED_ALERT_OK: "OK",
  },
};

const frOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Rejoignez des millions de joueurs sur QWORDLY.",
      TAGLINE_2: "Pret a vous amuser en entrainant votre esprit?",
      SIGN_IN_BUTTON: "Se connecter",
      OR_SIGN_IN_WITH: "ou se connecter avec",
      NO_ACCOUNT_PROMPT: "Pas de compte? ",
    },
    Login: {
      TITLE: "Connexion",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Entrez votre email",
      PASSWORD_LABEL: "Mot de passe",
      PASSWORD_PLACEHOLDER: "Entrez votre mot de passe",
      FORGOT_PASSWORD: "Mot de passe oublie?",
      LOGIN_BUTTON: "Se connecter",
      NO_ACCOUNT_PROMPT: "Pas de compte? ",
      REGISTER_NOW: "Inscrivez-vous",
      INVALID_EMAIL_FORMAT_ERROR: "Format email invalide",
      OR_LOGIN_WITH: "Ou connectez-vous avec",
      CONTINUE_WITH_GOOGLE: "Continuer avec Google",
      CONTINUE_WITH_FACEBOOK: "Continuer avec Facebook",
      PASSWORD_CANNOT_BE_EMPTY: "Le mot de passe ne peut pas etre vide",
      USER_NOT_FOUND_ERROR: "Utilisateur introuvable. Verifiez votre email.",
      WRONG_PASSWORD_ERROR: "Mot de passe incorrect. Reessayez.",
      USER_DISABLED_ERROR: "Ce compte est desactive.",
      ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
        "Un compte existe deja avec un autre mode de connexion.",
      OPERATION_NOT_SUPPORTED_ERROR:
        "Operation non prise en charge dans cet environnement.",
      LOGIN_FAILED_GENERIC:
        "Echec de connexion. Verifiez vos identifiants.",
    },
    SignUp: {
      TITLE: "Creez votre compte",
      USERNAME_LABEL: "Nom d utilisateur",
      USERNAME_PLACEHOLDER: "Entrez votre nom d utilisateur",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Entrez votre email",
      PASSWORD_LABEL: "Mot de passe",
      PASSWORD_PLACEHOLDER: "Entrez votre mot de passe",
      CONFIRM_PASSWORD_LABEL: "Confirmer le mot de passe",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirmez votre mot de passe",
      PASSWORD_DOES_NOT_MATCH: "Les mots de passe ne correspondent pas",
      PASSWORD_DOES_NOT_LONG_ENOUGH: "Mot de passe trop court",
      PASSWORD_VALIDATION_GOOD: "Mots de passe valides",
      TERMS_AGREEMENT_PART1: "J accepte le ",
      TERMS_USER_AGREEMENT: "contrat utilisateur",
      TERMS_AGREEMENT_PART2: " et la ",
      TERMS_PRIVACY_POLICY: "politique de confidentialite",
      NEXT_BUTTON: "Suivant",
      HAS_ACCOUNT_PROMPT: "Vous avez deja un compte? ",
      LOGIN_NOW: "Se connecter",
      USERNAME_CANNOT_BE_EMPTY: "Le nom d utilisateur ne peut pas etre vide",
      EMAIL_ALREADY_IN_USE_ERROR: "Cet email est deja utilise.",
      INVALID_EMAIL_ERROR: "Adresse email invalide.",
      OPERATION_NOT_ALLOWED_ERROR:
        "Inscription email et mot de passe non activee.",
      WEAK_PASSWORD_ERROR: "Mot de passe trop faible.",
    },
    NewPassword: {
      TITLE: "Definir un nouveau mot de passe",
      NEW_PASSWORD_DESCRIPTION:
        "Reinitialisez votre mot de passe pour recuperer votre compte.",
      NEW_PASSWORD_LABEL: "Nouveau mot de passe",
      NEW_PASSWORD_PLACEHOLDER: "Entrez votre nouveau mot de passe",
      CONFIRM_PASSWORD_LABEL: "Confirmer le nouveau mot de passe",
      CONFIRM_PASSWORD_PLACEHOLDER: "Confirmez votre nouveau mot de passe",
      SET_PASSWORD_BUTTON: "Confirmer",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Jouer",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Parametres",
    HINT_BUTTON: "Indice",
  },
  Settings: {
    TITLE: "Parametres",
    SOUND_TOGGLE: "Son",
    HAPTICS_TOGGLE: "Haptique",
    HARD_MODE_TOGGLE: "Mode difficile",
    LANGUAGE_LABEL: "Langue",
    HELP_BUTTON: "Aide",
    LOGOUT_BUTTON: "Se deconnecter",
    CREDITS_BUTTON: "Credits",
    CLOSE_BUTTON: "Fermer",
    LOGOUT_ERROR_TITLE: "Erreur",
    LOGOUT_ERROR_MESSAGE: "Impossible de se deconnecter. Reessayez.",
  },
  Credits: {
    TITLE: "Credits",
    SUBTITLE: "Decouvrez l equipe incroyable de Qwordly",
    THANK_YOU_TITLE: "Merci!",
  },
  Profile: {
    LOADING_MESSAGE: "Chargement du profil...",
    TITLE: "Profil",
    USERNAME_LABEL: "Nom d utilisateur:",
    SAVE_BUTTON: "Enregistrer",
    EDIT_BUTTON: "Modifier",
    ACCOUNT_SETTINGS_TITLE: "Parametres du compte",
    CHANGE_PASSWORD_BUTTON: "Changer le mot de passe",
    LINK_ACCOUNTS_BUTTON: "Lier des comptes",
    STATS_TITLE: "Statistiques",
    DAILY_PUZZLES_STAT: "Defis quotidiens",
    BEST_STREAK_STAT: "Meilleure serie",
    WORDS_GUESSED_STAT: "Mots trouves",
    WIN_RATE_STAT: "Taux de victoire",
    AVG_GUESSES_STAT: "Moyenne d essais",
    TOTAL_SCORE_STAT: "Score total",
    HIGHEST_CLASSIC_LEVEL_STAT: "Niveau classique max",
    GAMES_PLAYED_STAT: "Parties jouees",
    TOTAL_WINS_STAT: "Victoires totales",
    ALERT_ERROR_TITLE: "Erreur",
    ALERT_SUCCESS_TITLE: "Succes",
    ALERT_USERNAME_EMPTY: "Le nom d utilisateur ne peut pas etre vide.",
    ALERT_USERNAME_UPDATE_SUCCESS:
      "Le nom d utilisateur a ete mis a jour avec succes!",
    ALERT_USERNAME_UPDATE_FAIL:
      "Echec de mise a jour du nom d utilisateur. Reessayez.",
    CHANGE_AVATAR_TITLE: "Changer d avatar",
    SELECT_PRELOADED_AVATAR_SUBTITLE: "Selectionnez un avatar precharge:",
    UPLOAD_CUSTOM_AVATAR_SUBTITLE: "Ou telechargez le votre:",
    CHOOSE_FROM_GALLERY_BUTTON: "Choisir dans la galerie",
    CANCEL_BUTTON: "Annuler",
    ALERT_AVATAR_SELECT_FAIL: "Impossible de selectionner l avatar.",
    ALERT_AVATAR_UPDATE_SUCCESS: "Avatar mis a jour avec succes!",
    ALERT_PRELOADED_AVATAR_SELECT_FAIL:
      "Echec de selection de l avatar precharge.",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "Plus d essais! Regarder une pub pour gagner des pieces?",
    WATCH_AD_BUTTON: "Regarder la pub",
    NO_THANKS_BUTTON: "Non merci",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Impossible de charger les enigmes. Verifiez votre connexion.",
  },
  GameScreenAlerts: {
    SUBMIT_GUESS_ERROR_TITLE: "Erreur",
    SUBMIT_GUESS_ERROR_MESSAGE: "Impossible d envoyer la proposition.",
    NOT_ENOUGH_COINS_TITLE: "Pieces insuffisantes",
    NOT_ENOUGH_COINS_MESSAGE: "Vous avez besoin de plus de pieces.",
    HINT_ERROR_TITLE: "Erreur",
  },
  GameMessages: {
    GAME_WON: "Partie gagnee: Essais - ",
    IN_MODE: " en mode ",
    MODE_SUFFIX: ".",
    COINS_EARNED: "Pieces gagnees: ",
    GAME_LOST: "Partie perdue: Reponse - ",
    HINT_USED: "Indice utilise: Cout - ",
    RETRY_BUTTON_PRESSED: "Bouton recommencer presse",
  },
  Achievements: {
    UNLOCKED_ALERT_TITLE: "Succes debloque(s)!",
    UNLOCKED_ALERT_MESSAGE: "Consultez votre profil pour voir vos succes.",
    UNLOCKED_ALERT_OK: "OK",
  },
};

const deOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Spiele mit Millionen Menschen QWORDLY.",
      TAGLINE_2: "Bereit fur Spass und Gehirntraining?",
      SIGN_IN_BUTTON: "Anmelden",
      OR_SIGN_IN_WITH: "oder anmelden mit",
      NO_ACCOUNT_PROMPT: "Noch kein Konto? ",
    },
    Login: {
      TITLE: "Anmelden",
      EMAIL_LABEL: "E-Mail",
      EMAIL_PLACEHOLDER: "E-Mail eingeben",
      PASSWORD_LABEL: "Passwort",
      PASSWORD_PLACEHOLDER: "Passwort eingeben",
      FORGOT_PASSWORD: "Passwort vergessen?",
      LOGIN_BUTTON: "Anmelden",
      NO_ACCOUNT_PROMPT: "Noch kein Konto? ",
      REGISTER_NOW: "Jetzt registrieren",
      OR_LOGIN_WITH: "Oder anmelden mit",
      INVALID_EMAIL_FORMAT_ERROR: "Ungueltiges E-Mail-Format",
      LOGIN_FAILED_GENERIC: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
    },
    SignUp: {
      TITLE: "Konto erstellen",
      USERNAME_LABEL: "Benutzername",
      USERNAME_PLACEHOLDER: "Benutzernamen eingeben",
      EMAIL_LABEL: "E-Mail",
      EMAIL_PLACEHOLDER: "E-Mail eingeben",
      PASSWORD_LABEL: "Passwort",
      PASSWORD_PLACEHOLDER: "Passwort eingeben",
      CONFIRM_PASSWORD_LABEL: "Passwort bestaetigen",
      CONFIRM_PASSWORD_PLACEHOLDER: "Passwort erneut eingeben",
      NEXT_BUTTON: "Weiter",
      HAS_ACCOUNT_PROMPT: "Haben Sie bereits ein Konto? ",
      LOGIN_NOW: "Jetzt anmelden",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Spielen",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Einstellungen",
    HINT_BUTTON: "Hinweis",
  },
  Settings: {
    TITLE: "Einstellungen",
    SOUND_TOGGLE: "Ton",
    HAPTICS_TOGGLE: "Haptik",
    HARD_MODE_TOGGLE: "Schwerer Modus",
    LANGUAGE_LABEL: "Sprache",
    HELP_BUTTON: "Hilfe",
    LOGOUT_BUTTON: "Abmelden",
    CREDITS_BUTTON: "Credits",
    CLOSE_BUTTON: "Schliessen",
    LOGOUT_ERROR_TITLE: "Fehler",
    LOGOUT_ERROR_MESSAGE: "Abmelden fehlgeschlagen. Bitte erneut versuchen.",
  },
  Profile: {
    LOADING_MESSAGE: "Profildaten werden geladen...",
    TITLE: "Profil",
    USERNAME_LABEL: "Benutzername:",
    SAVE_BUTTON: "Speichern",
    EDIT_BUTTON: "Bearbeiten",
    STATS_TITLE: "Statistiken",
    CHANGE_PASSWORD_BUTTON: "Passwort aendern",
    CHANGE_AVATAR_TITLE: "Avatar aendern",
    CHOOSE_FROM_GALLERY_BUTTON: "Aus Galerie waehlen",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Raetsel konnten nicht geladen werden. Verbindung pruefen.",
  },
  GameScreenAlerts: {
    SUBMIT_GUESS_ERROR_TITLE: "Fehler",
    SUBMIT_GUESS_ERROR_MESSAGE:
      "Tipp konnte nicht gesendet werden. Bitte erneut versuchen.",
    NOT_ENOUGH_COINS_TITLE: "Nicht genug Muenzen",
    NOT_ENOUGH_COINS_MESSAGE: "Sie brauchen mehr Muenzen fuer einen Hinweis.",
    HINT_ERROR_TITLE: "Fehler",
  },
};

const jaOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "何百万人ものユーザーと一緒にQWORDLYを楽しもう。",
      TAGLINE_2: "遊びながら頭を鍛える準備はできていますか？",
      SIGN_IN_BUTTON: "ログイン",
      OR_SIGN_IN_WITH: "または",
      NO_ACCOUNT_PROMPT: "アカウントをお持ちでないですか？ ",
    },
    Login: {
      TITLE: "ログイン",
      EMAIL_LABEL: "メールアドレス",
      EMAIL_PLACEHOLDER: "メールアドレスを入力",
      PASSWORD_LABEL: "パスワード",
      PASSWORD_PLACEHOLDER: "パスワードを入力",
      FORGOT_PASSWORD: "パスワードをお忘れですか？",
      LOGIN_BUTTON: "ログイン",
      REGISTER_NOW: "今すぐ登録",
    },
    SignUp: {
      TITLE: "アカウント作成",
      USERNAME_LABEL: "ユーザー名",
      USERNAME_PLACEHOLDER: "ユーザー名を入力",
      NEXT_BUTTON: "次へ",
      LOGIN_NOW: "ログイン",
    },
    NewPassword: {
      TITLE: "新しいパスワードを設定",
      SET_PASSWORD_BUTTON: "確認",
    },
  },
  Navigation: {
    PLAY_BUTTON: "プレイ",
    PROFILE_BUTTON: "プロフィール",
    SETTINGS_BUTTON: "設定",
    HINT_BUTTON: "ヒント",
  },
  Settings: {
    TITLE: "設定",
    SOUND_TOGGLE: "サウンド",
    HAPTICS_TOGGLE: "触覚",
    HARD_MODE_TOGGLE: "ハードモード",
    LANGUAGE_LABEL: "言語",
    HELP_BUTTON: "ヘルプ",
    LOGOUT_BUTTON: "ログアウト",
    CREDITS_BUTTON: "クレジット",
    CLOSE_BUTTON: "閉じる",
  },
  Profile: {
    TITLE: "プロフィール",
    SAVE_BUTTON: "保存",
    EDIT_BUTTON: "編集",
    STATS_TITLE: "統計",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "推測回数がなくなりました。広告を見てコインを獲得しますか？",
    WATCH_AD_BUTTON: "広告を見る",
    NO_THANKS_BUTTON: "結構です",
  },
};

const koOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "수백만 명과 함께 QWORDLY를 즐겨보세요.",
      TAGLINE_2: "재미있게 두뇌를 훈련할 준비가 되셨나요?",
      SIGN_IN_BUTTON: "로그인",
      OR_SIGN_IN_WITH: "또는",
      NO_ACCOUNT_PROMPT: "계정이 없으신가요? ",
    },
    Login: {
      TITLE: "로그인",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "이메일 입력",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "비밀번호 입력",
      FORGOT_PASSWORD: "비밀번호를 잊으셨나요?",
      LOGIN_BUTTON: "로그인",
      REGISTER_NOW: "지금 가입",
    },
    SignUp: {
      TITLE: "계정 만들기",
      USERNAME_LABEL: "Username",
      USERNAME_PLACEHOLDER: "사용자 이름 입력",
      NEXT_BUTTON: "다음",
      LOGIN_NOW: "로그인",
    },
  },
  Navigation: {
    PLAY_BUTTON: "플레이",
    PROFILE_BUTTON: "프로필",
    SETTINGS_BUTTON: "설정",
    HINT_BUTTON: "힌트",
  },
  Settings: {
    TITLE: "설정",
    SOUND_TOGGLE: "사운드",
    HAPTICS_TOGGLE: "햅틱",
    HARD_MODE_TOGGLE: "하드 모드",
    LANGUAGE_LABEL: "언어",
    HELP_BUTTON: "도움말",
    LOGOUT_BUTTON: "로그아웃",
    CREDITS_BUTTON: "크레딧",
    CLOSE_BUTTON: "닫기",
  },
  Profile: {
    TITLE: "프로필",
    SAVE_BUTTON: "저장",
    EDIT_BUTTON: "편집",
    STATS_TITLE: "통계",
  },
};

const zhOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "加入数百万人一起玩QWORDLY。",
      TAGLINE_2: "准备好在娱乐中锻炼思维了吗？",
      SIGN_IN_BUTTON: "登录",
      OR_SIGN_IN_WITH: "或使用",
      NO_ACCOUNT_PROMPT: "还没有账号？ ",
    },
    Login: {
      TITLE: "登录",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "请输入邮箱",
      PASSWORD_LABEL: "Password",
      PASSWORD_PLACEHOLDER: "请输入密码",
      FORGOT_PASSWORD: "忘记密码？",
      LOGIN_BUTTON: "登录",
      REGISTER_NOW: "立即注册",
    },
    SignUp: {
      TITLE: "创建账号",
      USERNAME_LABEL: "Username",
      USERNAME_PLACEHOLDER: "请输入用户名",
      NEXT_BUTTON: "下一步",
      LOGIN_NOW: "登录",
    },
  },
  Navigation: {
    PLAY_BUTTON: "开始",
    PROFILE_BUTTON: "个人资料",
    SETTINGS_BUTTON: "设置",
    HINT_BUTTON: "提示",
  },
  Settings: {
    TITLE: "设置",
    SOUND_TOGGLE: "声音",
    HAPTICS_TOGGLE: "震动",
    HARD_MODE_TOGGLE: "困难模式",
    LANGUAGE_LABEL: "语言",
    HELP_BUTTON: "帮助",
    LOGOUT_BUTTON: "退出登录",
    CREDITS_BUTTON: "制作名单",
    CLOSE_BUTTON: "关闭",
  },
  Profile: {
    TITLE: "个人资料",
    SAVE_BUTTON: "保存",
    EDIT_BUTTON: "编辑",
    STATS_TITLE: "统计",
  },
};

const ruOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "Prisoedinyaites k millionam igrokov QWORDLY.",
      TAGLINE_2: "Gotovy veselitsya i trenirovat um?",
      SIGN_IN_BUTTON: "Voiti",
      OR_SIGN_IN_WITH: "ili voiti cherez",
      NO_ACCOUNT_PROMPT: "Net akkaunta? ",
    },
    Login: {
      TITLE: "Vhod",
      EMAIL_LABEL: "Email",
      EMAIL_PLACEHOLDER: "Vvedite email",
      PASSWORD_LABEL: "Parol",
      PASSWORD_PLACEHOLDER: "Vvedite parol",
      FORGOT_PASSWORD: "Zabyli parol?",
      LOGIN_BUTTON: "Voiti",
      REGISTER_NOW: "Zaregistrirovatsya",
    },
    SignUp: {
      TITLE: "Sozdat akkaunt",
      USERNAME_LABEL: "Imya polzovatelya",
      USERNAME_PLACEHOLDER: "Vvedite imya polzovatelya",
      NEXT_BUTTON: "Dalee",
      LOGIN_NOW: "Voiti",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Igrat",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Nastroiki",
    HINT_BUTTON: "Podskazka",
  },
  Settings: {
    TITLE: "Nastroiki",
    SOUND_TOGGLE: "Zvuk",
    HAPTICS_TOGGLE: "Vibratsiya",
    HARD_MODE_TOGGLE: "Slozhnyi rezhim",
    LANGUAGE_LABEL: "Yazyk",
    HELP_BUTTON: "Pomoshch",
    LOGOUT_BUTTON: "Vyiiti",
    CREDITS_BUTTON: "Avtory",
    CLOSE_BUTTON: "Zakryt",
  },
  Profile: {
    TITLE: "Profil",
    SAVE_BUTTON: "Sohranit",
    EDIT_BUTTON: "Izmenit",
    STATS_TITLE: "Statistika",
    CHANGE_PASSWORD_BUTTON: "Smenit parol",
  },
  ErrorMessages: {
    UNABLE_TO_LOAD_RIDDLES:
      "Ne udalos zagruzit zagadki. Proverte soedinenie.",
  },
};

const trOverrides: DeepPartial<AppStringsSchema> = {
  AuthStrings: {
    Landing: {
      TAGLINE_1: "QWORDLY oynamak icin milyonlara katilin.",
      TAGLINE_2: "Eglenceli sekilde zihninizi calistirmaya hazir misiniz?",
      SIGN_IN_BUTTON: "Giris yap",
      OR_SIGN_IN_WITH: "veya su ile giris yap",
      NO_ACCOUNT_PROMPT: "Hesabin yok mu? ",
    },
    Login: {
      TITLE: "Giris",
      EMAIL_LABEL: "E-posta",
      EMAIL_PLACEHOLDER: "E-postanizi girin",
      PASSWORD_LABEL: "Sifre",
      PASSWORD_PLACEHOLDER: "Sifrenizi girin",
      FORGOT_PASSWORD: "Sifrenizi mi unuttunuz?",
      LOGIN_BUTTON: "Giris Yap",
      NO_ACCOUNT_PROMPT: "Hesabin yok mu? ",
      REGISTER_NOW: "Hemen kaydol",
    },
    SignUp: {
      TITLE: "Hesabini olustur",
      USERNAME_LABEL: "Kullanici adi",
      USERNAME_PLACEHOLDER: "Kullanici adini gir",
      EMAIL_LABEL: "E-posta",
      EMAIL_PLACEHOLDER: "E-postani gir",
      PASSWORD_LABEL: "Sifre",
      PASSWORD_PLACEHOLDER: "Sifreni gir",
      CONFIRM_PASSWORD_LABEL: "Sifreyi Onayla",
      CONFIRM_PASSWORD_PLACEHOLDER: "Sifreni tekrar gir",
      NEXT_BUTTON: "Ileri",
      HAS_ACCOUNT_PROMPT: "Zaten hesabin var mi? ",
      LOGIN_NOW: "Simdi giris yap",
    },
  },
  Navigation: {
    PLAY_BUTTON: "Oyna",
    PROFILE_BUTTON: "Profil",
    SETTINGS_BUTTON: "Ayarlar",
    HINT_BUTTON: "Ipucu",
  },
  Settings: {
    TITLE: "Ayarlar",
    SOUND_TOGGLE: "Ses",
    HAPTICS_TOGGLE: "Titresim",
    HARD_MODE_TOGGLE: "Zor Mod",
    LANGUAGE_LABEL: "Dil",
    HELP_BUTTON: "Yardim",
    LOGOUT_BUTTON: "Cikis yap",
    CREDITS_BUTTON: "Ekip",
    CLOSE_BUTTON: "Kapat",
  },
  Profile: {
    TITLE: "Profil",
    SAVE_BUTTON: "Kaydet",
    EDIT_BUTTON: "Duzenle",
    STATS_TITLE: "Istatistikler",
    CHANGE_PASSWORD_BUTTON: "Sifre Degistir",
  },
  RewardedAdPrompts: {
    OUT_OF_GUESSES_PROMPT:
      "Tahmin hakkin bitti! Para kazanmak icin reklam izler misin?",
    WATCH_AD_BUTTON: "Reklam izle",
    NO_THANKS_BUTTON: "Hayir tesekkurler",
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const deepMerge = <T extends Record<string, unknown>>(
  base: T,
  overrides?: DeepPartial<T>
): T => {
  if (!overrides) {
    return base;
  }

  const output: Record<string, unknown> = { ...base };

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const baseValue = output[key];

    if (isPlainObject(baseValue) && isPlainObject(value)) {
      output[key] = deepMerge(
        baseValue as Record<string, unknown>,
        value as DeepPartial<Record<string, unknown>>
      );
      return;
    }

    output[key] = value;
  });

  return output as T;
};

const localizedStrings: Record<SupportedLanguage, AppStringsSchema> = {
  en: EN_APP_STRINGS,
  es: deepMerge(EN_APP_STRINGS, esOverrides),
  pt: deepMerge(EN_APP_STRINGS, ptOverrides),
  fr: deepMerge(EN_APP_STRINGS, frOverrides),
  de: deepMerge(EN_APP_STRINGS, deOverrides),
  ja: deepMerge(EN_APP_STRINGS, jaOverrides),
  ko: deepMerge(EN_APP_STRINGS, koOverrides),
  zh: deepMerge(EN_APP_STRINGS, zhOverrides),
  ru: deepMerge(EN_APP_STRINGS, ruOverrides),
  tr: deepMerge(EN_APP_STRINGS, trOverrides),
};

let currentLanguage: SupportedLanguage = "en";

const normalizeLanguage = (language: string): SupportedLanguage => {
  const lower = language.toLowerCase();

  if (lower.startsWith("es")) {
    return "es";
  }
  if (lower.startsWith("pt")) {
    return "pt";
  }
  if (lower.startsWith("fr")) {
    return "fr";
  }
  if (lower.startsWith("de")) {
    return "de";
  }
  if (lower.startsWith("ja")) {
    return "ja";
  }
  if (lower.startsWith("ko")) {
    return "ko";
  }
  if (lower.startsWith("zh")) {
    return "zh";
  }
  if (lower.startsWith("ru")) {
    return "ru";
  }
  if (lower.startsWith("tr")) {
    return "tr";
  }

  return "en";
};

export const isSupportedLanguage = (
  language: string
): language is SupportedLanguage => {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
};

export const getLanguageLabel = (language: SupportedLanguage): string => {
  const option = LANGUAGE_OPTIONS.find((entry) => entry.code === language);
  return option?.label ?? "English";
};

export const getAppLanguage = (): SupportedLanguage => currentLanguage;

export const setAppLanguage = (language: SupportedLanguage): void => {
  currentLanguage = language;
};

export const detectDeviceLanguage = (locale?: string): SupportedLanguage => {
  const resolvedLocale =
    locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
  const language = normalizeLanguage(resolvedLocale);
  currentLanguage = language;
  return currentLanguage;
};

// Backward-compatible alias. Prefer detectDeviceLanguage in non-hook contexts.
export const useDeviceLanguage = detectDeviceLanguage;

export const getAppStrings = (): AppStringsSchema =>
  localizedStrings[currentLanguage];

const getTypedAppStrings = (): typeof EN_APP_STRINGS =>
  getAppStrings() as typeof EN_APP_STRINGS;

export const AppStrings: typeof EN_APP_STRINGS = new Proxy(
  {} as typeof EN_APP_STRINGS,
  {
  get(_target, prop) {
    return Reflect.get(getTypedAppStrings(), prop);
  },
  ownKeys() {
    return Reflect.ownKeys(getTypedAppStrings());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getTypedAppStrings(), prop);
  },
}
);
