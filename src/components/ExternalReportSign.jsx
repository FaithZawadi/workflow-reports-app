"use client";
import { useEffect, useState } from "react";
import SignaturePad from "./SignaturePad";

const GOLD = "#F5A800", COAL = "#161310", INK = "#26221C", MUTE = "#6b6355", PASS = "#2E7D46";

export default function ExternalReportSign({ token }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfErr, setPdfErr] = useState(false);
  const [sig, setSig] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/reports/${token}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) setErr(d.error || "This link is not valid."); else { setInfo(d); if (d.signed) setDone(true); } })
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

  const submit = async () => {
    if (!name.trim()) return setErr("Please enter your name.");
    if (!sig) return setErr("Please sign in the box.");
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/public/reports/${token}/sign`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ signatureImage: sig, signedByName: name, title }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not submit."); setBusy(false); return; }
      setDone(true);
    } catch { setErr("Network problem — please try again."); setBusy(false); }
  };

  const wrap = { minHeight: "100vh", background: "#f3eee2", fontFamily: "system-ui, sans-serif", color: INK };
  if (err && !info) return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}><div><h1 style={{ fontSize: 20 }}>Signing link</h1><p style={{ color: MUTE }}>{err}</p></div></div>;
  if (!info) return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: MUTE }}>Loading…</span></div>;

  return (
    <div style={wrap}>
      <div style={{ background: COAL, color: "#fff", padding: "14px 18px" }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Qalibrated Systems</div>
        <div style={{ fontSize: 12.5, color: "#c9c1b0" }}>Report for signature</div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px #0001" }}>
          <div style={{ fontSize: 13, color: MUTE }}>{info.templateName} · {info.serial}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{info.clientName}{info.site ? ` — ${info.site}` : ""}</div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>Completed by {info.authorName} · {new Date(info.date).toLocaleDateString()}</div>

          {/* PDF preview */}
          <div style={{ marginTop: 12, height: "58vh", minHeight: 320, borderRadius: 10, overflow: "hidden", background: "#525659", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {pdfErr ? (
              <a href={`/api/public/reports/${token}/pdf`} target="_blank" rel="noreferrer" style={{ color: "#fff", fontWeight: 700 }}>Open the report PDF</a>
            ) : pdfUrl ? (
              <iframe title="Report" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
            ) : (
              <span style={{ color: "#fff", fontSize: 13 }}>Loading report…</span>
            )}
          </div>

          {done ? (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: "#eef6f0", border: "1px solid #bfe0c9", textAlign: "center" }}>
              <div style={{ fontSize: 22, color: PASS, fontWeight: 900 }}>✓ Signed</div>
              <p style={{ fontSize: 14, color: INK, margin: "6px 0 0" }}>
                Thank you{info.signedByName ? `, ${info.signedByName}` : ""}. Your signature has been recorded and saved with the report.
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Sign to acknowledge this report</div>
              <SignaturePad onChange={setSig} />
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                <label style={{ fontSize: 12, color: MUTE }}>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inp} /></label>
                <label style={{ fontSize: 12, color: MUTE }}>Title / position (optional)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site Manager" style={inp} /></label>
              </div>
              {err && <div style={{ color: "#B03A2E", fontWeight: 700, fontSize: 13, marginTop: 8 }}>{err}</div>}
              <button onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 12, padding: 14, borderRadius: 12, border: 0, background: GOLD, color: COAL, fontWeight: 800, fontSize: 15 }}>
                {busy ? "Submitting…" : "Sign & submit"}
              </button>
              <p style={{ fontSize: 11.5, color: MUTE, marginTop: 8, textAlign: "center" }}>By signing you confirm you have reviewed the report above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", marginTop: 3, padding: "10px 12px", borderRadius: 8, border: "1px solid #cfc8ba", fontSize: 15, color: "#26221C", background: "#fff" };
