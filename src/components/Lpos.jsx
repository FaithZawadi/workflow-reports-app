"use client";
import { useEffect, useMemo, useState } from "react";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_CHIP = {
  DRAFT: { label: "Draft", bg: "#e8e3d6", color: INK },
  PENDING: { label: "Pending", bg: "#fff3d6", color: "#8a6d00" },
  PENDING_TM: { label: "Technical Mgr", bg: "#fff3d6", color: "#8a6d00" },
  PENDING_CFO: { label: "CFO", bg: "#fff3d6", color: "#8a6d00" },
  PENDING_MD: { label: "Managing Dir.", bg: "#fff3d6", color: "#8a6d00" },
  APPROVED: { label: "Approved", bg: "#eaf4ee", color: PASS },
  CANCELLED: { label: "Cancelled", bg: COAL, color: GOLD },
};
// Who may approve each pending stage (mirrors the server-side gate).
const STAGE = {
  PENDING_TM: { label: "Technical Manager", roles: ["TECHNICAL_MANAGER", "ADMIN"] },
  PENDING_CFO: { label: "Chief Finance Officer", roles: ["CFO", "ADMIN"] },
  PENDING_MD: { label: "Managing Director", roles: ["MANAGING_DIRECTOR", "ADMIN"] },
};
const CREATE_ROLES = ["MANAGER", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "CFO", "MANAGING_DIRECTOR", "ADMIN"];
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyItem = () => ({ description: "", qty: 1, unit: "EA", unitPrice: "" });

