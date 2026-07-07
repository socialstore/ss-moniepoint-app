import { useEffect } from "react";

type Mode = "light" | "dark";

function applyTheme(mode: Mode) {
  // shadcn dark mode keys off the `.dark` class on <html> (see index.css @custom-variant).
  document.documentElement.classList.toggle("dark", mode === "dark");
}

// Follow the platform-app host's theme. The host posts { type: "THEME", mode } on load + whenever the
// merchant flips theme; until it does, we fall back to the OS color scheme. Once the host speaks it wins
// (it is the source of truth for the embed's look).
export function useHostTheme() {
  useEffect(() => {
    // The host bakes the initial theme into ?theme= (also read by the inline script in index.html for a
    // flash-free first paint). If present, treat it as host-provided so the OS scheme can't override it.
    const urlTheme = new URLSearchParams(window.location.search).get("theme");
    let hostControls = urlTheme === "dark" || urlTheme === "light";
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystem = () => {
      if (!hostControls) applyTheme(mq.matches ? "dark" : "light");
    };

    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; mode?: Mode };
      if (d?.type === "THEME" && (d.mode === "light" || d.mode === "dark")) {
        hostControls = true;
        applyTheme(d.mode);
      }
    }

    window.addEventListener("message", onMessage);
    mq.addEventListener("change", applySystem);
    if (hostControls) applyTheme(urlTheme as Mode);
    else applySystem(); // no host hint yet → follow the OS scheme until the host tells us otherwise
    window.parent?.postMessage({ type: "GET_THEME" }, "*"); // nudge the host to send its current theme

    return () => {
      window.removeEventListener("message", onMessage);
      mq.removeEventListener("change", applySystem);
    };
  }, []);
}
