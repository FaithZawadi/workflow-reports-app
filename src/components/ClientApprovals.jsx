"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, LINE, PASS, FAIL } from "@/lib/theme";

// Managers approve or reject clients that technicians registered while filing.
export default function ClientApprovals() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null); // id being acted on

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/clients/pending", { cache: "no-store" });
      if (!r.ok) return setErr("Could not load pending clients.");
      setRows((await r.json()).clients || []);
    } catch {
      setErr("Could not load pending clients.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (c, decision) => {
    let note = "";
    if (decision === "reject") {
      note = window.prompt(`Reject “${c.name}”? Add a short reason (optional):`, "") ?? null;
      if (note === null) return; // cancelled
    }
    setBusy(c.id);
    try {
      const r = await fetch(`/api/clients/${c.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Could not save."); setBusy(null); return; }
      await load();
    } catch {
      setErr("Network problem — try again.");
    }
    setBusy(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Approvals</p>
          <h1 className="h1">Client registrations</h1>
          <p className="muted">New clients technicians added while filing reports — approve to confirm them, or reject.</p>
        </div>
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {rows === null && <div className="muted" style={{ marginTop: 16 }}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          Nothing awaiting your approval. 🎉
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10, marginTop: 16 }}>
        {(rows || []).map((c) => (
          <div key={c.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                  Registered by <b>{c.registeredByName || "—"}</b> · {new Date(c.createdAt).toLocaleDateString()}
                  {c.sites?.length ? ` · sites: ${c.sites.join(", ")}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ fontSize: 12, background: PASS, color: "#fff", borderColor: PASS, fontWeight: 800 }} disabled={busy === c.id} onClick={() => decide(c, "approve")}>
                  {busy === c.id ? "…" : "Approve"}
                </button>
                <button className="btn" style={{ fontSize: 12, color: FAIL, borderColor: LINE }} disabled={busy === c.id} onClick={() => decide(c, "reject")}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
        Approving confirms the client in the registry. Rejecting deactivates it. The person who registered it is notified either way.
        <span style={{ color: GOLD }}> </span>
      </p>
    </div>
  );
}
