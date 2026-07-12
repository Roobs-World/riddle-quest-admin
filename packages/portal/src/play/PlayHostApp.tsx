import {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import logoUrl from "../assets/main-logo.webp";
import googleUrl from "../assets/google.svg";
import facebookUrl from "../assets/facebook.svg";
import coinUrl from "../assets/large-coin-stack.svg";
import profileUrl from "../assets/profile-icon.svg";
import settingsUrl from "../assets/settings-icon.svg";
import {createHostMessageRouter} from "./bridgeRouter";
import {LANGUAGE_OPTIONS, detectDeviceLanguage, getLanguageLabel, setLocale, tr, useLocale, type Locale} from "./i18n";
import {createRequestId} from "./requestIds";
import {createHostServices, getHostConfigurationWarning, resolveHostServicesMode} from "./services";
import type {AuthSnapshot, HostServices, LeaderboardType, ProductSummary, WebGameMode} from "./types";

type HostPanel = "profile" | "leaderboard" | "shop" | "settings";
type OperationName =
  | "auth"
  | "loadRiddle"
  | "completeGame"
  | "hint"
  | "spendCoins"
  | "purchase"
  | "rewardedAd"
  | "skip"
  | "profile"
  | "leaderboard";

const basePath = "/riddle-quest";

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error && "message" in error) {
    if ("name" in error && error.name === "WebProviderNotConfiguredError") {
      return tr("WebPortal.PROVIDER_NOT_CONFIGURED");
    }
    return String(error.message).replace(/^Firebase:\s*/i, "");
  }
  return tr("ErrorMessages.GENERIC_UNEXPECTED_ERROR");
};

const toGameUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  return `${basePath}/play/game/${params.toString() ? `?${params}` : ""}`;
};

const createHostMessage = <Message extends HostToGameMessage>(message: Message): Message => ({
  ...message,
  sentAt: Date.now(),
});

