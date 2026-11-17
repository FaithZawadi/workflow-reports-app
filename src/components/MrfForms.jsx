"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

// The Material Requisition Form (QSL-A2) is the printable form of a purchase
// requisition. This page is a form-first home for it: raise a requisition on the
// QSL-A2 layout, then open or print its MRF. The records are the same purchase
// requests, shown here as forms.
const STATUS_CHIP = {
  PENDING: { label: "Awaiting review", bg: "#fff3d6", color: "#8a6d00" },
  APPROVED: { label: "Approved", bg: "#eaf4ee", color: PASS },
  DECLINED: { label: "Declined", bg: "#fdecec", color: "#C62828" },
  CONVERTED: { label: "Raised as LPO", bg: "#e7effb", color: "#2a5aa0" },
  CANCELLED: { label: "Cancelled", bg: COAL, color: GOLD },
};
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyItem = () => ({ description: "", qty: 1, unit: "EA", estUnitPrice: "" });
const lab = { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 3, display: "block" };

export default function MrfForms({ profile }) {
  const [requests, setRequests] = useState(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null); // request id whose form header is being edited

  const load = async () => {
    setErr("");
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/purchase-requests?${params.toString()}`);
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Could not load forms.");
    setRequests(d.requests || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "8px 2px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>Material requisition forms</h1>
          <div className="muted" style={{ fontSize: 13 }}>Raise a requisition on the QSL-A2 form, then open or print its MRF. A manager reviews it and can raise an LPO from an approved one.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ fontWeight: 800 }}>+ New MRF</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="input" placeholder="Search serial, project, requester…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} style={{ flex: "1 1 240px" }} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="all">All statuses</option>
          <option value="PENDING">Awaiting review</option>
          <option value="APPROVED">Approved</option>
          <option value="CONVERTED">Raised as LPO</option>
          <option value="DECLINED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      {requests === null ? (
        <div className="muted">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: MUTE }}>No requisition forms yet. Tap “+ New MRF” to raise one.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: COAL, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Serial", "Project / store", "Items", "Est. total", "Status", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 3 ? "right" : "left", padding: "8px 10px", fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((pr) => {
                  const chip = STATUS_CHIP[pr.status] || { label: pr.status, bg: "#eee", color: INK };
                  const n = Array.isArray(pr.items) ? pr.items.length : 0;
                  return (
                    <Fragment key={pr.id}>
                      <tr style={{ borderTop: "1px solid #eae4d6", fontSize: 13.5 }}>
                        <td style={{ padding: "8px 10px", fontFamily: "var(--mono)", fontWeight: 700 }}>{pr.number}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 700, color: INK }}>{pr.projectName || pr.title || "—"}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>
                            {[pr.projectNumber ? `No. ${pr.projectNumber}` : null, pr.storeName ? `Store: ${pr.storeName}` : null, `by ${pr.requestedByName}`].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", color: MUTE }}>{n} item{n === 1 ? "" : "s"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>{pr.estTotal ? `${pr.currency} ${money(pr.estTotal)}` : "—"}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: chip.bg, color: chip.color }}>{chip.label}</span>
                        </td>
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                          <a className="btn btn-primary" href={`/api/purchase-requests/${pr.id}/mrf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Open MRF</a>{" "}
                          <a className="btn" href={`/api/purchase-requests/${pr.id}/mrf?download=1`} style={{ fontSize: 12, textDecoration: "none" }}>Download</a>{" "}
                          {pr.status === "PENDING" && (
                            <button className="btn" onClick={() => setEditing(editing === pr.id ? null : pr.id)} style={{ fontSize: 12 }}>{editing === pr.id ? "Close" : "Edit form"}</button>
                          )}
                        </td>
                      </tr>
                      {editing === pr.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, background: "#faf7f0" }}>
                            <FormHeaderEditor pr={pr} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && <MrfCreateForm preparedBy={profile?.name} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

// Inline editor for the QSL-A2 header fields (project / store / checked-by).
function FormHeaderEditor({ pr, onClose, onSaved }) {
  const [projectName, setProjectName] = useState(pr.projectName || "");
  const [projectNumber, setProjectNumber] = useState(pr.projectNumber || "");
  const [storeName, setStoreName] = useState(pr.storeName || "");
  const [checkedByName, setCheckedByName] = useState(pr.checkedByName || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/purchase-requests/${pr.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectName, projectNumber, storeName, checkedByName }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "Could not save (only the person who raised it can edit, while it is pending)."); setBusy(false); return; }
      onSaved();
    } catch { setErr("Network problem — try again."); setBusy(false); }
  };

  return (
    <div className="form-2col" style={{ padding: 14 }}>
      <div><label style={lab}>Project name</label><input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} /></div>
      <div><label style={lab}>Project number</label><input className="input" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} /></div>
      <div><label style={lab}>Store name</label><input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
      <div><label style={lab}>Checked by</label><input className="input" value={checkedByName} onChange={(e) => setCheckedByName(e.target.value)} placeholder="Name of who checks it" /></div>
      {err && <div className="err" style={{ gridColumn: "1 / -1" }}>{err}</div>}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy} style={{ fontWeight: 800 }}>{busy ? "Saving…" : "Save form details"}</button>
      </div>
    </div>
  );
}

