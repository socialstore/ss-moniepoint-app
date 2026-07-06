// Bridge to the ss-platform-app embed host. The iframe never holds the dashboard cookie or
// the workspace api-key: it asks the host for a short-lived platform session token and sends
// that to this app's /admin backend, which verifies it (JWKS, aud = this app) and uses its
// own server-side stored key. Skeleton stub — the full versioned protocol
// (READY / NAVIGATE / TOAST / RESIZE / GET_SESSION_TOKEN) lands in p2-admin-ui + p1-app-host-embed.

export type HostMessage = { type: "SESSION_TOKEN"; token: string; exp: number };

export function ready(): void {
  window.parent?.postMessage({ type: "READY" }, "*");
}

export function requestSessionToken(): Promise<string> {
  return new Promise((resolve) => {
    function onMessage(e: MessageEvent) {
      // p2-admin-ui validates e.origin against the platform origin before trusting this.
      const data = e.data as HostMessage;
      if (data?.type === "SESSION_TOKEN") {
        window.removeEventListener("message", onMessage);
        resolve(data.token);
      }
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "GET_SESSION_TOKEN" }, "*");
  });
}
