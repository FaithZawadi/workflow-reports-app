"use client";
import { useCallback, useEffect, useState } from "react";
import { COAL, GOLD, INK, MUTE, LINE, PASS, FAIL, WAIT } from "@/lib/theme";

const ACTION_COLOR = {
  CREATE: PASS,
  UPDATE: WAIT,
  APPROVE: PASS,
  REJECT: FAIL,
  DELETE: FAIL,
};

const ENTITIES = [
  ["all", "All"],
  ["USER", "Users"],
  ["REPORT", "Reports"],
  ["SCHEDULE", "Schedules"],
  ["WEIGHBRIDGE", "Weighbridges"],
];

export default function AuditLog() {
  const [logs, setLogs] = useState(null);
  const [entity, setEntity] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (entity !== "all") params.set("entity", entity);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch("/api/audit?" + params.toString());
    const d = await res.json();
    setLogs(d.logs || []);
  }, [entity, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div style={{ marginTop: 12 }}>
        <p className="eyebrow">Administration</p>
        <h1 className="h1">Audit log</h1>
        <p className="muted">Every create, update, approval and deletion across users, reports and schedules.</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
        {ENTITIES.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setEntity(k)}
            className="btn"
            style={entity === k ? { background: COAL, color: GOLD, borderColor: COAL, fontSize: 12 } : { fontSize: 12 }}
          >
            {l}
          </button>
        ))}
      </div>

      <input
        className="input"
        placeholder="Search by person, summary or record id…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {logs === null && <div className="muted">Loading audit log…</div>}
      {logs && logs.length === 0 && (
        <div className="card" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", color: MUTE }}>
          No audit entries match.
        </div>
      )}

      {logs && logs.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640, border: `1px solid ${LINE}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px 96px 88px 1fr", background: COAL, color: "#fff", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
              <span style={{ padding: "6px 10px", borderRight: "1px solid #2c2720" }}>When</span>
              <span style={{ padding: "6px 10px", borderRight: "1px solid #2c2720" }}>Action</span>
              <span style={{ padding: "6px 10px", borderRight: "1px solid #2c2720" }}>Type</span>
              <span style={{ padding: "6px 10px" }}>Details</span>
            </div>
            {logs.map((l) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "150px 96px 88px 1fr", fontSize: 13, borderTop: `1px solid ${LINE}` }}>
                <span style={{ padding: "8px 10px", borderRight: `1px solid ${LINE}`, color: MUTE, fontSize: 12 }}>
                  {new Date(l.at).toLocaleString()}
                </span>
                <span style={{ padding: "8px 10px", borderRight: `1px solid ${LINE}` }}>
                  <span style={{ fontWeight: 800, fontSize: 11, color: "#fff", background: ACTION_COLOR[l.action] || MUTE, padding: "2px 6px", borderRadius: 3 }}>
                    {l.action}
                  </span>
                </span>
                <span style={{ padding: "8px 10px", borderRight: `1px solid ${LINE}`, color: INK, fontWeight: 700, fontSize: 12 }}>{l.entity}</span>
                <span style={{ padding: "8px 10px", color: INK }}>
                  {l.summary}
                  <span style={{ display: "block", color: MUTE, fontSize: 11, marginTop: 2 }}>
                    by {l.actorName}{l.actorRole ? ` (${l.actorRole})` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
