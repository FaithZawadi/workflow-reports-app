"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, PAPER, LINE } from "@/lib/theme";

const BLANK = { name: "", clientName: "" };

export default function SitesAdmin() {
  const [rows, setRows] = useState(null);
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/sites?manage=1");
    if (!res.ok) return setErr("Could not load sites.");
    setRows((await res.json()).sites || []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
  }, [load]);

  const shown = (rows || []).filter((s) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [s.name, s.client].some((v) => String(v || "").toLowerCase().includes(t));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">Sites &amp; locations</h1>
          <p className="muted">Register each site once. It then appears in the site dropdown when filing a report. Leave the client blank to make a site available to everyone.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => setShowAdd((v) => !v)} style={{ fontSize: 12 }}>
            {showAdd ? "Close" : "+ Add site"}
          </button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {showAdd && <SiteForm clients={clients} onSaved={() => { setShowAdd(false); load(); }} />}

      <input className="input" placeholder="Search site or client…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "10px 0 12px" }} />

      {rows === null && <div className="muted">Loading sites…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No sites yet. Use “Add site” to register the first one.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((s) => (
          <div key={s.id} className="card" style={{ padding: 14, opacity: s.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: INK }}>
                  {s.name}
                  {!s.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}> · deactivated</span>}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{s.client || "All clients"}</div>
              </div>
              <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === s.id ? null : s.id)}>
                {editing === s.id ? "Cancel" : "Edit"}
              </button>
            </div>
            {editing === s.id && (
              <SiteForm clients={clients} site={s} onSaved={() => { setEditing(null); load(); }} onDeleted={() => { setEditing(null); load(); }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteForm({ clients, site, onSaved, onDeleted }) {
  const [f, setF] = useState(
    site ? { name: site.name || "", clientName: site.client || "", active: site.active } : { ...BLANK, active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("Site / location name is required.");
    setBusy(true);
    const res = await fetch(site ? `/api/sites/${site.id}` : "/api/sites", {
      method: site ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete site ${site.name}?`)) return;
    setBusy(true);
    await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
    setBusy(false);
    onDeleted && onDeleted();
  };

  const wrap = site
    ? { marginTop: 12, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 }
    : { padding: 16, marginTop: 12, borderColor: GOLD };

  return (
    <div className={site ? "" : "card"} style={wrap}>
      {!site && <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New site / location</div>}
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Site / location name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dispatch Gate" /></L>
        <L label="Client (plant) — optional">
          <input className="input" list="site-clients" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Blank = available to all" />
          <datalist id="site-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </L>
      </div>
      {site && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, margin: "4px 0 10px" }}>
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
      )}
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontSize: 13 }}>{busy ? "Saving…" : site ? "Save changes" : "Add site"}</button>
        {site && <button className="btn" onClick={remove} disabled={busy} style={{ fontSize: 13, color: "#B03A2E" }}>Delete</button>}
      </div>
    </div>
  );
}

function L({ label, children }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
