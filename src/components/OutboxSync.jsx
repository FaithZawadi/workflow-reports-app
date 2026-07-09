"use client";
import { useEffect, useState } from "react";
import { pendingCount, flushOutbox } from "@/lib/outbox";
import { GOLD, COAL, PASS } from "@/lib/theme";

// Watches the offline outbox and forwards queued reports to the server as soon
// as the network is available. Mounted once inside the app shell.
export default function OutboxSync() {
  const [pending, setPending] = useState(0);
  const [justSent, setJustSent] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      const n = await pendingCount();
      if (alive) setPending(n);
    };

    const sync = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if ((await pendingCount()) === 0) return;
      const { sent, remaining } = await flushOutbox();
      if (!alive) return;
      setPending(remaining);
      if (sent > 0) {
        setJustSent(sent);
        setTimeout(() => alive && setJustSent(0), 6000);
        // Refresh any list/detail view now that server state changed.
        window.dispatchEvent(new CustomEvent("qsl:outbox-synced", { detail: { sent } }));
      }
    };

    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);

    setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    refresh();
    sync();

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // A report filed while offline notifies us so the banner updates at once.
    window.addEventListener("qsl:outbox-queued", refresh);
    // Periodic safety net (e.g. flaky connections that never fire "online").
    const timer = setInterval(sync, 30000);

    return () => {
      alive = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("qsl:outbox-queued", refresh);
      clearInterval(timer);
    };
  }, []);

  if (pending === 0 && justSent === 0) return null;

  const banner = {
    position: "fixed",
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 50,
    maxWidth: 520,
    margin: "0 auto",
    padding: "10px 14px",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 6px 20px rgba(0,0,0,.18)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  if (pending > 0) {
    return (
      <div className="app-toast" style={{ ...banner, background: COAL, color: "#fff", border: `1px solid ${GOLD}` }} role="status">
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: online ? GOLD : "#9a9083", flexShrink: 0 }} />
        {online
          ? `Sending ${pending} saved report${pending > 1 ? "s" : ""}…`
          : `Offline — ${pending} report${pending > 1 ? "s" : ""} saved on this device, will send when you're back online.`}
      </div>
    );
  }

  return (
    <div className="app-toast" style={{ ...banner, background: PASS, color: "#fff" }} role="status">
      <span aria-hidden>✓</span>
      {justSent} saved report{justSent > 1 ? "s" : ""} sent successfully.
    </div>
  );
}
