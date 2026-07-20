"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, COAL, PASS, FAIL } from "@/lib/theme";
import {
  SURVEY_SERVICE_LABEL,
  SURVEY_CRITERIA,
  COMPLAINT_HANDLING_LABEL,
} from "@/lib/survey";

const Stars = ({ n }) =>
  n ? (
    <span style={{ color: GOLD, fontSize: 14, letterSpacing: 1 }} aria-label={`${n} of 5`}>
      {"★".repeat(n)}<span style={{ color: "#d9d2c4" }}>{"★".repeat(5 - n)}</span>
    </span>
  ) : (
    <span style={{ color: MUTE, fontSize: 12 }}>not rated</span>
  );

const YN_LABEL = { YES: "Yes", NO: "No", NOT_SURE: "Not sure" };

export default function ServiceFeedbackList() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({ count: 0, average: 0, rated: 0, recommends: 0 });
  const [err, setErr] = useState("");
  const [open, setOpen] = useState({});

  const load = useCallback(async () => {
    const res = await fetch("/api/service-feedback?manage=1");
    if (!res.ok) return setErr("Could not load feedback.");
    const d = await res.json();
    setRows(d.feedback || []);
    setStats(d.stats || { count: 0, average: 0, rated: 0, recommends: 0 });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/service-feedback` : "/service-feedback";
  const copyLink = () => { try { navigator.clipboard.writeText(shareUrl); } catch { /* ignore */ } };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Customer voice · QSL/QP/004/CSSF</p>
          <h1 className="h1">Customer satisfaction surveys</h1>
          <p className="muted">Surveys customers complete after a calibration. Share the public link below with clients.</p>
        </div>
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
      </div>

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
          <a className="btn btn-dark" href={shareUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Open public form ↗</a>
        </div>
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      {rows === null && <div className="muted">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>No surveys yet.</div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {(rows || []).map((f) => {
          const types = Array.isArray(f.serviceTypes) ? f.serviceTypes : [];
          const isOpen = open[f.id];
          const criteria = f.criteria || {};
          const criteriaCount = Object.keys(criteria).length;
          return (
            <div key={f.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {types.length ? types.map((t) => (
                    <span key={t} style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".02em", color: "#fff", background: COAL, padding: "2px 7px", borderRadius: 3 }}>
                      {SURVEY_SERVICE_LABEL[t] || t}
                    </span>
                  )) : <span className="muted" style={{ fontSize: 12 }}>no service type</span>}
                </div>
                <Stars n={f.overall || f.rating} />
              </div>

              <div style={{ fontWeight: 800, fontSize: 15, color: INK, marginTop: 6 }}>{f.clientName}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                {f.recommend && <Badge on={f.recommend === "YES"} off={f.recommend === "NO"}>Recommend: {YN_LABEL[f.recommend]}</Badge>}
                {f.useAgain && <Badge on={f.useAgain === "YES"} off={f.useAgain === "NO"}>Use again: {YN_LABEL[f.useAgain]}</Badge>}
                {f.hadProblem === true && <Badge off>Reported a problem</Badge>}
              </div>

              {f.comments && <div style={{ fontSize: 14, color: INK, marginTop: 6 }}>{f.comments}</div>}

              {(criteriaCount > 0 || f.didWell || f.improve || f.additionalServices || f.problemDetail) && (
                <button onClick={() => setOpen((s) => ({ ...s, [f.id]: !s[f.id] }))} style={{ background: "none", border: 0, color: GOLD, fontWeight: 700, fontSize: 12.5, marginTop: 8, cursor: "pointer", padding: 0 }}>
                  {isOpen ? "Hide details ▲" : "Show full survey ▼"}
                </button>
              )}

              {isOpen && (
                <div style={{ marginTop: 8, borderTop: "1px solid #eae4d6", paddingTop: 8 }}>
                  {criteriaCount > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: MUTE, marginBottom: 4 }}>Service evaluation</div>
                      <div style={{ display: "grid", gap: 3 }}>
                        {SURVEY_CRITERIA.filter(([k]) => criteria[k]).map(([k, label]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                            <span style={{ color: INK }}><b style={{ color: MUTE }}>{k}</b> {label}</span>
                            <b style={{ color: criteria[k] >= 4 ? PASS : criteria[k] <= 2 ? FAIL : INK }}>{criteria[k]}/5</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {f.hadProblem && f.problemDetail && <Field label="Problem described">{f.problemDetail}</Field>}
                  {f.complaintHandling && <Field label="Complaint handling">{COMPLAINT_HANDLING_LABEL[f.complaintHandling] || f.complaintHandling}</Field>}
                  {f.didWell && <Field label="What we did well">{f.didWell}</Field>}
                  {f.improve && <Field label="Areas to improve">{f.improve}</Field>}
                  {f.additionalServices && <Field label="Additional services wanted">{f.additionalServices}</Field>}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {[f.contactName, f.contactEmail, f.contactPhone].filter(Boolean).join(" · ") || "no contact details"}
                  {" · "}{new Date(f.createdAt).toLocaleString()}
                </div>
                <a className="btn" href={`/api/service-feedback/${f.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>PDF</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ on, off, children }) {
  const color = on ? PASS : off ? FAIL : MUTE;
  return <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, padding: "2px 7px", borderRadius: 3 }}>{children}</span>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: MUTE }}>{label}</div>
      <div style={{ fontSize: 13.5, color: INK }}>{children}</div>
    </div>
  );
}
