"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GOLD, COAL, INK, MUTE, FAIL, PASS, WAIT } from "@/lib/theme";

const TYPE_COLOR = { REVIEW: WAIT, APPROVAL: WAIT, DECISION: PASS, TASK: GOLD, FAILURE: FAIL, SYSTEM: FAIL, SCHEDULE: WAIT };
function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.notifications || []);
      setUnread(d.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 45000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markAll = async () => {
    try { await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ markAll: true }) }); } catch {}
    setItems((xs) => xs.map((i) => ({ ...i, read: true })));
    setUnread(0);
  };
  const openItem = async (n) => {
    if (!n.read) {
      fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen((v) => !v); if (!open) load(); }} aria-label="Notifications" title="Notifications"
        style={{ position: "relative", background: "none", border: 0, cursor: "pointer", color: "#fff", padding: 6, display: "flex" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: "absolute", top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, background: FAIL, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, maxWidth: "86vw", background: "#fff", color: INK, border: "1px solid #e6e0d2", borderRadius: 10, boxShadow: "0 12px 34px rgba(0,0,0,.24)", zIndex: 60, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: COAL, color: "#fff" }}>
            <span style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: ".04em" }}>Notifications</span>
            {unread > 0 && <button onClick={markAll} style={{ background: "none", border: 0, color: GOLD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark all read</button>}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {items.length === 0 && <div style={{ padding: 20, textAlign: "center", color: MUTE, fontSize: 13 }}>No notifications yet.</div>}
            {items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: 0, borderBottom: "1px solid #f0ece1", background: n.read ? "#fff" : "#fdf6e3", cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[n.type] || MUTE, marginTop: 5, flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>{n.body}</div>}
                    <div style={{ fontSize: 11, color: "#a89f8d", marginTop: 3 }}>{ago(n.createdAt)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
