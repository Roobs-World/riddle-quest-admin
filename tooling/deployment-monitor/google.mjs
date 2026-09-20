/** Credential-free runtime: Cloud Run obtains its narrowly scoped service identity. */
export function googleClient({fetcher = fetch, accessToken = process.env.MONITOR_ACCESS_TOKEN} = {}) {
  let credential = accessToken ? {access_token: accessToken, expiresAt: Infinity} : null;
  return async function request(url, body, options = {}) {
    if (!credential || credential.expiresAt < Date.now() + 60000) {
      const response = await fetcher("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
        headers: {"Metadata-Flavor": "Google"}, signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok) throw new Error("Cloud service identity is unavailable");
      const value = await response.json();
      if (!value.access_token || !Number.isFinite(value.expires_in)) throw new Error("Invalid cloud service identity");
      credential = {...value, expiresAt: Date.now() + value.expires_in * 1000};
    }
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !["logging.googleapis.com", "run.googleapis.com", "storage.googleapis.com"].includes(parsed.hostname)) throw new Error("Unexpected cloud API host");
    const isList = parsed.hostname === "run.googleapis.com";
    if (isList && body) for (const [key, value] of Object.entries(body)) parsed.searchParams.set(key, value);
    const response = await fetcher(parsed, {
      method: options.method ?? (body && !isList ? "POST" : "GET"),
      headers: {Authorization: `Bearer ${credential.access_token}`, "Content-Type": "application/json"},
      ...(body && !isList ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(45000), redirect: "error",
    });
    if (response.status === 404 && options.optional) return null;
    if (!response.ok) {
      const error = new Error(`Cloud API ${parsed.hostname}${parsed.pathname} returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  };
}

export function snapshotStore(request, bucket) {
  if (!/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(bucket ?? "")) throw new Error("Invalid monitoring bucket");
  const objectUrl = (name) => `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`;
  return {
    async read(name) {
      // Metadata and content must refer to the same immutable object generation.
      const metadata = await request(objectUrl(name), undefined, {optional: true});
      if (!metadata) return null;
      const data = await request(`${objectUrl(name)}?alt=media&generation=${metadata.generation}`);
      return {data, generation: metadata.generation};
    },
    async write(name, data, generation = "0") {
      return request(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}&ifGenerationMatch=${generation}`, data);
    },
  };
}
