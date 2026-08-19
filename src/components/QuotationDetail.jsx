"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperCard, SectionBar } from "./ui";
import { StatusBadge } from "./CalibrationRequests";
import { QUOTE_STATUS } from "./Quotations";
import ShareButtons from "./ShareButtons";
import { quoteTotals, amountInWords } from "@/lib/money";
import { DEFAULT_PAYMENT_DETAILS, DEFAULT_QUOTE_TERMS } from "@/lib/company";
import { isClient } from "@/lib/roles";
import { GOLD, COAL, INK, MUTE, PASS, FAIL, WAIT } from "@/lib/theme";

const BLANK = { description: "", qty: 1, unit: "EA", unitPrice: 0 };
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuotationDetail({ id, profile }) {
  const router = useRouter();
  // Amendment history is internal-only — never shown to a client viewer.
  const staffViewer = !isClient(profile);
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
  // Client contact — captured/edited on the quote so it can be emailed/messaged.
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // Invoice-style fields — subject line, file/ref no, and the editable payment
  // details + terms-of-sale blocks (prefilled from company defaults).
  const [subject, setSubject] = useState("");
  const [fileNo, setFileNo] = useState("");
  const [paymentDetails, setPaymentDetails] = useState(DEFAULT_PAYMENT_DETAILS);
  const [terms, setTerms] = useState(DEFAULT_QUOTE_TERMS);
  // Reason captured when re-issuing an already-issued quote (an amendment).
  const [amendReason, setAmendReason] = useState("");

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
        setContactPerson(quote.contactPerson || "");
        setContactEmail(quote.contactEmail || "");
        setContactPhone(quote.contactPhone || "");
        setSubject(quote.subject || "");
        setFileNo(quote.fileNo || "");
        setPaymentDetails(quote.paymentDetails || DEFAULT_PAYMENT_DETAILS);
        setTerms(quote.terms || DEFAULT_QUOTE_TERMS);
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
    // Email is optional — some clients only have WhatsApp. Issuing still mints
    // the shareable PDF link so it can be sent by WhatsApp or downloaded.
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: clean, vatRate: Number(vatRate), freight: Number(freight), currency, notes,
          validUntil: validUntil || null, issue,
          contactPerson: contactPerson.trim(), contactEmail: contactEmail.trim(), contactPhone: contactPhone.trim(),
          subject: subject.trim(), fileNo: fileNo.trim(), paymentDetails: paymentDetails.trim(), terms: terms.trim(),
          amendReason: amendReason.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setNote(d.error || "Could not save.");
        setBusy(false);
        return;
      }
      // On issue, open the client's email app with the quotation link ready to send.
      if (issue && d.shareToken && d.contactEmail) {
        const link = `${window.location.origin}/d/${d.shareToken}`;
        const subject = `Quotation ${d.number} — Qalibrated Systems`;
        const body = `Dear ${contactPerson.trim() || "Sir/Madam"},\n\nPlease find our quotation ${d.number} for ${q?.clientName || "your organisation"}. Total ${d.currency} ${Number(d.grandTotal || 0).toLocaleString()}.\n\nOpen the quotation (PDF):\n${link}\n\nKind regards,\n${profile?.name || "Qalibrated Systems"}\nQalibrated Systems Limited`;
        window.location.href = `mailto:${encodeURIComponent(d.contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      await load();
      setAmendReason("");
      setNote(
        issue
          ? contactEmail.trim()
            ? "Quotation issued. Your email app should open, ready to send — or use the share buttons above (Email / WhatsApp / Download PDF)."
            : "Quotation issued. No email on file — share it via WhatsApp or Download PDF using the buttons above."
          : "Draft saved."
      );
    } catch {
      setNote("Network problem — try again.");
    }
    setBusy(false);
  };

  const [lpoBusy, setLpoBusy] = useState(false);
  const [lpoMsg, setLpoMsg] = useState("");

  const uploadLpo = async (file) => {
    setLpoMsg("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setLpoMsg("Please choose an image file (JPG or PNG).");
    if (file.size > 2 * 1024 * 1024) return setLpoMsg("The LPO image must be 2 MB or smaller.");
    setLpoBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lpoImage: dataUrl, lpoName: file.name }),
      });
      const d = await res.json();
      if (!res.ok) {
        setLpoMsg(d.error || "Could not upload the LPO.");
        setLpoBusy(false);
        return;
      }
      await load();
      setLpoMsg("LPO uploaded.");
    } catch {
      setLpoMsg("Network problem — try again.");
    }
    setLpoBusy(false);
  };

  const removeLpo = async () => {
    setLpoBusy(true);
    setLpoMsg("");
    try {
      await fetch(`/api/quotations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ lpoImage: null }) });
      await load();
    } catch {
      setLpoMsg("Network problem — try again.");
    }
    setLpoBusy(false);
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
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, background: COAL, color: GOLD, padding: "4px 8px" }}>{q.number}</span>
            {q.revision > 0 && (
              <span title={`Amended ${q.revision} time${q.revision === 1 ? "" : "s"}`} style={{ fontSize: 11, fontWeight: 800, background: GOLD, color: COAL, padding: "3px 7px", borderRadius: 999 }}>Rev {q.revision}</span>
            )}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={q.status} map={QUOTE_STATUS} />
            {q.status !== "REQUESTED" && (
              <a className="btn btn-dark" href={`/api/quotations/${id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Download PDF</a>
            )}
            {perm.canPrepare && (
              <button
                className="btn"
                style={{ fontSize: 12, color: FAIL }}
                onClick={async () => {
                  if (!confirm(`Delete quotation ${q.number}? This can't be undone.`)) return;
                  const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
                  if (res.ok) router.push("/quotations");
                  else setNote((await res.json().catch(() => ({}))).error || "Could not delete.");
                }}
              >
                Delete
              </button>
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

        {q.status !== "REQUESTED" && q.shareToken && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: MUTE, marginBottom: 6 }}>Share quotation</div>
            <ShareButtons
              subject={`Quotation ${q.number} — Qalibrated Systems`}
              message={`Quotation ${q.number} for ${q.clientName}. Total ${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}${q.validUntil ? `, valid until ${new Date(q.validUntil).toLocaleDateString()}` : ""}. Open the PDF:`}
              url={typeof window !== "undefined" ? `${window.location.origin}/d/${q.shareToken}` : ""}
              to={q.contactEmail}
              phone={q.contactPhone}
            />
            <div style={{ fontSize: 11, color: MUTE, marginTop: 6 }}>
              This is a private, unguessable link that opens only the quotation PDF — it doesn&apos;t expose the system.
            </div>
          </div>
        )}

        {/* ---- Staff editor ---- */}
        {editable ? (
          <>
            <SectionBar>Client contact</SectionBar>
            <div className="grid md-2">
              <label className="field"><span className="label">Contact person</span>
                <input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="e.g. Jane Doe" />
              </label>
              <label className="field"><span className="label">Client email (optional)</span>
                <input id="qd-client-email" className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="leave blank to share by WhatsApp / PDF" />
              </label>
              <label className="field"><span className="label">Client phone (for WhatsApp)</span>
                <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="e.g. +254 7XX XXX XXX" />
              </label>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>No email? Leave it blank — you can still issue the quote and share the PDF by WhatsApp or download it.</p>
            <div className="grid md-2">
              <label className="field"><span className="label">Subject / job</span>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Calibration & verification of weighbridge" />
              </label>
              <label className="field"><span className="label">File / reference no.</span>
                <input className="input" value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="e.g. QSL/2026/014" />
              </label>
            </div>

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

            <SectionBar>Payment details &amp; terms</SectionBar>
            <div className="grid md-2">
              <label className="field"><span className="label">Payment details (shown on the PDF)</span>
                <textarea className="input" rows={7} style={{ fontFamily: "monospace", fontSize: 12 }} value={paymentDetails} onChange={(e) => setPaymentDetails(e.target.value)} />
                <span className="muted" style={{ fontSize: 11 }}>Editable — one line each. Defaults to the company bank details.</span>
              </label>
              <label className="field"><span className="label">Terms of sale (foot of the quotation)</span>
                <textarea className="input" rows={7} value={terms} onChange={(e) => setTerms(e.target.value)} />
                <span className="muted" style={{ fontSize: 11 }}>Editable — shown at the bottom of the quotation.</span>
              </label>
            </div>

            <Totals totals={totals} currency={currency} vatRate={vatRate} freight={freight} words={previewWords} />

            {/* Amendment history + a reason box when re-issuing an issued quote. */}
            {staffViewer && q.amendments?.length ? <RevisionHistory amendments={q.amendments} /> : null}
            {q.status === "QUOTED" && (
              <label className="field" style={{ marginTop: 10 }}>
                <span className="label">Reason for amendment (shown on the revised quote)</span>
                <input className="input" value={amendReason} onChange={(e) => setAmendReason(e.target.value)} placeholder="e.g. Revised scope — added load-cell replacement" />
                <span className="muted" style={{ fontSize: 11 }}>Re-issuing records a new revision (Rev {(q.revision || 0) + 1}) with your name, the date and this reason.</span>
              </label>
            )}

            {note && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{note}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button className="btn" onClick={() => save(false)} disabled={busy} style={{ fontSize: 13 }}>Save draft</button>
              <button className="btn btn-primary" onClick={() => save(true)} disabled={busy} style={{ flex: 1, minWidth: 160 }}>
                {q.status === "QUOTED" ? "Re-issue amended quote" : "Issue to client"}
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
                {staffViewer && q.amendments?.length ? <RevisionHistory amendments={q.amendments} /> : null}
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

        {/* Local Purchase Order — client uploads their LPO image; both sides view it. */}
        {q.status !== "REQUESTED" && (
          <div style={{ marginTop: 16 }}>
            <SectionBar>Local Purchase Order (LPO)</SectionBar>
            {q.lpoImage ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.lpoImage} alt="LPO" style={{ maxWidth: "100%", maxHeight: 460, border: "1px solid #d9d2c4", borderRadius: 4 }} />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{q.lpoName || "LPO"}{q.lpoUploadedAt ? ` · ${new Date(q.lpoUploadedAt).toLocaleDateString()}` : ""}</span>
                  <a className="btn" href={q.lpoImage} download={q.lpoName || "LPO.jpg"} style={{ fontSize: 12, textDecoration: "none" }}>Download</a>
                  {perm.canUploadLpo && (
                    <>
                      <label className="btn" style={{ fontSize: 12, cursor: "pointer" }}>
                        Replace
                        <input type="file" accept="image/*" hidden onChange={(e) => uploadLpo(e.target.files?.[0])} disabled={lpoBusy} />
                      </label>
                      <button className="btn" onClick={removeLpo} disabled={lpoBusy} style={{ fontSize: 12, color: FAIL }}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            ) : perm.canUploadLpo ? (
              <div className="card" style={{ padding: 16, borderStyle: "dashed", textAlign: "center" }}>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>Upload your Local Purchase Order as an image (JPG or PNG, up to 2 MB).</p>
                <label className="btn btn-primary" style={{ fontSize: 13, cursor: "pointer", display: "inline-block" }}>
                  {lpoBusy ? "Uploading…" : "Choose LPO image"}
                  <input type="file" accept="image/*" hidden onChange={(e) => uploadLpo(e.target.files?.[0])} disabled={lpoBusy} />
                </label>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>No LPO uploaded yet.</div>
            )}
            {lpoMsg && <div style={{ color: WAIT, fontWeight: 700, fontSize: 13, marginTop: 8 }}>{lpoMsg}</div>}
          </div>
        )}
      </PaperCard>
    </div>
  );
}

function RevisionHistory({ amendments }) {
  const list = [...amendments].sort((a, b) => (b.rev || 0) - (a.rev || 0));
  return (
    <div style={{ marginTop: 14 }}>
      <SectionBar>Amendment history</SectionBar>
      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
        {list.map((a, i) => {
          const delta = a.grandTotal != null && a.prevTotal != null ? Number(a.grandTotal) - Number(a.prevTotal) : null;
          return (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", padding: "8px 10px", background: "#FBF9F4", border: "1px solid #e6e0d2", borderRadius: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, background: GOLD, color: COAL, padding: "2px 7px", borderRadius: 999 }}>Rev {a.rev}</span>
              <span style={{ fontSize: 13, color: INK, fontWeight: 700 }}>{a.byName || "—"}</span>
              <span className="muted" style={{ fontSize: 12 }}>{a.at ? new Date(a.at).toLocaleString() : ""}</span>
              {delta != null && delta !== 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: delta > 0 ? FAIL : PASS }}>
                  {delta > 0 ? "▲" : "▼"} {a.currency || ""} {Math.abs(delta).toLocaleString()}
                </span>
              )}
              {a.note && <span style={{ fontSize: 13, color: INK, flexBasis: "100%" }}>{a.note}</span>}
            </div>
          );
        })}
      </div>
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
