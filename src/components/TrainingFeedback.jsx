"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, COAL, PASS, LINE } from "@/lib/theme";
import { TRAINING_CRITERIA, TRAINING_SCALE, RECOMMEND, RECOMMEND_LABEL } from "@/lib/training";

const Stars = ({ n }) =>
  n ? (
    <span style={{ color: GOLD, fontSize: 14, letterSpacing: 1 }} aria-label={`${n} of 5`}>
      {"★".repeat(n)}<span style={{ color: "#d9d2c4" }}>{"★".repeat(5 - n)}</span>
    </span>
  ) : (
    <span style={{ color: MUTE, fontSize: 12 }}>not rated</span>
  );

const emptyForm = () => ({
  trainingTitle: "QSL Maintenance App Training",
  trainingDate: "",
  trainer: "",
  traineeName: "",
  traineeRole: "",
  department: "",
  criteria: {},
  overall: 0,
  didWell: "",
  improve: "",
  recommend: "",
});

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
          style={{
            width: 30, height: 30, borderRadius: 7, cursor: "pointer", fontWeight: 800, fontSize: 13,
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

export default function TrainingFeedback() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({ count: 0, average: 0, rated: 0, recommends: 0 });
  const [err, setErr] = useState("");
  const [open, setOpen] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/training-feedback");
    if (!res.ok) return setErr("Could not load training feedback.");
    const d = await res.json();
    setRows(d.feedback || []);
    setStats(d.stats || { count: 0, average: 0, rated: 0, recommends: 0 });
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCriterion = (k, v) => setForm((f) => ({ ...f, criteria: { ...f.criteria, [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setOkMsg("");
    if (!form.traineeName.trim()) return setErr("Enter the attendee's name.");
    setBusy(true);
    try {
      const res = await fetch("/api/training-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Could not save."); return; }
      setOkMsg("Feedback recorded.");
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Human Resources · QSL/HR/TFB</p>
          <h1 className="h1">Training feedback</h1>
          <p className="muted">Record each attendee&apos;s evaluation after a training, review them here, and download the sheets as PDF.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => { setShowForm((v) => !v); setErr(""); }} style={{ fontSize: 12 }}>
            {showForm ? "Close" : "+ Record feedback"}
          </button>
        </div>
      </div>

      {/* stats + download all */}
      <div className="card" style={{ padding: 12, margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: INK }}>{stats.average ? stats.average.toFixed(1) : "—"}</div>
          <div>
            <Stars n={Math.round(stats.average)} />
            <div className="muted" style={{ fontSize: 12 }}>{stats.count} record{stats.count === 1 ? "" : "s"} · {stats.rated} rated · {stats.recommends} would recommend</div>
          </div>
        </div>
        <a
          className="btn btn-primary"
          href="/api/training-feedback/pdf"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, textDecoration: "none", pointerEvents: stats.count ? "auto" : "none", opacity: stats.count ? 1 : 0.5 }}
        >
          Download all sheets (PDF)
        </a>
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
      {okMsg && <div className="card" style={{ padding: "8px 12px", marginBottom: 10, borderColor: PASS, borderLeftWidth: 5, color: INK, fontWeight: 700, fontSize: 13 }}>{okMsg}</div>}

      {/* record form */}
      {showForm && (
        <form onSubmit={submit} className="card" style={{ padding: 16, marginBottom: 16, borderColor: GOLD }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
            <label className="field" style={{ margin: 0 }}><span className="label">Training</span>
              <input className="input" value={form.trainingTitle} onChange={(e) => setField("trainingTitle", e.target.value)} /></label>
            <label className="field" style={{ margin: 0 }}><span className="label">Training date</span>
              <input className="input" type="date" value={form.trainingDate} onChange={(e) => setField("trainingDate", e.target.value)} /></label>
            <label className="field" style={{ margin: 0 }}><span className="label">Facilitator</span>
              <input className="input" value={form.trainer} onChange={(e) => setField("trainer", e.target.value)} placeholder="Trainer name" /></label>
            <label className="field" style={{ margin: 0 }}><span className="label">Attendee name *</span>
              <input className="input" value={form.traineeName} onChange={(e) => setField("traineeName", e.target.value)} placeholder="Full name" /></label>
            <label className="field" style={{ margin: 0 }}><span className="label">Role / title</span>
              <input className="input" value={form.traineeRole} onChange={(e) => setField("traineeRole", e.target.value)} /></label>
            <label className="field" style={{ margin: 0 }}><span className="label">Department</span>
              <input className="input" value={form.department} onChange={(e) => setField("department", e.target.value)} /></label>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: MUTE, margin: "14px 0 6px" }}>Evaluation · 1 = Poor … 5 = Excellent</div>
          <div style={{ display: "grid", gap: 8 }}>
            {TRAINING_CRITERIA.map(([k, label]) => (
              <div key={k} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
                <span style={{ fontSize: 13, color: INK, flex: "1 1 220px" }}>{label}</span>
                <Rating value={form.criteria[k] || 0} onChange={(v) => setCriterion(k, v)} />
              </div>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: INK, flex: "1 1 220px" }}>Overall rating of the training</span>
              <Rating value={form.overall} onChange={(v) => setField("overall", v)} />
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <label className="field" style={{ margin: 0 }}><span className="label">What was most useful</span>
              <textarea className="input" rows={3} value={form.didWell} onChange={(e) => setField("didWell", e.target.value)} /></label>
            <label className="field" style={{ margin: 0 }}><span className="label">What could be improved</span>
              <textarea className="input" rows={3} value={form.improve} onChange={(e) => setField("improve", e.target.value)} /></label>
          </div>

          <div style={{ marginTop: 10 }}>
            <span className="label">Would recommend this training?</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {RECOMMEND.map((r) => (
                <button key={r.key} type="button" onClick={() => setField("recommend", form.recommend === r.key ? "" : r.key)}
                  className="btn" style={form.recommend === r.key ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ fontSize: 13 }}>{busy ? "Saving…" : "Save feedback"}</button>
            <button className="btn" type="button" onClick={() => { setShowForm(false); setForm(emptyForm()); }} style={{ fontSize: 13 }}>Cancel</button>
          </div>
        </form>
      )}

      {/* list */}
      {rows === null && <div className="muted">Loading feedback…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No training feedback recorded yet. Use “Record feedback” to add the first one.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
        {(rows || []).map((f) => {
          const isOpen = !!open[f.id];
          return (
            <div key={f.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="stripe" style={{ height: 4 }} />
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 900, color: INK, fontSize: 15 }}>{f.traineeName}</span>
                  <Stars n={f.overall} />
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                  {f.trainingTitle}
                  {f.trainingDate ? " · " + new Date(f.trainingDate).toLocaleDateString() : ""}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>
                  {[f.traineeRole, f.department, f.trainer ? "by " + f.trainer : null].filter(Boolean).join(" · ") || "—"}
                </div>

                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <tbody>
                        {TRAINING_CRITERIA.map(([k, label]) => (
                          <tr key={k}>
                            <td style={{ padding: "3px 0", color: MUTE }}>{label}</td>
                            <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 800, color: INK }}>{f.criteria?.[k] ? `${f.criteria[k]}/5` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {f.didWell && <div style={{ marginTop: 8, fontSize: 12.5 }}><b style={{ color: MUTE }}>Most useful: </b>{f.didWell}</div>}
                    {f.improve && <div style={{ marginTop: 4, fontSize: 12.5 }}><b style={{ color: MUTE }}>Improve: </b>{f.improve}</div>}
                    {f.recommend && <div style={{ marginTop: 4, fontSize: 12.5 }}><b style={{ color: MUTE }}>Recommend: </b>{RECOMMEND_LABEL[f.recommend]}</div>}
                    {f.recordedByName && <div style={{ marginTop: 6, fontSize: 11, color: MUTE }}>Recorded by {f.recordedByName}</div>}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))} style={{ fontSize: 12 }}>
                    {isOpen ? "Hide" : "View"}
                  </button>
                  <a className="btn btn-dark" href={`/api/training-feedback/${f.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>
                    PDF sheet
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
