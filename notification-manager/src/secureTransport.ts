export function secureManagementOrigin(): string {
  const location = window.location;
  if (location.protocol === "https:" || import.meta.env.DEV && location.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return location.origin;
  throw new Error("Open the notification manager over HTTPS before signing in or sending requests.");
}
