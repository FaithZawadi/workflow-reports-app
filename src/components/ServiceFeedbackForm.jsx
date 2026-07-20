"use client";
import { useState } from "react";
import { Brand, Stripe } from "./ui";
import { GOLD, COAL, INK, MUTE, PASS } from "@/lib/theme";
import { COMPANY } from "@/lib/company";
import {
  SURVEY_SERVICE_TYPES,
  SURVEY_CRITERIA,
  SATISFACTION_SCALE,
  COMPLAINT_HANDLING,
  YES_NO_UNSURE,
} from "@/lib/survey";

// Customer Satisfaction Survey Form (QSL/QP/004/CSSF). Public page — no login.
export default function ServiceFeedbackForm({ prefill = {} }) {
  const [f, setF] = useState({
    clientName: prefill.clientName || "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    serviceDate: "",
    problemDetail: "",
    complaintHandling: "",
    didWell: "",
    improve: "",
    additionalServices: "",
    comments: "",
    useAgain: "",
    recommend: "",
  });
  const [serviceTypes, setServiceTypes] = useState([]);
  const [criteria, setCriteria] = useState({}); // { "2.1": 1..5 }
  const [overall, setOverall] = useState(0);
  const [hadProblem, setHadProblem] = useState(null); // true/false/null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleService = (k) => setServiceTypes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const setCriterion = (k, v) => setCriteria((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!f.clientName.trim()) return setErr("Please enter your organization name.");
    const answered = overall || Object.keys(criteria).length > 0 || f.comments.trim() || f.didWell.trim() || f.improve.trim();
    if (!answered) return setErr("Please rate at least one item or leave a comment.");
    setBusy(true);
    try {
      const res = await fetch("/api/service-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          serviceTypes,
          criteria,
          overall: overall || undefined,
          hadProblem: hadProblem === null ? undefined : hadProblem,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not send.");
        setBusy(false);
        return;
      }
      setSavedId(data.id || null);
      setDone(true);
    } catch {
      setErr("Network problem. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="card login-card" style={{ maxWidth: 760 }}>
        <Stripe />
        <div className="paper" style={{ padding: "24px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <Brand />
            <span className="mono" style={{ fontSize: 11, color: GOLD, background: COAL, padding: "3px 6px" }}>QSL/QP/004/CSSF</span>
          </div>
          <p className="eyebrow" style={{ marginTop: 14 }}>ISO/IEC 17025 · Customer voice</p>
          <h1 className="h1" style={{ marginTop: 4 }}>Customer Satisfaction Survey</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Conducted per ISO/IEC 17025:2017 Cl. 8.6 and 7.1 &amp; 7.8. Your feedback helps us improve our calibration
            services for Non-Automatic Weighing Instruments (NAWI) and Mass Standards.
          </p>

          {done ? (
            <div className="card" style={{ marginTop: 18, padding: 18, borderColor: GOLD, background: "#fdf6e3" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: INK }}>Thank you for your valuable feedback 🙏</div>
              <p className="muted" style={{ marginTop: 6 }}>Your survey has been received. The QSL team will review it and follow up if needed.</p>
              {savedId && (
                <a className="btn btn-dark" href={`/api/service-feedback/${savedId}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 13, textDecoration: "none", marginTop: 12, display: "inline-block" }}>
                  Download a copy (PDF)
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={submit} style={{ marginTop: 8 }}>
              {/* Section 1 */}
              <SectionTitle n="1" title="Customer information" />
              <div className="grid md-2" style={{ gap: 8 }}>
                <label className="field"><span className="label">Organization name *</span><input className="input" value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. Kapa Oil Refineries" /></label>
                <label className="field"><span className="label">Contact person</span><input className="input" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></label>
                <label className="field"><span className="label">Email</span><input className="input" type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></label>
                <label className="field"><span className="label">Phone</span><input className="input" value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></label>
                <label className="field"><span className="label">Date</span><input className="input" type="date" value={f.serviceDate} onChange={(e) => set("serviceDate", e.target.value)} /></label>
              </div>
              <div className="field">
                <span className="label">Type of service used (tick all that apply)</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {SURVEY_SERVICE_TYPES.map((s) => (
                    <label key={s.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: INK }}>
                      <input type="checkbox" checked={serviceTypes.includes(s.key)} onChange={() => toggleService(s.key)} style={{ width: 18, height: 18 }} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 2 */}
              <SectionTitle n="2" title="Service evaluation" />
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                1 = Very Dissatisfied · 2 = Dissatisfied · 3 = Neutral · 4 = Satisfied · 5 = Very Satisfied
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                {SURVEY_CRITERIA.map(([k, label]) => (
                  <div key={k} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 8px", background: "#fff", border: "1px solid #eae4d6", borderRadius: 4 }}>
                    <span style={{ fontSize: 13.5, color: INK, flex: "1 1 220px" }}><b style={{ color: MUTE }}>{k}</b> {label}</span>
                    <ScaleRow value={criteria[k]} onChange={(v) => setCriterion(k, v)} />
                  </div>
                ))}
              </div>

              {/* Section 4 */}
              <SectionTitle n="4" title="Complaints and issues" />
              <div className="field">
                <span className="label">Did you experience any problems or nonconformities with our service?</span>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Choice active={hadProblem === false} onClick={() => setHadProblem(false)}>No</Choice>
                  <Choice active={hadProblem === true} onClick={() => setHadProblem(true)}>Yes</Choice>
                </div>
              </div>
              {hadProblem && (
                <label className="field"><span className="label">Please describe</span><textarea className="input" rows={2} value={f.problemDetail} onChange={(e) => set("problemDetail", e.target.value)} spellCheck /></label>
              )}
              <div className="field">
                <span className="label">If you raised a complaint, was it handled effectively?</span>
                <select className="input" value={f.complaintHandling} onChange={(e) => set("complaintHandling", e.target.value)}>
                  <option value="">— choose —</option>
                  {COMPLAINT_HANDLING.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>

              {/* Section 5 */}
              <SectionTitle n="5" title="Improvement and expectations" />
              <label className="field"><span className="label">What did we do well?</span><textarea className="input" rows={2} value={f.didWell} onChange={(e) => set("didWell", e.target.value)} spellCheck /></label>
              <label className="field"><span className="label">Areas where we can improve</span><textarea className="input" rows={2} value={f.improve} onChange={(e) => set("improve", e.target.value)} spellCheck /></label>
              <label className="field"><span className="label">Additional services you would like us to offer</span><textarea className="input" rows={2} value={f.additionalServices} onChange={(e) => set("additionalServices", e.target.value)} spellCheck /></label>

              {/* Section 6 */}
              <SectionTitle n="6" title="Overall assessment" />
              <div className="field">
                <span className="label">Overall satisfaction with our laboratory</span>
                <div style={{ marginTop: 4 }}><ScaleRow value={overall} onChange={setOverall} wide /></div>
              </div>
              <div className="grid md-2" style={{ gap: 8 }}>
                <div className="field">
                  <span className="label">Would you use our laboratory again?</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {YES_NO_UNSURE.map((o) => <Choice key={o.key} active={f.useAgain === o.key} onClick={() => set("useAgain", o.key)}>{o.label}</Choice>)}
                  </div>
                </div>
                <div className="field">
                  <span className="label">Would you recommend us to others?</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {YES_NO_UNSURE.map((o) => <Choice key={o.key} active={f.recommend === o.key} onClick={() => set("recommend", o.key)}>{o.label}</Choice>)}
                  </div>
                </div>
              </div>

              <label className="field"><span className="label">Any other comments</span><textarea className="input" rows={3} value={f.comments} onChange={(e) => set("comments", e.target.value)} spellCheck placeholder="Anything else you'd like us to know…" /></label>

              {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
              <button className="btn btn-primary" style={{ width: "100%", padding: 13 }} disabled={busy}>
                {busy ? "Sending…" : "Submit survey"}
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

function SectionTitle({ n, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
      <span style={{ background: COAL, color: GOLD, fontWeight: 900, fontSize: 12, borderRadius: 4, padding: "3px 8px" }}>Section {n}</span>
      <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 13, color: INK, letterSpacing: ".02em" }}>{title}</span>
    </div>
  );
}

// A 1..5 satisfaction selector.
function ScaleRow({ value, onChange, wide }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            title={SATISFACTION_SCALE[n - 1]}
            aria-label={`${n} — ${SATISFACTION_SCALE[n - 1]}`}
            onClick={() => onChange(n)}
            style={{
              width: wide ? 44 : 34,
              height: 34,
              borderRadius: 4,
              border: "1px solid",
              borderColor: on ? COAL : "#cfc8ba",
              background: on ? COAL : "#fff",
              color: on ? GOLD : INK,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Choice({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 4,
        border: "1px solid",
        borderColor: active ? PASS : "#cfc8ba",
        background: active ? PASS : "#fff",
        color: active ? "#fff" : INK,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
