import { useEffect } from "react";

// Native WebView hosts post { type: 'SAFE_AREA', top, bottom, left, right } — the device notch /
// status-bar / home-indicator insets. We apply them as CSS variables so the app CONTENT clears those
// unsafe regions while the background still fills the screen edge-to-edge. On web the host sends nothing,
// so the insets stay 0 (the dashboard owns its own chrome there).
export function useSafeArea() {
  useEffect(() => {
    const set = (name: string, px?: number) =>
      document.documentElement.style.setProperty(name, `${Math.max(0, Number(px) || 0)}px`);

    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; top?: number; bottom?: number; left?: number; right?: number };
      if (d?.type === "SAFE_AREA") {
        set("--safe-top", d.top);
        set("--safe-bottom", d.bottom);
        set("--safe-left", d.left);
        set("--safe-right", d.right);
      }
    }

    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "GET_SAFE_AREA" }, "*"); // nudge the host to send insets
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
