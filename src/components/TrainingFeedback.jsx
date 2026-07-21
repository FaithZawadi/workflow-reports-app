"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, LINE } from "@/lib/theme";
import { TRAINING_CRITERIA, TRAINING_MODE_LABEL, RECOMMEND_LABEL } from "@/lib/training";
import ShareButtons from "./ShareButtons";
import TrainingFeedbackForm from "./TrainingFeedbackForm";

const Stars = ({ n }) =>
  n ? (
    <span style={{ color: GOLD, fontSize: 14, letterSpacing: 1 }} aria-label={`${n} of 5`}>
      {"★".repeat(n)}<span style={{ color: "#d9d2c4" }}>{"★".repeat(5 - n)}</span>
    </span>
  ) : (
    <span style={{ color: MUTE, fontSize: 12 }}>not rated</span>
  );

export default function TrainingFeedback() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({ count: 0, average: 0, rated: 0, recommends: 0 });
  const [err, setErr] = useState("");
  const [open, setOpen] = useState({});
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/training-feedback");
    if (!res.ok) return setErr("Could not load training feedback.");
    const d = await res.json();
    setRows(d.feedback || []);
    setStats(d.stats || { count: 0, average: 0, rated: 0, recommends: 0 });
  }, []);

  useEffect(() => { load(); }, [load]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/training-survey` : "/training-survey";
  const copyLink = () => { try { navigator.clipboard.writeText(shareUrl); } catch { /* ignore */ } };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Human Resources · QSL/HR/TFB</p>
          <h1 className="h1">Training feedback</h1>
          <p className="muted">Share the public form with participants after a training, review the responses here, and download the sheets as PDF.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
          <button className="btn btn-dark" onClick={() => { setShowForm((v) => !v); setErr(""); }} style={{ fontSize: 12 }}>
            {showForm ? "Close" : "+ Record manually"}
          </button>
        </div>
      </div>

      {/* stats + download all */}
      <div className="card" style={{ padding: 12, margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: INK }}>{stats.average ? stats.average.toFixed(1) : "—"}</div>
          <div>
            <Stars n={Math.round(stats.average)} />
            <div className="muted" style={{ fontSize: 12 }}>{stats.count} response{stats.count === 1 ? "" : "s"} · {stats.rated} rated · {stats.recommends} would recommend</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={copyLink} style={{ fontSize: 12 }}>Copy link</button>
          <a className="btn" href={shareUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Open public form ↗</a>
          <a className="btn btn-primary" href="/api/training-feedback/pdf" target="_blank" rel="noreferrer"
            style={{ fontSize: 12, textDecoration: "none", pointerEvents: stats.count ? "auto" : "none", opacity: stats.count ? 1 : 0.5 }}>
            Download all (PDF)
          </a>
        </div>
      </div>

      {/* share the form */}
      <div style={{ margin: "0 0 14px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: MUTE, marginBottom: 6 }}>Share the feedback form with participants</div>
        <ShareButtons
          subject="Qalibrated Systems — Training Feedback Form"
          message="Thank you for attending the Qalibrated Systems MMS training. Please share your feedback (about 2 minutes):"
          url={shareUrl}
        />
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      {/* manual record (same form as the public page) */}
      {showForm && (
        <TrainingFeedbackForm embedded onSubmitted={() => { setShowForm(false); load(); }} />
      )}

      {/* list */}
      {rows === null && <div className="muted">Loading feedback…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No training feedback yet. Share the public form with participants, or use “Record manually”.
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
                  {[f.organization, f.traineeRole].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>
                  {[
                    f.trainingDate ? new Date(f.trainingDate).toLocaleDateString() : null,
                    f.trainer ? "by " + f.trainer : null,
                    TRAINING_MODE_LABEL[f.mode],
                  ].filter(Boolean).join(" · ") || "—"}
                </div>

                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <tbody>
                        {TRAINING_CRITERIA.map(([k, label]) => (
                          <tr key={k}>
                            <td style={{ padding: "3px 0", color: MUTE }}>{label}</td>
                            <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>{f.criteria?.[k] ? `${f.criteria[k]}/5` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {f.recommend && <div style={{ marginTop: 8, fontSize: 12.5 }}><b style={{ color: MUTE }}>Recommend: </b>{RECOMMEND_LABEL[f.recommend]}</div>}
                    {f.didWell && <div style={{ marginTop: 4, fontSize: 12.5 }}><b style={{ color: MUTE }}>Most useful: </b>{f.didWell}</div>}
                    {f.improve && <div style={{ marginTop: 4, fontSize: 12.5 }}><b style={{ color: MUTE }}>Improve: </b>{f.improve}</div>}
                    {f.additionalSupport && <div style={{ marginTop: 4, fontSize: 12.5 }}><b style={{ color: MUTE }}>Follow-up: </b>{f.additionalSupport}</div>}
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
