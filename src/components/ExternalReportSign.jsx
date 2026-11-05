"use client";
import { useEffect, useState } from "react";
import SignaturePad from "./SignaturePad";

const GOLD = "#F5A800", COAL = "#161310", INK = "#26221C", MUTE = "#6b6355", PASS = "#2E7D46", FAIL = "#B03A2E";

export default function ExternalReportSign({ token }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfErr, setPdfErr] = useState(false);
  const [mode, setMode] = useState(null); // null | "approve" | "return"
  const [sig, setSig] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null); // "approved" | "returned"

  useEffect(() => {
    fetch(`/api/public/reports/${token}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setErr(d.error || "This link is not valid."); return; }
        setInfo(d);
        if (d.signed) setOutcome("approved");
        else if (d.returned) setOutcome("returned");
      })
      .catch(() => setErr("Could not load the report."));
  }, [token]);

  // Load the PDF as a blob so it displays despite the app's frame headers.
  useEffect(() => {
    let url = "";
    let cancelled = false;
    fetch(`/api/public/reports/${token}/pdf`, { credentials: "same-origin" })
      .then((r) => { if (!r.ok) throw new Error("pdf"); return r.blob(); })
      .then((b) => { if (!cancelled) { url = URL.createObjectURL(b); setPdfUrl(url); } })
      .catch(() => { if (!cancelled) setPdfErr(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [token]);

  const submitApprove = async () => {
    if (!name.trim()) return setErr("Please enter your name.");
    if (!sig) return setErr("Please sign in the box.");
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/public/reports/${token}/sign`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ signatureImage: sig, signedByName: name, title, comment }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not submit."); setBusy(false); return; }
      setOutcome("approved");
    } catch { setErr("Network problem — please try again."); setBusy(false); }
  };

  const submitReturn = async () => {
    if (!comment.trim()) return setErr("Please add a comment explaining what to change.");
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/public/reports/${token}/return`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ comment, name }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not submit."); setBusy(false); return; }
      setOutcome("returned");
    } catch { setErr("Network problem — please try again."); setBusy(false); }
  };

  const wrap = { minHeight: "100vh", background: "#f3eee2", fontFamily: "system-ui, sans-serif", color: INK };
  if (err && !info) return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}><div><h1 style={{ fontSize: 20 }}>Report link</h1><p style={{ color: MUTE }}>{err}</p></div></div>;
  if (!info) return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: MUTE }}>Loading…</span></div>;

  return (
    <div style={wrap}>
      <div style={{ background: COAL, color: "#fff", padding: "14px 18px" }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Qalibrated Systems</div>
        <div style={{ fontSize: 12.5, color: "#c9c1b0" }}>Report for your approval</div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px #0001" }}>
          <div style={{ fontSize: 13, color: MUTE }}>{info.templateName} · {info.serial}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{info.clientName}{info.site ? ` — ${info.site}` : ""}</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>Completed by {info.authorName} · {new Date(info.date).toLocaleDateString()}</div>

          {/* PDF preview — read-only; the client cannot edit the report. */}
          <div style={{ marginTop: 12, height: "58vh", minHeight: 320, borderRadius: 10, overflow: "hidden", background: "#525659", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {pdfErr ? (
              <a href={`/api/public/reports/${token}/pdf`} target="_blank" rel="noreferrer" style={{ color: "#fff", fontWeight: 700 }}>Open the report PDF</a>
            ) : pdfUrl ? (
              <iframe title="Report" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
            ) : (
              <span style={{ color: "#fff", fontSize: 13 }}>Loading report…</span>
            )}
          </div>

          {outcome === "approved" ? (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: "#eef6f0", border: "1px solid #bfe0c9", textAlign: "center" }}>
              <div style={{ fontSize: 22, color: PASS, fontWeight: 900 }}>✓ Approved &amp; signed</div>
              <p style={{ fontSize: 14, color: INK, margin: "6px 0 0" }}>
                Thank you{info.signedByName ? `, ${info.signedByName}` : ""}. Your approval and signature have been recorded with the report.
              </p>
            </div>
          ) : outcome === "returned" ? (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: "#fdf1ef", border: "1px solid #e7bcb4", textAlign: "center" }}>
              <div style={{ fontSize: 20, color: FAIL, fontWeight: 900 }}>↩ Returned with your comment</div>
              <p style={{ fontSize: 14, color: INK, margin: "6px 0 0" }}>
                Thank you. Your comment has been sent back to the Qalibrated team — they’ll make the change and send it again.
              </p>
            </div>
          ) : mode === null ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Please review the report above, then choose:</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => { setErr(""); setMode("approve"); }} style={{ flex: "1 1 180px", padding: 14, borderRadius: 12, border: 0, background: PASS, color: "#fff", fontWeight: 800, fontSize: 15 }}>
                  ✓ Approve &amp; sign
                </button>
                <button onClick={() => { setErr(""); setMode("return"); }} style={{ flex: "1 1 180px", padding: 14, borderRadius: 12, border: `2px solid ${FAIL}`, background: "#fff", color: FAIL, fontWeight: 800, fontSize: 15 }}>
                  ↩ Return with a comment
                </button>
              </div>
            </div>
          ) : mode === "approve" ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Approve &amp; sign</div>
              <SignaturePad onChange={setSig} />
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                <label style={{ fontSize: 12, color: MUTE }}>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inp} /></label>
                <label style={{ fontSize: 12, color: MUTE }}>Title / position (optional)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site Manager" style={inp} /></label>
              </div>
              <label style={{ fontSize: 12, color: MUTE, display: "block", marginTop: 10 }}>Comment (optional)
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Any note to accompany your approval" style={{ ...inp, minHeight: 60, resize: "vertical" }} />
              </label>
              {err && <div style={{ color: FAIL, fontWeight: 700, fontSize: 13, marginTop: 8 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => { setMode(null); setErr(""); }} disabled={busy} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #cfc8ba", background: "#fff", color: INK, fontWeight: 700, fontSize: 14 }}>← Back</button>
                <button onClick={submitApprove} disabled={busy} style={{ flex: 1, padding: 14, borderRadius: 12, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 15 }}>
                  {busy ? "Submitting…" : "Approve & submit"}
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: MUTE, marginTop: 8, textAlign: "center" }}>By signing you confirm you have reviewed and approved the report above.</p>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Return with a comment</div>
              <label style={{ fontSize: 12, color: MUTE, display: "block" }}>What needs to change?
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Explain what should be corrected before you can approve" style={{ ...inp, minHeight: 90, resize: "vertical" }} />
              </label>
              <label style={{ fontSize: 12, color: MUTE, display: "block", marginTop: 10 }}>Your name (optional)
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inp} />
              </label>
              {err && <div style={{ color: FAIL, fontWeight: 700, fontSize: 13, marginTop: 8 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => { setMode(null); setErr(""); }} disabled={busy} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #cfc8ba", background: "#fff", color: INK, fontWeight: 700, fontSize: 14 }}>← Back</button>
                <button onClick={submitReturn} disabled={busy} style={{ flex: 1, padding: 14, borderRadius: 12, border: 0, background: FAIL, color: "#fff", fontWeight: 800, fontSize: 15 }}>
                  {busy ? "Sending…" : "Return report"}
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: MUTE, marginTop: 8, textAlign: "center" }}>The report goes back to the Qalibrated team with your comment. You can’t edit the report yourself.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", marginTop: 3, padding: "10px 12px", borderRadius: 8, border: "1px solid #cfc8ba", fontSize: 15, color: "#26221C", background: "#fff" };
