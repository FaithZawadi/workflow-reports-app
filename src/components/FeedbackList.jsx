"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLD, INK, MUTE } from "@/lib/theme";

const Stars = ({ n }) => (
  <span style={{ color: GOLD, fontSize: 15, letterSpacing: 1 }} aria-label={`${n} of 5`}>
    {"★".repeat(n)}<span style={{ color: "#d9d2c4" }}>{"★".repeat(5 - n)}</span>
  </span>
);

export default function FeedbackList() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({ count: 0, average: 0 });
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/feedback?manage=1");
    if (!res.ok) return setErr("Could not load feedback.");
    const d = await res.json();
    setRows(d.feedback || []);
    setStats(d.stats || { count: 0, average: 0 });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="h1">App feedback &amp; reviews</h1>
          <p className="muted">Ratings and comments left by staff from the in-app prompt.</p>
        </div>
        <button className="btn" onClick={load} style={{ fontSize: 12 }}>Refresh</button>
      </div>

      {err && <div className="err" style={{ margin: "10px 0" }}>{err}</div>}

      {stats.count > 0 && (
        <div className="card" style={{ padding: 14, margin: "12px 0", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: INK }}>{stats.average.toFixed(1)}</div>
          <div>
            <Stars n={Math.round(stats.average)} />
            <div className="muted" style={{ fontSize: 12 }}>average from {stats.count} response{stats.count > 1 ? "s" : ""}</div>
          </div>
        </div>
      )}

      {rows === null && <div className="muted">Loading feedback…</div>}
      {rows && rows.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No feedback yet. Staff are prompted to rate the app from time to time.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
        {(rows || []).map((f) => (
          <div key={f.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Stars n={f.rating} />
              <span className="muted" style={{ fontSize: 12 }}>{new Date(f.createdAt).toLocaleString()}</span>
            </div>
            {f.comment && <div style={{ fontSize: 14, color: INK, marginTop: 6 }}>{f.comment}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {f.userName}{f.userEmail ? ` · ${f.userEmail}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
