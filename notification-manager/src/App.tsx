import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {User} from "@supabase/auth-js";
import {createManagementApi} from "./api";
import {Calendar} from "./Calendar";
import {campaignStatus, CampaignDetails, CampaignList} from "./CampaignList";
import {Composer} from "./Composer";
import {type Campaign, type CampaignRequest, type ManagementOverview} from "./contracts";
import {localDay, operatorTimeZone} from "./dates";
import {createManagementConnection, managementError, type ManagementConnection} from "./supabase";
import {Icon} from "./Icons";
import {DraftWorkspace} from "./DraftWorkspace";

type Page = "compose" | "calendar" | "history";
type Connection = {kind: "configured"; value: ManagementConnection} | {kind: "setup"; message: string};
type AuthState = {kind: "loading"} | {kind: "signed-out"} | {kind: "signed-in"; user: User};
type WorkspaceData = {configuration: ManagementOverview; campaigns: Campaign[]; activeCursor: string | null; historyCursor: string | null};

const pageCopy: Record<Page, {eyebrow: string; title: string; body: string}> = {
  compose: {eyebrow: "NOTIFICATION COMPOSER", title: "Send a push notification.", body: "Write your message, choose an audience, and send it now or schedule a time."},
  calendar: {eyebrow: "YOUR NOTIFICATION SCHEDULE", title: "Plan your notifications.", body: "Choose a date to see scheduled notifications or create a new message."},
  history: {eyebrow: "EVERY MESSAGE, ACCOUNTED FOR", title: "Follow every notification.", body: "Review the queue and the outcome of each push-service attempt."},
};

