"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE, COAL } from "@/lib/theme";
import { SERVICE_TYPES, SERVICE_TYPE_LABEL } from "@/lib/serviceTypes";

const Stars = ({ n }) =>
  n ? (
    <span style={{ color: GOLD, fontSize: 14, letterSpacing: 1 }} aria-label={`${n} of 5`}>
      {"★".repeat(n)}<span style={{ color: "#d9d2c4" }}>{"★".repeat(5 - n)}</span>
    </span>
  ) : (
    <span style={{ color: MUTE, fontSize: 12 }}>no rating</span>
  );

export default function ServiceFeedbackList() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({ count: 0, average: 0, rated: 0 });
  const [filter, setFilter] = useState("all");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/service-feedback?manage=1");
    if (!res.ok) return setErr("Could not load feedback.");
    const d = await res.json();
    setRows(d.feedback || []);
    setStats(d.stats || { count: 0, average: 0, rated: 0 });
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = (rows || []).filter((f) => filter === "all" || f.serviceType === filter);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/service-feedback` : "/service-feedback";

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Customer voice</p>
          <h1 className="h1">Service feedback &amp; enquiries</h1>
          <p className="muted">Feedback customers leave after a service. Share the public form link below with clients.</p>
        </div>
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
      </div>

      <div className="card" style={{ padding: 12, margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: INK }}>{stats.average ? stats.average.toFixed(1) : "—"}</div>
          <div>
            <Stars n={Math.round(stats.average)} />
            <div className="muted" style={{ fontSize: 12 }}>{stats.count} response{stats.count === 1 ? "" : "s"} · {stats.rated} rated</div>
          </div>
        </div>
        <a className="btn btn-dark" href={shareUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "none" }}>Open public form ↗</a>
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {[["all", "All"], ...SERVICE_TYPES.map((s) => [s.key, s.label])].map(([k, label]) => {
          const on = filter === k;
          return (
            <button key={k} onClick={() => setFilter(k)} className="btn" style={{ fontSize: 12, padding: "6px 10px", background: on ? COAL : "#fff", color: on ? GOLD : INK, borderColor: on ? COAL : undefined }}>{label}</button>
          );
        })}
      </div>

      {rows === null && <div className="muted">Loading…</div>}
      {rows && shown.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>No feedback yet.</div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {shown.map((f) => (
          <div key={f.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: "#fff", background: COAL, padding: "2px 8px", borderRadius: 3 }}>
                {SERVICE_TYPE_LABEL[f.serviceType] || f.serviceType}
              </span>
              <Stars n={f.rating} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: INK, marginTop: 6 }}>{f.clientName}{f.weighbridge ? ` · ${f.weighbridge}` : ""}</div>
            {f.comments && <div style={{ fontSize: 14, color: INK, marginTop: 4 }}>{f.comments}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {[f.contactName, f.contactEmail, f.contactPhone].filter(Boolean).join(" · ") || "no contact details"}
              {" · "}{new Date(f.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
