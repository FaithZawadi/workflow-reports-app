"use client";
import { useState } from "react";
import { Brand, Stripe } from "./ui";
import { GOLD, COAL, INK, MUTE } from "@/lib/theme";
import { COMPANY } from "@/lib/company";
import { SERVICE_TYPES } from "@/lib/serviceTypes";

export default function ServiceFeedbackForm({ prefill = {} }) {
  const [f, setF] = useState({
    serviceType: prefill.serviceType || "",
    clientName: prefill.clientName || "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    weighbridge: "",
    serviceDate: "",
    comments: "",
  });
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!f.serviceType) return setErr("Please choose the type of service.");
    if (!f.clientName.trim()) return setErr("Please enter your company name.");
    if (!rating && !f.comments.trim()) return setErr("Please give a rating or a comment.");
    setBusy(true);
    try {
      const res = await fetch("/api/service-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, rating: rating || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Could not send."); setBusy(false); return; }
      setDone(true);
    } catch {
      setErr("Network problem. Please try again.");
      setBusy(false);
    }
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="login-shell">
      <div className="card login-card" style={{ maxWidth: 620 }}>
        <Stripe />
        <div className="paper" style={{ padding: "24px 22px" }}>
          <Brand />
          <p className="eyebrow" style={{ marginTop: 14 }}>Customer service feedback</p>
          <h1 className="h1" style={{ marginTop: 4 }}>How was your service?</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Tell us how the recent maintenance or calibration went, or leave an enquiry. It goes straight to the QSL team.
          </p>

          {done ? (
            <div className="card" style={{ marginTop: 18, padding: 18, borderColor: GOLD, background: "#fdf6e3" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: INK }}>Thank you! 🙏</div>
              <p className="muted" style={{ marginTop: 6 }}>Your feedback has been received. The QSL team will follow up if needed.</p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ marginTop: 18 }}>
              <label className="field">
                <span className="label">Service carried out</span>
                <select className="input" value={f.serviceType} onChange={(e) => set("serviceType", e.target.value)}>
                  <option value="">— choose —</option>
                  {SERVICE_TYPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <div className="grid md-2" style={{ gap: 8 }}>
                <label className="field"><span className="label">Company name</span><input className="input" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. TATA Chemicals Magadi" /></label>
                <label className="field"><span className="label">Weighbridge / site (optional)</span><input className="input" value={f.weighbridge} onChange={(e) => set("weighbridge", e.target.value)} /></label>
                <label className="field"><span className="label">Your name (optional)</span><input className="input" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
                <label className="field"><span className="label">Service date (optional)</span><input className="input" type="date" value={f.serviceDate} onChange={(e) => set("serviceDate", e.target.value)} /></label>
                <label className="field"><span className="label">Email (optional)</span><input className="input" type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></label>
                <label className="field"><span className="label">Phone (optional)</span><input className="input" value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></label>
              </div>

              <div className="field">
                <span className="label">Your rating</span>
                <div style={{ display: "flex", gap: 4 }} onMouseLeave={() => setHover(0)}>
                  {stars.map((n) => {
                    const on = (hover || rating) >= n;
                    return (
                      <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}
                        style={{ background: "none", border: 0, cursor: "pointer", padding: 2, fontSize: 30, lineHeight: 1, color: on ? GOLD : "#cfc8ba" }}>
                        {on ? "★" : "☆"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="field">
                <span className="label">Comments or enquiry</span>
                <textarea className="input" rows={4} value={f.comments} onChange={(e) => set("comments", e.target.value)} spellCheck autoCapitalize="sentences" style={{ resize: "vertical" }} placeholder="What went well, what could be better, or any question for our team…" />
              </label>

              {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
              <button className="btn btn-primary" style={{ width: "100%", padding: 13 }} disabled={busy}>
                {busy ? "Sending…" : "Send feedback"}
              </button>
            </form>
          )}

          <div className="mono" style={{ fontSize: 10.5, color: MUTE, marginTop: 18, lineHeight: 1.6 }}>
            {COMPANY.name} · {COMPANY.email} · {COMPANY.phone}
          </div>
        </div>
        <Stripe />
      </div>
    </div>
  );
}