export function PlayHostApp() {
  const locale = useLocale();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const sessionIdRef = useRef(createRequestId("session"));
  const servicesMode = useMemo(() => resolveHostServicesMode(), []);
  const services = useMemo<HostServices>(() => createHostServices(servicesMode), [servicesMode]);
  const configurationWarning = getHostConfigurationWarning(servicesMode);

  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>({user: null, profile: null});
  const [frameReady, setFrameReady] = useState(false);
  const [gameMode, setGameMode] = useState<WebGameMode>("classic");
  const [frameHeight, setFrameHeight] = useState(720);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(configurationWarning);
  const [panel, setPanel] = useState<HostPanel>("profile");
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>("xp");
  const [leaderboard, setLeaderboard] = useState<Array<{userId: string; username: string; level: number; xp: number; totalWins: number; bestStreak: number}>>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    detectDeviceLanguage(localStorage.getItem("appLanguage") ?? navigator.language);
  }, []);

  useEffect(() => services.auth.subscribe(setAuthSnapshot), [services]);

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const postToGame = useCallback((message: HostToGameMessage) => {
    frameRef.current?.contentWindow?.postMessage(createHostMessage(message), window.location.origin);
  }, []);

  const sendInit = useCallback(() => {
    postToGame({
      type: "host:init",
      requestId: createRequestId("init"),
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        sessionId: sessionIdRef.current,
        locale,
        user: authSnapshot.user,
        profile: authSnapshot.profile,
        gameMode,
        products: services.products,
      },
    });
  }, [authSnapshot.profile, authSnapshot.user, gameMode, locale, postToGame, services.products]);

  const postOperation = useCallback(
    (requestId: string | undefined, operation: OperationName, ok: boolean, data?: unknown, error?: string) => {
      postToGame({
        type: "host:operationResult",
        requestId,
        payload: {
          operation,
          ok,
          data,
          error,
        },
      });
    },
    [postToGame],
  );

  const loadAndPostRiddle = useCallback(
    async (input: {gameMode: WebGameMode; locale: string; classicIndex?: number}, requestId?: string) => {
      try {
        const riddle = await services.loadRiddle(input);
        postToGame({
          type: "host:riddleLoaded",
          requestId,
          payload: {
            riddle,
            profile: authSnapshot.profile,
          },
        });
        postOperation(requestId, "loadRiddle", true, {riddleId: riddle.riddleId});
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice(message);
        postOperation(requestId, "loadRiddle", false, undefined, message);
      }
    },
    [authSnapshot.profile, postOperation, postToGame, services],
  );

  useEffect(() => {
    postToGame({
      type: "host:authState",
      requestId: createRequestId("auth"),
      payload: authSnapshot,
    });
  }, [authSnapshot, postToGame]);

  useEffect(() => {
    if (!authSnapshot.user) {
      setLeaderboard([]);
      return;
    }

    void services.loadLeaderboard(leaderboardType).then(setLeaderboard).catch((error) => setNotice(getErrorMessage(error)));
  }, [authSnapshot.user, leaderboardType, services]);

  const router = useMemo(
    () =>
      createHostMessageRouter({
        ready: async () => {
          setFrameReady(true);
          sendInit();
          if (authSnapshot.user) {
            loadedUserIdRef.current = authSnapshot.user.uid;
            await loadAndPostRiddle({
              gameMode,
              locale,
              classicIndex: authSnapshot.profile?.classicIndex,
            });
          }
        },
        resize: (message) => {
          setFrameHeight(Math.max(620, Math.min(1200, message.payload.height)));
        },
        loadRiddle: async (message) => {
          await loadAndPostRiddle(message.payload, message.requestId);
        },
        completeGame: async (message) => {
          try {
            const result = await services.completeGame(message.payload);
            postOperation(message.requestId, "completeGame", true, result);
          } catch (error) {
            postOperation(message.requestId, "completeGame", false, undefined, getErrorMessage(error));
          }
        },
        requestHint: async (message) => {
          try {
            const result = await services.requestHint(message.payload);
            postOperation(message.requestId, "hint", true, result);
          } catch (error) {
            postOperation(message.requestId, "hint", false, undefined, getErrorMessage(error));
          }
        },
        spendCoins: async (message) => {
          try {
            if (message.payload.reason === "skip" && message.payload.riddleId && message.payload.gameMode) {
              const result = await services.skipRiddle({
                riddleId: message.payload.riddleId,
                gameMode: message.payload.gameMode,
              });
              postOperation(message.requestId, "skip", true, result);
              await loadAndPostRiddle({
                gameMode: message.payload.gameMode,
                locale,
                classicIndex: result.newProgress?.classicIndex ?? authSnapshot.profile?.classicIndex,
              });
              return;
            }

            const result = await services.spendCoins(message.payload);
            postOperation(message.requestId, "spendCoins", true, result);
          } catch (error) {
            postOperation(message.requestId, message.payload.reason === "skip" ? "skip" : "spendCoins", false, undefined, getErrorMessage(error));
          }
        },
        requestPurchase: async (message) => {
          try {
            const result = await services.requestPurchase(message.payload.productId);
            setNotice(tr("WebPortal.PURCHASE_COMPLETE", {coins: result.coinsAwarded}));
            postOperation(message.requestId, "purchase", true, result);
          } catch (error) {
            postOperation(message.requestId, "purchase", false, undefined, getErrorMessage(error));
          }
        },
        requestRewardedAd: async (message) => {
          try {
            if (!authSnapshot.user) {
              throw new Error(tr("ErrorMessages.SIGN_IN_TO_CONTINUE"));
            }
            const result = await services.requestRewardedAd({
              placement: message.payload.placement,
              userId: authSnapshot.user.uid,
            });
            postOperation(message.requestId, "rewardedAd", true, result);
          } catch (error) {
            postOperation(message.requestId, "rewardedAd", false, undefined, getErrorMessage(error));
          }
        },
        analytics: (message) => {
          console.info("[riddle-quest-web]", message.payload.eventName, message.payload.params ?? {});
        },
        error: (message) => {
          setNotice(message.payload.message);
        },
      }),
    [authSnapshot.profile, authSnapshot.user, gameMode, loadAndPostRiddle, locale, postOperation, sendInit, services],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) {
        return;
      }

      void router(event.data).catch((error) => setNotice(getErrorMessage(error)));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  useEffect(() => {
    if (!authSnapshot.user) {
      loadedUserIdRef.current = null;
      return;
    }

    if (!frameReady || loadedUserIdRef.current === authSnapshot.user.uid) {
      return;
    }

    loadedUserIdRef.current = authSnapshot.user.uid;
    void loadAndPostRiddle({
      gameMode,
      locale,
      classicIndex: authSnapshot.profile?.classicIndex,
    });
  }, [authSnapshot.profile?.classicIndex, authSnapshot.user, frameReady, gameMode, loadAndPostRiddle, locale]);

  const signIn = async (operation: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await operation();
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    await signIn(() => services.auth.signInEmail(email, password));
  };

  const buyProduct = async (product: ProductSummary) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await services.requestPurchase(product.productId);
      setNotice(tr("WebPortal.PURCHASE_COMPLETE", {coins: result.coinsAwarded}));
      postOperation(createRequestId("host-purchase"), "purchase", true, result);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const pauseGame = () => {
    postToGame({type: "host:pause", requestId: createRequestId("pause"), payload: {}});
  };

  const resumeGame = () => {
    postToGame({type: "host:resume", requestId: createRequestId("resume"), payload: {}});
  };

  const visibleFrameHeight = Math.max(520, Math.min(frameHeight, viewportHeight - 116));

  if (!authSnapshot.user) {
    return (
      <main className="play-host unauthenticated">
        <section className="play-login">
          <div className="play-login-copy">
            <img className="play-logo" src={logoUrl} alt={tr("WebPortal.APP_TITLE")} />
            <p className="play-badge">{tr("WebPortal.HTML5_BADGE")}</p>
            <h1>{tr("WebPortal.APP_TITLE")}</h1>
            <p>{tr("AuthStrings.Landing.TAGLINE_1")}</p>
            <LanguagePicker locale={locale} />
          </div>

          <form className="play-login-panel" onSubmit={submitEmail}>
            <h2>{tr("Navigation.PLAY_BUTTON")}</h2>
            <p>{tr("WebPortal.GUEST_WARNING")}</p>
            {notice && <div className="play-alert">{notice}</div>}
            <label>
              {tr("WebPortal.EMAIL_LABEL")}
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
            </label>
            <label>
              {tr("WebPortal.PASSWORD_LABEL")}
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
            </label>
            <button className="play-primary" disabled={busy || !email || !password} type="submit">
              {busy ? tr("WebPortal.SIGNING_IN") : tr("WebPortal.SIGN_IN_WITH_EMAIL")}
            </button>
            <button className="play-secondary" disabled={busy} type="button" onClick={() => void signIn(services.auth.signInGuest)}>
              {tr("AuthStrings.Landing.PLAY_AS_GUEST")}
            </button>
            <div className="play-provider-row">
              <button disabled={busy} type="button" onClick={() => void signIn(services.auth.signInGoogle)} aria-label={tr("AuthStrings.Login.CONTINUE_WITH_GOOGLE")}>
                <img src={googleUrl} alt="" />
                <span>{tr("AuthStrings.Login.CONTINUE_WITH_GOOGLE")}</span>
              </button>
              <button disabled={busy} type="button" onClick={() => void signIn(services.auth.signInFacebook)} aria-label={tr("AuthStrings.Login.CONTINUE_WITH_FACEBOOK")}>
                <img src={facebookUrl} alt="" />
                <span>{tr("AuthStrings.Login.CONTINUE_WITH_FACEBOOK")}</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="play-host">
      <aside className="play-host-sidebar">
        <img className="host-logo" src={logoUrl} alt={tr("WebPortal.APP_TITLE")} />
        <div className="host-profile">
          <img src={profileUrl} alt="" />
          <div>
            <strong>{authSnapshot.profile?.username ?? authSnapshot.user.displayName ?? tr("Profile.GUEST_USERNAME")}</strong>
            <span>{authSnapshot.user.isAnonymous ? tr("Profile.GUEST_MODE_TITLE") : authSnapshot.user.email}</span>
          </div>
        </div>
        <div className="host-coins">
          <img src={coinUrl} alt="" />
          <strong>{(authSnapshot.profile?.coins ?? 0).toLocaleString()}</strong>
          <span>{tr("CoinShop.COINS_SUFFIX")}</span>
        </div>
        <div className="mode-toggle" role="group" aria-label={tr("WebPortal.MODE_LABEL")}>
          <button className={gameMode === "classic" ? "active" : ""} onClick={() => setGameMode("classic")}>
            {tr("WebPortal.PLAY_CLASSIC")}
          </button>
          <button className={gameMode === "challenge" ? "active" : ""} onClick={() => setGameMode("challenge")}>
            {tr("WebPortal.PLAY_DAILY")}
          </button>
        </div>
        <nav className="host-panel-nav" aria-label={tr("Navigation.GAME")}>
          <PanelButton active={panel === "profile"} icon={profileUrl} label={tr("Navigation.PROFILE_BUTTON")} onClick={() => setPanel("profile")} />
          <PanelButton active={panel === "leaderboard"} label={tr("Leaderboard.TITLE")} onClick={() => setPanel("leaderboard")} />
          <PanelButton active={panel === "shop"} icon={coinUrl} label={tr("CoinShop.TITLE")} onClick={() => setPanel("shop")} />
          <PanelButton active={panel === "settings"} icon={settingsUrl} label={tr("Navigation.SETTINGS_BUTTON")} onClick={() => setPanel("settings")} />
        </nav>
        <button className="play-text-button" onClick={() => void services.auth.signOut()}>{tr("Settings.LOGOUT_BUTTON")}</button>
      </aside>

      <section className="play-frame-column">
        <div className="play-frame-toolbar">
          <div>
            <p>{servicesMode === "fake" ? tr("WebPortal.JEST_HARNESS") : tr("WebPortal.HOST_STATUS_READY")}</p>
            <strong>{getLanguageLabel(locale as Locale)}</strong>
          </div>
          <button className="play-secondary compact" onClick={() => void loadAndPostRiddle({gameMode, locale, classicIndex: authSnapshot.profile?.classicIndex})}>
            {tr("WebPortal.OPEN_GAME")}
          </button>
        </div>
        {notice && <div className="play-alert">{notice}</div>}
        <iframe
          ref={frameRef}
          className="game-frame"
          src={toGameUrl()}
          style={{height: visibleFrameHeight}}
          title={tr("WebPortal.GAME_FRAME_TITLE")}
        />
      </section>

      <aside className="play-host-panel">
        {panel === "profile" && <ProfilePanel snapshot={authSnapshot} />}
        {panel === "leaderboard" && (
          <LeaderboardPanel
            leaderboard={leaderboard}
            type={leaderboardType}
            onTypeChange={setLeaderboardType}
          />
        )}
        {panel === "shop" && <ShopPanel busy={busy} products={services.products} onBuy={buyProduct} />}
        {panel === "settings" && (
          <SettingsPanel
            locale={locale}
            onPause={pauseGame}
            onResume={resumeGame}
            onUpdateUsername={async (username) => {
              setBusy(true);
              setNotice(null);
              try {
                await services.updateUsername(username);
                setNotice(tr("Profile.ALERT_USERNAME_UPDATE_SUCCESS"));
              } catch (error) {
                setNotice(getErrorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </aside>
    </main>
  );
}

function LanguagePicker({locale}: {locale: string}) {
  return (
    <label className="language-picker">
      {tr("Settings.LANGUAGE_LABEL")}
      <select
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;
          localStorage.setItem("appLanguage", nextLocale);
          setLocale(nextLocale);
        }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PanelButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon ? <img src={icon} alt="" /> : <span>#</span>}
      {label}
    </button>
  );
}

function ProfilePanel({snapshot}: {snapshot: AuthSnapshot}) {
  const profile = snapshot.profile;
  return (
    <section>
      <h2>{tr("Profile.TITLE")}</h2>
      <p>{tr("WebPortal.PROFILE_PROGRESS", {level: profile?.level ?? 1, xp: profile?.xp ?? 0})}</p>
      <dl className="profile-stats">
        <div><dt>{tr("Profile.GAMES_PLAYED_STAT")}</dt><dd>{profile?.gamesPlayed ?? 0}</dd></div>
        <div><dt>{tr("Profile.TOTAL_WINS_STAT")}</dt><dd>{profile?.wins ?? 0}</dd></div>
        <div><dt>{tr("StatsModal.CURRENT_STREAK")}</dt><dd>{profile?.winStreak ?? 0}</dd></div>
        <div><dt>{tr("Profile.HIGHEST_CLASSIC_LEVEL_STAT")}</dt><dd>{profile?.classicIndex ?? 1}</dd></div>
      </dl>
      <h3>{tr("Achievements.MODAL_TITLE")}</h3>
      <div className="achievement-list">
        {(profile?.achievements.length ? profile.achievements : [tr("WebPortal.ACHIEVEMENTS_EMPTY")]).map((achievement) => (
          <span key={achievement}>{achievement}</span>
        ))}
      </div>
    </section>
  );
}

function LeaderboardPanel({
  leaderboard,
  type,
  onTypeChange,
}: {
  leaderboard: Array<{userId: string; username: string; level: number; xp: number; totalWins: number; bestStreak: number}>;
  type: LeaderboardType;
  onTypeChange: (type: LeaderboardType) => void;
}) {
  const metric = (row: (typeof leaderboard)[number]) =>
    type === "xp" ? `${row.xp} ${tr("StatsModal.XP")}` : type === "totalWins" ? row.totalWins : row.bestStreak;

  return (
    <section>
      <h2>{tr("Leaderboard.TITLE")}</h2>
      <div className="leaderboard-tabs">
        <button className={type === "xp" ? "active" : ""} onClick={() => onTypeChange("xp")}>{tr("Leaderboard.TAB_XP")}</button>
        <button className={type === "totalWins" ? "active" : ""} onClick={() => onTypeChange("totalWins")}>{tr("Leaderboard.TAB_WINS")}</button>
        <button className={type === "bestStreak" ? "active" : ""} onClick={() => onTypeChange("bestStreak")}>{tr("Leaderboard.TAB_STREAK")}</button>
      </div>
      <ol className="leaderboard-list">
        {leaderboard.length === 0 ? (
          <li>{tr("Leaderboard.NO_SCORES_YET")}</li>
        ) : leaderboard.map((row) => (
          <li key={row.userId}>
            <span>{row.username}</span>
            <strong>{metric(row)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ShopPanel({
  busy,
  products,
  onBuy,
}: {
  busy: boolean;
  products: ProductSummary[];
  onBuy: (product: ProductSummary) => void;
}) {
  return (
    <section>
      <h2>{tr("CoinShop.TITLE")}</h2>
      <div className="shop-products">
        {products.map((product) => (
          <article key={product.productId}>
            {product.featuredBadge && <span>{product.featuredBadge}</span>}
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <strong>{product.coins.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}</strong>
            <button className="play-primary compact" disabled={busy} onClick={() => onBuy(product)}>
              {tr("CoinShop.PURCHASE_BUTTON")} {product.displayPrice}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsPanel({
  locale,
  onPause,
  onResume,
  onUpdateUsername,
}: {
  locale: string;
  onPause: () => void;
  onResume: () => void;
  onUpdateUsername: (username: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");

  const submitUsername = async (event: FormEvent) => {
    event.preventDefault();
    if (username.trim().length < 3) {
      return;
    }
    await onUpdateUsername(username.trim());
    setUsername("");
  };

  return (
    <section>
      <h2>{tr("Settings.TITLE")}</h2>
      <LanguagePicker locale={locale} />
      <form className="username-form" onSubmit={submitUsername}>
        <label>
          {tr("Profile.UPDATE_USERNAME_TITLE")}
          <input
            minLength={3}
            placeholder={tr("Profile.ENTER_NEW_USERNAME_PLACEHOLDER")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <button className="play-primary compact" disabled={username.trim().length < 3}>
          {tr("Profile.SAVE_BUTTON")}
        </button>
      </form>
      <div className="settings-actions">
        <button className="play-secondary compact" onClick={onPause}>{tr("WebPortal.PAUSE_GAME")}</button>
        <button className="play-secondary compact" onClick={onResume}>{tr("WebPortal.RESUME_GAME")}</button>
      </div>
    </section>
  );
}
