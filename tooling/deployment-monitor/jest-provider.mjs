export const jestGame = {teamId: "019faa67-d2a6-7169-aa29-a4411a3a3c3d", gameId: "019faa68-f3ec-755d-9ab5-c887fb426801"};

export function dailyActivity(result, now = new Date()) {
  const data = result?.data;
  if (result?.chart !== "dau_summary" || !Array.isArray(data?.date) || !Array.isArray(data.dau)
    || data.date.length !== data.dau.length || data.date.length > 3660
    || (data.registeredDau && data.registeredDau.length !== data.date.length)) throw new Error("Invalid Jest analytics shape");
  const seen = new Set();
  return data.date.map((date, index) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
      || new Date(date).toISOString().slice(0, 10) !== date || seen.has(date)) throw new Error("Invalid Jest reporting day");
    seen.add(date);
    const active = data.dau[index];
    const registered = data.registeredDau?.[index] ?? null;
    if (!Number.isSafeInteger(active) || active < 0 || (registered !== null && (!Number.isSafeInteger(registered) || registered < 0 || registered > active))) throw new Error("Invalid Jest player count");
    return {date, platform: "Jest", dailyActiveUsers: active, registeredDailyActiveUsers: registered};
  }).filter(({date}) => date < now.toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date));
}

async function rpcResult(response, id) {
  if (!response.ok) throw new Error(`Jest MCP returned ${response.status}`);
  const text = await response.text();
  const messages = response.headers.get("content-type")?.includes("text/event-stream")
    ? text.split(/\r?\n\r?\n/).flatMap((event) => {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      return data ? [JSON.parse(data)] : [];
    }) : [JSON.parse(text)];
  const result = messages.find((message) => message.id === id);
  if (!result || result.error || result.result?.isError) throw new Error("Jest MCP operation failed");
  return result.result;
}

export async function readJestAnalytics(accessToken, {fetcher = fetch} = {}) {
  const headers = {Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream"};
  const send = (body) => fetcher("https://jest.com/mcp", {method: "POST", headers,
    body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(45000)});
  const initialized = await send({jsonrpc: "2.0", id: 1, method: "initialize", params: {protocolVersion: "2025-03-26", capabilities: {}, clientInfo: {name: "riddle-quest-monitoring", version: "1.0.0"}}});
  const initialization = await rpcResult(initialized, 1);
  headers["MCP-Protocol-Version"] = initialization.protocolVersion;
  const session = initialized.headers.get("mcp-session-id");
  if (session) headers["Mcp-Session-Id"] = session;
  const notification = await send({jsonrpc: "2.0", method: "notifications/initialized"});
  if (!notification.ok) throw new Error(`Jest MCP initialization returned ${notification.status}`);
  const result = await rpcResult(await send({jsonrpc: "2.0", id: 2, method: "tools/call", params: {name: "get_game_analytics", arguments: {...jestGame, chart: "dau_summary"}}}), 2);
  if (result.structuredContent?.chart) return result.structuredContent;
  const content = result.content?.find((block) => block.type === "text");
  if (!content) throw new Error("Jest analytics content is unavailable");
  return JSON.parse(content.text);
}

export async function collectJestSnapshot(snapshot, {store, now = new Date(), fetcher = fetch}) {
  const record = await store.read("jest-oauth.json");
  if (!record) return {snapshot, status: "Connection required"};
  let credential = record.data;
  if (!(credential.expiresAt > now.getTime() + 60000)) {
    const response = await fetcher("https://auth.jest.com/oauth2/token", {method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: new URLSearchParams({grant_type: "refresh_token", refresh_token: credential.refreshToken, client_id: credential.clientId})});
    if (!response.ok) throw new Error(`Jest token refresh returned ${response.status}`);
    const token = await response.json();
    if (!token.access_token || !Number.isFinite(token.expires_in)) throw new Error("Invalid refreshed Jest credential");
    credential = {...credential, accessToken: token.access_token, refreshToken: token.refresh_token ?? credential.refreshToken, expiresAt: now.getTime() + token.expires_in * 1000};
    // Persist rotated credentials before making any analytical request.
    await store.write("jest-oauth.json", credential, record.generation);
  }
  const rows = dailyActivity(await readJestAnalytics(credential.accessToken, {fetcher}), now);
  if (!rows.length) throw new Error("Jest returned no completed reporting days");
  return {status: "Succeeded", snapshot: {...snapshot, queries: {...snapshot.queries,
    provider_daily_activity: {rows, source: {
      label: "Jest authenticated game analytics — automatic collection", retrievedAt: now.toISOString(),
      tables: [`Jest get_game_analytics(teamId=${jestGame.teamId}, gameId=${jestGame.gameId}, chart=dau_summary)`],
      filters: ["Provider-reported game-wide daily active users; no deployment identifier or timezone metadata returned.", "Current and future reporting days excluded. Zeroes are observed values; missing fields remain null."],
      metricDefinitions: [{label: "Jest daily active users", definition: "The dau_summary dau field at the provider-reported day grain. Game-wide, not attributable to a release. registeredDau is a separate count of registered daily active users.", componentIds: ["provider-daily-activity"]}],
    }},
  }}};
}
