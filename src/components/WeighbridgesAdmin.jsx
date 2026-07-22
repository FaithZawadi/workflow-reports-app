"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, PAPER, LINE } from "@/lib/theme";

const BLANK = { label: "", clientName: "", site: "", makeModel: "", serialNo: "", capacity: "", deckLength: "" };

export default function WeighbridgesAdmin({ canAdminister = true }) {
  const [rows, setRows] = useState(null);
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/weighbridges?manage=1");
    if (!res.ok) return setErr("Could not load weighbridges.");
    setRows((await res.json()).weighbridges || []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
    fetch("/api/users/directory").then((r) => r.json()).then((d) => setManagers(d.managers || [])).catch(() => {});
  }, [load]);

  const shown = (rows || []).filter((w) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [w.label, w.client, w.site, w.makeModel, w.serialNo].some((v) => String(v || "").toLowerCase().includes(s));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">Weighbridges</h1>
          <p className="muted">Register each weighbridge once. Technicians and engineers then pick it from a dropdown when filing.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => setShowAdd((v) => !v)} style={{ fontSize: 12 }}>
            {showAdd ? "Close" : "+ Add weighbridge"}
          </button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {showAdd && <WBForm clients={clients} managers={managers} onSaved={() => { setShowAdd(false); load(); }} />}

      <input className="input" placeholder="Search name, client, site, make or serial…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "10px 0 12px" }} />

      {rows === null && <div className="muted">Loading weighbridges…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No weighbridges yet. Use “Add weighbridge” to register the first one.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((w) => (
          <div key={w.id} className="card" style={{ padding: 14, opacity: w.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: INK }}>
                  {w.label}
                  {!w.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}> · deactivated</span>}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {w.client}{w.site ? ` — ${w.site}` : ""}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {[w.makeModel && `Make: ${w.makeModel}`, w.serialNo && `S/N: ${w.serialNo}`, w.capacity && `Cap: ${w.capacity}`, w.deckLength && `Deck: ${w.deckLength}`]
                    .filter(Boolean).join(" · ") || "no equipment details"}
                  {w.users > 0 ? ` · ${w.users} assignee${w.users > 1 ? "s" : ""}` : ""}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Client manager: {w.managerName ? <b style={{ color: INK }}>{w.managerName}</b> : <span style={{ color: MUTE }}>not set</span>}
                </div>
              </div>
              {canAdminister && (
                <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === w.id ? null : w.id)}>
                  {editing === w.id ? "Cancel" : "Edit"}
                </button>
              )}
            </div>
            {canAdminister && editing === w.id && (
              <WBForm clients={clients} managers={managers} wb={w} onSaved={() => { setEditing(null); load(); }} onDeleted={() => { setEditing(null); load(); }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WBForm({ clients, managers = [], wb, onSaved, onDeleted }) {
  const [f, setF] = useState(
    wb
      ? { label: wb.label || "", clientName: wb.client || "", site: wb.site || "", makeModel: wb.makeModel || "", serialNo: wb.serialNo || "", capacity: wb.capacity || "", deckLength: wb.deckLength || "", clientManagerId: wb.clientManagerId || "", active: wb.active }
      : { ...BLANK, clientManagerId: "", active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setErr("");
    if (!f.label.trim()) return setErr("Name/ID is required.");
    if (!f.clientName.trim()) return setErr("Choose the client (plant).");
    setBusy(true);
    const res = await fetch(wb ? `/api/weighbridges/${wb.id}` : "/api/weighbridges", {
      method: wb ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete weighbridge ${wb.label}?`)) return;
    setBusy(true);
    await fetch(`/api/weighbridges/${wb.id}`, { method: "DELETE" });
    setBusy(false);
    onDeleted && onDeleted();
  };

  const wrap = wb
    ? { marginTop: 12, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 }
    : { padding: 16, marginTop: 12, borderColor: GOLD };

  return (
    <div className={wb ? "" : "card"} style={wrap}>
      {!wb && <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New weighbridge</div>}
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Name / ID"><input className="input" value={f.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. WB-1 Dispatch Gate" /></L>
        <L label="Client (plant)">
          <input className="input" list="wb-clients" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. TATA Chemicals Magadi" />
          <datalist id="wb-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </L>
        <L label="Site / location"><input className="input" value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="e.g. Dispatch gate" /></L>
        <L label="Make / model"><input className="input" value={f.makeModel} onChange={(e) => set("makeModel", e.target.value)} placeholder="e.g. Avery E1205" /></L>
        <L label="Serial no."><input className="input" value={f.serialNo} onChange={(e) => set("serialNo", e.target.value)} /></L>
        <L label="Capacity / division"><input className="input" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="e.g. 60 t / 20 kg" /></L>
        <L label="Deck length"><input className="input" value={f.deckLength} onChange={(e) => set("deckLength", e.target.value)} placeholder="e.g. 18 m" /></L>
        <L label="Client manager (approves reports)">
          <select className="input" value={f.clientManagerId} onChange={(e) => set("clientManagerId", e.target.value)}>
            <option value="">— none —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
          </select>
        </L>
      </div>
      {wb && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, margin: "4px 0 10px" }}>
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
      )}
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontSize: 13 }}>{busy ? "Saving…" : wb ? "Save changes" : "Add weighbridge"}</button>
        {wb && <button className="btn" onClick={remove} disabled={busy} style={{ fontSize: 13, color: "#B03A2E" }}>Delete</button>}
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
