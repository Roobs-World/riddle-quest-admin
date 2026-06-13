import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";
import {onAuthStateChanged, type User} from "firebase/auth";
import {
  adjustUserCoins,
  auth,
  firebaseConfigurationError,
  generateTodaysChallenge,
  getPortalOverview,
  seedLocalizedRiddles,
  signInWithEmail,
  signInWithGoogle,
  signOutPortal,
  type PortalOverview,
  type PortalUser,
} from "./firebase";

type View = "overview" | "players" | "riddles" | "operations";

const navigation: Array<{id: View; label: string; glyph: string}> = [
  {id: "overview", label: "Overview", glyph: "01"},
  {id: "players", label: "Players", glyph: "02"},
  {id: "riddles", label: "Riddle bank", glyph: "03"},
  {id: "operations", label: "Operations", glyph: "04"},
];

function formatDate(value: number | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message).replace(/^Firebase:\s*/i, "");
  }
  return "Something went wrong.";
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(firebaseConfigurationError);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
      }),
    [],
  );

  const loadOverview = useCallback(async () => {
    if (!user || firebaseConfigurationError) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPortalOverview({userLimit: 100, riddleLimit: 100});
      setOverview(result.data);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return overview?.users ?? [];
    return (overview?.users ?? []).filter((player) =>
      [player.username, player.email, player.userId].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [overview?.users, query]);

  const runOperation = async (operation: () => Promise<string>) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await operation());
      await loadOverview();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return <FullPageStatus label="Opening control room" />;
  }

  if (!user) {
    return <SignInScreen error={error} onError={setError} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Q</div>
          <div>
            <strong>Qwordly</strong>
            <span>Control room</span>
          </div>
        </div>

        <nav aria-label="Portal sections">
          {navigation.map((item) => (
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setView(item.id)}
            >
              <span>{item.glyph}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="live-dot"><i /> Firebase connected</div>
          <button className="text-button" onClick={() => void signOutPortal()}>Sign out</button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Project operations</p>
            <h1>{navigation.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="refresh-button" disabled={loading} onClick={() => void loadOverview()}>
              {loading ? "Refreshing..." : "Refresh data"}
            </button>
            <div className="operator">
              <span>{user.displayName || user.email?.split("@")[0] || "Admin"}</span>
              <small>{user.email}</small>
            </div>
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
                players={filteredUsers}
                query={query}
                setQuery={setQuery}
                disabled={loading}
                onAdjust={(player, delta, reason) =>
                  runOperation(async () => {
                    const result = await adjustUserCoins({userId: player.userId, delta, reason});
                    return `${player.username}'s balance is now ${result.data.newBalance.toLocaleString()} coins.`;
                  })
                }
              />
            )}
            {view === "riddles" && overview && <RiddlesView data={overview} />}
            {view === "operations" && (
              <OperationsView
                disabled={loading}
                onGenerateDaily={(forceGenerate) =>
                  runOperation(async () => {
                    const result = await generateTodaysChallenge({forceGenerate});
                    return result.data.message;
                  })
                }
                onSeed={(classicCount) =>
                  runOperation(async () => {
                    const result = await seedLocalizedRiddles({classicCount, forceGenerateDaily: true});
                    return result.data.message;
                  })
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SignInScreen({
  error,
  onError,
}: {
  error: string | null;
  onError: (message: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleEmailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await signInWithEmail(email, password);
    } catch (nextError) {
      onError(getErrorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="login-brand"><span>Q</span> Qwordly</div>
        <div>
          <p className="eyebrow">Private project portal</p>
          <h1>Keep every riddle, player, and release in view.</h1>
          <p>
            The operational home for Riddle Quest. Monitor content coverage, inspect player health,
            and run controlled backend actions.
          </p>
        </div>
        <div className="signal-strip">
          <span>Players</span><span>Content</span><span>Daily health</span><span>Operations</span>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={handleEmailSignIn}>
          <p className="eyebrow">Authorised operators only</p>
          <h2>Enter the control room</h2>
          <p className="muted">Use a Firebase account with an admin claim or an entry in the `admins` collection.</p>
          {error && <div className="alert error">{error}</div>}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Signing in..." : "Sign in with email"}
          </button>
          <div className="divider"><span>or</span></div>
          <button
            className="google-button"
            disabled={busy}
            type="button"
            onClick={() => void signInWithGoogle().catch((nextError) => onError(getErrorMessage(nextError)))}
          >
            Continue with Google
          </button>
        </form>
      </section>
    </div>
  );
}

function OverviewView({data}: {data: PortalOverview}) {
  const metrics = [
    {label: "Registered players", value: data.metrics.userCount, note: "Firebase user documents"},
    {label: "Localized riddles", value: data.metrics.localizedRiddleCount, note: "Across every language"},
    {
      label: "Daily coverage",
      value: `${data.metrics.healthyDailyLocales}/${data.metrics.localeCount}`,
      note: "Locales with a current challenge",
    },
    {label: "Legacy classics", value: data.metrics.classicCount, note: "Original English collection"},
  ];

  const lowestCoverage = [...data.localizedCounts].sort((a, b) => a.count - b.count).slice(0, 6);
  const recentPlayers = data.users.slice(0, 5);

  return (
    <div className="page-grid">
      <section className="metric-grid">
        {metrics.map((metric, index) => (
          <article className="metric-card" key={metric.label}>
            <span className="metric-index">0{index + 1}</span>
            <strong>{typeof metric.value === "number" ? metric.value.toLocaleString() : metric.value}</strong>
            <h3>{metric.label}</h3>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="panel span-7">
        <PanelHeading title="Language coverage" note="Lowest inventory first" />
        <div className="coverage-list">
          {lowestCoverage.map((item) => {
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
        <PanelHeading title="Daily pulse" note={`Updated ${formatDate(data.generatedAt)}`} />
        <div className="daily-pulse">
          {data.dailyByLocale.slice(0, 8).map((item) => (
            <div key={item.locale}>
              <span className={item.available ? "status-dot healthy" : "status-dot"} />
              <strong>{item.locale.toUpperCase()}</strong>
              <small>{item.challengeKey || (item.available ? "Available" : "Missing")}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel span-12">
        <PanelHeading title="Recently active players" note="Latest sign-ins" />
        <PlayerTable players={recentPlayers} />
      </section>
    </div>
  );
}

function PlayersView({
  players,
  query,
  setQuery,
  disabled,
  onAdjust,
}: {
  players: PortalUser[];
  query: string;
  setQuery: (query: string) => void;
  disabled: boolean;
  onAdjust: (player: PortalUser, delta: number, reason: string) => Promise<void>;
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
          <input
            className="search"
            placeholder="Search name, email, or UID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <PlayerTable players={players} onSelect={setSelected} />
      </section>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <form className="modal-card" onSubmit={submitAdjustment} onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelected(null)}>Close</button>
            <p className="eyebrow">Audited correction</p>
            <h2>Adjust {selected.username}&apos;s coins</h2>
            <p className="muted">Current balance: {selected.coins.toLocaleString()} coins</p>
            <label>
              Change
              <input type="number" value={delta} onChange={(event) => setDelta(event.target.value)} required />
            </label>
            <label>
              Reason
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
            <tr className={onSelect ? "clickable" : ""} key={player.userId} onClick={() => onSelect?.(player)}>
              <td><strong>{player.username}</strong><small>{player.email || player.userId}</small></td>
              <td><span className="language-tag">{player.preferredLanguage.toUpperCase()}</span></td>
              <td>Level {player.classicIndex}</td>
              <td>{player.wins}/{player.gamesPlayed} wins</td>
              <td>{player.coins.toLocaleString()}</td>
              <td>{formatDate(player.lastLogin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiddlesView({data}: {data: PortalOverview}) {
  return (
    <div className="page-grid">
      <section className="panel span-4 inventory-panel">
        <PanelHeading title="Inventory by locale" note="Includes current daily" />
        {data.localizedCounts.map((item) => (
          <div className="inventory-row" key={item.locale}>
            <span>{item.locale.toUpperCase()}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </section>
      <section className="panel span-8">
        <PanelHeading title="English riddle bank" note={`${data.riddles.length} newest records`} />
        <div className="riddle-list">
          {data.riddles.map((riddle) => (
            <article key={riddle.riddleId}>
              <div>
                <span>{riddle.category}</span>
                <small>{riddle.index === null ? riddle.riddleId : `#${riddle.index}`}</small>
              </div>
              <p>{riddle.text || "Missing clue text"}</p>
              <strong>{riddle.answer || "Missing answer"}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function OperationsView({
  disabled,
  onGenerateDaily,
  onSeed,
}: {
  disabled: boolean;
  onGenerateDaily: (force: boolean) => Promise<void>;
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
        <button className="primary-button" disabled={disabled} onClick={() => void onGenerateDaily(false)}>
          Generate if missing
        </button>
      </article>
      <article className="operation-card">
        <span className="operation-number">02</span>
        <p className="eyebrow">Recovery action</p>
        <h2>Replace today&apos;s challenge</h2>
        <p>Forces fresh generation across the current daily pipeline. Use after reviewing a bad clue.</p>
        <button className="danger-button" disabled={disabled} onClick={() => void onGenerateDaily(true)}>
          Force regeneration
        </button>
      </article>
      <article className="operation-card wide">
        <span className="operation-number">03</span>
        <p className="eyebrow">Localized inventory</p>
        <h2>Seed every supported language</h2>
        <p>Fills empty localized classic banks and generates current daily content. This can take several minutes.</p>
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
          <button className="primary-button" disabled={disabled} onClick={() => void onSeed(classicCount)}>
            Seed localized content
          </button>
        </div>
      </article>
    </div>
  );
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
