import { useEffect } from "react";
import { ready } from "./bridge";

// Skeleton embed UI. The real admin surfaces — Connect (Moniepoint credentials), Terminals
// (serial + permanent NUBAN), and the Clearing-house (suspense-ledger manual matching) —
// land in p2-admin-ui, rendered inside the ss-platform-app iframe host.
export function App() {
  useEffect(() => {
    ready();
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640 }}>
      <h1>Moniepoint · Pay with Bank Transfer</h1>
      <p>Marketplace app (skeleton). Admin surfaces implemented by the Phase-2 build:</p>
      <ul>
        <li>Connect — Moniepoint credentials</li>
        <li>Terminals — serial + permanent NUBAN</li>
        <li>Clearing-house — reconcile unmatched transfers</li>
      </ul>
    </main>
  );
}
