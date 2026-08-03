"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, LINE } from "@/lib/theme";

// Admin registry for clients (companies) and the sites/locations under each one.
// Register a client once (e.g. "TATA Chemicals"), add its sites (Magadi, Kajiado,
// Mombasa), and every report then rolls up per-site and to the overall client.
export default function ClientsAdmin() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setErr("");
    const res = await fetch("/api/clients?manage=1", { cache: "no-store" });
    if (!res.ok) return setErr("Could not load clients.");
    setRows((await res.json()).clients || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addClient = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not add client.");
    setNewName("");
    setAdding(false);
    load();
  };

  const shown = (rows || []).filter((c) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [c.name, ...(c.sites || []).map((s) => s.name)].some((v) => String(v || "").toLowerCase().includes(t));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">Clients &amp; sites</h1>
          <p className="muted">Register each company once, then add its sites. Reports and statements roll up by site and to the overall client.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => setAdding((v) => !v)} style={{ fontSize: 12 }}>{adding ? "Close" : "+ Add client"}</button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}

      {adding && (
        <div className="card" style={{ padding: 16, marginTop: 12, borderColor: GOLD }}>
          <label className="label">Company / client name</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <input className="input" autoFocus placeholder="e.g. TATA Chemicals" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addClient()} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn-dark" disabled={busy} onClick={addClient}>{busy ? "Saving…" : "Register client"}</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Register the company here (not the site). Add the individual sites below once it’s created.</p>
        </div>
      )}

      <input className="input" placeholder="Search client or site…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "12px 0" }} />

      {rows === null && <div className="muted">Loading clients…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No clients yet. Use “Add client” to register the first company.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
        {shown.map((c) => (
          <ClientCard key={c.id} client={c} allClients={rows || []} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client: c, allClients = [], open, onToggle, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState("");
  const [name, setName] = useState(c.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doMerge = async () => {
    if (!target) return;
    const t = allClients.find((x) => x.id === target);
    if (!confirm(`Merge "${c.name}" (${c.reportCount} report${c.reportCount === 1 ? "" : "s"}) into "${t?.name}"?\n\nEverything moves to "${t?.name}" and "${c.name}" is deleted. This can't be undone.`)) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/clients/${c.id}/merge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ into: target }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not merge.");
    setMerging(false);
    onChanged();
  };

  const patch = async (body) => {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/clients/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    setEditing(false);
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete client "${c.name}"? If it has reports it will be deactivated instead (history is kept).`)) return;
    setBusy(true);
    const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Could not delete.");
    onChanged();
  };

  const sites = c.sites || [];
  const activeSites = sites.filter((s) => s.active);

  return (
    <div className="card" style={{ padding: 14, opacity: c.active ? 1 : 0.62 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-dark" disabled={busy} onClick={() => patch({ name: name.trim() })}>Save</button>
              <button className="btn" onClick={() => { setEditing(false); setName(c.name); }}>Cancel</button>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>
                {c.name}
                {!c.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}> · deactivated</span>}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {activeSites.length} site{activeSites.length === 1 ? "" : "s"} · {c.reportCount} report{c.reportCount === 1 ? "" : "s"} · {c.weighbridgeCount} weighbridge{c.weighbridgeCount === 1 ? "" : "s"}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn" style={btnSm} onClick={onToggle}>{open ? "Hide sites" : `Sites (${sites.length})`}</button>
            <button className="btn" style={btnSm} onClick={() => setEditing(true)}>Rename</button>
            <button className="btn" style={btnSm} onClick={() => setMerging((v) => !v)}>Merge…</button>
            <button className="btn" style={btnSm} onClick={() => patch({ active: !c.active })} disabled={busy}>{c.active ? "Deactivate" : "Activate"}</button>
            <button className="btn" style={{ ...btnSm, color: "#B03A2E" }} onClick={del} disabled={busy}>Delete</button>
          </div>
        )}
      </div>

      {merging && !editing && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
          <div className="label" style={{ marginBottom: 6 }}>Merge “{c.name}” into…</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} style={{ flex: 1, minWidth: 220 }}>
              <option value="">— choose the client to keep —</option>
              {allClients.filter((x) => x.id !== c.id).map((x) => (
                <option key={x.id} value={x.id}>{x.name}{x.reportCount ? ` (${x.reportCount} reports)` : ""}</option>
              ))}
            </select>
            <button className="btn btn-dark" style={btnSm} disabled={busy || !target} onClick={doMerge}>{busy ? "Merging…" : "Merge"}</button>
            <button className="btn" style={btnSm} onClick={() => { setMerging(false); setTarget(""); }}>Cancel</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Moves all reports, weighbridges, schedules and records to the chosen client, renames them to match, then deletes “{c.name}”.</p>
        </div>
      )}

      {err && <div className="err" style={{ marginTop: 8, fontSize: 12 }}>{err}</div>}

      {open && !editing && (
        <SiteManager clientName={c.name} sites={sites} onChanged={onChanged} />
      )}

      {/* Quick site chips when collapsed */}
      {!open && !editing && activeSites.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {activeSites.map((s) => (
            <span key={s.id} style={chip}>{s.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SiteManager({ clientName, sites, onChanged }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n, clientName }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not add site.");
    setName("");
    onChanged();
  };

  const removeSite = async (s) => {
    if (!confirm(`Remove site "${s.name}"?`)) return;
    await fetch(`/api/sites/${s.id}`, { method: "DELETE" });
    onChanged();
  };
  const toggleSite = async (s) => {
    await fetch(`/api/sites/${s.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !s.active }) });
    onChanged();
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
      <div className="label" style={{ marginBottom: 6 }}>Sites for {clientName}</div>
      {sites.length === 0 && <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>No sites yet — add this client’s locations below.</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {sites.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px", background: "#FBF9F4", border: `1px solid ${LINE}`, borderRadius: 6, opacity: s.active ? 1 : 0.6 }}>
            <span style={{ fontSize: 13.5, color: INK, fontWeight: 600 }}>
              {s.name}{!s.active && <span style={{ color: MUTE, fontWeight: 400 }}> · off</span>}
            </span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="btn" style={btnSm} onClick={() => toggleSite(s)}>{s.active ? "Deactivate" : "Activate"}</button>
              <button className="btn" style={{ ...btnSm, color: "#B03A2E" }} onClick={() => removeSite(s)}>Remove</button>
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input className="input" placeholder="Add a site (e.g. Magadi plant)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ flex: 1, minWidth: 180 }} />
        <button className="btn btn-dark" disabled={busy} onClick={add}>{busy ? "…" : "+ Add site"}</button>
      </div>
      {err && <div className="err" style={{ marginTop: 6, fontSize: 12 }}>{err}</div>}
    </div>
  );
}

const btnSm = { fontSize: 12, padding: "6px 10px" };
const chip = { fontSize: 12, fontWeight: 700, color: INK, background: "#F3EFE6", border: `1px solid ${LINE}`, borderRadius: 999, padding: "3px 10px" };
