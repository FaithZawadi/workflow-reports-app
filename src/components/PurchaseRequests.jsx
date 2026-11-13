"use client";
import { useEffect, useMemo, useState } from "react";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_CHIP = {
  PENDING: { label: "Awaiting review", bg: "#fff3d6", color: "#8a6d00" },
  APPROVED: { label: "Approved", bg: "#eaf4ee", color: PASS },
  DECLINED: { label: "Declined", bg: "#fdecec", color: "#C62828" },
  CONVERTED: { label: "Raised as LPO", bg: "#e7effb", color: "#2a5aa0" },
  CANCELLED: { label: "Cancelled", bg: COAL, color: GOLD },
};
const PR_REVIEW_ROLES = ["MANAGER", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "ADMIN"];
const LPO_CREATE_ROLES = ["MANAGER", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "CFO", "MANAGING_DIRECTOR", "ADMIN"];
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyItem = () => ({ description: "", qty: 1, unit: "EA", estUnitPrice: "" });

export default function PurchaseRequests({ profile }) {
  const [requests, setRequests] = useState(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const myRoles = (profile?.roles && profile.roles.length ? profile.roles : [profile?.role]).filter(Boolean);
  const canReview = PR_REVIEW_ROLES.some((r) => myRoles.includes(r));
  const canRaiseLpo = LPO_CREATE_ROLES.some((r) => myRoles.includes(r));

  const load = async () => {
    setErr("");
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/purchase-requests?${params.toString()}`);
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Could not load requests.");
    setRequests(d.requests || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const doAction = async (pr, action, extra = {}) => {
    setErr("");
    const res = await fetch(`/api/purchase-requests/${pr.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || "Could not update the request.");
    load();
  };
  const decline = (pr) => {
    const comment = typeof window !== "undefined" ? window.prompt("Reason for declining this request:") : "";
    if (comment && comment.trim()) doAction(pr, "decline", { comment: comment.trim() });
  };
  const raiseLpo = async (pr) => {
    setErr("");
    const res = await fetch(`/api/purchase-requests/${pr.id}/convert`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || "Could not raise the LPO.");
    if (typeof window !== "undefined") window.location.href = "/lpos";
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "8px 2px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>Purchase requests</h1>
          <div className="muted" style={{ fontSize: 13 }}>Ask for something to be bought. A manager reviews it, then raises an LPO.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ fontWeight: 800 }}>+ New request</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="input" placeholder="Search number, title, supplier…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} style={{ flex: "1 1 240px" }} />
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
        <div className="card" style={{ padding: 20, textAlign: "center", color: MUTE }}>No purchase requests yet.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: COAL, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Number", "What / requester", "Est. total", "Status", "Needed by", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 2 ? "right" : "left", padding: "8px 10px", fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((pr) => {
                  const chip = STATUS_CHIP[pr.status] || { label: pr.status, bg: "#eee", color: INK };
                  const n = Array.isArray(pr.items) ? pr.items.length : 0;
                  return (
                    <tr key={pr.id} style={{ borderTop: "1px solid #eae4d6", fontSize: 13.5 }}>
                      <td style={{ padding: "8px 10px", fontFamily: "var(--mono)", fontWeight: 700 }}>{pr.number}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 700, color: INK }}>{pr.title || `${n} item${n === 1 ? "" : "s"}`}</div>
                        <div className="muted" style={{ fontSize: 11.5 }}>by {pr.requestedByName}{pr.suggestedSupplier ? ` · ${pr.suggestedSupplier}` : ""}{pr.lpoNumber ? ` · ${pr.lpoNumber}` : ""}</div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>{pr.estTotal ? `${pr.currency} ${money(pr.estTotal)}` : "—"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: chip.bg, color: chip.color }}>{chip.label}</span>
                      </td>
                      <td style={{ padding: "8px 10px", color: MUTE, fontSize: 12.5 }}>{pr.requiredBy ? new Date(pr.requiredBy).toLocaleDateString() : "—"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                        {pr.status === "PENDING" && canReview ? (
                          <>
                            <button className="btn" onClick={() => doAction(pr, "approve")} style={{ fontSize: 12, color: PASS }}>Approve</button>{" "}
                            <button className="btn" onClick={() => decline(pr)} style={{ fontSize: 12, color: FAIL }}>Decline</button>
                          </>
                        ) : null}
                        {pr.status === "APPROVED" && canRaiseLpo ? (
                          <button className="btn btn-primary" onClick={() => raiseLpo(pr)} style={{ fontSize: 12 }}>Raise LPO</button>
                        ) : null}
                        {pr.status === "PENDING" && !canReview ? (
                          <button className="btn" onClick={() => doAction(pr, "cancel")} style={{ fontSize: 12, color: WAIT }}>Cancel</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && <RequestForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function RequestForm({ onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [justification, setJustification] = useState("");
  const [suggestedSupplier, setSuggestedSupplier] = useState("");
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
    if (clean.length === 0) return setErr("Add at least one item you need.");
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, justification, suggestedSupplier, requiredBy, items: clean }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not save."); setBusy(false); return; }
      onSaved();
    } catch { setErr("Network problem — try again."); setBusy(false); }
  };

  const lab = { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 3, display: "block" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(22,19,16,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 720, width: "100%", padding: 18, background: "#fff", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>New purchase request</h2>
          <button onClick={onClose} style={{ background: "none", border: 0, fontSize: 22, color: MUTE, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>What do you need?</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary, e.g. Replacement load cells for Katani" /></div>
          <div><label style={lab}>Suggested supplier (optional)</label><input className="input" value={suggestedSupplier} onChange={(e) => setSuggestedSupplier(e.target.value)} placeholder="If you know one" /></div>
          <div><label style={lab}>Needed by</label><input className="input" type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>Why is it needed? (optional)</label><input className="input" value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Justification" /></div>
        </div>

        <label style={{ ...lab, marginTop: 14 }}>Items</label>
        <div style={{ display: "grid", gap: 6 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 54px 54px 100px 24px", gap: 6, alignItems: "center" }}>
              <input className="input" placeholder="Description" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
              <input className="input" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
              <input className="input" placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
              <input className="input" placeholder="Est. price" value={it.estUnitPrice} onChange={(e) => setItem(i, "estUnitPrice", e.target.value)} />
              <button onClick={() => removeItem(i)} title="Remove" style={{ background: "none", border: 0, color: FAIL, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={addItem} style={{ fontSize: 12.5, marginTop: 6 }}>+ Add item</button>

        <div style={{ marginTop: 12, padding: 10, background: "#faf7f0", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between", fontWeight: 800, color: COAL }}>
          <span>Estimated total</span><span style={{ fontFamily: "var(--mono)" }}>KES {money(estTotal)}</span>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Estimates only — the actual prices are set on the LPO.</div>

        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} style={{ flex: 2, fontWeight: 800 }}>{busy ? "Submitting…" : "Submit request"}</button>
        </div>
      </div>
    </div>
  );
}
