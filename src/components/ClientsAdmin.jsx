"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, LINE, PASS, WAIT } from "@/lib/theme";

// Admin registry for clients (companies) and the sites/locations under each one.
// Register a client once (e.g. "TATA Chemicals"), capture its contacts / tax /
// account manager, add its sites (with address + GPS), and every report then
// rolls up per-site and to the overall client.

const STATUS_META = {
  ACTIVE: { label: "Active", color: PASS },
  PROSPECT: { label: "Prospect", color: WAIT },
  INACTIVE: { label: "Inactive", color: MUTE },
};

export default function ClientsAdmin() {
  const [rows, setRows] = useState(null);
  const [staff, setStaff] = useState([]);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [consolidating, setConsolidating] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const res = await fetch("/api/clients?manage=1", { cache: "no-store" });
    if (!res.ok) return setErr("Could not load clients.");
    setRows((await res.json()).clients || []);
  }, []);

  useEffect(() => {
    load();
    // QSL staff for the "account manager" dropdown (internal users only).
    fetch("/api/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setStaff((d.users || []).filter((u) => !u.client && u.active)))
      .catch(() => {});
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

  const consolidate = async () => {
    if (!confirm('Consolidate duplicates?\n\nEvery "Tata Chemicals" spelling variant (Magadi, Kajiado, Mombasa) is folded into ONE "TATA Chemicals" client, and each report is tagged with its branch as the site. This can\'t be undone.')) return;
    setConsolidating(true);
    setErr("");
    setNotice("");
    const res = await fetch("/api/clients/consolidate", { method: "POST" });
    setConsolidating(false);
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || "Could not consolidate.");
    const d = await res.json();
    setNotice(d.mergedClients || d.renamed ? `Done — ${d.mergedClients} duplicate client${d.mergedClients === 1 ? "" : "s"} merged, ${d.renamed} renamed.` : "Already consolidated — nothing to merge.");
    load();
  };

  const shown = (rows || []).filter((c) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [c.name, c.displayName, c.city, c.contactPerson, ...(c.sites || []).map((s) => s.name)].some((v) => String(v || "").toLowerCase().includes(t));
  });

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">Clients &amp; sites</h1>
          <p className="muted">Register each company once — contacts, tax details, account manager — then add its sites with address and map location.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn" onClick={consolidate} disabled={consolidating} style={{ fontSize: 12 }} title="Fold duplicate Tata Chemicals spellings into one client with branches as sites">{consolidating ? "Consolidating…" : "Consolidate duplicates"}</button>
          <button className="btn btn-dark" onClick={() => setAdding((v) => !v)} style={{ fontSize: 12 }}>{adding ? "Close" : "+ Add client"}</button>
        </div>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}
      {notice && <div className="card" style={{ margin: "10px 0", padding: "10px 12px", borderColor: GOLD, fontSize: 13, color: INK }}>{notice}</div>}

      {adding && (
        <div className="card" style={{ padding: 16, marginTop: 12, borderColor: GOLD }}>
          <label className="label">Company / client name</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <input className="input" autoFocus placeholder="e.g. TATA Chemicals" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addClient()} style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn-dark" disabled={busy} onClick={addClient}>{busy ? "Saving…" : "Register client"}</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Register the company here. Open its “Details” to capture contacts, tax number and account manager, and add its sites below.</p>
        </div>
      )}

      <input className="input" placeholder="Search client, city, contact or site…" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: "12px 0" }} />

      {rows === null && <div className="muted">Loading clients…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No clients yet. Use “Add client” to register the first company.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
        {shown.map((c) => (
          <ClientCard key={c.id} client={c} allClients={rows || []} staff={staff} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client: c, allClients = [], staff = [], open, onToggle, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [showSites, setShowSites] = useState(false);
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState("");
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
    if (!res.ok) { setErr((await res.json()).error || "Could not save."); return false; }
    onChanged();
    return true;
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
  const st = STATUS_META[c.status] || STATUS_META.ACTIVE;

  return (
    <div className="card" style={{ padding: 14, opacity: c.active ? 1 : 0.62 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: INK }}>{c.name}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: st.color, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".04em" }}>{st.label}</span>
            {!c.active && <span style={{ fontSize: 11, color: MUTE, fontWeight: 700 }}>· deactivated</span>}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {c.clientType ? `${c.clientType} · ` : ""}{activeSites.length} site{activeSites.length === 1 ? "" : "s"} · {c.reportCount} report{c.reportCount === 1 ? "" : "s"} · {c.weighbridgeCount} weighbridge{c.weighbridgeCount === 1 ? "" : "s"}
            {c.accountManager ? ` · AM: ${c.accountManager.name}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="btn" style={btnSm} onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Details"}</button>
          <button className="btn" style={btnSm} onClick={() => setShowSites((v) => !v)}>{showSites ? "Hide sites" : `Sites (${sites.length})`}</button>
          <button className="btn" style={btnSm} onClick={() => setMerging((v) => !v)}>Merge…</button>
          <button className="btn" style={btnSm} onClick={() => patch({ active: !c.active })} disabled={busy}>{c.active ? "Deactivate" : "Activate"}</button>
          <button className="btn" style={{ ...btnSm, color: "#B03A2E" }} onClick={del} disabled={busy}>Delete</button>
        </div>
      </div>

      {merging && (
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

      {editing && <ClientDetailsForm client={c} staff={staff} onSave={patch} onDone={() => setEditing(false)} />}

      {showSites && <SiteManager clientName={c.name} sites={sites} onChanged={onChanged} />}

      {!showSites && !editing && activeSites.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {activeSites.map((s) => (
            <span key={s.id} style={chip} title={[s.address, s.city].filter(Boolean).join(", ")}>{s.name}{s.lat != null && s.lng != null ? " 📍" : ""}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const FIELDS = [
  ["name", "Registered name", "text"],
  ["displayName", "Trading / short name", "text"],
  ["clientType", "Type / industry", "text"],
  ["status", "Status", "status"],
  ["contactPerson", "Primary contact", "text"],
  ["contactEmail", "Contact email", "email"],
  ["contactPhone", "Contact phone", "tel"],
  ["billingEmail", "Billing email", "email"],
  ["taxPin", "KRA PIN / tax ID", "text"],
  ["regNo", "Company reg. no.", "text"],
  ["website", "Website", "text"],
  ["address", "Head-office address", "text"],
  ["city", "City / town", "text"],
  ["country", "Country", "text"],
  ["accountManagerId", "Account manager", "am"],
  ["onboardedAt", "Onboarded on", "date"],
];

function ClientDetailsForm({ client: c, staff, onSave, onDone }) {
  const init = {};
  for (const [k] of FIELDS) init[k] = c[k] ?? "";
  init.onboardedAt = c.onboardedAt ? String(c.onboardedAt).slice(0, 10) : "";
  init.status = c.status || "ACTIVE";
  const [form, setForm] = useState(init);
  const [notes, setNotes] = useState(c.notes || "");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!String(form.name || "").trim()) return;
    setBusy(true);
    const ok = await onSave({ ...form, notes });
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {FIELDS.map(([k, label, type]) => (
          <div key={k}>
            <label className="label" style={{ fontSize: 11.5 }}>{label}</label>
            {type === "status" ? (
              <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="PROSPECT">Prospect</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            ) : type === "am" ? (
              <select className="input" value={form.accountManagerId || ""} onChange={(e) => set("accountManagerId", e.target.value)}>
                <option value="">— none —</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            ) : (
              <input className="input" type={type === "date" ? "date" : "text"} inputMode={type === "tel" ? "tel" : undefined} value={form[k] || ""} onChange={(e) => set(k, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      <label className="label" style={{ fontSize: 11.5, marginTop: 10, display: "block" }}>Notes</label>
      <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth knowing about this client…" style={{ resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn btn-dark" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save details"}</button>
        <button className="btn" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function SiteManager({ clientName, sites, onChanged }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

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
          <div key={s.id} style={{ background: "#FBF9F4", border: `1px solid ${LINE}`, borderRadius: 6, opacity: s.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 13.5, color: INK, fontWeight: 600 }}>{s.name}{!s.active && <span style={{ color: MUTE, fontWeight: 400 }}> · off</span>}</span>
                {(s.city || s.address) && <span className="muted" style={{ fontSize: 12, display: "block" }}>{[s.address, s.city].filter(Boolean).join(", ")}</span>}
                {s.lat != null && s.lng != null && (
                  <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "#2563eb", textDecoration: "none" }}>📍 {Number(s.lat).toFixed(5)}, {Number(s.lng).toFixed(5)}</a>
                )}
              </span>
              <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn" style={btnSm} onClick={() => setEditId(editId === s.id ? null : s.id)}>{editId === s.id ? "Close" : "Edit"}</button>
                <button className="btn" style={btnSm} onClick={() => toggleSite(s)}>{s.active ? "Deactivate" : "Activate"}</button>
                <button className="btn" style={{ ...btnSm, color: "#B03A2E" }} onClick={() => removeSite(s)}>Remove</button>
              </span>
            </div>
            {editId === s.id && <SiteEditor site={s} onDone={() => setEditId(null)} onChanged={onChanged} />}
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

function SiteEditor({ site: s, onDone, onChanged }) {
  const [f, setF] = useState({
    name: s.name || "",
    address: s.address || "",
    city: s.city || "",
    lat: s.lat ?? "",
    lng: s.lng ?? "",
    contactPerson: s.contactPerson || "",
    contactPhone: s.contactPhone || "",
    notes: s.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return setErr("Geolocation is not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setF((x) => ({ ...x, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
      () => setErr("Could not read your location (permission denied?)."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const save = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/sites/${s.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error || "Could not save.");
    onChanged();
    onDone();
  };

  return (
    <div style={{ padding: "4px 10px 12px", borderTop: `1px dashed ${LINE}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 8 }}>
        <Field label="Site name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Address"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="City / town"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Site contact"><input className="input" value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></Field>
        <Field label="Contact phone"><input className="input" inputMode="tel" value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></Field>
        <Field label="Latitude"><input className="input" inputMode="decimal" value={f.lat} onChange={(e) => set("lat", e.target.value)} placeholder="-1.2345" /></Field>
        <Field label="Longitude"><input className="input" inputMode="decimal" value={f.lng} onChange={(e) => set("lng", e.target.value)} placeholder="36.8219" /></Field>
      </div>
      <Field label="Notes"><input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn btn-dark" style={btnSm} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save site"}</button>
        <button className="btn" style={btnSm} type="button" onClick={useMyLocation}>Use my location</button>
        <button className="btn" style={btnSm} onClick={onDone}>Cancel</button>
      </div>
      {err && <div className="err" style={{ marginTop: 6, fontSize: 12 }}>{err}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label" style={{ fontSize: 11.5 }}>{label}</label>
      {children}
    </div>
  );
}

const btnSm = { fontSize: 12, padding: "6px 10px" };
const chip = { fontSize: 12, fontWeight: 700, color: INK, background: "#F3EFE6", border: `1px solid ${LINE}`, borderRadius: 999, padding: "3px 10px" };
