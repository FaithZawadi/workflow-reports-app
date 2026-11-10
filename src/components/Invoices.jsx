"use client";
import { useEffect, useMemo, useState } from "react";
import { COAL, GOLD, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const STATUS_CHIP = {
  DRAFT: { label: "Draft", bg: "#e8e3d6", color: INK },
  UNPAID: { label: "Unpaid", bg: "#fdecec", color: "#C62828" },
  PAID: { label: "Paid", bg: "#eaf4ee", color: PASS },
  CANCELLED: { label: "Cancelled", bg: COAL, color: GOLD },
};
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyItem = () => ({ description: "", qty: 1, unit: "EA", unitPrice: "" });

export default function Invoices({ profile }) {
  const [invoices, setInvoices] = useState(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setErr("");
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/invoices?${params.toString()}`);
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Could not load invoices.");
    setInvoices(d.invoices || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const markPaid = async (inv, paid) => {
    await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: paid ? "PAID" : "UNPAID" }),
    });
    load();
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "8px 2px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>Invoices</h1>
          <div className="muted" style={{ fontSize: 13 }}>Raise and track client invoices.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ fontWeight: 800 }}>+ New invoice</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="input" placeholder="Search number, client, subject…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} style={{ flex: "1 1 240px" }} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
          <option value="all">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="DRAFT">Draft</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      {invoices === null ? (
        <div className="muted">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: MUTE }}>No invoices yet. Raise your first one.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: COAL, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Number", "Client", "Amount due", "Status", "Due", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 2 ? "right" : "left", padding: "8px 10px", fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const chip = STATUS_CHIP[inv.status] || { label: inv.status, bg: "#eee", color: INK };
                  return (
                    <tr key={inv.id} style={{ borderTop: "1px solid #eae4d6", fontSize: 13.5 }}>
                      <td style={{ padding: "8px 10px", fontFamily: "var(--mono)", fontWeight: 700 }}>{inv.number}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 700, color: INK }}>{inv.clientName}</div>
                        {inv.subject ? <div className="muted" style={{ fontSize: 11.5 }}>{inv.subject}</div> : null}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>{inv.currency} {money(inv.grandTotal)}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: chip.bg, color: chip.color }}>{chip.label}</span>
                      </td>
                      <td style={{ padding: "8px 10px", color: MUTE, fontSize: 12.5 }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                        <a className="btn" href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>PDF</a>{" "}
                        {inv.status === "PAID" ? (
                          <button className="btn" onClick={() => markPaid(inv, false)} style={{ fontSize: 12, color: WAIT }}>Unmark</button>
                        ) : inv.status !== "CANCELLED" ? (
                          <button className="btn" onClick={() => markPaid(inv, true)} style={{ fontSize: 12, color: PASS }}>Mark paid</button>
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

      {creating && <InvoiceForm profile={profile} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function InvoiceForm({ onClose, onSaved }) {
  const [clients, setClients] = useState([]);
  const [clientName, setClientName] = useState("");
  const [subject, setSubject] = useState("");
  const [ref, setRef] = useState("");
  const [fileNo, setFileNo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [vatRate, setVatRate] = useState(16);
  const [retentionRate, setRetentionRate] = useState(0);
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || [])).catch(() => {});
  }, []);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((a) => [...a, emptyItem()]);
  const removeItem = (i) => setItems((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const retentionAmount = subtotal * (Number(retentionRate) || 0) / 100;
    const netAmount = subtotal - retentionAmount;
    const vatAmount = netAmount * (Number(vatRate) || 0) / 100;
    return { subtotal, retentionAmount, netAmount, vatAmount, grandTotal: netAmount + vatAmount };
  }, [items, vatRate, retentionRate]);

  const save = async () => {
    if (!clientName.trim()) return setErr("Choose the client.");
    const clean = items.filter((it) => it.description.trim());
    if (clean.length === 0) return setErr("Add at least one line item.");
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName, subject, ref, fileNo, dueDate, vatRate: Number(vatRate), retentionRate: Number(retentionRate), contactPerson, notes, items: clean }),
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
          <h2 style={{ margin: 0, fontSize: 18 }}>New invoice</h2>
          <button onClick={onClose} style={{ background: "none", border: 0, fontSize: 22, color: MUTE, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lab}>Client</label>
            <input className="input" list="inv-clients" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
            <datalist id="inv-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <div><label style={lab}>Contact person</label><input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Attn:" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lab}>Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What this invoice is for" /></div>
          <div><label style={lab}>Reference</label><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Contract / proposal no." /></div>
          <div><label style={lab}>Staff invoice no.</label><input className="input" value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="e.g. HA-2026-014" /></div>
          <div><label style={lab}>Due date</label><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={lab}>VAT %</label><input className="input" type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={lab}>Retention %</label><input className="input" type="number" value={retentionRate} onChange={(e) => setRetentionRate(e.target.value)} /></div>
          </div>
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
          {Number(retentionRate) > 0 && <Row k={`Less retention ${retentionRate}%`} v={`(${money(totals.retentionAmount)})`} />}
          {Number(retentionRate) > 0 && <Row k="Net amount" v={money(totals.netAmount)} strong />}
          <Row k={`VAT (${vatRate}%)`} v={money(totals.vatAmount)} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #e6dfce", fontWeight: 900, color: COAL }}>
            <span>Amount due</span><span style={{ fontFamily: "var(--mono)" }}>KES {money(totals.grandTotal)}</span>
          </div>
        </div>

        <div style={{ marginTop: 10 }}><label style={lab}>Notes (optional)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shown at the foot of the invoice" /></div>

        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} style={{ flex: 2, fontWeight: 800 }}>{busy ? "Raising…" : "Raise invoice"}</button>
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
