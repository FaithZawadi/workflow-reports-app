"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar } from "./ui";
import { StatusBadge } from "./CalibrationRequests";
import { QUOTE_STATUS } from "./Quotations";
import { quoteTotals, amountInWords } from "@/lib/money";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const BLANK = { description: "", qty: 1, unit: "EA", unitPrice: 0 };
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuotationDetail({ id, profile }) {
  const router = useRouter();
  const [q, setQ] = useState(null);
  const [perm, setPerm] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Editable draft (staff)
  const [items, setItems] = useState([{ ...BLANK }]);
  const [vatRate, setVatRate] = useState(16);
  const [freight, setFreight] = useState(0);
  const [currency, setCurrency] = useState("KES");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const load = () =>
    fetch(`/api/quotations/${id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setErr(d.error || "Could not load.");
        const quote = d.quotation;
        setQ(quote);
        setPerm(d.permissions || {});
        setItems(Array.isArray(quote.items) && quote.items.length ? quote.items : [{ ...BLANK }]);
        setVatRate(quote.vatRate ?? 16);
        setFreight(quote.freight ?? 0);
        setCurrency(quote.currency || "KES");
        setValidUntil(quote.validUntil ? quote.validUntil.slice(0, 10) : "");
        setNotes(quote.notes || "");
      })
      .catch(() => setErr("Could not load."));

  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => quoteTotals(items, vatRate, freight), [items, vatRate, freight]);

  const setItem = (i, k, v) => setItems((s) => s.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((s) => [...s, { ...BLANK }]);
  const removeItem = (i) => setItems((s) => (s.length <= 1 ? s : s.filter((_, idx) => idx !== i)));

  const save = async (issue) => {
    setNote("");
    const clean = items.filter((it) => String(it.description).trim());
    if (issue && clean.length === 0) return setNote("Add at least one line item before issuing.");
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: clean, vatRate: Number(vatRate), freight: Number(freight), currency, notes, validUntil: validUntil || null, issue }),
      });
      const d = await res.json();
      if (!res.ok) {
        setNote(d.error || "Could not save.");
        setBusy(false);
        return;
      }
      await load();
      setNote(issue ? "Quotation issued and emailed to the client." : "Draft saved.");
    } catch {
      setNote("Network problem — try again.");
    }
    setBusy(false);
  };

  const decide = async (clientDecision) => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientDecision }),
      });
      const d = await res.json();
      if (!res.ok) {
        setNote(d.error || "Could not save.");
        setBusy(false);
        return;
      }
      await load();
    } catch {
      setNote("Network problem — try again.");
    }
    setBusy(false);
  };

  if (err) return <div className="err" style={{ marginTop: 16 }}>{err}</div>;
  if (!q) return <div className="muted" style={{ marginTop: 24 }}>Loading…</div>;

  const editable = perm.canPrepare && (q.status === "REQUESTED" || q.status === "QUOTED");
  const previewWords = amountInWords(totals.grandTotal, currency);

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => router.push("/quotations")} style={{ background: "none", border: 0, color: WAIT, fontWeight: 700, fontSize: 13 }}>
        ← Back
      </button>
      <PaperCard>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, background: COAL, color: GOLD, padding: "4px 8px" }}>{q.number}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={q.status} map={QUOTE_STATUS} />
            {q.status !== "REQUESTED" && (
              <a className="btn btn-dark" href={`/api/quotations/${id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Download PDF</a>
            )}
          </div>
        </div>

        <h1 className="h1" style={{ marginTop: 10 }}>Quotation — {q.clientName}</h1>
        <div className="muted" style={{ fontSize: 12 }}>
          {q.contactPerson || "-"}{q.contactEmail ? ` · ${q.contactEmail}` : ""} · raised {new Date(q.createdAt).toLocaleDateString()}
          {q.preparedByName ? ` · prepared by ${q.preparedByName}` : ""}
        </div>
        {q.requestNote && (
          <div className="card" style={{ padding: 12, marginTop: 10, background: "#f3eee2" }}>
            <b style={{ fontSize: 12, textTransform: "uppercase", color: MUTE }}>Request</b>
            <div style={{ fontSize: 14, color: INK, marginTop: 2 }}>{q.requestNote}</div>
          </div>
        )}

        {/* ---- Staff editor ---- */}
        {editable ? (
          <>
            <SectionBar>Line items</SectionBar>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 110px 110px 28px", gap: 4, marginBottom: 4 }}>
                  {["Description", "Qty", "UOM", "Unit price", "Amount", ""].map((h) => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: COAL, padding: "4px 5px" }}>{h}</span>
                  ))}
                </div>
                {items.map((it, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 110px 110px 28px", gap: 4, marginBottom: 4, alignItems: "center" }}>
                    <input className="input" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} style={cell} />
                    <input className="input" type="number" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} style={{ ...cell, textAlign: "right" }} />
                    <input className="input" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} style={cell} />
                    <input className="input" type="number" value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", e.target.value)} style={{ ...cell, textAlign: "right" }} />
                    <span style={{ fontSize: 13, textAlign: "right", color: INK }}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</span>
                    <button onClick={() => removeItem(i)} title="Remove" style={{ background: "none", border: 0, color: FAIL, fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn" onClick={addItem} style={{ fontSize: 12, marginTop: 4 }}>+ Add line</button>

            <div className="grid md-2" style={{ marginTop: 12 }}>
              <label className="field"><span className="label">Currency</span>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {["KES", "USD", "EUR", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="field"><span className="label">VAT rate (%)</span>
                <input className="input" type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
              </label>
              <label className="field"><span className="label">Freight ({currency})</span>
                <input className="input" type="number" value={freight} onChange={(e) => setFreight(e.target.value)} />
              </label>
              <label className="field"><span className="label">Valid until</span>
                <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </label>
            </div>
            <label className="field"><span className="label">Notes</span>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <Totals totals={totals} currency={currency} vatRate={vatRate} freight={freight} words={previewWords} />
            {note && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{note}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button className="btn" onClick={() => save(false)} disabled={busy} style={{ fontSize: 13 }}>Save draft</button>
              <button className="btn btn-primary" onClick={() => save(true)} disabled={busy} style={{ flex: 1, minWidth: 160 }}>
                {q.status === "QUOTED" ? "Re-issue to client" : "Issue to client"}
              </button>
            </div>
          </>
        ) : (
          /* ---- Read-only view (client, or issued/closed) ---- */
          <>
            {Array.isArray(q.items) && q.items.length > 0 && (
              <>
                <SectionBar>Line items</SectionBar>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560, fontSize: 13 }}>
                    <thead>
                      <tr><th style={thd}>#</th><th style={thd}>Description</th><th style={{ ...thd, textAlign: "right" }}>Qty</th><th style={thd}>UOM</th><th style={{ ...thd, textAlign: "right" }}>Unit price</th><th style={{ ...thd, textAlign: "right" }}>Amount</th></tr>
                    </thead>
                    <tbody>
                      {q.items.map((it, i) => (
                        <tr key={i}>
                          <td style={tdc}>{i + 1}</td>
                          <td style={tdc}>{it.description}</td>
                          <td style={{ ...tdc, textAlign: "right" }}>{Number(it.qty || 0).toLocaleString()}</td>
                          <td style={tdc}>{it.unit || "EA"}</td>
                          <td style={{ ...tdc, textAlign: "right" }}>{money(it.unitPrice)}</td>
                          <td style={{ ...tdc, textAlign: "right" }}>{money((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Totals totals={{ subtotal: q.subtotal, vatAmount: q.vatAmount, grandTotal: q.grandTotal }} currency={q.currency} vatRate={q.vatRate} freight={q.freight} words={q.amountInWords} />
                {q.notes && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}><b>Notes:</b> {q.notes}</div>}
              </>
            )}
            {q.status === "REQUESTED" && (
              <div className="card" style={{ padding: 16, marginTop: 14, borderStyle: "dashed", textAlign: "center", color: MUTE }}>
                Awaiting pricing from QSL. You will be emailed when the quotation is ready.
              </div>
            )}

            {/* Client accept / decline */}
            {perm.canDecide && (
              <div className="card" style={{ borderColor: GOLD, background: "#fdf6e3", padding: 14, marginTop: 14 }}>
                <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: 13, color: INK }}>Your decision</div>
                <p className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>Accept to proceed, or decline. Recorded against {q.number}.</p>
                {note && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{note}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => decide("ACCEPTED")} disabled={busy} style={{ flex: 1, background: PASS, color: "#fff", borderColor: PASS, fontWeight: 900, textTransform: "uppercase" }}>Accept</button>
                  <button className="btn" onClick={() => decide("DECLINED")} disabled={busy} style={{ flex: 1, background: FAIL, color: "#fff", borderColor: FAIL, fontWeight: 900, textTransform: "uppercase" }}>Decline</button>
                </div>
              </div>
            )}
            {(q.status === "ACCEPTED" || q.status === "DECLINED") && (
              <div className="card" style={{ marginTop: 14, padding: 12, borderLeftWidth: 5, borderColor: q.status === "ACCEPTED" ? PASS : FAIL }}>
                <b>{q.status === "ACCEPTED" ? "Accepted" : "Declined"}</b>{q.decidedAt ? ` on ${new Date(q.decidedAt).toLocaleString()}` : ""}.
              </div>
            )}
          </>
        )}
      </PaperCard>
    </div>
  );
}

function Totals({ totals, currency, vatRate, freight, words }) {
  const row = (k, v, strong) => (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "3px 0" }}>
      <span style={{ width: 160, textAlign: "right", fontWeight: strong ? 900 : 700, color: strong ? "#fff" : INK, background: strong ? COAL : "transparent", padding: strong ? "4px 8px" : "0 8px" }}>{k}</span>
      <span style={{ width: 130, textAlign: "right", fontWeight: strong ? 900 : 600, color: INK }}>{money(v)}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 10 }}>
      {row("Sub total", totals.subtotal)}
      {Number(freight) > 0 && row("Freight", freight)}
      {row(`VAT (${Number(vatRate) || 0}%)`, totals.vatAmount)}
      {row(`Grand total, ${currency}`, totals.grandTotal, true)}
      {words && <div style={{ textAlign: "right", fontSize: 12, color: MUTE, marginTop: 4, fontStyle: "italic" }}>{words}</div>}
    </div>
  );
}

const cell = { fontSize: 13, padding: "7px 6px" };
const thd = { background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textAlign: "left", padding: "6px 8px", border: "1px solid #2c2720" };
const tdc = { padding: "6px 8px", border: "1px solid #e6e0d2", color: INK, verticalAlign: "top" };
