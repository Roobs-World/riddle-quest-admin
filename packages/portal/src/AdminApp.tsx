import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";
import {ClerkProvider, SignIn, UserButton, useAuth, useClerk, useUser} from "@clerk/react";
import {
  auditLogToCsv,
  filterAndSortPlayers,
  filterRiddles,
  getManagementInsights,
  playersToCsv,
  riddlesToCsv,
  type PlayerSortKey,
} from "./adminUtils";
import type {
  PortalAuditEvent,
  PortalLeaderboardEntry,
  PortalOverview,
  PortalRiddle,
  PortalUser,
} from "./firebase";

type View = "overview" | "players" | "riddles" | "leaderboards" | "audit" | "operations";
type LeaderboardKind = "xp" | "totalWins" | "bestStreak";
type DiagnosticState = {title: string; status: "success" | "error"; body: string} | null;
type AdminAuthPayload = {clerkToken?: string};
type AdminUser = {
  id: string;
  displayName: string;
  email: string | null;
};
type AdminConsoleProps = {
  adminUser: AdminUser;
  authSourceLabel: string;
  getClerkToken?: () => Promise<string | null>;
  onSignOut?: () => Promise<void>;
};

const BASE_PATH = "/riddle-quest";
const isAdminHarnessRoute =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("harness") === "jest";
const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";

const navigation: Array<{id: View; label: string; glyph: string}> = [
  {id: "overview", label: "Overview", glyph: "01"},
  {id: "players", label: "Players", glyph: "02"},
  {id: "riddles", label: "Content", glyph: "03"},
  {id: "leaderboards", label: "Leaderboards", glyph: "04"},
  {id: "audit", label: "Audit", glyph: "05"},
  {id: "operations", label: "Operations", glyph: "06"},
];

type AdminFirebaseApi = typeof import("./firebase");

let firebaseApiPromise: Promise<AdminFirebaseApi> | null = null;

const loadAdminFirebaseApi = (): Promise<AdminFirebaseApi> => {
  firebaseApiPromise ??= import("./firebase");
  return firebaseApiPromise;
};

function formatDate(value: number | null | undefined): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {notation: "compact", maximumFractionDigits: 1}).format(value);
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message).replace(/^Firebase:\s*/i, "");
  }
  return "Something went wrong.";
}