export default function Lpos({ profile }) {
  const [lpos, setLpos] = useState(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setErr("");
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/lpos?${params.toString()}`);
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Could not load purchase orders.");
    setLpos(d.lpos || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const myRoles = (profile?.roles && profile.roles.length ? profile.roles : [profile?.role]).filter(Boolean);
  const canApproveStage = (st) => (STAGE[st]?.roles || []).some((r) => myRoles.includes(r));
  const canCreate = CREATE_ROLES.some((r) => myRoles.includes(r));

  const doAction = async (lpo, action, extra = {}) => {
    setErr("");
    const res = await fetch(`/api/lpos/${lpo.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || "Could not update the order.");
    load();
  };
  const reject = (lpo) => {
    const comment = typeof window !== "undefined" ? window.prompt("Reason for rejecting this order:") : "";
    if (comment && comment.trim()) doAction(lpo, "reject", { comment: comment.trim() });
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "8px 2px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>Purchase orders</h1>
          <div className="muted" style={{ fontSize: 13 }}>Raise and authorise Local Purchase Orders to suppliers.</div>
        </div>
        {canCreate ? <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ fontWeight: 800 }}>+ New LPO</button> : null}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="input" placeholder="Search number, supplier, subject…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} style={{ flex: "1 1 240px" }} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="DRAFT">Draft</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      {lpos === null ? (
        <div className="muted">Loading…</div>
      ) : lpos.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: MUTE }}>No purchase orders yet. Raise your first one.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: COAL, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Number", "Supplier", "Order total", "Status", "Required by", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 2 ? "right" : "left", padding: "8px 10px", fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lpos.map((lpo) => {
                  const chip = STATUS_CHIP[lpo.status] || { label: lpo.status, bg: "#eee", color: INK };
                  return (
                    <tr key={lpo.id} style={{ borderTop: "1px solid #eae4d6", fontSize: 13.5 }}>
                      <td style={{ padding: "8px 10px", fontFamily: "var(--mono)", fontWeight: 700 }}>{lpo.number}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 700, color: INK }}>{lpo.supplierName}</div>
                        {lpo.subject ? <div className="muted" style={{ fontSize: 11.5 }}>{lpo.subject}</div> : null}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>{lpo.currency} {money(lpo.grandTotal)}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: chip.bg, color: chip.color }}>{chip.label}</span>
                      </td>
                      <td style={{ padding: "8px 10px", color: MUTE, fontSize: 12.5 }}>{lpo.requiredBy ? new Date(lpo.requiredBy).toLocaleDateString() : "—"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                        <a className="btn" href={`/api/lpos/${lpo.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>PDF</a>{" "}
                        {lpo.status === "DRAFT" && canCreate ? (
                          <button className="btn" onClick={() => doAction(lpo, "submit")} style={{ fontSize: 12, color: PASS }}>Submit</button>
                        ) : null}
                        {STAGE[lpo.status] ? (
                          canApproveStage(lpo.status) ? (
                            <>
                              <button className="btn" onClick={() => doAction(lpo, "approve")} style={{ fontSize: 12, color: PASS }}>Approve</button>{" "}
                              <button className="btn" onClick={() => reject(lpo)} style={{ fontSize: 12, color: FAIL }}>Reject</button>
                            </>
                          ) : (
                            <span className="muted" style={{ fontSize: 11.5 }}>awaiting {STAGE[lpo.status].label}</span>
                          )
                        ) : null}{" "}
                        {lpo.status !== "CANCELLED" && lpo.status !== "APPROVED" && canCreate ? (
                          <button className="btn" onClick={() => doAction(lpo, "cancel")} style={{ fontSize: 12, color: WAIT }}>Cancel</button>
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

      {creating && <LpoForm profile={profile} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function LpoForm({ onClose, onSaved }) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierTel, setSupplierTel] = useState("");
  const [supplierPin, setSupplierPin] = useState("");
  const [subject, setSubject] = useState("");
  const [supplierQuoteRef, setSupplierQuoteRef] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [vatRate, setVatRate] = useState(16);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((a) => [...a, emptyItem()]);
  const removeItem = (i) => setItems((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const vatAmount = subtotal * (Number(vatRate) || 0) / 100;
    return { subtotal, vatAmount, grandTotal: subtotal + vatAmount };
  }, [items, vatRate]);

  const save = async () => {
    if (!supplierName.trim()) return setErr("Enter the supplier.");
    const clean = items.filter((it) => it.description.trim());
    if (clean.length === 0) return setErr("Add at least one line item.");
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/lpos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ supplierName, supplierContact, supplierTel, supplierPin, subject, supplierQuoteRef, deliverTo, requiredBy, deliveryDate, paymentTerms, vatRate: Number(vatRate), notes, items: clean }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not save."); setBusy(false); return; }
      onSaved();
    } catch { setErr("Network problem — try again."); setBusy(false); }
  };

  const lab = { fontSize: 11, fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 3, display: "block" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(22,19,16,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 760, width: "100%", padding: 18, background: "#fff", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>New purchase order</h2>
          <button onClick={onClose} style={{ background: "none", border: 0, fontSize: 22, color: MUTE, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lab}>Supplier</label><input className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name" /></div>
          <div><label style={lab}>Contact person</label><input className="input" value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} placeholder="Attn:" /></div>
          <div><label style={lab}>Supplier tel.</label><input className="input" value={supplierTel} onChange={(e) => setSupplierTel(e.target.value)} placeholder="07xx xxx xxx" /></div>
          <div><label style={lab}>Supplier PIN</label><input className="input" value={supplierPin} onChange={(e) => setSupplierPin(e.target.value)} placeholder="KRA PIN (for eTIMS)" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What this order is for" /></div>
          <div><label style={lab}>Your (supplier) quotation</label><input className="input" value={supplierQuoteRef} onChange={(e) => setSupplierQuoteRef(e.target.value)} placeholder="Supplier quote ref." /></div>
          <div><label style={lab}>Deliver to</label><input className="input" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} placeholder="Default: QSL Centre, Nairobi" /></div>
          <div><label style={lab}>Required by</label><input className="input" type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} /></div>
          <div><label style={lab}>Delivery date</label><input className="input" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
          <div><label style={lab}>Payment terms</label><input className="input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Default: 30 days from valid eTIMS invoice" /></div>
          <div><label style={lab}>VAT %</label><input className="input" type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></div>
        </div>

        <label style={{ ...lab, marginTop: 14 }}>Line items</label>
        <div style={{ display: "grid", gap: 6 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 54px 54px 90px 24px", gap: 6, alignItems: "center" }}>
              <input className="input" placeholder="Description" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} />
              <input className="input" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
              <input className="input" placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} />
              <input className="input" placeholder="Rate" value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} />
              <button onClick={() => removeItem(i)} title="Remove" style={{ background: "none", border: 0, color: FAIL, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={addItem} style={{ fontSize: 12.5, marginTop: 6 }}>+ Add item</button>

        <div style={{ marginTop: 12, padding: 10, background: "#faf7f0", borderRadius: 8, fontSize: 13 }}>
          <Row k="Subtotal" v={money(totals.subtotal)} />
          <Row k={`VAT (${vatRate}%)`} v={money(totals.vatAmount)} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #e6dfce", fontWeight: 900, color: COAL }}>
            <span>Order total</span><span style={{ fontFamily: "var(--mono)" }}>KES {money(totals.grandTotal)}</span>
          </div>
        </div>

        <div style={{ marginTop: 10 }}><label style={lab}>Delivery instructions (optional)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shown under the items" /></div>

        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} style={{ flex: 2, fontWeight: 800 }}>{busy ? "Raising…" : "Raise LPO"}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: strong ? 800 : 400, color: strong ? INK : MUTE }}>
      <span>{k}</span><span style={{ fontFamily: "var(--mono)", color: INK }}>{v}</span>
    </div>
  );
}