// The QSL-A2 Material Requisition Form, filled in to raise a requisition.
function MrfCreateForm({ preparedBy, onClose, onSaved }) {
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [storeName, setStoreName] = useState("");
  const [checkedByName, setCheckedByName] = useState("");
  const [title, setTitle] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((a) => [...a, emptyItem()]);
  const removeItem = (i) => setItems((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a));
  const estTotal = useMemo(() => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.estUnitPrice) || 0), 0), [items]);

  const save = async () => {
    const clean = items.filter((it) => it.description.trim());
    if (clean.length === 0) return setErr("Add at least one item to requisition.");
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, projectName, projectNumber, storeName, checkedByName, requiredBy, items: clean }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not save."); setBusy(false); return; }
      onSaved();
    } catch { setErr("Network problem — try again."); setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(22,19,16,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 720, width: "100%", padding: 18, background: "#fff", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>New material requisition (QSL-A2)</h2>
          <button onClick={onClose} style={{ background: "none", border: 0, fontSize: 22, color: MUTE, cursor: "pointer" }}>×</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Prepared by {preparedBy || "you"} · Approved by the reviewing manager once submitted.</div>

        <div className="form-2col">
          <div><label style={lab}>Project name</label><input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. N8 NTSA Nakuru & Kisumu" /></div>
          <div><label style={lab}>Project number</label><input className="input" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="If any" /></div>
          <div><label style={lab}>Store name</label><input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Store / stationed from" /></div>
          <div><label style={lab}>Checked by (optional)</label><input className="input" value={checkedByName} onChange={(e) => setCheckedByName(e.target.value)} placeholder="Name" /></div>
          <div className="col-full"><label style={lab}>Summary (optional)</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of what is needed" /></div>
          <div><label style={lab}>Needed by</label><input className="input" type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} /></div>
        </div>

        <label style={{ ...lab, marginTop: 14 }}>Items requisitioned</label>
        <div className="req-items">
          <div className="req-head" style={{ fontSize: 10.5, color: MUTE, fontWeight: 700, textTransform: "uppercase" }}>
            <span>Description</span><span>Qty</span><span>Unit</span><span>Est. each</span><span />
          </div>
          {items.map((it, i) => (
            <div key={i} className="req-item">
              <input className="input desc" placeholder="Description" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
              <input className="input" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
              <input className="input" placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
              <input className="input" placeholder="Est. each" value={it.estUnitPrice} onChange={(e) => setItem(i, "estUnitPrice", e.target.value)} />
              <button onClick={() => removeItem(i)} title="Remove" style={{ background: "none", border: 0, color: FAIL, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={addItem} style={{ fontSize: 12.5, marginTop: 6 }}>+ Add item</button>

        <div style={{ marginTop: 12, padding: 10, background: "#faf7f0", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between", fontWeight: 800, color: COAL }}>
          <span>Estimated total</span><span style={{ fontFamily: "var(--mono)" }}>KES {money(estTotal)}</span>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Estimates only — actual costs are filled on the printed form / LPO.</div>

        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} style={{ flex: 2, fontWeight: 800 }}>{busy ? "Submitting…" : "Submit requisition"}</button>
        </div>
      </div>
    </div>
  );
}