function downloadCsv(filename: string, contents: string) {
  if (!contents) return;
  const blob = new Blob([contents], {type: "text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AdminApp() {
  if (isAdminHarnessRoute) {
    return (
      <AdminConsole
        adminUser={{id: "harness-operator", displayName: "Jest Operator", email: "operator@example.com"}}
        authSourceLabel="Harness session"
      />
    );
  }

  if (!clerkPublishableKey) {
    return <ClerkConfigurationMissing />;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkAdminGate />
    </ClerkProvider>
  );
}

function ClerkAdminGate() {
  const {getToken, isLoaded, isSignedIn} = useAuth();
  const {signOut} = useClerk();
  const {user} = useUser();

  if (!isLoaded) {
    return <FullPageStatus label="Opening management portal" />;
  }

  if (!isSignedIn || !user) {
    return <ClerkSignInScreen />;
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;
  const displayName =
    user.fullName ||
    user.username ||
    email?.split("@")[0] ||
    "Admin";

  return (
    <AdminConsole
      adminUser={{id: user.id, displayName, email}}
      authSourceLabel="Clerk session"
      getClerkToken={() => getToken()}
      onSignOut={() => signOut({redirectUrl: `${BASE_PATH}/admin/`})}
    />
  );
}

function AdminConsole({adminUser, authSourceLabel, getClerkToken, onSignOut}: AdminConsoleProps) {
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerLocale, setPlayerLocale] = useState("");
  const [playerSort, setPlayerSort] = useState<PlayerSortKey>("recent");
  const [riddleQuery, setRiddleQuery] = useState("");
  const [riddleLocale, setRiddleLocale] = useState("");

  const getConfiguredFirebaseApi = useCallback(async () => {
    const api = await loadAdminFirebaseApi();
    setError(api.firebaseConfigurationError);
    if (api.firebaseConfigurationError) {
      throw new Error(api.firebaseConfigurationError);
    }
    return api;
  }, []);

  const getAdminAuthPayload = useCallback(async (): Promise<AdminAuthPayload> => {
    if (!getClerkToken) return {};
    const clerkToken = await getClerkToken();
    if (!clerkToken) {
      throw new Error("Clerk session token is unavailable. Sign in again.");
    }
    return {clerkToken};
  }, [getClerkToken]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAdminHarnessRoute) {
        setOverview(createHarnessPortalOverview());
        return;
      }

      const api = await getConfiguredFirebaseApi();
      const adminAuth = await getAdminAuthPayload();
      const result = await api.getPortalOverview({
        ...adminAuth,
        userLimit: 100,
        riddleLimit: 100,
        auditLimit: 30,
        leaderboardLimit: 15,
      });
      setOverview(result.data);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [getAdminAuthPayload, getConfiguredFirebaseApi]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const availableLocales = useMemo(() => {
    const locales = new Set<string>();
    overview?.localizedCounts.forEach((item) => locales.add(item.locale));
    overview?.users.forEach((player) => locales.add(player.preferredLanguage));
    overview?.riddles.forEach((riddle) => locales.add(riddle.locale));
    return [...locales].sort();
  }, [overview]);

  const filteredUsers = useMemo(
    () => filterAndSortPlayers(overview?.users ?? [], playerQuery, playerLocale, playerSort),
    [overview?.users, playerLocale, playerQuery, playerSort],
  );

  const filteredRiddles = useMemo(
    () => filterRiddles(overview?.riddles ?? [], riddleQuery, riddleLocale),
    [overview?.riddles, riddleLocale, riddleQuery],
  );

  const runOperation = async (operation: (api: AdminFirebaseApi, adminAuth: AdminAuthPayload) => Promise<string>) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setDiagnostic(null);
    try {
      const api = await getConfiguredFirebaseApi();
      const adminAuth = await getAdminAuthPayload();
      setNotice(await operation(api, adminAuth));
      await loadOverview();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async (title: string, operation: (api: AdminFirebaseApi) => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const api = await getConfiguredFirebaseApi();
      const result = await operation(api);
      setDiagnostic({title, status: "success", body: JSON.stringify(result, null, 2)});
    } catch (nextError) {
      const message = getErrorMessage(nextError);
      setDiagnostic({title, status: "error", body: message});
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Q</div>
          <div>
            <strong>Qwordly</strong>
            <span>Management</span>
          </div>
        </div>

        <nav aria-label="Portal sections">
          {navigation.map((item) => (
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <span>{item.glyph}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <a className="text-link" href={`${BASE_PATH}/performance/`}>Performance dashboard</a>
          <a className="text-link" href={`${BASE_PATH}/play/`}>Playable route</a>
          <div className="live-dot"><i /> {authSourceLabel}</div>
          {onSignOut && <button className="text-button" onClick={() => void onSignOut()} type="button">Sign out</button>}
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Project management</p>
            <h1>{navigation.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="refresh-button" disabled={loading} onClick={() => void loadOverview()} type="button">
              {loading ? "Refreshing..." : "Refresh data"}
            </button>
            <div className="operator">
              <span>{adminUser.displayName}</span>
              <small>{adminUser.email ?? adminUser.id}</small>
            </div>
            {onSignOut && (
              <div className="clerk-user-button" aria-label="Clerk account menu">
                <UserButton />
              </div>
            )}
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {!overview && loading ? (
          <FullPageStatus label="Reading project state" compact />
        ) : (
          <>
            {view === "overview" && overview && <OverviewView data={overview} />}
            {view === "players" && overview && (
              <PlayersView
                availableLocales={availableLocales}
                disabled={loading}
                onAdjust={(player, delta, reason) => {
                  if (isAdminHarnessRoute) {
                    setOverview((current) => applyHarnessCoinAdjustment(current, player.userId, delta, reason));
                    setNotice(`${player.username}'s balance was adjusted in the harness.`);
                    return Promise.resolve();
                  }
                  return runOperation(async (api, adminAuth) => {
                    const result = await api.adjustUserCoins({...adminAuth, userId: player.userId, delta, reason});
                    return `${player.username}'s balance is now ${result.data.newBalance.toLocaleString()} coins.`;
                  });
                }}
                onExport={() => downloadCsv("qwordly-players.csv", playersToCsv(filteredUsers))}
                players={filteredUsers}
                query={playerQuery}
                selectedLocale={playerLocale}
                setQuery={setPlayerQuery}
                setSelectedLocale={setPlayerLocale}
                setSortKey={setPlayerSort}
                sortKey={playerSort}
              />
            )}
            {view === "riddles" && overview && (
              <RiddlesView
                availableLocales={availableLocales}
                data={overview}
                onExport={() => downloadCsv("qwordly-riddles.csv", riddlesToCsv(filteredRiddles))}
                query={riddleQuery}
                riddles={filteredRiddles}
                selectedLocale={riddleLocale}
                setQuery={setRiddleQuery}
                setSelectedLocale={setRiddleLocale}
              />
            )}
            {view === "leaderboards" && overview && <LeaderboardsView data={overview} />}
            {view === "audit" && overview && (
              <AuditView
                events={overview.auditLog ?? []}
                onExport={() => downloadCsv("qwordly-admin-audit.csv", auditLogToCsv(overview.auditLog ?? []))}
              />
            )}
            {view === "operations" && (
              <OperationsView
                diagnostic={diagnostic}
                disabled={loading}
                onGenerateDaily={(forceGenerate) => {
                  if (isAdminHarnessRoute) {
                    setNotice(forceGenerate ? "Harness daily challenge regenerated." : "Harness daily challenge is ready.");
                    return Promise.resolve();
                  }
                  return runOperation(async (api, adminAuth) => {
                    const result = await api.generateTodaysChallenge({...adminAuth, forceGenerate});
                    return result.data.message;
                  });
                }}
                onRunDiagnostic={(kind) => {
                  if (isAdminHarnessRoute) {
                    const title =
                      kind === "daily"
                        ? "Current daily callable"
                        : kind === "classic"
                          ? "Classic riddle callable"
                          : "Leaderboard callable";
                    setDiagnostic({
                      title,
                      status: "success",
                      body: JSON.stringify(createHarnessDiagnosticPayload(kind), null, 2),
                    });
                    return Promise.resolve();
                  }
                  if (kind === "daily") {
                    return runDiagnostic("Current daily callable", async (api) => {
                      const result = await api.getCurrentDailyChallenge({});
                      return result.data;
                    });
                  }
                  if (kind === "classic") {
                    return runDiagnostic("Classic riddle callable", async (api) => {
                      const result = await api.getCurrentClassicRiddle({classicIndex: 1, locale: "en"});
                      return result.data;
                    });
                  }
                  return runDiagnostic("Leaderboard callable", async (api) => {
                    const result = await api.getLeaderboard({type: "xp", limit: 5});
                    return result.data;
                  });
                }}
                onSeed={(classicCount) => {
                  if (isAdminHarnessRoute) {
                    setNotice(`Harness seeded ${classicCount} classic riddles per locale.`);
                    return Promise.resolve();
                  }
                  return runOperation(async (api, adminAuth) => {
                    const result = await api.seedLocalizedRiddles({...adminAuth, classicCount, forceGenerateDaily: true});
                    return result.data.message;
                  });
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ManagementLoginStory() {
  return (
    <section className="login-story">
      <div className="login-brand"><span>Q</span> Qwordly</div>
      <div>
        <p className="eyebrow">Private management portal</p>
        <h1>Run Riddle Quest from one focused console.</h1>
        <p>Player operations, content health, ranking quality, audit history, and release telemetry.</p>
      </div>
      <div className="signal-strip">
        <span>Players</span><span>Content</span><span>Leaderboards</span><span>Audit</span>
      </div>
    </section>
  );
}

function ClerkSignInScreen() {
  return (
    <div className="login-page">
      <ManagementLoginStory />
      <section className="login-panel">
        <div className="clerk-auth-card">
          <p className="eyebrow">Authorised operators only</p>
          <h2>Enter management</h2>
          <p className="muted">Sign in with the Clerk account approved for Riddle Quest admin access.</p>
          <div className="clerk-widget">
            <SignIn />
          </div>
        </div>
      </section>
    </div>
  );
}

function ClerkConfigurationMissing() {
  return (
    <div className="login-page">
      <ManagementLoginStory />
      <section className="login-panel">
        <div className="clerk-auth-card">
          <p className="eyebrow">Configuration needed</p>
          <h2>Clerk is not configured</h2>
          <p className="muted">
            Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> or <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to the portal environment before using the management console.
          </p>
        </div>
      </section>
    </div>
  );
}

function OverviewView({data}: {data: PortalOverview}) {
  const insights = getManagementInsights(data);
  const metrics = [
    {label: "Registered players", value: data.metrics.userCount, note: "Total user documents"},
    {
      label: "Daily coverage",
      value: `${data.metrics.healthyDailyLocales}/${data.metrics.localeCount}`,
      note: "Locales with current daily",
    },
    {label: "Active sample", value: insights.activeUsersLoaded, note: "Loaded users with recent activity"},
    {label: "Loaded coin float", value: formatCompact(insights.totalLoadedCoins), note: "Coins in loaded users"},
    {label: "Localized riddles", value: data.metrics.localizedRiddleCount, note: "All locale banks"},
    {label: "Average win rate", value: formatPercent(insights.averageWinRate), note: "Loaded user sample"},
  ];

  return (
    <div className="page-grid">
      <section className="metric-grid">
        {metrics.map((metric, index) => (
          <article className="metric-card" key={metric.label}>
            <span className="metric-index">{String(index + 1).padStart(2, "0")}</span>
            <strong>{typeof metric.value === "number" ? metric.value.toLocaleString() : metric.value}</strong>
            <h3>{metric.label}</h3>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="panel span-7">
        <PanelHeading title="Language risk" note="Lowest inventory first" />
        <div className="coverage-list">
          {insights.lowInventoryLocales.map((item) => {
            const maximum = Math.max(...data.localizedCounts.map((entry) => entry.count), 1);
            return (
              <div className="coverage-row" key={item.locale}>
                <span>{item.locale.toUpperCase()}</span>
                <div><i style={{width: `${Math.max(4, (item.count / maximum) * 100)}%`}} /></div>
                <strong>{item.count}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel span-5">
        <PanelHeading title="Top XP" note="Leaderboard snapshot" />
        <LeaderboardMini entries={data.leaderboard?.xp ?? []} />
      </section>

      <section className="panel span-7">
        <PanelHeading title="Daily coverage" note={`Updated ${formatDate(data.generatedAt)}`} />
        <DailyPulse items={data.dailyByLocale} />
      </section>

      <section className="panel span-5">
        <PanelHeading title="Recent audit" note={`${data.auditLog?.length ?? 0} loaded`} />
        <AuditMini events={data.auditLog ?? []} />
      </section>

      <section className="panel span-12">
        <PanelHeading title="Recently active players" note="Latest sign-ins" />
        <PlayerTable players={data.users.slice(0, 6)} />
      </section>
    </div>
  );
}

function PlayersView({
  availableLocales,
  disabled,
  onAdjust,
  onExport,
  players,
  query,
  selectedLocale,
  setQuery,
  setSelectedLocale,
  setSortKey,
  sortKey,
}: {
  availableLocales: string[];
  disabled: boolean;
  onAdjust: (player: PortalUser, delta: number, reason: string) => Promise<void>;
  onExport: () => void;
  players: PortalUser[];
  query: string;
  selectedLocale: string;
  setQuery: (query: string) => void;
  setSelectedLocale: (locale: string) => void;
  setSortKey: (sortKey: PlayerSortKey) => void;
  sortKey: PlayerSortKey;
}) {
  const [selected, setSelected] = useState<PortalUser | null>(null);
  const [delta, setDelta] = useState("50");
  const [reason, setReason] = useState("");

  const submitAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    await onAdjust(selected, Number(delta), reason);
    setSelected(null);
    setReason("");
  };

  return (
    <div className="page-grid">
      <section className="panel span-12">
        <div className="table-toolbar">
          <PanelHeading title="Player directory" note={`${players.length} loaded`} />
          <div className="toolbar-controls">
            <input
              className="search"
              placeholder="Search name, email, or UID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select value={selectedLocale} onChange={(event) => setSelectedLocale(event.target.value)}>
              <option value="">All locales</option>
              {availableLocales.map((locale) => (
                <option key={locale} value={locale}>{locale.toUpperCase()}</option>
              ))}
            </select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as PlayerSortKey)}>
              <option value="recent">Recent</option>
              <option value="coins">Coins</option>
              <option value="wins">Wins</option>
              <option value="winRate">Win rate</option>
            </select>
            <button className="refresh-button" onClick={onExport} type="button">Export CSV</button>
          </div>
        </div>
        <PlayerTable players={players} onSelect={setSelected} />
      </section>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <form className="modal-card wide-modal" onSubmit={submitAdjustment} onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelected(null)}>Close</button>
            <p className="eyebrow">Player account</p>
            <h2>{selected.username}</h2>
            <div className="detail-grid">
              <span><strong>{selected.coins.toLocaleString()}</strong> coins</span>
              <span><strong>{selected.wins}/{selected.gamesPlayed}</strong> wins</span>
              <span><strong>{formatPercent(selected.winRate)}</strong> win rate</span>
              <span><strong>{selected.classicIndex}</strong> classic index</span>
            </div>
            <p className="muted">{selected.email || selected.userId}</p>
            <label>
              Coin change
              <input type="number" value={delta} onChange={(event) => setDelta(event.target.value)} required />
            </label>
            <label>
              Audit reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} required />
            </label>
            <button className="primary-button" disabled={disabled || Number(delta) === 0}>
              Apply adjustment
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PlayerTable({
  players,
  onSelect,
}: {
  players: PortalUser[];
  onSelect?: (player: PortalUser) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Player</th><th>Language</th><th>Progress</th><th>Record</th><th>Coins</th><th>Last seen</th></tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr
              className={onSelect ? "clickable" : ""}
              key={player.userId}
              onClick={() => onSelect?.(player)}
              onKeyDown={(event) => {
                if (!onSelect) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(player);
                }
              }}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
              <td><strong>{player.username}</strong><small>{player.email || player.userId}</small></td>
              <td><span className="language-tag">{player.preferredLanguage.toUpperCase()}</span></td>
              <td>Classic {player.classicIndex}</td>
              <td>{player.wins}/{player.gamesPlayed} wins</td>
              <td>{player.coins.toLocaleString()}</td>
              <td>{formatDate(player.lastLogin)}</td>
            </tr>
          ))}
          {players.length === 0 && <EmptyTableRow colSpan={6} label="No players match the current filters." />}
        </tbody>
      </table>
    </div>
  );
}

function RiddlesView({
  availableLocales,
  data,
  onExport,
  query,
  riddles,
  selectedLocale,
  setQuery,
  setSelectedLocale,
}: {
  availableLocales: string[];
  data: PortalOverview;
  onExport: () => void;
  query: string;
  riddles: PortalRiddle[];
  selectedLocale: string;
  setQuery: (query: string) => void;
  setSelectedLocale: (locale: string) => void;
}) {
  return (
    <div className="page-grid">
      <section className="panel span-4 inventory-panel">
        <PanelHeading title="Inventory by locale" note="Localized banks" />
        {data.localizedCounts.map((item) => (
          <div className="inventory-row" key={item.locale}>
            <span>{item.locale.toUpperCase()}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </section>
      <section className="panel span-8">
        <div className="table-toolbar">
          <PanelHeading title="Riddle bank" note={`${riddles.length} records`} />
          <div className="toolbar-controls">
            <input
              className="search"
              placeholder="Search clue, answer, or id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select value={selectedLocale} onChange={(event) => setSelectedLocale(event.target.value)}>
              <option value="">All locales</option>
              {availableLocales.map((locale) => (
                <option key={locale} value={locale}>{locale.toUpperCase()}</option>
              ))}
            </select>
            <button className="refresh-button" onClick={onExport} type="button">Export CSV</button>
          </div>
        </div>
        <div className="riddle-list">
          {riddles.map((riddle) => (
            <article key={riddle.riddleId}>
              <div>
                <span>{riddle.category}</span>
                <small>{riddle.index === null ? riddle.riddleId : `#${riddle.index}`}</small>
              </div>
              <p>{riddle.text || "Missing clue text"}</p>
              <strong>{riddle.answer || "Missing answer"}</strong>
            </article>
          ))}
          {riddles.length === 0 && <p className="muted empty-note">No riddles match the current filters.</p>}
        </div>
      </section>
      <section className="panel span-12">
        <PanelHeading title="Daily content" note="Every supported locale" />
        <DailyPulse items={data.dailyByLocale} />
      </section>
    </div>
  );
}

function LeaderboardsView({data}: {data: PortalOverview}) {
  const [kind, setKind] = useState<LeaderboardKind>("xp");
  const entries = data.leaderboard?.[kind] ?? [];

  return (
    <div className="page-grid">
      <section className="panel span-12">
        <div className="table-toolbar">
          <PanelHeading title="Ranking health" note={`${entries.length} loaded`} />
          <div className="segmented-controls">
            {(["xp", "totalWins", "bestStreak"] as LeaderboardKind[]).map((item) => (
              <button
                className={kind === item ? "active" : ""}
                key={item}
                onClick={() => setKind(item)}
                type="button"
              >
                {leaderboardTitle(item)}
              </button>
            ))}
          </div>
        </div>
        <LeaderboardTable entries={entries} kind={kind} />
      </section>
    </div>
  );
}

function LeaderboardTable({entries, kind}: {entries: PortalLeaderboardEntry[]; kind: LeaderboardKind}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Rank</th><th>Player</th><th>Level</th><th>XP</th><th>Wins</th><th>Best streak</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${kind}-${entry.userId}`}>
              <td><span className="rank-badge">{index + 1}</span></td>
              <td><strong>{entry.username}</strong><small>{entry.userId}</small></td>
              <td>{entry.level}</td>
              <td>{entry.xp.toLocaleString()}</td>
              <td>{entry.totalWins.toLocaleString()}</td>
              <td>{entry.bestStreak.toLocaleString()}</td>
              <td>{formatDate(entry.updatedAt)}</td>
            </tr>
          ))}
          {entries.length === 0 && <EmptyTableRow colSpan={7} label="No leaderboard rows were returned." />}
        </tbody>
      </table>
    </div>
  );
}

function AuditView({events, onExport}: {events: PortalAuditEvent[]; onExport: () => void}) {
  return (
    <div className="page-grid">
      <section className="panel span-12">
        <div className="table-toolbar">
          <PanelHeading title="Admin audit log" note={`${events.length} recent events`} />
          <button className="refresh-button" onClick={onExport} type="button">Export CSV</button>
        </div>
        <AuditTable events={events} />
      </section>
    </div>
  );
}

function AuditTable({events}: {events: PortalAuditEvent[]}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>When</th><th>Action</th><th>Target</th><th>Delta</th><th>Balance</th><th>Reason</th><th>Admin</th></tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.auditId}>
              <td>{formatDate(event.createdAt)}</td>
              <td>{event.action}</td>
              <td><small>{event.targetUserId || "n/a"}</small></td>
              <td>{event.delta === null ? "n/a" : event.delta.toLocaleString()}</td>
              <td>
                {event.previousBalance === null || event.newBalance === null
                  ? "n/a"
                  : `${event.previousBalance.toLocaleString()} -> ${event.newBalance.toLocaleString()}`}
              </td>
              <td>{event.reason || "n/a"}</td>
              <td><small>{event.adminUserId || "n/a"}</small></td>
            </tr>
          ))}
          {events.length === 0 && <EmptyTableRow colSpan={7} label="No audit events were returned." />}
        </tbody>
      </table>
    </div>
  );
}

function OperationsView({
  diagnostic,
  disabled,
  onGenerateDaily,
  onRunDiagnostic,
  onSeed,
}: {
  diagnostic: DiagnosticState;
  disabled: boolean;
  onGenerateDaily: (force: boolean) => Promise<void>;
  onRunDiagnostic: (kind: "daily" | "classic" | "leaderboard") => Promise<void>;
  onSeed: (count: number) => Promise<void>;
}) {
  const [classicCount, setClassicCount] = useState(5);
  return (
    <div className="operations-grid">
      <article className="operation-card urgent">
        <span className="operation-number">01</span>
        <p className="eyebrow">Daily content</p>
        <h2>Generate today&apos;s challenge</h2>
        <p>Creates a daily riddle only when today&apos;s content is missing.</p>
        <button className="primary-button" disabled={disabled} onClick={() => void onGenerateDaily(false)} type="button">
          Generate if missing
        </button>
      </article>
      <article className="operation-card">
        <span className="operation-number">02</span>
        <p className="eyebrow">Recovery action</p>
        <h2>Replace today&apos;s challenge</h2>
        <p>Forces fresh generation across the current daily pipeline.</p>
        <button className="danger-button" disabled={disabled} onClick={() => void onGenerateDaily(true)} type="button">
          Force regeneration
        </button>
      </article>
      <article className="operation-card wide">
        <span className="operation-number">03</span>
        <p className="eyebrow">Localized inventory</p>
        <h2>Seed every supported language</h2>
        <p>Fills localized classic banks and generates current daily content.</p>
        <div className="inline-action">
          <label>
            Classic riddles per locale
            <input
              type="number"
              min={1}
              max={100}
              value={classicCount}
              onChange={(event) => setClassicCount(Number(event.target.value))}
            />
          </label>
          <button className="primary-button" disabled={disabled} onClick={() => void onSeed(classicCount)} type="button">
            Seed localized content
          </button>
        </div>
      </article>
      <article className="operation-card wide diagnostics-card">
        <span className="operation-number">04</span>
        <p className="eyebrow">Callable diagnostics</p>
        <h2>Live service checks</h2>
        <div className="diagnostic-actions">
          <button className="google-button" disabled={disabled} onClick={() => void onRunDiagnostic("daily")} type="button">
            Check daily
          </button>
          <button className="google-button" disabled={disabled} onClick={() => void onRunDiagnostic("classic")} type="button">
            Check classic
          </button>
          <button
            className="google-button"
            disabled={disabled}
            onClick={() => void onRunDiagnostic("leaderboard")}
            type="button"
          >
            Check leaderboard
          </button>
        </div>
        {diagnostic && (
          <div className={diagnostic.status === "success" ? "diagnostic-output" : "diagnostic-output error"}>
            <strong>{diagnostic.title}</strong>
            <pre>{diagnostic.body}</pre>
          </div>
        )}
      </article>
    </div>
  );
}

function DailyPulse({
  items,
}: {
  items: Array<{locale: string; available: boolean; challengeKey: string | null; text: string | null}>;
}) {
  return (
    <div className="daily-pulse">
      {items.map((item) => (
        <div key={item.locale}>
          <span className={item.available ? "status-dot healthy" : "status-dot"} />
          <strong>{item.locale.toUpperCase()}</strong>
          <small>{item.challengeKey || (item.available ? "Available" : "Missing")}</small>
        </div>
      ))}
    </div>
  );
}

function LeaderboardMini({entries}: {entries: PortalLeaderboardEntry[]}) {
  if (entries.length === 0) {
    return <p className="muted empty-note">No leaderboard rows were returned.</p>;
  }

  return (
    <div className="mini-list">
      {entries.slice(0, 5).map((entry, index) => (
        <div key={entry.userId}>
          <span>{index + 1}</span>
          <strong>{entry.username}</strong>
          <small>Level {entry.level} / {entry.xp.toLocaleString()} XP</small>
        </div>
      ))}
    </div>
  );
}

function AuditMini({events}: {events: PortalAuditEvent[]}) {
  if (events.length === 0) {
    return <p className="muted empty-note">No audit events were returned.</p>;
  }

  return (
    <div className="mini-list">
      {events.slice(0, 5).map((event) => (
        <div key={event.auditId}>
          <span>{event.delta ?? "-"}</span>
          <strong>{event.action}</strong>
          <small>{event.reason || formatDate(event.createdAt)}</small>
        </div>
      ))}
    </div>
  );
}

function leaderboardTitle(kind: LeaderboardKind): string {
  if (kind === "totalWins") return "Wins";
  if (kind === "bestStreak") return "Streak";
  return "XP";
}

function EmptyTableRow({colSpan, label}: {colSpan: number; label: string}) {
  return (
    <tr>
      <td className="empty-row" colSpan={colSpan}>{label}</td>
    </tr>
  );
}

function createHarnessPortalOverview(): PortalOverview {
  const now = Date.now();
  const users: PortalUser[] = [
    {
      userId: "user-ada",
      username: "Ada",
      email: "ada@example.com",
      coins: 420,
      gamesPlayed: 32,
      wins: 26,
      winRate: 0.81,
      classicIndex: 28,
      preferredLanguage: "en",
      lastLogin: now - 20 * 60 * 1000,
    },
    {
      userId: "user-mina",
      username: "Mina",
      email: "mina@example.com",
      coins: 1160,
      gamesPlayed: 18,
      wins: 12,
      winRate: 0.67,
      classicIndex: 15,
      preferredLanguage: "fr",
      lastLogin: now - 5 * 60 * 60 * 1000,
    },
    {
      userId: "user-tal",
      username: "Tal",
      email: "",
      coins: 75,
      gamesPlayed: 5,
      wins: 2,
      winRate: 0.4,
      classicIndex: 6,
      preferredLanguage: "es",
      lastLogin: now - 4 * 24 * 60 * 60 * 1000,
    },
  ];

  const leaderboard = [
    {userId: "user-mina", username: "Mina", level: 9, xp: 3100, totalWins: 12, bestStreak: 8, updatedAt: now},
    {userId: "user-ada", username: "Ada", level: 8, xp: 2800, totalWins: 26, bestStreak: 11, updatedAt: now},
    {userId: "user-tal", username: "Tal", level: 3, xp: 640, totalWins: 2, bestStreak: 2, updatedAt: now},
  ];

  return {
    generatedAt: now,
    metrics: {
      userCount: 1284,
      classicCount: 640,
      localizedRiddleCount: 10880,
      healthyDailyLocales: 16,
      localeCount: 17,
      activeUsersLoaded: users.length,
      totalCoinsLoaded: users.reduce((total, user) => total + user.coins, 0),
      auditEventsLoaded: 2,
    },
    users,
    riddles: [
      {
        riddleId: "classic-en-001",
        text: "What has keys but cannot open doors?",
        answer: "piano",
        locale: "en",
        category: "classic",
        index: 1,
        challengeKey: null,
      },
      {
        riddleId: "classic-en-002",
        text: "What speaks without a mouth?",
        answer: "echo",
        locale: "en",
        category: "classic",
        index: 2,
        challengeKey: null,
      },
      {
        riddleId: "current",
        text: "I can be cracked, made, told, and played.",
        answer: "joke",
        locale: "en",
        category: "daily",
        index: null,
        challengeKey: "2026-07-05",
      },
    ],
    localizedCounts: [
      {locale: "en", count: 640},
      {locale: "fr", count: 620},
      {locale: "es", count: 604},
      {locale: "de", count: 600},
      {locale: "ja", count: 584},
      {locale: "ar", count: 540},
    ],
    dailyByLocale: [
      {locale: "en", available: true, challengeKey: "2026-07-05", text: "I can be cracked, made, told, and played."},
      {locale: "fr", available: true, challengeKey: "2026-07-05", text: "Pretend French daily clue"},
      {locale: "es", available: true, challengeKey: "2026-07-05", text: "Pretend Spanish daily clue"},
      {locale: "de", available: true, challengeKey: "2026-07-05", text: "Pretend German daily clue"},
      {locale: "ja", available: true, challengeKey: "2026-07-05", text: "Pretend Japanese daily clue"},
      {locale: "ar", available: false, challengeKey: null, text: null},
    ],
    auditLog: [
      {
        auditId: "audit-1",
        action: "adjust-user-coins",
        adminUserId: "operator@example.com",
        targetUserId: "user-tal",
        delta: 50,
        previousBalance: 25,
        newBalance: 75,
        reason: "Support correction",
        createdAt: now - 60 * 60 * 1000,
      },
      {
        auditId: "audit-2",
        action: "adjust-user-coins",
        adminUserId: "operator@example.com",
        targetUserId: "user-mina",
        delta: -100,
        previousBalance: 1260,
        newBalance: 1160,
        reason: "Duplicate reward reversal",
        createdAt: now - 8 * 60 * 60 * 1000,
      },
    ],
    leaderboard: {
      xp: leaderboard,
      totalWins: [...leaderboard].sort((left, right) => right.totalWins - left.totalWins),
      bestStreak: [...leaderboard].sort((left, right) => right.bestStreak - left.bestStreak),
    },
  };
}

function applyHarnessCoinAdjustment(
  overview: PortalOverview | null,
  userId: string,
  delta: number,
  reason: string,
): PortalOverview | null {
  if (!overview) return overview;
  const target = overview.users.find((user) => user.userId === userId);
  if (!target) return overview;
  const nextBalance = Math.max(0, target.coins + delta);
  const nextUsers = overview.users.map((user) => (user.userId === userId ? {...user, coins: nextBalance} : user));

  return {
    ...overview,
    metrics: {
      ...overview.metrics,
      totalCoinsLoaded: nextUsers.reduce((total, user) => total + user.coins, 0),
      auditEventsLoaded: (overview.auditLog?.length ?? 0) + 1,
    },
    users: nextUsers,
    auditLog: [
      {
        auditId: `harness-${Date.now()}`,
        action: "adjust-user-coins",
        adminUserId: "operator@example.com",
        targetUserId: userId,
        delta,
        previousBalance: target.coins,
        newBalance: nextBalance,
        reason,
        createdAt: Date.now(),
      },
      ...(overview.auditLog ?? []),
    ],
  };
}

function createHarnessDiagnosticPayload(kind: "daily" | "classic" | "leaderboard") {
  if (kind === "leaderboard") {
    return {entries: createHarnessPortalOverview().leaderboard?.xp.slice(0, 2), requestingUserId: "user-ada"};
  }

  return {
    challenge: {
      date: "2026-07-05",
      totalQuestions: 1,
      questions: [
        {
          riddleId: kind === "daily" ? "current" : "classic-en-001",
          text: kind === "daily" ? "I can be cracked, made, told, and played." : "What has keys but cannot open doors?",
          answer: kind === "daily" ? "joke" : "piano",
          questionNumber: 1,
        },
      ],
    },
    currentQuestion: 1,
    hasCompletedToday: false,
    questionsCompleted: 0,
  };
}

function PanelHeading({title, note}: {title: string; note: string}) {
  return <div className="panel-heading"><h2>{title}</h2><span>{note}</span></div>;
}

function FullPageStatus({label, compact = false}: {label: string; compact?: boolean}) {
  return (
    <div className={compact ? "loading-state compact" : "loading-state"}>
      <div className="loader"><i /><i /><i /></div>
      <span>{label}</span>
    </div>
  );
}