function Navigation({page, onChange, disabled = false}: {page: Page; onChange(page: Page): void; disabled?: boolean}) {
  const items: readonly {id: Page; label: string; icon: "send" | "calendar" | "history"}[] = [
    {id: "compose", label: "Compose", icon: "send"}, {id: "calendar", label: "Calendar", icon: "calendar"}, {id: "history", label: "History", icon: "history"},
  ];
  return <nav className="main-navigation" aria-label="Main navigation">{items.map(item => <button key={item.id} type="button" className={page === item.id ? "active" : ""} disabled={disabled} aria-current={page === item.id ? "page" : undefined} onClick={() => onChange(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{page === item.id && <i />}</button>)}</nav>;
}

function Brand() {
  return <a className="brand" href="#main"><span className="app-mark"><Icon name="bell" size={24} /></span><span>riddle quest<small>NOTIFICATION STUDIO</small></span></a>;
}

function Login({connection, onDrafts}: {connection: Connection; onDrafts(): void}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = async () => {
    if (connection.kind !== "configured" || busy) return;
    setBusy(true); setError(null);
    try {await connection.value.signIn();}
    catch (failure) {setError(managementError(failure));}
    finally {setBusy(false);}
  };
  return <div className="application">
    <aside className="sidebar"><Brand /><span className="sidebar-section">WORKSPACE</span><Navigation page="compose" onChange={() => {}} disabled /><div className="sidebar-footer"><Icon name="shield" size={18} /><span>Private team workspace<small>Push delivery only</small></span></div></aside>
    <div className="workspace"><header className="topbar"><span className="breadcrumb">Workspace <span>/</span> Notifications</span><span className="service-badge"><span />PUSH ONLY</span></header><main id="main" className="main-content login-content">
      <div className="login-intro"><span className="eyebrow">HELLO, GOOD TIMING.</span><h1>Small messages.<br />More moments of play.</h1><p>A dedicated place to send your next notification, plan ahead, and follow every push.</p><div className="login-features"><span><Icon name="send" />Send in the moment</span><span><Icon name="calendar" />Plan it on the calendar</span><span><Icon name="history" />Keep a clear record</span></div></div>
      <section className="panel login-panel"><span className="app-mark"><Icon name="shield" size={25} /></span><h2>Sign in to Notification Studio.</h2><p>{connection.kind === "configured" ? "Sign in with an approved team account to manage Riddle Quest notifications." : "Sign-in is not available yet. Please contact the workspace administrator."}</p>
        {connection.kind === "configured" ? <button type="button" className="button-primary google-sign-in" disabled={busy} onClick={() => {void signIn();}}><span className="google-letter" aria-hidden="true">G</span>{busy ? "Opening sign-in…" : "Continue with Google"}</button> : <div className="setup-note"><strong>Sign-in unavailable</strong><p>The administrator needs to finish connecting the sign-in service.</p>{import.meta.env.DEV && <details><summary>Development configuration</summary><p>{connection.message}</p></details>}</div>}
        {import.meta.env.DEV && <button type="button" className="button-secondary" onClick={onDrafts}>Open local drafts workspace</button>}
        {error && <p className="inline-message error-message" role="alert">{error}</p>}
        <div className="login-security"><Icon name="shield" size={16} /><span>Only approved administrators can send messages.</span></div>
      </section>
    </main><footer className="workspace-footer"><span>Riddle Quest · Notification Studio</span><span>Always push. Thoughtfully timed.</span></footer></div>
  </div>;
}

function Workspace({connection, user, onAccessDenied}: {connection: ManagementConnection; user: User; onAccessDenied(message: string): void}) {
  const [page, setPage] = useState<Page>("compose");
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => localDay(new Date()));
  const [scheduleRequest, setScheduleRequest] = useState<{day: string; revision: number} | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loadingMore, setLoadingMore] = useState<"active" | "history" | null>(null);
  const pageCounts = useRef({active: 1, history: 1});
  const version = useRef(0);
  const actionControllers = useRef(new Set<AbortController>());
  const mounted = useRef(true);
  const selectedId = useRef<string | null>(null);
  selectedId.current = selected?.id ?? null;
  const api = useMemo(() => createManagementApi(connection, user.id, onAccessDenied), [connection, user.id, onAccessDenied]);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true, inFlight = false, pendingRefresh = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (!active) return;
      if (inFlight) {pendingRefresh = true; return;}
      inFlight = true; setRefreshing(true);
      const revision = version.current;
      try {
        const readPages = async (view: "active" | "history") => {
          const campaigns: Campaign[] = [];
          let cursor: string | null = null;
          for (let pageIndex = 0; pageIndex < pageCounts.current[view]; pageIndex += 1) {
            const result = await api.campaigns(view, controller.signal, cursor ?? undefined);
            campaigns.push(...result.campaigns);
            cursor = result.nextCursor;
            if (!cursor) break;
          }
          return {campaigns, nextCursor: cursor};
        };
        const [configuration, activePage, historyPage, detail] = await Promise.all([api.configuration(controller.signal), readPages("active"), readPages("history"), selectedId.current ? api.campaign(selectedId.current, controller.signal) : Promise.resolve(null)]);
        if (!active || controller.signal.aborted) return;
        if (revision === version.current) {
          const campaigns = [...new Map([...activePage.campaigns, ...historyPage.campaigns].map(campaign => [campaign.id, campaign])).values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          setData({configuration, campaigns, activeCursor: activePage.nextCursor, historyCursor: historyPage.nextCursor});
          setSelected(current => current ? detail?.id === current.id ? detail : campaigns.find(campaign => campaign.id === current.id) ?? current : null);
        }
        setError(null);
      } catch (failure) {
        if (active && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The notification service could not be loaded.");
      } finally {
        inFlight = false;
        if (active) {setLoading(false); setRefreshing(false);}
        if (active && (pendingRefresh || revision !== version.current)) {
          pendingRefresh = false;
          void refresh();
        }
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const onVisibility = () => {if (document.visibilityState === "visible") void refresh();};
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {if (document.visibilityState !== "hidden") void refresh();}, 10_000);
    return () => {active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility);};
  }, [api]);
  useEffect(() => {
    mounted.current = true;
    const controllers = actionControllers.current;
    return () => {mounted.current = false; controllers.forEach(controller => controller.abort()); controllers.clear();};
  }, []);
  const upsert = useCallback((campaign: Campaign) => {
    version.current += 1;
    setData(current => current ? {...current, campaigns: [campaign, ...current.campaigns.filter(value => value.id !== campaign.id)].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))} : current);
    setSelected(current => current?.id === campaign.id ? campaign : current);
  }, []);
  const create = async (input: CampaignRequest) => {
    const controller = new AbortController();
    actionControllers.current.add(controller);
    try {
      const campaign = await api.create(input, controller.signal);
      if (mounted.current && !controller.signal.aborted) upsert(campaign);
      return campaign;
    } finally {
      actionControllers.current.delete(controller);
      if (mounted.current && !controller.signal.aborted) void refreshRef.current();
    }
  };
  const cancel = async (campaign: Campaign) => {
    const controller = new AbortController();
    actionControllers.current.add(controller);
    try {
      const updated = await api.cancel(campaign.id, controller.signal);
      if (mounted.current && !controller.signal.aborted) upsert(updated);
    } finally {
      actionControllers.current.delete(controller);
      if (mounted.current && !controller.signal.aborted) void refreshRef.current();
    }
  };
  const upload = async (file: File) => {
    const controller = new AbortController();
    actionControllers.current.add(controller);
    try {return await connection.uploadImage(file, user.id, controller.signal);}
    finally {actionControllers.current.delete(controller);}
  };
  const loadMore = async (view: "active" | "history") => {
    const cursor = view === "active" ? data?.activeCursor : data?.historyCursor;
    if (!cursor || loadingMore) return;
    const controller = new AbortController();
    actionControllers.current.add(controller);
    setLoadingMore(view);
    try {
      const result = await api.campaigns(view, controller.signal, cursor);
      if (!mounted.current || controller.signal.aborted) return;
      version.current += 1;
      pageCounts.current[view] += 1;
      setData(current => current ? {...current,
        campaigns: [...new Map([...current.campaigns, ...result.campaigns].map(campaign => [campaign.id, campaign])).values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        ...(view === "active" ? {activeCursor: result.nextCursor} : {historyCursor: result.nextCursor}),
      } : current);
      setError(null);
    } catch (failure) {if (mounted.current && !controller.signal.aborted) setError(managementError(failure));}
    finally {actionControllers.current.delete(controller); if (mounted.current) setLoadingMore(null);}
  };
  const scheduleDay = () => {
    setScheduleRequest(current => ({day: selectedDay, revision: (current?.revision ?? 0) + 1}));
    setPage("compose");
    requestAnimationFrame(() => document.getElementById("notification-title")?.focus());
  };
  const campaigns = data?.campaigns ?? [];
  const active = campaigns.filter(campaign => campaign.status === "queued" || campaign.status === "sending");
  const today = localDay(new Date());
  const upcoming = [...active].sort((a, b) => Date.parse(a.sendAt) - Date.parse(b.sendAt));
  const dayCampaigns = campaigns.filter(campaign => localDay(new Date(campaign.sendAt)) === selectedDay).sort((a, b) => Date.parse(a.sendAt) - Date.parse(b.sendAt));
  const history = campaigns.filter(campaign => (filter === "all" || filter === "active" && ["queued", "sending"].includes(campaign.status) || campaign.status === filter) && `${campaign.title} ${campaign.body}`.toLowerCase().includes(search.toLowerCase()));
  const displayName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "Team account";
  const initials = displayName.split(/\s+/u).map(value => value.charAt(0)).slice(0, 2).join("").toUpperCase();
  return <div className="application">
    <aside className="sidebar"><Brand /><span className="sidebar-section">WORKSPACE</span><Navigation page={page} onChange={setPage} /><div className="sidebar-tip"><span className="sparkle" aria-hidden="true">✦</span><strong>A little nudge.<br />A big adventure.</strong><p>Keep your players curious about what's next.</p></div><div className="sidebar-footer"><Icon name="shield" size={18} /><span>Hosted push service<small>Riddle Quest</small></span></div></aside>
    <div className="workspace"><header className="topbar"><span className="breadcrumb">Workspace <span>/</span> Notifications</span><div className="topbar-right"><span className="service-badge"><span />PUSH ONLY</span><div className="operator"><span className="avatar">{initials}</span><div><strong>{displayName}</strong><small>{user.email}</small></div></div><button type="button" className="icon-button" aria-label="Sign out" onClick={() => {void connection.signOut().catch(failure => setError(managementError(failure)));}}><Icon name="logout" size={18} /></button></div></header>
      <main id="main" className="main-content">
        <div className="page-heading"><div><span className="eyebrow">{pageCopy[page].eyebrow}</span><h1>{pageCopy[page].title}</h1><p>{pageCopy[page].body}</p></div><span className="timezone-label"><Icon name="clock" size={16} />{operatorTimeZone}</span></div>
        <div className="summary-grid"><article><span className="summary-icon purple"><Icon name="calendar" /></span><div><span>Upcoming notifications</span><strong>{data ? data.configuration.campaignSummary.upcoming.toLocaleString() : "—"}<small>queued or sending</small></strong></div></article><article><span className="summary-icon orange"><Icon name="send" /></span><div><span>Accepted today</span><strong>{data ? data.configuration.campaignSummary.acceptedToday.toLocaleString() : "—"}<small>push-service acceptances</small></strong></div></article><article><span className="summary-icon green"><Icon name="bell" /></span><div><span>Registered browser devices</span><strong>{data?.configuration.firebaseAudience.status === "connected" ? data.configuration.firebaseAudience.registeredDevices.toLocaleString() : "—"}<small>{data?.configuration.firebaseAudience.status === "connected" ? `${data.configuration.firebaseAudience.accounts.toLocaleString()} Firebase accounts` : data?.configuration.firebaseAudience.status === "unavailable" ? "Firebase connection unavailable" : "Firebase push not connected"}</small></strong></div></article></div>
        {data?.activeCursor && <div className="pagination-note" role="status"><span>More scheduled notifications are available. Load them to include every date in the calendar.</span><button type="button" className="button-secondary compact-button" disabled={Boolean(loadingMore) || refreshing} onClick={() => {void loadMore("active");}}>{loadingMore === "active" ? "Loading…" : "Load more scheduled"}</button></div>}
        {error && <div className="workspace-error" role="alert"><span>{error}</span><button type="button" disabled={refreshing} onClick={() => {void refreshRef.current();}}>Try again</button></div>}
        {loading && !data ? <div className="panel loading-state" role="status"><span className="spinner" /> Loading your notification workspace…</div> : !data ? <div className="panel empty-state"><Icon name="shield" size={30} /><h2>We couldn't open this workspace.</h2><p>Check your access and the service configuration, then try again.</p><button className="button-secondary" type="button" onClick={() => {void refreshRef.current();}}>Retry connection</button></div> : <>
          <section hidden={page !== "compose"} aria-label="Compose notification"><Composer draftOwner={user.id} configuration={data.configuration} campaigns={campaigns} scheduleRequest={scheduleRequest} onCreate={create} onUpload={upload} /><section className="panel upcoming-panel"><div className="section-heading"><div><h2>Up next</h2><p>Your next scheduled moments.</p></div><button type="button" className="text-button" onClick={() => setPage("calendar")}>View calendar <Icon name="right" size={16} /></button></div><CampaignList campaigns={upcoming.slice(0, 4)} onSelect={setSelected} /></section></section>
          <section hidden={page !== "calendar"} aria-label="Notification calendar" className="calendar-layout"><div className="panel calendar-panel"><Calendar selectedDay={selectedDay} onSelect={setSelectedDay} campaigns={campaigns} /><div className="calendar-legend"><span><i /> Scheduled notification</span><span>All times in {operatorTimeZone}</span></div></div><aside className="panel day-panel"><div className="section-heading"><div><span className="eyebrow">SELECTED DAY</span><h2>{new Intl.DateTimeFormat(undefined, {month: "long", day: "numeric"}).format(new Date(`${selectedDay}T12:00:00`))}</h2><p>{dayCampaigns.length} notification{dayCampaigns.length === 1 ? "" : "s"}</p></div></div>{dayCampaigns.length ? <ul className="day-campaigns">{dayCampaigns.map(campaign => <li key={campaign.id}><time dateTime={campaign.sendAt}>{new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"}).format(new Date(campaign.sendAt))}</time><button type="button" onClick={() => setSelected(campaign)}><strong>{campaign.title}</strong><span className={`status status-${campaign.status}`}>{campaignStatus(campaign)}</span></button></li>)}</ul> : <div className="day-empty"><Icon name="calendar" size={32} /><strong>A little room for something good.</strong><p>No notifications are planned for this day.</p></div>}<button className="button-primary" type="button" disabled={selectedDay < today} onClick={scheduleDay}><Icon name="plus" size={18} /> Schedule on this day</button></aside></section>
          <section hidden={page !== "history"} aria-label="Notification history" className="panel history-panel"><div className="section-heading"><div><h2>Notification history</h2><p>Loaded campaigns and their push-service outcomes.</p></div><button className="button-secondary compact-button" type="button" disabled={refreshing} onClick={() => {void refreshRef.current();}}><Icon name="refresh" size={16} />{refreshing ? "Refreshing…" : "Refresh"}</button></div><div className="history-filters"><label className="search-field"><Icon name="search" size={17} /><span className="visually-hidden">Search notifications</span><input placeholder="Find a notification…" value={search} onChange={event => setSearch(event.target.value)} /></label><label><span className="visually-hidden">Filter notification status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Queued and sending</option><option value="complete">Complete</option><option value="cancelled">Cancelled</option></select></label></div><CampaignList campaigns={history} onSelect={setSelected} emptyTitle={search || filter !== "all" ? "No matching notifications." : undefined} emptyBody={search || filter !== "all" ? "Try another search or status filter." : undefined} />{data.historyCursor && <div className="load-more-row"><button type="button" className="button-secondary compact-button" disabled={Boolean(loadingMore) || refreshing} onClick={() => {void loadMore("history");}}>{loadingMore === "history" ? "Loading history…" : "Load older history"}</button></div>}<div className="table-note"><Icon name="shield" size={15} /> Accepted counts confirm a push-service response, not delivery to a device.</div></section>
        </>}
      </main><footer className="workspace-footer"><span>Riddle Quest · Notification Studio</span><span>Always push. Thoughtfully timed.</span></footer>
    </div>
    {selected && <CampaignDetails key={selected.id} campaign={selected} onClose={() => setSelected(null)} onCancel={cancel} />}
  </div>;
}

function OperatorWorkspace({connection, user}: {connection: ManagementConnection; user: User}) {
  const [access, setAccess] = useState<{kind: "checking"} | {kind: "allowed"} | {kind: "denied"; message: string}>({kind: "checking"});
  const [attempt, setAttempt] = useState(0);
  const onAccessDenied = useCallback((message: string) => setAccess({kind: "denied", message}), []);
  useEffect(() => {
    const controller = new AbortController();
    setAccess({kind: "checking"});
    void createManagementApi(connection, user.id).configuration(controller.signal).then(() => {
      if (!controller.signal.aborted && connection.isCurrentUser(user.id)) setAccess({kind: "allowed"});
    }).catch(failure => {
      if (!controller.signal.aborted) setAccess({kind: "denied", message: managementError(failure)});
    });
    return () => controller.abort();
  }, [connection, user.id, attempt]);
  if (access.kind === "allowed") return <Workspace connection={connection} user={user} onAccessDenied={onAccessDenied} />;
  return <main className="boot-state"><span className="app-mark"><Icon name="shield" /></span>
    {access.kind === "checking" ? <><span className="spinner" /><p>Checking workspace access…</p></> : <><h1>Workspace access required</h1><p role="alert">{access.message}</p><p>Only approved team accounts can open the notification workspace.</p><button className="button-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button><button className="text-button" onClick={() => {void connection.signOut().catch(failure => setAccess({kind: "denied", message: managementError(failure)}));}}>Sign out</button></>}
  </main>;
}

export function App() {
  const [localDrafts, setLocalDrafts] = useState(false);
  const [connection] = useState<Connection>(() => {
    try {return {kind: "configured", value: createManagementConnection()};}
    catch (failure) {return {kind: "setup", message: failure instanceof Error ? failure.message : "The notification workspace is not configured."};}
  });
  const [auth, setAuth] = useState<AuthState>({kind: "loading"});
  useEffect(() => {
    if (connection.kind !== "configured") return;
    let active = true, observed = false;
    const {data} = connection.value.client.auth.onAuthStateChange((_event, session) => {
      observed = true;
      if (active) setAuth(session ? {kind: "signed-in", user: session.user} : {kind: "signed-out"});
    });
    void connection.value.client.auth.getSession().then(({data: initial}) => {
      if (active && !observed) setAuth(initial.session ? {kind: "signed-in", user: initial.session.user} : {kind: "signed-out"});
    }).catch(() => {if (active && !observed) setAuth({kind: "signed-out"});});
    return () => {active = false; data.subscription.unsubscribe();};
  }, [connection]);
  if (connection.kind === "configured" && auth.kind === "signed-in") return <OperatorWorkspace key={auth.user.id} connection={connection.value} user={auth.user} />;
  if (connection.kind === "configured" && auth.kind === "loading") return <main className="boot-state"><span className="app-mark"><Icon name="bell" size={26} /></span><span className="spinner" /><p>Opening Notification Studio…</p></main>;
  if (import.meta.env.DEV && localDrafts) return <DraftWorkspace onBack={() => setLocalDrafts(false)} />;
  return <Login connection={connection} onDrafts={() => setLocalDrafts(true)} />;
}
