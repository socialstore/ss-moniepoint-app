// Bridge to the ss-platform-app embed host. The iframe never holds the dashboard cookie or
// the workspace api-key: it asks the host for a short-lived platform session token and sends
// that to this app's /admin backend, which verifies it (JWKS, aud = this app) and uses its
// own server-side stored key. Skeleton stub — the full versioned protocol
// (READY / NAVIGATE / TOAST / RESIZE / GET_SESSION_TOKEN) lands in p2-admin-ui + p1-app-host-embed.

export type HostMessage = { type: "SESSION_TOKEN"; token: string; exp: number };

export function ready(): void {
  window.parent?.postMessage({ type: "READY" }, "*");
}

// Ask the host frame for a session token. Resolves to "" if no host answers within the timeout, so a
// standalone/dev load (opened outside the dashboard, no ?token=) can fall back to the empty state
// instead of hanging.
export function requestSessionToken(timeoutMs = 3000): Promise<string> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      resolve(v);
    };
    function onMessage(e: MessageEvent) {
      // p2-admin-ui validates e.origin against the platform origin before trusting this.
      const data = e.data as HostMessage;
      if (data?.type === "SESSION_TOKEN") finish(data.token);
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "GET_SESSION_TOKEN" }, "*");
    setTimeout(() => finish(""), timeoutMs);
  });
}
