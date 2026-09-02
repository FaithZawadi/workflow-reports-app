"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, LINE, PASS, FAIL } from "@/lib/theme";

// Approvers (admin / manager / PM / TM) confirm or reject the clients AND sites
// that technicians register while filing reports. Any approver may act.
export default function ClientApprovals() {
  const [clients, setClients] = useState(null);
  const [sites, setSites] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null); // "type:id" being acted on

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/clients/pending", { cache: "no-store" });
      if (!r.ok) return setErr("Could not load pending registrations.");
      const d = await r.json();
      setClients(d.clients || []);
      setSites(d.sites || []);
    } catch {
      setErr("Could not load pending registrations.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (kind, row, decision) => {
    let note = "";
    if (decision === "reject") {
      note = window.prompt(`Reject “${row.name}”? Add a short reason (optional):`, "") ?? null;
      if (note === null) return; // cancelled
    }
    const key = `${kind}:${row.id}`;
    setBusy(key);
    try {
      const url = kind === "site" ? `/api/sites/${row.id}/approve` : `/api/clients/${row.id}/approve`;
      const r = await fetch(url, {
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

  const Row = ({ kind, row, subtitle }) => {
    const key = `${kind}:${row.id}`;
    return (
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>{row.name}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" style={{ fontSize: 12, background: PASS, color: "#fff", borderColor: PASS, fontWeight: 800 }} disabled={busy === key} onClick={() => decide(kind, row, "approve")}>
              {busy === key ? "…" : "Approve"}
            </button>
            <button className="btn" style={{ fontSize: 12, color: FAIL, borderColor: LINE }} disabled={busy === key} onClick={() => decide(kind, row, "reject")}>
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  };

  const nothing = clients && clients.length === 0 && sites.length === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Approvals</p>
          <h1 className="h1">Client &amp; site registrations</h1>
          <p className="muted">New clients and sites technicians added while filing — approve to confirm them, or reject.</p>
        </div>
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {clients === null && <div className="muted" style={{ marginTop: 16 }}>Loading…</div>}
      {nothing && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE, marginTop: 16 }}>
          Nothing awaiting approval. 🎉
        </div>
      )}

      {clients && clients.length > 0 && (
        <>
          <h2 className="h2" style={{ fontSize: 15, marginTop: 20 }}>New clients ({clients.length})</h2>
          <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10, marginTop: 8 }}>
            {clients.map((c) => (
              <Row key={c.id} kind="client" row={c}
                subtitle={<>Registered by <b>{c.registeredByName || "—"}</b> · {new Date(c.createdAt).toLocaleDateString()}{c.sites?.length ? ` · sites: ${c.sites.join(", ")}` : ""}</>} />
            ))}
          </div>
        </>
      )}

      {sites.length > 0 && (
        <>
          <h2 className="h2" style={{ fontSize: 15, marginTop: 20 }}>New sites ({sites.length})</h2>
          <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10, marginTop: 8 }}>
            {sites.map((s) => (
              <Row key={s.id} kind="site" row={s}
                subtitle={<>Under <b>{s.clientName}</b> · added by <b>{s.registeredByName || "—"}</b> · {new Date(s.createdAt).toLocaleDateString()}</>} />
            ))}
          </div>
        </>
      )}

      <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
        Approving confirms the record in the registry. Rejecting deactivates it. The person who registered it is notified either way.
        <span style={{ color: GOLD }}> </span>
      </p>
    </div>
  );
}
