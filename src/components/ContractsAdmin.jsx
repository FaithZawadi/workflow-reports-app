"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, PAPER, LINE, PASS, FAIL, WAIT } from "@/lib/theme";
import { FREQUENCIES, FREQUENCY_KEYS } from "@/lib/schedule";

function fmt(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}
function dueColor(days) {
  if (days < 0) return FAIL;
  if (days <= 14) return WAIT;
  return PASS;
}
function duePhrase(days) {
  if (days < 0) return `${-days} day(s) overdue`;
  if (days === 0) return "due today";
  return `in ${days} day(s)`;
}

export default function ContractsAdmin() {
  const [rows, setRows] = useState(null);
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/contracts");
    if (!res.ok) return setErr("Could not load contracts.");
    setRows((await res.json()).contracts || []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
  }, [load]);

  const markServiced = async (c) => {
    if (!confirm(`Mark this service done for "${c.name}"? The next service date rolls forward one ${FREQUENCIES[c.frequency]?.label.toLowerCase() || "cycle"}.`)) return;
    setBusyId(c.id);
    try { await fetch(`/api/contracts/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ markServiced: true }) }); await load(); }
    finally { setBusyId(null); }
  };

  const shown = (rows || []).filter((c) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [c.name, c.clientName, c.clientEmail].some((v) => String(v || "").toLowerCase().includes(s));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Service contracts</p>
          <h1 className="h1">Maintenance contracts</h1>
          <p className="muted">The client contact and the QSL Technical Manager are emailed several times before each service falls due.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => setShowAdd((v) => !v)} style={{ fontSize: 12 }}>{showAdd ? "Close" : "+ New contract"}</button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {showAdd && <ContractForm clients={clients} onSaved={() => { setShowAdd(false); load(); }} />}

      <input className="input" placeholder="Search contract, company or email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "10px 0 12px" }} />

      {rows === null && <div className="muted">Loading contracts…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No contracts yet. Use “New contract” to register the first one.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((c) => (
          <div key={c.id} className="card" style={{ padding: 0, overflow: "hidden", opacity: c.active ? 1 : 0.6 }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 5, background: dueColor(c.daysUntil) }} />
              <div style={{ padding: 14, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: INK }}>{c.name}{!c.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}> · paused</span>}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: dueColor(c.daysUntil) }}>{duePhrase(c.daysUntil)}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{c.clientName} · {FREQUENCIES[c.frequency]?.label || c.frequency} · next service {fmt(c.nextServiceAt)}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Reminders → {c.clientEmail || "no client email"}{c.technicalManagerEmail ? ` + ${c.technicalManagerEmail}` : " (no technical manager email)"}
                  {c.lastServiceAt ? ` · last serviced ${fmt(c.lastServiceAt)}` : ""}
                </div>
                {c.notes && <div className="muted" style={{ fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{c.notes}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: "6px 10px" }} disabled={busyId === c.id} onClick={() => markServiced(c)}>Mark serviced</button>
                  <button className="btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? "Cancel" : "Edit"}</button>
                </div>
                {editing === c.id && <ContractForm clients={clients} contract={c} onSaved={() => { setEditing(null); load(); }} onDeleted={() => { setEditing(null); load(); }} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractForm({ clients, contract, onSaved, onDeleted }) {
  const iso = (d) => (d ? String(d).slice(0, 10) : "");
  const [f, setF] = useState(
    contract
      ? { name: contract.name || "", clientName: contract.clientName || "", clientEmail: contract.clientEmail || "", technicalManagerEmail: contract.technicalManagerEmail || "", frequency: contract.frequency || "QUARTERLY", intervalDays: contract.intervalDays || 30, nextServiceAt: iso(contract.nextServiceAt), startDate: iso(contract.startDate), endDate: iso(contract.endDate), notes: contract.notes || "", active: contract.active }
      : { name: "", clientName: "", clientEmail: "", technicalManagerEmail: "", frequency: "QUARTERLY", intervalDays: 30, nextServiceAt: "", startDate: "", endDate: "", notes: "", active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("Contract name is required.");
    if (!contract && !f.clientName.trim()) return setErr("Choose the client (company).");
    if (!contract && !f.nextServiceAt) return setErr("Enter the next service date.");
    setBusy(true);
    const res = await fetch(contract ? `/api/contracts/${contract.id}` : "/api/contracts", {
      method: contract ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete contract ${contract.name}?`)) return;
    setBusy(true);
    await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
    setBusy(false);
    onDeleted && onDeleted();
  };

  const wrap = contract ? { marginTop: 12, padding: 12, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 4 } : { padding: 16, marginTop: 12, borderColor: GOLD };
  return (
    <div className={contract ? "" : "card"} style={wrap}>
      {!contract && <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK, marginBottom: 10 }}>New maintenance contract</div>}
      <div className="grid md-2" style={{ gap: 8 }}>
        <L label="Contract name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Magadi annual maintenance" /></L>
        <L label="Client (company)">
          <input className="input" list="contract-clients" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. TATA Chemicals Magadi" />
          <datalist id="contract-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </L>
        <L label="Client contact email"><input className="input" type="email" value={f.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="client@company.com" /></L>
        <L label="Technical Manager email"><input className="input" type="email" value={f.technicalManagerEmail} onChange={(e) => set("technicalManagerEmail", e.target.value)} placeholder="tm@qalibrated.co.ke" /></L>
        <L label="Service frequency">
          <select className="input" value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>
            {FREQUENCY_KEYS.map((k) => <option key={k} value={k}>{FREQUENCIES[k].label}</option>)}
          </select>
        </L>
        {f.frequency === "CUSTOM" && <L label="Every N days"><input className="input" type="number" min="1" value={f.intervalDays} onChange={(e) => set("intervalDays", e.target.value)} /></L>}
        <L label="Next service date"><input className="input" type="date" value={f.nextServiceAt} onChange={(e) => set("nextServiceAt", e.target.value)} /></L>
        <L label="Contract start (optional)"><input className="input" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></L>
        <L label="Contract end (optional)"><input className="input" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></L>
      </div>
      <L label="Notes (optional)"><input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} spellCheck /></L>
      {contract && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, margin: "4px 0 10px" }}>
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active (reminders on)
        </label>
      )}
      {err && <div className="err" style={{ margin: "6px 0" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontSize: 13 }}>{busy ? "Saving…" : contract ? "Save changes" : "Add contract"}</button>
        {contract && <button className="btn" onClick={remove} disabled={busy} style={{ fontSize: 13, color: "#B03A2E" }}>Delete</button>}
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
