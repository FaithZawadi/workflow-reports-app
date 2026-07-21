"use client";
import { useState } from "react";
import { Brand, Stripe } from "./ui";
import { GOLD, COAL, INK, MUTE, LINE } from "@/lib/theme";
import { TRAINING_CRITERIA, TRAINING_SCALE, TRAINING_MODES, RECOMMEND } from "@/lib/training";

// A 1..5 rating selector.
function Rating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          title={TRAINING_SCALE[n - 1]}
          aria-label={`${n} — ${TRAINING_SCALE[n - 1]}`}
          style={{
            width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 14,
            border: `1px solid ${value === n ? COAL : LINE}`,
            background: value === n ? COAL : "#fff",
            color: value === n ? GOLD : INK,
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

const empty = (prefill) => ({
  trainingTitle: prefill.trainingTitle || "Qalibrated Systems MMS Training",
  organization: prefill.organization || "",
  trainer: prefill.trainer || "",
  trainingDate: prefill.date || "",
  traineeName: "",
  traineeRole: "",
  mode: "",
  didWell: "",
  improve: "",
  additionalSupport: "",
  recommend: "",
});

// MMS Training Feedback Form. Public (no login). `embedded` renders it inside
// the HR page (no full-page shell) and calls onSubmitted after saving.
export default function TrainingFeedbackForm({ prefill = {}, embedded = false, onSubmitted }) {
  const [f, setF] = useState(empty(prefill));
  const [criteria, setCriteria] = useState({});
  const [overall, setOverall] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setCriterion = (k, v) => setCriteria((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!f.traineeName.trim()) return setErr("Please enter your name.");
    const answered = overall || Object.keys(criteria).length > 0 || f.didWell.trim() || f.improve.trim() || f.additionalSupport.trim();
    if (!answered) return setErr("Please rate at least one item or leave a comment.");
    setBusy(true);
    try {
      const res = await fetch("/api/training-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, criteria, overall: overall || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Could not send."); setBusy(false); return; }
      setSavedId(data.id || null);
      setDone(true);
      if (embedded && onSubmitted) onSubmitted();
    } catch {
      setErr("Network problem. Please try again.");
      setBusy(false);
    }
  };

  const thanks = (
    <div className="card" style={{ marginTop: embedded ? 0 : 18, padding: 18, borderColor: GOLD, background: "#fdf6e3" }}>
      <div style={{ fontWeight: 900, fontSize: 16, color: INK }}>Thank you for your feedback 🙏</div>
      <p className="muted" style={{ marginTop: 6 }}>Your training feedback has been received. HR will review it.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {savedId && (
          <a className="btn btn-dark" href={`/api/training-feedback/${savedId}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 13, textDecoration: "none" }}>
            Download a copy (PDF)
          </a>
        )}
        {!embedded && (
          <button className="btn" onClick={() => { setF(empty(prefill)); setCriteria({}); setOverall(0); setDone(false); setSavedId(null); }} style={{ fontSize: 13 }}>
            Submit another
          </button>
        )}
      </div>
    </div>
  );

  const Section = ({ title }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "16px 0 8px" }}>
      <span style={{ width: 10, height: 10, background: GOLD }} />
      <span style={{ fontWeight: 800, fontSize: 13, color: INK, textTransform: "uppercase", letterSpacing: ".03em" }}>{title}</span>
    </div>
  );

  const formBody = (
    <form onSubmit={submit} style={{ marginTop: embedded ? 0 : 8 }}>
      <Section title="Participant details" />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
        <label className="field" style={{ margin: 0 }}><span className="label">Name *</span><input className="input" value={f.traineeName} onChange={(e) => set("traineeName", e.target.value)} placeholder="Full name" /></label>
        <label className="field" style={{ margin: 0 }}><span className="label">Organization / Site</span><input className="input" value={f.organization} onChange={(e) => set("organization", e.target.value)} placeholder="e.g. Tata Chemicals" /></label>
        <label className="field" style={{ margin: 0 }}><span className="label">Role / Designation</span><input className="input" value={f.traineeRole} onChange={(e) => set("traineeRole", e.target.value)} /></label>
        <label className="field" style={{ margin: 0 }}><span className="label">Date of training</span><input className="input" type="date" value={f.trainingDate} onChange={(e) => set("trainingDate", e.target.value)} /></label>
        <label className="field" style={{ margin: 0 }}><span className="label">Trainer</span><input className="input" value={f.trainer} onChange={(e) => set("trainer", e.target.value)} placeholder="e.g. Zawadi / Calisto" /></label>
        <div className="field" style={{ margin: 0 }}>
          <span className="label">Mode</span>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {TRAINING_MODES.map((m) => (
              <button key={m.key} type="button" onClick={() => set("mode", f.mode === m.key ? "" : m.key)}
                className="btn" style={f.mode === m.key ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Section title="Rate each statement · 1 = Poor  …  5 = Excellent" />
      <div style={{ display: "grid", gap: 8 }}>
        {TRAINING_CRITERIA.map(([k, label]) => (
          <div key={k} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
            <span style={{ fontSize: 13.5, color: INK, flex: "1 1 240px" }}>{label}</span>
            <Rating value={criteria[k] || 0} onChange={(v) => setCriterion(k, v)} />
          </div>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: INK, flex: "1 1 240px" }}>Overall satisfaction with this training</span>
          <Rating value={overall} onChange={setOverall} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="label">Would you recommend this training to a colleague?</span>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {RECOMMEND.map((r) => (
            <button key={r.key} type="button" onClick={() => set("recommend", f.recommend === r.key ? "" : r.key)}
              className="btn" style={f.recommend === r.key ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <Section title="Open feedback" />
      <label className="field" style={{ margin: 0 }}><span className="label">Most useful part of this training</span>
        <textarea className="input" rows={2} value={f.didWell} onChange={(e) => set("didWell", e.target.value)} /></label>
      <label className="field" style={{ margin: "8px 0 0" }}><span className="label">What could be improved</span>
        <textarea className="input" rows={2} value={f.improve} onChange={(e) => set("improve", e.target.value)} /></label>
      <label className="field" style={{ margin: "8px 0 0" }}><span className="label">Additional support / follow-up needed</span>
        <textarea className="input" rows={2} value={f.additionalSupport} onChange={(e) => set("additionalSupport", e.target.value)} /></label>

      {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ fontSize: 14 }}>{busy ? "Sending…" : "Submit feedback"}</button>
      </div>
    </form>
  );

  // Embedded (inside the HR page) — no full-page shell.
  if (embedded) {
    return done ? thanks : <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: GOLD }}>{formBody}</div>;
  }

  // Public standalone page.
  return (
    <div className="login-shell">
      <div className="card login-card" style={{ maxWidth: 780 }}>
        <Stripe />
        <div className="paper" style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <Brand />
            <span className="mono" style={{ fontSize: 11, color: GOLD, background: COAL, padding: "3px 6px" }}>QSL/HR/TFB</span>
          </div>
          <p className="eyebrow" style={{ marginTop: 14 }}>Training feedback</p>
          <h1 className="h1" style={{ marginTop: 4 }}>Training Feedback Form</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Training on the Qalibrated Systems Maintenance Management System (MMS). Your feedback helps us improve future
            training — it takes about two minutes.
          </p>
          {done ? thanks : formBody}
        </div>
      </div>
    </div>
  );
}
